import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle, AlertCircle, Loader2, X, Copy, FileSpreadsheet } from 'lucide-react';
import { categorizeSachkonto, computeBuchungsschluessel, formatEUR, formatDateDE, round2 } from '@/lib/sachkostenUtils';

export default function SachkostenImport({ einrichtungId, kategorien, onClose, onSuccess }) {
  const [stage, setStage] = useState('upload');
  const [parsedRows, setParsedRows] = useState([]);
  const [zuordnungen, setZuordnungen] = useState([]);
  const [betragstyp, setBetragstyp] = useState('netto');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    base44.entities.SachkontoZuordnungen.filter({ aktiv: true }).then(setZuordnungen).catch(() => {});
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setStage('parsing');
    setError('');
    try {
      const upload = await base44.integrations.Core.UploadFile({ file });
      const resp = await base44.functions.invoke('parseSachkostenExcel', { file_url: upload.file_url });
      const result = resp.data;
      if (!result?.success || !result.rows?.length) {
        setError('Keine Daten in der Excel-Datei gefunden.');
        setStage('error');
        return;
      }

      // Bestehende Ausgaben für Duplikatserkennung laden
      const monate = [...new Set(result.rows.map(r => r.leistungsmonat).filter(Boolean))];
      const existing = [];
      for (const m of monate) {
        const data = await base44.entities.SachkostenAusgaben.filter({ einrichtung_id: einrichtungId, leistungsmonat: m });
        existing.push(...data);
      }
      const existingKeys = new Set(existing.map(a => a.buchungsschluessel).filter(Boolean));

      // Auto-Kategorisierung + Duplikatserkennung
      const processed = result.rows.map(row => {
        const katId = categorizeSachkonto(row.sachkonto, zuordnungen);
        const schluessel = computeBuchungsschluessel(row);
        return {
          ...row,
          kategorie_id: katId,
          zuordnungsstatus: katId ? 'zugeordnet' : 'offen',
          buchungsschluessel: schluessel,
          isDuplicate: existingKeys.has(schluessel),
        };
      });

      setParsedRows(processed);
      setStage('preview');
    } catch (err) {
      setError(err.message || 'Fehler beim Verarbeiten der Datei');
      setStage('error');
    }
    e.target.value = '';
  };

  const confirmImport = async () => {
    setStage('importing');
    try {
      const user = await base44.auth.me();
      const importId = crypto.randomUUID();
      const importdatum = new Date().toISOString().split('T')[0];
      const toImport = parsedRows.filter(r => !r.isDuplicate);
      const duplikate = parsedRows.filter(r => r.isDuplicate);

      const records = toImport.map(r => ({
        buchungsdatum: r.buchungsdatum,
        leistungsmonat: r.leistungsmonat,
        belegnummer: r.belegnummer || '',
        lieferant: r.lieferant || '',
        sachkonto: r.sachkonto || '',
        kostenstelle: r.kostenstelle || '',
        buchungstext: r.buchungstext || '',
        nettobetrag: r.nettobetrag || 0,
        bruttobetrag: r.bruttobetrag || 0,
        verwendeter_betrag: betragstyp === 'netto' ? r.nettobetrag : r.bruttobetrag,
        kategorie_id: r.kategorie_id || '',
        einrichtung_id: einrichtungId,
        import_vorgang_id: importId,
        buchungsschluessel: r.buchungsschluessel,
        zuordnungsstatus: r.zuordnungsstatus,
        ist_storniert: false,
      }));

      if (records.length > 0) await base44.entities.SachkostenAusgaben.bulkCreate(records);

      const gesamtsumme = round2(records.reduce((s, r) => s + r.verwendeter_betrag, 0));
      const leistungsmonate = [...new Set(records.map(r => r.leistungsmonat).filter(Boolean))].join(', ');

      await base44.entities.SachkostenImporte.create({
        dateiname: fileName,
        importdatum,
        leistungsmonat: leistungsmonate,
        benutzer: user?.email || '',
        anzahl_zeilen: parsedRows.length,
        anzahl_importiert: records.length,
        anzahl_duplikate: duplikate.length,
        anzahl_fehler: 0,
        gesamtsumme,
        status: 'abgeschlossen',
        fehlerprotokoll: '',
      });

      setImportResult({ imported: records.length, duplicates: duplikate.length, sum: gesamtsumme });
      setStage('done');
    } catch (err) {
      setError(err.message || 'Fehler beim Import');
      setStage('error');
    }
  };

  const katName = (id) => kategorien.find(k => k.id === id)?.name || '—';
  const zugeordnet = parsedRows.filter(r => r.kategorie_id);
  const offen = parsedRows.filter(r => !r.kategorie_id);
  const duplikate = parsedRows.filter(r => r.isDuplicate);
  const importierbar = parsedRows.filter(r => !r.isDuplicate);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Ausgaben importieren</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {stage === 'upload' && (
            <div className="flex flex-col items-center py-12">
              <button onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-2xl p-12 hover:border-teal-400 hover:bg-teal-50/50 transition-all">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Excel-Datei auswählen</p>
                <p className="text-xs text-slate-400 mt-1">Unterstützt: .xlsx, .xls</p>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 max-w-md">
                <p className="font-semibold mb-1">Erwartete Spalten:</p>
                <p>Buchungsdatum · Leistungsmonat · Belegnummer · Lieferant · Sachkonto · Kostenstelle · Buchungstext · Nettobetrag · Bruttobetrag</p>
                <p className="mt-1 text-blue-500">Auch ERP-Kontoblätter mit „Datum" und „Umsatz Soll" werden erkannt.</p>
              </div>
            </div>
          )}

          {stage === 'parsing' && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Datei wird verarbeitet…</p>
            </div>
          )}

          {stage === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">{parsedRows.length}</p>
                  <p className="text-xs text-slate-500">Gelesen</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{zugeordnet.length}</p>
                  <p className="text-xs text-green-600">Zugeordnet</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{offen.length}</p>
                  <p className="text-xs text-amber-600">Zuordnung offen</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{duplikate.length}</p>
                  <p className="text-xs text-red-600">Duplikate</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 rounded-lg p-3">
                <span className="text-sm font-medium text-slate-700">Verwendeter Betrag:</span>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={betragstyp === 'netto'} onChange={() => setBetragstyp('netto')} className="accent-teal-600" />
                  <span>Nettobetrag</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={betragstyp === 'brutto'} onChange={() => setBetragstyp('brutto')} className="accent-teal-600" />
                  <span>Bruttobetrag</span>
                </label>
                <span className="ml-auto text-xs text-slate-400">Gesamt: {formatEUR(importierbar.reduce((s, r) => s + (betragstyp === 'netto' ? r.nettobetrag : r.bruttobetrag), 0))}</span>
              </div>

              {duplikate.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                    <Copy className="w-4 h-4" /> {duplikate.length} Duplikate erkannt – werden nicht importiert
                  </p>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      <th className="px-3 py-2 font-medium">Datum</th>
                      <th className="px-3 py-2 font-medium">Monat</th>
                      <th className="px-3 py-2 font-medium">Lieferant</th>
                      <th className="px-3 py-2 font-medium">Sachkonto</th>
                      <th className="px-3 py-2 font-medium">Kategorie</th>
                      <th className="px-3 py-2 font-medium text-right">Netto</th>
                      <th className="px-3 py-2 font-medium text-right">Brutto</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {parsedRows.slice(0, 100).map((r, i) => (
                      <tr key={i} className={r.isDuplicate ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}>
                        <td className="px-3 py-1.5 text-slate-600">{formatDateDE(r.buchungsdatum)}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.leistungsmonat}</td>
                        <td className="px-3 py-1.5 text-slate-700 max-w-[160px] truncate">{r.lieferant || r.buchungstext}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.sachkonto || '—'}</td>
                        <td className="px-3 py-1.5">
                          {r.kategorie_id ? <span className="text-teal-700">{katName(r.kategorie_id)}</span> : <span className="text-amber-600">offen</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{formatEUR(r.nettobetrag)}</td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{formatEUR(r.bruttobetrag)}</td>
                        <td className="px-3 py-1.5">
                          {r.isDuplicate ? <span className="text-red-500">Duplikat</span> : r.kategorie_id ? <span className="text-green-600">OK</span> : <span className="text-amber-500">offen</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 100 && <p className="text-xs text-slate-400 text-center py-2">… und {parsedRows.length - 100} weitere</p>}
              </div>
            </div>
          )}

          {stage === 'importing' && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Buchungen werden importiert…</p>
            </div>
          )}

          {stage === 'done' && (
            <div className="flex flex-col items-center py-12">
              <CheckCircle className="w-14 h-14 text-teal-600 mb-3" />
              <p className="text-lg font-semibold text-slate-900">Import erfolgreich!</p>
              <p className="text-sm text-slate-500 mt-1">{importResult.imported} Buchungen importiert, {importResult.duplicates} Duplikate übersprungen</p>
              <p className="text-sm text-slate-700 mt-1">Gesamtsumme: {formatEUR(importResult.sum)}</p>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center py-12">
              <AlertCircle className="w-14 h-14 text-red-500 mb-3" />
              <p className="text-lg font-semibold text-slate-900">Fehler</p>
              <p className="text-sm text-slate-500 mt-1 text-center max-w-md">{error}</p>
            </div>
          )}
        </div>

        {stage === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <p className="text-xs text-slate-500">
              <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />{fileName} · {importierbar.length} importierbar
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                Abbrechen
              </button>
              <button onClick={confirmImport} disabled={importierbar.length === 0}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {importierbar.length} Buchungen importieren
              </button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button onClick={onSuccess} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
              Fertig
            </button>
          </div>
        )}
      </div>
    </div>
  );
}