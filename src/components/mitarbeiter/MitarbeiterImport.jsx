import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

const KATEGORIEN_MAP = {
  'pflege': 'pflege', 'Pflege': 'pflege',
  'nachtwache': 'nachtwache', 'Nachtwache': 'nachtwache',
  'pflegedienstleitung': 'pflegedienstleitung', 'Pflegedienstleitung': 'pflegedienstleitung', 'PDL': 'pflegedienstleitung',
  'leitung': 'leitung', 'Leitung': 'leitung',
  'betreuung_43b': 'betreuung_43b', 'Betreuung §43b': 'betreuung_43b', '43b': 'betreuung_43b',
  'gfb': 'gfb', 'GfB': 'gfb', 'GFB': 'gfb',
  'sonstiges': 'sonstiges', 'Sonstiges': 'sonstiges',
  'azubi': 'azubi', 'Azubi': 'azubi',
};

// Auto-Klassifikation wie auf der Mitarbeiter-Seite
const PFK_KEYWORDS = ['pflegefachkraft', 'fachkraft', 'gesundheits- und krankenpfleger', 'gesundheits- und krankenpflegerin', 'examinierte', 'altenpfleger', 'altenpflegerin', 'pflegefachmann', 'pflegefachfrau', 'krankenpfleger', 'krankenpflegerin', 'exami', 'pflegedienstleitung', 'pdl', 'stationsleitung', 'wohnbereichsleitung', 'wbl'];
const PHK_MIT_KEYWORDS = ['altenpflegehelfer', 'altenpflegehelferin', 'pflegehelfer', 'pflegehelferin', 'gesundheits- und krankenpflegehelfer', 'pflegeassistent', 'pflegeassistenz'];
const PHK_OHNE_KEYWORDS = ['pflegehilfskraft', 'betreuungskraft', '43b', 'alltagsbegleiter', 'hauswirtschaft', 'reinigung', 'küche', 'koch'];

function classifyFunktion(funktion) {
  const b = (funktion || '').toLowerCase().trim();
  if (!b) return null;
  if (PFK_KEYWORDS.some(k => b.includes(k))) return 'pfk';
  if (PHK_MIT_KEYWORDS.some(k => b.includes(k))) return 'phk_mit';
  if (PHK_OHNE_KEYWORDS.some(k => b.includes(k))) return 'phk_ohne';
  return null;
}

function kategorieFromFunktion(funktion) {
  const b = (funktion || '').toLowerCase().trim();
  if (!b) return 'pflege';
  if (b.includes('verwaltung') || b.includes('verwaltungs') || b.includes('büro') || b.includes('sekretär') || b.includes('empfang')) return 'verwaltung';
  if (b.includes('reinigung') || b.includes('hauswirtschaft') || b.includes('küche') || b.includes('koch')) return 'kueche_reinigung';
  if (b.includes('nachtwache') || b.includes('nacht')) return 'nachtwache';
  if (b.includes('pflegedienstleitung') || b.includes('pdl')) return 'pflegedienstleitung';
  if (b.includes('leitung')) return 'leitung';
  if (b.includes('betreuung') || b.includes('43b')) return 'betreuung_43b';
  if (b.includes('azubi') || b.includes('auszubildende')) return 'azubi';
  return 'pflege';
}

function detectMedifoxListType(fileName) {
  const n = (fileName || '').toLowerCase();
  if (n.includes('komprimiert') || n.includes('mitarbeiterliste')) return 'komprimiert';
  if (n.includes('ls')) return 'ls';
  if (n.includes('sma')) return 'sma';
  return 'komprimiert';
}

