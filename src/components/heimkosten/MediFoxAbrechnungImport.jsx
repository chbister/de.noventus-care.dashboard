import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export default function MediFoxAbrechnungImport({ einrichtungId, onClose, onSuccess }) {
  const fileRef = useRef();
  const [state, setState] = useState('idle');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setState('loading');
    setError('');

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.functions.invoke('parseMediFoxAbrechnung', { file_url });
      const data = result.data;

      if (!data || !data.success || !data.rows?.length) {
        setState('error');
        setError(data?.error || 'Keine Daten in der Datei gefunden.');
        return;
      }

      setParsed(data);
      setState('preview');
    } catch (err) {
      setState('error');
      setError(err.message || 'Fehler beim Verarbeiten der Datei.');
    }
  };

  const doImport = async () => {
    setState('importing');
    try {
      const { jahr, monat } = parsed.rows[0];

      // Bestehende Einträge für diesen Monat löschen (Replace-Strategie)
      await base44.entities.MediFoxAbrechnung.deleteMany({
        einrichtung_id: einrichtungId,
        jahr,
        monat,
      });

      // Neue Einträge erstellen
      const records = parsed.rows.map(row => ({
        ...row,
        einrichtung_id: einrichtungId,
        zeitraum_von: parsed.zeitraum_von || null,
        zeitraum_bis: parsed.zeitraum_bis || null,
      }));
      await base44.entities.MediFoxAbrechnung.bulkCreate(records);

      setState('done');
      setTimeout(() => onSuccess?.(), 1200);
    } catch (err) {
      setState('error');
      setError(err.message || 'Import fehlgeschlagen.');
    }
  };

  const reset = () => { setState('idle'); setParsed(null); setError(''); };

  const gesamt = parsed?.rows?.reduce((s, r) => s + (r.abger_betrag || 0), 0) || 0;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">MediFox-Import — Abgerechnete Leistungen</h3>
        <div className="flex items-center gap-2">
          {state !== 'idle' && <button onClick={reset} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {state === 'idle' && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all"
          >
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-medium">MediFox Excel-Datei hier ablegen</p>
            <p className="text-xs text-slate-400 mt-1">"Abgerechnete Leistungen nach Monat" aus MediFox · .xlsx, .xls</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
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
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button onClick={reset} className="mt-3 text-xs text-slate-500 underline">Erneut versuchen</button>
        </div>
      )}

      {state === 'preview' && parsed && (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-teal-600">Zeitraum:</span>{' '}
              <span className="font-medium text-teal-800">{parsed.zeitraum_von ? new Date(parsed.zeitraum_von).toLocaleDateString('de-DE') : '—'} – {parsed.zeitraum_bis ? new Date(parsed.zeitraum_bis).toLocaleDateString('de-DE') : '—'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-500">Abrechnungsmonat:</span>{' '}
              <span className="font-medium text-slate-800">{parsed.rows[0]?.monat ? MONATE[parsed.rows[0].monat - 1] : '—'} {parsed.rows[0]?.jahr}</span>
            </div>
            <div className="bg-slate-900 text-white rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400">Gesamt:</span>{' '}
              <span className="font-bold">{fmt(gesamt)}</span>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-3">
            <span className="font-semibold text-teal-700">{parsed.rows.length}</span> Leistungspositionen erkannt
            {' · '}bestehende Daten für diesen Monat werden ersetzt.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-100 mb-4 max-h-72 overflow-y-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Kürzel</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Bezeichnung</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Leistungsgruppe</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Einzelpreis</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Anzahl</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parsed.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-700">{row.abkuerzung}</td>
                    <td className="px-3 py-2 text-slate-600">{row.bezeichnung}</td>
                    <td className="px-3 py-2 text-slate-500">{row.leistungsgruppe}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(row.einzelpreis)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(row.abger_anzahl)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(row.abger_betrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={doImport}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Upload className="w-4 h-4" /> {parsed.rows.length} Positionen importieren
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
          <p className="text-sm text-green-700 font-semibold">Import erfolgreich!</p>
          <p className="text-xs text-slate-400 mt-1">{parsed?.rows?.length || 0} Positionen gespeichert.</p>
        </div>
      )}
    </div>
  );
}