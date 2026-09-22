import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

const STEUERFREI_SUMMARY = 'SZF';
const STEUERFREI_INDIVIDUAL = ['210', '345', '39K'];

export default function GehaltsImport({ einrichtungId, onClose, onSuccess }) {
  const [gehaltsFile, setGehaltsFile] = useState(null);
  const [svFile, setSvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('select');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState({ matched: [], unmatched: [] });

  const handleProcess = async () => {
    if (!gehaltsFile || !svFile || !einrichtungId) return;
    setLoading(true);
    setStage('processing');
    setError('');

    try {
      const gehaltsUpload = await base44.integrations.Core.UploadFile({ file: gehaltsFile });
      const svUpload = await base44.integrations.Core.UploadFile({ file: svFile });

      const svResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: svUpload.file_url,
        json_schema: {
          type: "object",
          properties: {
            Personalnummer: { type: "string" },
            Bruttogehalt_LA100: { type: "number", description: "mtl. Bruttogehalt ohne AG Anteil (LA100)" },
            Bruttogehalt_LA204: { type: "number", description: "mtl. Bruttogehalt ohne AG Anteil (LA204)" },
            Monatslohn_Aushilfe: { type: "number", description: "Monatslohn Aushilfe" },
            Zulage: { type: "number" },
            SV_AG_Anteile: { type: "number", description: "SV-AG-Anteile ausgehend vom lfd. Bruttoentgelt" }
          }
        }
      });

      const gehaltsResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: gehaltsUpload.file_url,
        json_schema: {
          type: "object",
          properties: {
            PNR: { type: "string" },
            Lohnart: { type: "string" },
            Betrag: { type: "number" }
          }
        }
      });

      const svRows = Array.isArray(svResult.output) ? svResult.output : (svResult.output?.rows || []);
      const svMap = {};
      svRows.forEach(r => {
        const pnr = String(r.Personalnummer || '').trim();
        if (!pnr) return;
        svMap[pnr] = {
          monatsgehalt_brutto: (r.Bruttogehalt_LA100 || 0) + (r.Bruttogehalt_LA204 || 0) + (r.Monatslohn_Aushilfe || 0),
          funktionszulagen: r.Zulage || 0,
          sv_ag_anteil: r.SV_AG_Anteile || 0,
        };
      });

      const gehaltsRows = Array.isArray(gehaltsResult.output) ? gehaltsResult.output : (gehaltsResult.output?.rows || []);
      const szfMap = {};
      const indivMap = {};
      gehaltsRows.forEach(r => {
        const pnr = String(r.PNR || '').trim();
        if (!pnr) return;
        if (r.Lohnart === STEUERFREI_SUMMARY) {
          szfMap[pnr] = (szfMap[pnr] || 0) + (r.Betrag || 0);
        } else if (STEUERFREI_INDIVIDUAL.includes(r.Lohnart)) {
          indivMap[pnr] = (indivMap[pnr] || 0) + (r.Betrag || 0);
        }
      });

      const mitarbeiter = await base44.entities.Mitarbeiter.filter({ einrichtung_id: einrichtungId });

      const matched = [];
      const unmatched = [];
      Object.keys(svMap).forEach(pnr => {
        const ma = mitarbeiter.find(m => String(m.personalnummer || '').trim() === pnr);
        const zuschlaege = szfMap[pnr] !== undefined ? szfMap[pnr] : (indivMap[pnr] || 0);
        const data = { ...svMap[pnr], zuschlaege_steuerfrei: zuschlaege };
        if (ma) {
          matched.push({ id: ma.id, name: ma.name, personalnummer: pnr, ...data });
        } else {
          unmatched.push({ personalnummer: pnr, ...data });
        }
      });

      setPreview({ matched, unmatched });
      setStage('preview');
    } catch (e) {
      setError(e.message || 'Fehler beim Verarbeiten der Dateien');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    setLoading(true);
    try {
      const updates = preview.matched.map(m => ({
        id: m.id,
        monatsgehalt_brutto: Math.round(m.monatsgehalt_brutto * 100) / 100,
        funktionszulagen: Math.round(m.funktionszulagen * 100) / 100,
        sv_ag_anteil: Math.round(m.sv_ag_anteil * 100) / 100,
        zuschlaege_steuerfrei: Math.round(m.zuschlaege_steuerfrei * 100) / 100,
      }));
      await base44.entities.Mitarbeiter.bulkUpdate(updates);
      setStage('done');
      onSuccess();
    } catch (e) {
      setError(e.message || 'Fehler beim Speichern');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Gehaltsimport</h2>
        <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {stage === 'select' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Hinweis:</strong> Mitarbeiter müssen eine Personalnummer hinterlegt haben, damit der Abgleich funktioniert.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">SV-Anteile (Excel)</label>
              <input type="file" accept=".xlsx,.xls" onChange={e => setSvFile(e.target.files[0])}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              {svFile && <p className="text-xs text-teal-600 mt-1">✓ {svFile.name}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Gehaltsbestandteile (Excel)</label>
              <input type="file" accept=".xlsx,.xls" onChange={e => setGehaltsFile(e.target.files[0])}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" />
              {gehaltsFile && <p className="text-xs text-teal-600 mt-1">✓ {gehaltsFile.name}</p>}
            </div>
          </div>
          <button onClick={handleProcess} disabled={!gehaltsFile || !svFile}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload className="w-4 h-4" /> Dateien verarbeiten
          </button>
        </div>
      )}

      {stage === 'processing' && (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500">Dateien werden verarbeitet...</p>
        </div>
      )}

      {stage === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-teal-700">{preview.matched.length}</p>
              <p className="text-xs text-teal-600">zugeordnet</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{preview.unmatched.length}</p>
              <p className="text-xs text-red-600">nicht zugeordnet</p>
            </div>
          </div>

          {preview.matched.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                    <th className="px-3 py-2 font-medium text-slate-600">PNR</th>
                    <th className="px-3 py-2 font-medium text-slate-600 text-right">Brutto</th>
                    <th className="px-3 py-2 font-medium text-slate-600 text-right">Zulage</th>
                    <th className="px-3 py-2 font-medium text-slate-600 text-right">Zuschläge stfr.</th>
                    <th className="px-3 py-2 font-medium text-slate-600 text-right">SV-AG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {preview.matched.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-800">{m.name}</td>
                      <td className="px-3 py-2 text-slate-500">{m.personalnummer}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(m.monatsgehalt_brutto)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(m.funktionszulagen)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(m.zuschlaege_steuerfrei)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{fmt(m.sv_ag_anteil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.unmatched.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-700 mb-1">Nicht zugeordnet ({preview.unmatched.length}):</p>
              <p className="text-xs text-red-600">
                PNR: {preview.unmatched.map(u => u.personalnummer).join(', ')}
              </p>
              <p className="text-xs text-red-500 mt-1">Diese Personalnummern wurden in den Mitarbeiterdaten nicht gefunden.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={confirmImport} disabled={preview.matched.length === 0 || loading}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Import bestätigen ({preview.matched.length})
            </button>
            <button onClick={() => setStage('select')}
              className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Zurück
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex flex-col items-center py-12">
          <CheckCircle className="w-12 h-12 text-teal-600 mb-3" />
          <p className="text-lg font-semibold text-slate-900">Import erfolgreich!</p>
          <p className="text-sm text-slate-500 mt-1">{preview.matched.length} Mitarbeiter aktualisiert.</p>
        </div>
      )}

      {stage === 'error' && (
        <div className="flex flex-col items-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
          <p className="text-lg font-semibold text-slate-900">Fehler</p>
          <p className="text-sm text-slate-500 mt-1 text-center max-w-md">{error}</p>
        </div>
      )}
    </div>
  );
}