export default function MitarbeiterImport({ einrichtungId, wohnbereiche, mode = 'datev', onClose, onSuccess }) {
  const fileRef = useRef();
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [detectedCols, setDetectedCols] = useState(null);
  const [listType, setListType] = useState(null);

  const isDatev = mode === 'datev';
  const titleColor = isDatev ? 'text-teal-700' : 'text-blue-700';
  const accentColor = isDatev ? 'teal' : 'blue';

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const detectedListType = !isDatev ? detectMedifoxListType(file.name) : null;
    if (detectedListType === 'sma') {
      setErrors(['SMA-Listen werden beim Import ignoriert.']);
      setLoading(false);
      return;
    }
    setListType(detectedListType);
    setLoading(true);
    setErrors([]);
    setRows([]);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const resp = await base44.functions.invoke('parseMitarbeiterExcel', { file_url, mode });
    const result = resp.data;
    if (!result?.success) {
      setErrors([`Fehler beim Lesen der Datei: ${result?.error || 'Unbekannter Fehler'}`]);
      setLoading(false);
      return;
    }

    const rawRows = Array.isArray(result.rows) ? result.rows : [];
    setDetectedCols(result.detectedColumns || null);

    // Bestehende Mitarbeiter laden (Abgleich über Personalnummer ODER Name)
    const existing = await base44.entities.Mitarbeiter.filter({ einrichtung_id: einrichtungId });
    const existingByPnr = {};
    const existingByName = {};
    existing.forEach(m => {
      const pnr = String(m.personalnummer || '').trim();
      const nm = String(m.name || '').trim().toLowerCase();
      if (pnr) existingByPnr[pnr] = m;
      if (nm) existingByName[nm] = m;
    });

    // Wohnbereich-Map für MediFox-Import (Match by name like "WB 1")
    const wohnbereichMap = {};
    (wohnbereiche || []).forEach(wb => {
      const nm = String(wb.name || '').trim().toLowerCase();
      if (nm) wohnbereichMap[nm] = wb.id;
    });

    // Nach Personalnummer (DATEV) bzw. Name (MediFox) deduplizieren
    const byKey = {};
    rawRows.forEach(r => {
      const pnr = String(r.personalnummer || '').trim();
      const name = String(r.name || '').trim();
      if (!name && !pnr) return;
      const key = pnr || `__noPnr_${name.toLowerCase()}`;
      if (!byKey[key]) {
        byKey[key] = {
          name,
          personalnummer: pnr,
          wochenstunden: Number(r.wochenstunden) || 0,
          stellenumfang_prozent: Number(r.stellenumfang_prozent) || 0,
          tarifgruppe: String(r.tarifgruppe || '').trim(),
          tarifstufe: String(r.tarifstufe || '').trim(),
          monatsstunden_gfb: Number(r.monatsstunden_gfb) || 0,
          tarif: String(r.tarif || '').trim(),
          monatsgehalt_brutto: Number(r.monatsgehalt_brutto) || 0,
          sv_ag_anteil: Number(r.sv_ag_anteil) || 0,
          funktionszulagen: Number(r.funktionszulagen) || 0,
          zuschlaege_steuerfrei: Number(r.zuschlaege_steuerfrei) || 0,
          funktion: String(r.funktion || '').trim(),
          beruf: String(r.beruf || '').trim(),
          wohnbereich_name: String(r.wohnbereich || '').trim(),
          eintrittsdatum: String(r.eintrittsdatum || '').trim(),
          befristet_bis: String(r.befristet_bis || '').trim(),
        };
      }
    });

    const parsed = Object.values(byKey).map(r => {
      const gfbStd = Number(r.monatsstunden_gfb) || 0;
      const stellenumfang = Number(r.stellenumfang_prozent) || 0;
      const vk = stellenumfang > 0
        ? Math.round((stellenumfang / 100) * 100) / 100
        : gfbStd > 0
          ? Math.round((gfbStd / 173.33) * 100) / 100
          : (r.wochenstunden > 0 ? Math.round((r.wochenstunden / 40) * 100) / 100 : 0);

      // Matching: erst über PNR, dann über Name (für Listen mit abweichenden PNRs)
      let existingRec = null;
      if (r.personalnummer && existingByPnr[r.personalnummer]) {
        existingRec = existingByPnr[r.personalnummer];
      } else if (r.name) {
        const nameKey = r.name.toLowerCase();
        if (existingByName[nameKey]) existingRec = existingByName[nameKey];
      }

      // MediFox: Qualifikation (beruf) hat Vorrang vor Funktion → bessere VK-Klassifikation
      const berufsbezeichnung = !isDatev ? (r.beruf || r.funktion || '') : (r.beruf || '');
      const wohnbereich_id = !isDatev && r.wohnbereich_name ? (wohnbereichMap[r.wohnbereich_name.toLowerCase()] || '') : '';

      let vkFields = { vk_pfk: 0, vk_phk_mit_ausbildung: 0, vk_phk_ohne_ausbildung: 0 };
      if (!isDatev && berufsbezeichnung) {
        const typ = classifyFunktion(berufsbezeichnung);
        if (typ === 'pfk') vkFields.vk_pfk = vk;
        else if (typ === 'phk_mit') vkFields.vk_phk_mit_ausbildung = vk;
        else if (typ === 'phk_ohne') vkFields.vk_phk_ohne_ausbildung = vk;
      }

      return {
        ...r,
        berufsbezeichnung,
        wohnbereich_id,
        ...vkFields,
        monatsstunden_gfb: gfbStd,
        stellenumfang_prozent: stellenumfang,
        vk_anteil: vk,
        kategorie: !isDatev && berufsbezeichnung ? kategorieFromFunktion(berufsbezeichnung) : 'pflege',
        aktiv: true,
        einrichtung_id: einrichtungId,
        exists: !!existingRec,
        existing_id: existingRec?.id || null,
        _selected: true,
      };
    });

    const errs = [];
    parsed.forEach((r, i) => {
      if (!r.name) errs.push(`Eintrag ${i + 1}: Name fehlt`);
    });

    setErrors(errs);
    setRows(parsed);
    setLoading(false);
  };

  const toggleRow = (i) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, _selected: !r._selected } : r));
  };

  const toggleAll = () => {
    const allSelected = rows.filter(r => r.name).every(r => r._selected);
    setRows(prev => prev.map(r => ({ ...r, _selected: r.name ? !allSelected : r._selected })));
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const valid = rows.filter(r => r.name && r._selected);
      const toCreate = valid.filter(r => !r.exists).map(({ exists, existing_id, beruf, wohnbereich_name, _selected, ...rest }) => {
        const stelle = Number(rest.stellenumfang_prozent) || 0;
        rest.vk_anteil = stelle > 0
          ? Math.round((stelle / 100) * 100) / 100
          : rest.monatsstunden_gfb > 0
            ? Math.round((rest.monatsstunden_gfb / 173.33) * 100) / 100
            : (rest.wochenstunden > 0 ? Math.round((rest.wochenstunden / 40) * 100) / 100 : 0);
        if (rest.monatsstunden_gfb > 0) {
          rest.ist_gfb = true;
        } else {
          rest.monatsstunden_gfb = 0;
          rest.ist_gfb = false;
        }
        return rest;
      });
      const toUpdateRaw = valid.filter(r => r.exists && r.existing_id).map(({ _selected, ...r }) => {
        const update = { id: r.existing_id };

        if (isDatev) {
          // DATEV: alle Felder
          if (r.wochenstunden) update.wochenstunden = r.wochenstunden;
          if (r.monatsstunden_gfb > 0) {
            update.vk_anteil = Math.round((r.monatsstunden_gfb / 173.33) * 100) / 100;
          } else if (r.wochenstunden) {
            update.vk_anteil = r.wochenstunden > 0 ? Math.round((r.wochenstunden / 40) * 100) / 100 : 0;
          }
          if (r.tarifgruppe) update.tarifgruppe = r.tarifgruppe;
          if (r.tarifstufe) update.tarifstufe = r.tarifstufe;
          update.ist_gfb = r.monatsstunden_gfb > 0;
          update.monatsstunden_gfb = r.monatsstunden_gfb > 0 ? r.monatsstunden_gfb : 0;
          if (r.monatsgehalt_brutto) update.monatsgehalt_brutto = Math.round(r.monatsgehalt_brutto * 100) / 100;
          if (r.sv_ag_anteil) update.sv_ag_anteil = Math.round(r.sv_ag_anteil * 100) / 100;
          if (r.funktionszulagen) update.funktionszulagen = Math.round(r.funktionszulagen * 100) / 100;
          if (r.zuschlaege_steuerfrei) update.zuschlaege_steuerfrei = Math.round(r.zuschlaege_steuerfrei * 100) / 100;
        } else if (listType === 'ls') {
          // LS: Personalnummer, Bruttogehalt, Tarifgruppe, Tarifstufe
          if (r.personalnummer) update.personalnummer = r.personalnummer;
          if (r.monatsgehalt_brutto) update.monatsgehalt_brutto = Math.round(r.monatsgehalt_brutto * 100) / 100;
          if (r.tarifgruppe) update.tarifgruppe = r.tarifgruppe;
          if (r.tarifstufe) update.tarifstufe = r.tarifstufe;
        } else {
          // Komprimiert (default): nur Stammdaten
          if (r.berufsbezeichnung) {
            update.berufsbezeichnung = r.berufsbezeichnung;
            update.kategorie = r.kategorie;
            update.vk_pfk = r.vk_pfk || 0;
            update.vk_phk_mit_ausbildung = r.vk_phk_mit_ausbildung || 0;
            update.vk_phk_ohne_ausbildung = r.vk_phk_ohne_ausbildung || 0;
          }
          if (r.funktion) update.funktion = r.funktion;
          if (r.wohnbereich_id) update.wohnbereich_id = r.wohnbereich_id;
          if (r.wochenstunden) update.wochenstunden = r.wochenstunden;
          if (r.monatsstunden_gfb > 0) {
            update.monatsstunden_gfb = r.monatsstunden_gfb;
            update.ist_gfb = true;
          }
          const stelle = Number(r.stellenumfang_prozent) || 0;
          if (stelle > 0) {
            update.vk_anteil = Math.round((stelle / 100) * 100) / 100;
          } else if (r.monatsstunden_gfb > 0) {
            update.vk_anteil = Math.round((r.monatsstunden_gfb / 173.33) * 100) / 100;
          } else if (r.wochenstunden > 0) {
            update.vk_anteil = Math.round((r.wochenstunden / 40) * 100) / 100;
          }
          if (r.eintrittsdatum) update.eintrittsdatum = r.eintrittsdatum;
          if (r.befristet_bis) update.befristet_bis = r.befristet_bis;
        }
        return update;
      });
      // Duplikate ausschließen: mehrere Zeilen können denselben Mitarbeiter matchen
      const seenIds = new Set();
      const toUpdate = toUpdateRaw.filter(u => {
        if (seenIds.has(u.id)) return false;
        seenIds.add(u.id);
        return true;
      });

      let created = 0, updated = 0;
      if (toCreate.length > 0) {
        await base44.entities.Mitarbeiter.bulkCreate(toCreate);
        created = toCreate.length;
      }
      if (toUpdate.length > 0) {
        await base44.entities.Mitarbeiter.bulkUpdate(toUpdate);
        updated = toUpdate.length;
      }

      setImportResult({ created, updated, count: created + updated });
      setDone(true);
      onSuccess();
    } catch (err) {
      alert('Import fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'Personalnummer,Name,Wochenstunden,Tarif,Tarifgruppe,Tarifstufe,Monatsstunden GFB\n952248,Bösel,35,N07,P3,3,';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Mitarbeiter_Vorlage.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className={`font-bold text-lg ${titleColor}`}>
              {isDatev ? 'DATEV Import' : 'MediFox Import'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isDatev
                ? 'Entgeltübersicht mit Gehalt, SV-Anteilen und Zulagen'
                : listType === 'ls'
                  ? 'LS-Liste: Bruttogehalt, Tarifgruppe, Tarifstufe'
                  : listType === 'komprimiert'
                    ? 'Komprimiert: Stammdaten (Funktion, Qualifikation, Stunden, VK)'
                    : 'Mitarbeiterliste mit Funktion, Wohnbereich und Auto-Klassifikation'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!done ? (
            <>
              {/* Upload Zone */}
              {rows.length === 0 && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-8 h-8 text-teal-500 mx-auto mb-2 animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    )}
                    <p className="font-medium text-slate-700">
                      {loading ? 'Datei wird verarbeitet...' : isDatev ? 'DATEV Entgeltübersicht hier ablegen' : 'MediFox Mitarbeiterliste hier ablegen'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">.xlsx, .xls oder .csv</p>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                  </div>
                  <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-teal-600 hover:underline">
                    <Download className="w-4 h-4" /> Vorlage herunterladen (CSV)
                  </button>
                </div>
              )}

              {/* Fehler */}
              {errors.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700 mb-1">Warnungen:</p>
                  {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}

              {/* Vorschau */}
              {rows.length > 0 && (
                <div className="mt-4">
                  {detectedCols && isDatev && (() => {
                    const missing = ['wochenstunden','tarif','tarifstufe','monatsgehalt_brutto','sv_ag_anteil','funktionszulagen']
                      .filter(k => detectedCols[k] === undefined);
                    if (missing.length === 0) return null;
                    return (
                      <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-amber-800 mb-1">⚠ Nicht alle Spalten wurden erkannt:</p>
                        <p className="text-xs text-amber-700">
                          Fehlend: {missing.map(k => k === 'monatsgehalt_brutto' ? 'Brutto' : k === 'sv_ag_anteil' ? 'SV-AG' : k === 'funktionszulagen' ? 'Zulagen' : k === 'tarif' ? 'Tarifgruppe' : k === 'tarifstufe' ? 'Tarifstufe' : k === 'wochenstunden' ? 'Wochenstunden' : k).join(', ')}
                        </p>
                        <p className="text-[11px] text-amber-600 mt-1">Erkannt: {Object.keys(detectedCols).join(', ') || 'keine'}</p>
                      </div>
                    );
                  })()}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">
                      Vorschau: <span className="text-teal-600">{rows.filter(r => r.name && r._selected).length}</span> von {rows.filter(r => r.name).length} Mitarbeitern ausgewählt
                    </p>
                    <button onClick={toggleAll} className="text-xs text-teal-600 hover:underline font-medium">
                      {rows.filter(r => r.name).every(r => r._selected) ? 'Alle abwählen' : 'Alle auswählen'}
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="px-3 py-2 w-8"><input type="checkbox" checked={rows.filter(r => r.name).every(r => r._selected)} onChange={toggleAll} className="rounded border-slate-300" /></th>
                          <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                          <th className="px-3 py-2 font-medium text-slate-600">PNR</th>
                          {!isDatev && <th className="px-3 py-2 font-medium text-slate-600">Funktion</th>}
                          {!isDatev && <th className="px-3 py-2 font-medium text-slate-600">Wohnbereich</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600">Tarifgruppe</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600">Tarifstufe</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600">Std/Wo</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600">VK</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600">GfB-Std</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600 text-right">Brutto</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600 text-right">SV-AG</th>}
                          {isDatev && <th className="px-3 py-2 font-medium text-slate-600 text-right">Zulagen</th>}
                          <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map((r, i) => (
                          <tr key={i} className={`${!r.name ? 'bg-red-50' : r._selected ? 'hover:bg-slate-50/50' : 'opacity-40 bg-slate-50'}`}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={!!r._selected} disabled={!r.name} onChange={() => toggleRow(i)} className="rounded border-slate-300" />
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{r.name || <span className="text-red-500">fehlt</span>}</td>
                            <td className="px-3 py-2 text-slate-500">{r.personalnummer || '—'}</td>
                            {!isDatev && <td className="px-3 py-2 text-slate-600">{r.berufsbezeichnung || '—'}</td>}
                            {!isDatev && <td className="px-3 py-2 text-slate-500">{r.wohnbereich_name || '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-slate-500">{r.tarifgruppe || '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-slate-500">{r.tarifstufe || '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-slate-500">{r.wochenstunden || '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-slate-500">{r.vk_anteil?.toFixed(2) || '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-slate-500">{r.monatsstunden_gfb > 0 ? r.monatsstunden_gfb : '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-right text-slate-700">{r.monatsgehalt_brutto ? r.monatsgehalt_brutto.toFixed(2) : '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-right text-slate-700">{r.sv_ag_anteil ? r.sv_ag_anteil.toFixed(2) : '—'}</td>}
                            {isDatev && <td className="px-3 py-2 text-right text-slate-700">{r.funktionszulagen ? r.funktionszulagen.toFixed(2) : '—'}</td>}
                            <td className="px-3 py-2">
                              {r.name
                                ? (r.exists
                                  ? <span className="text-amber-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Update</span>
                                  : <span className="text-teal-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Neu</span>)
                                : <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Fehler</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-teal-500 mx-auto mb-4" />
              <p className="text-xl font-bold text-slate-900">{importResult?.count} Mitarbeiter verarbeitet</p>
              <p className="text-slate-400 text-sm mt-1">
                {importResult?.created || 0} neu · {importResult?.updated || 0} aktualisiert
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            {done ? 'Schließen' : 'Abbrechen'}
          </button>
          {!done && rows.filter(r => r.name).length > 0 && (
            <button onClick={doImport} disabled={importing || rows.filter(r => r.name && r._selected).length === 0}
              className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importiere...' : `${rows.filter(r => r.name && r._selected).length} Mitarbeiter verarbeiten`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}