import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Excel-Import für BewohnerHeimkosten
 *
 * Erwartete Spalten (Spaltennamen flexibel, case-insensitive):
 * bewohner_name | zimmer | pflegegrad |
 * anteil_pflegekasse | anteil_sozialamt | anteil_bewohner | betrag_gesamt |
 * bezahlt_pflegekasse | bezahlt_sozialamt | bezahlt_bewohner |
 * sozialamt_wohngeld | sozialamt_pflegewohngeld | sozialamt_uebergeleitet_rente | sozialamt_sozialhilfe |
 * bemerkung
 */

const FIELD_MAP = {
  bewohner_name: ['bewohner_name', 'name', 'bewohner', 'bewohnername'],
  zimmer: ['zimmer', 'zimmer_nr', 'room'],
  pflegegrad: ['pflegegrad', 'pg'],
  anteil_pflegekasse: ['anteil_pflegekasse', 'pflegekasse', 'pflegekasse_soll'],
  anteil_sozialamt: ['anteil_sozialamt', 'sozialamt', 'sozialamt_soll'],
  anteil_bewohner: ['anteil_bewohner', 'bewohner_anteil', 'eigenanteil'],
  betrag_gesamt: ['betrag_gesamt', 'gesamt', 'gesamtbetrag'],
  bezahlt_pflegekasse: ['bezahlt_pflegekasse', 'pflegekasse_ist', 'pflegekasse_bez'],
  bezahlt_sozialamt: ['bezahlt_sozialamt', 'sozialamt_ist', 'sozialamt_bez'],
  bezahlt_bewohner: ['bezahlt_bewohner', 'bewohner_ist', 'bewohner_bez'],
  sozialamt_wohngeld: ['sozialamt_wohngeld', 'wohngeld'],
  sozialamt_pflegewohngeld: ['sozialamt_pflegewohngeld', 'pflegewohngeld'],
  sozialamt_uebergeleitet_rente: ['sozialamt_uebergeleitet_rente', 'uebergeleitet_rente', 'rente'],
  sozialamt_sozialhilfe: ['sozialamt_sozialhilfe', 'sozialhilfe'],
  bemerkung: ['bemerkung', 'notiz', 'note'],
};

function mapRow(rawRow) {
  const lower = {};
  Object.keys(rawRow).forEach(k => { lower[k.toLowerCase().replace(/\s+/g, '_')] = rawRow[k]; });

  const result = {};
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    for (const alias of aliases) {
      if (lower[alias] !== undefined && lower[alias] !== null && lower[alias] !== '') {
        result[field] = lower[alias];
        break;
      }
    }
  }
  return result;
}

function calcStatus(bezahlt, gesamt) {
  if (bezahlt >= gesamt && gesamt > 0) return 'bezahlt';
  if (bezahlt > 0) return 'teilweise_bezahlt';
  return 'offen';
}

export default function BewohnerKostenImport({ einrichtungId, monat, jahr, onSuccess }) {
  const fileRef = useRef();
  const [state, setState] = useState('idle'); // idle | loading | preview | importing | done | error
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setState('loading');
    setErrors([]);
    setPreview([]);

    // Upload file first
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Extract data using LLM-based extractor
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bewohner_name: { type: 'string' },
                zimmer: { type: 'string' },
                pflegegrad: { type: 'string' },
                anteil_pflegekasse: { type: 'number' },
                anteil_sozialamt: { type: 'number' },
                anteil_bewohner: { type: 'number' },
                betrag_gesamt: { type: 'number' },
                bezahlt_pflegekasse: { type: 'number' },
                bezahlt_sozialamt: { type: 'number' },
                bezahlt_bewohner: { type: 'number' },
                sozialamt_wohngeld: { type: 'number' },
                sozialamt_pflegewohngeld: { type: 'number' },
                sozialamt_uebergeleitet_rente: { type: 'number' },
                sozialamt_sozialhilfe: { type: 'number' },
                bemerkung: { type: 'string' },
              },
            },
          },
        },
      },
    });

    if (result.status !== 'success' || !result.output?.rows?.length) {
      setState('error');
      setMessage(result.details || 'Keine Daten gefunden. Bitte Dateiformat prüfen.');
      return;
    }

    const rows = result.output.rows;
    const errs = [];
    const valid = [];

    rows.forEach((raw, idx) => {
      const row = mapRow(raw);
      if (!row.bewohner_name) {
        errs.push(`Zeile ${idx + 2}: Bewohner-Name fehlt`);
        return;
      }
      const bezahlt = (parseFloat(row.bezahlt_pflegekasse) || 0) +
                      (parseFloat(row.bezahlt_sozialamt) || 0) +
                      (parseFloat(row.bezahlt_bewohner) || 0);
      valid.push({
        ...row,
        einrichtung_id: einrichtungId,
        monat,
        jahr,
        betrag_bezahlt: bezahlt,
        status: calcStatus(bezahlt, parseFloat(row.betrag_gesamt) || 0),
        anteil_pflegekasse: parseFloat(row.anteil_pflegekasse) || 0,
        anteil_sozialamt: parseFloat(row.anteil_sozialamt) || 0,
        anteil_bewohner: parseFloat(row.anteil_bewohner) || 0,
        betrag_gesamt: parseFloat(row.betrag_gesamt) || 0,
        bezahlt_pflegekasse: parseFloat(row.bezahlt_pflegekasse) || 0,
        bezahlt_sozialamt: parseFloat(row.bezahlt_sozialamt) || 0,
        bezahlt_bewohner: parseFloat(row.bezahlt_bewohner) || 0,
        sozialamt_wohngeld: parseFloat(row.sozialamt_wohngeld) || 0,
        sozialamt_pflegewohngeld: parseFloat(row.sozialamt_pflegewohngeld) || 0,
        sozialamt_uebergeleitet_rente: parseFloat(row.sozialamt_uebergeleitet_rente) || 0,
        sozialamt_sozialhilfe: parseFloat(row.sozialamt_sozialhilfe) || 0,
        pflegegrad: row.pflegegrad || 'PG3',
        zimmer: row.zimmer || '',
        bemerkung: row.bemerkung || '',
      });
    });

    setErrors(errs);
    setPreview(valid);
    setState('preview');
  };

  const doImport = async () => {
    setState('importing');
    try {
      // Bestehende Einträge für diesen Monat laden (Smart-Update)
      const existing = await base44.entities.BewohnerHeimkosten.filter({
        einrichtung_id: einrichtungId, monat, jahr,
      });

      const nameMatch = (name) => {
        const n = (name || '').toLowerCase().trim();
        return existing.find(e => (e.bewohner_name || '').toLowerCase().trim() === n);
      };

      const toUpdate = [];
      const toCreate = [];

      preview.forEach(row => {
        const match = nameMatch(row.bewohner_name);
        if (match) {
          // Nur Soll-Werte aktualisieren, Ist-Werte (bezahlt_*) bleiben unangetastet
          const bezahlt = (match.bezahlt_pflegekasse || 0) + (match.bezahlt_sozialamt || 0) + (match.bezahlt_bewohner || 0);
          const gesamt = parseFloat(row.betrag_gesamt) || 0;
          toUpdate.push({
            id: match.id,
            zimmer: row.zimmer || match.zimmer,
            pflegegrad: row.pflegegrad || match.pflegegrad,
            anteil_pflegekasse: parseFloat(row.anteil_pflegekasse) || 0,
            anteil_sozialamt: parseFloat(row.anteil_sozialamt) || 0,
            anteil_bewohner: parseFloat(row.anteil_bewohner) || 0,
            betrag_gesamt: gesamt,
            sozialamt_wohngeld: parseFloat(row.sozialamt_wohngeld) || 0,
            sozialamt_pflegewohngeld: parseFloat(row.sozialamt_pflegewohngeld) || 0,
            sozialamt_uebergeleitet_rente: parseFloat(row.sozialamt_uebergeleitet_rente) || 0,
            sozialamt_sozialhilfe: parseFloat(row.sozialamt_sozialhilfe) || 0,
            betrag_bezahlt: bezahlt,
            status: bezahlt >= gesamt && gesamt > 0 ? 'bezahlt' : bezahlt > 0 ? 'teilweise_bezahlt' : 'offen',
          });
        } else {
          toCreate.push(row);
        }
      });

      if (toCreate.length > 0) await base44.entities.BewohnerHeimkosten.bulkCreate(toCreate);
      if (toUpdate.length > 0) await base44.entities.BewohnerHeimkosten.bulkUpdate(toUpdate);

      setState('done');
      const parts = [];
      if (toCreate.length > 0) parts.push(`${toCreate.length} neu angelegt`);
      if (toUpdate.length > 0) parts.push(`${toUpdate.length} aktualisiert (Ist-Werte erhalten)`);
      setMessage(parts.join(' · ') || 'Keine Änderungen.');
      onSuccess?.();
    } catch (err) {
      setState('error');
      setMessage(err.message || 'Import fehlgeschlagen.');
    }
  };

  const reset = () => { setState('idle'); setPreview([]); setErrors([]); setMessage(''); };

  const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Excel-Import Bewohner Kosten</h3>
        {state !== 'idle' && (
          <button onClick={reset} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        )}
      </div>

      {state === 'idle' && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all"
          >
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-medium">Excel- oder CSV-Datei hier ablegen</p>
            <p className="text-xs text-slate-400 mt-1">Klicken zum Auswählen · .xlsx, .xls, .csv</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <div className="mt-3 bg-slate-50 rounded-lg p-3 space-y-2">
            <div>
              <p className="text-xs font-semibold text-teal-700 mb-0.5">📋 Aus MediFox (Soll-Werte):</p>
              <p className="text-xs text-slate-500 font-mono leading-relaxed">
                bewohner_name · zimmer · pflegegrad · anteil_pflegekasse · anteil_sozialamt · anteil_bewohner · betrag_gesamt · sozialamt_wohngeld · sozialamt_pflegewohngeld · sozialamt_uebergeleitet_rente · sozialamt_sozialhilfe
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-0.5">✏️ Manuell (Ist-Zahlungen, nicht im Import):</p>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                bezahlt_pflegekasse · bezahlt_sozialamt · bezahlt_bewohner · zahlungsdatum · bemerkung
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              💡 Beim erneuten Import werden bestehende Einträge erkannt und nur die Soll-Werte aktualisiert — bereits erfasste Zahlungen bleiben erhalten.
            </p>
          </div>
        </>
      )}

      {state === 'loading' && (
        <div className="py-10 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          <p className="text-sm">Datei wird analysiert…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="py-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 font-medium">{message}</p>
          <button onClick={reset} className="mt-3 text-xs text-slate-500 underline">Zurück</button>
        </div>
      )}

      {state === 'preview' && (
        <>
          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ {errors.length} Zeile(n) übersprungen:</p>
              {errors.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
            </div>
          )}
          <p className="text-sm text-slate-600 mb-3">
            <span className="font-semibold text-teal-700">{preview.length}</span> Einträge bereit für Import
            · {monat}/{jahr}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-100 mb-4 max-h-56 overflow-y-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Bewohner</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">PG</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Pflegekasse</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Sozialamt</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Gesamt</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-800">{row.bewohner_name}{row.zimmer ? ` (Zim. ${row.zimmer})` : ''}</td>
                    <td className="px-3 py-2 text-slate-500">{row.pflegegrad}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(row.anteil_pflegekasse)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(row.anteil_sozialamt)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(row.betrag_gesamt)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        row.status === 'bezahlt' ? 'bg-green-100 text-green-700' :
                        row.status === 'teilweise_bezahlt' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={doImport}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Upload className="w-4 h-4" /> {preview.length} Einträge importieren
            </button>
            <button onClick={reset}
              className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <X className="w-4 h-4" /> Abbrechen
            </button>
          </div>
        </>
      )}

      {state === 'importing' && (
        <div className="py-10 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          <p className="text-sm">Daten werden importiert…</p>
        </div>
      )}

      {state === 'done' && (
        <div className="py-6 text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-green-700 font-semibold">{message}</p>
          <button onClick={reset} className="mt-3 text-xs text-slate-500 underline">Weiteren Import starten</button>
        </div>
      )}
    </div>
  );
}