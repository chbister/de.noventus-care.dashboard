import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, Check, X, Loader2, AlertCircle } from 'lucide-react';

export default function BewohnerImport({ wohnbereiche, onDone, onClose }) {
  const [step, setStep] = useState('upload'); // upload → preview → done
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [groups, setGroups] = useState([]);
  const [mapping, setMapping] = useState({}); // { bereichName: wohnbereichId | '__skip' }
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(''); }
  };

  const parse = async () => {
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('parseBewohnerImport', { file_url });
      const parsed = res.data;
      if (parsed.error) { setError(parsed.error); setParsing(false); return; }

      const grpList = parsed.groups || [];
      setGroups(grpList);

      // Auto-match Bereich → Wohnbereich by name similarity
      const auto = {};
      grpList.forEach(g => {
        const gl = g.bereich.toLowerCase();
        const match = wohnbereiche.find(wb => {
          const wl = wb.name.toLowerCase();
          return wl === gl || gl.includes(wl) || wl.includes(gl) ||
            gl.includes(wb.name.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
            wb.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(gl.replace(/[^a-z0-9]/g, ''));
        });
        auto[g.bereich] = match ? match.id : '__skip';
      });
      setMapping(auto);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Fehler beim Parsen');
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    setError('');
    try {
      // Group by target Wohnbereich
      const updates = {}; // wbId → { pg1, pg2, ... }
      groups.forEach(g => {
        const wbId = mapping[g.bereich];
        if (!wbId || wbId === '__skip') return;
        if (!updates[wbId]) updates[wbId] = { ruestige: 0, pg0: 0, pg1: 0, pg2: 0, pg3: 0, pg4: 0, pg5: 0 };
        updates[wbId].ruestige += g.ruestige;
        updates[wbId].pg0 += g.pg0;
        updates[wbId].pg1 += g.pg1;
        updates[wbId].pg2 += g.pg2;
        updates[wbId].pg3 += g.pg3;
        updates[wbId].pg4 += g.pg4;
        updates[wbId].pg5 += g.pg5;
      });

      const wbIds = Object.keys(updates);
      for (const wbId of wbIds) {
        const wb = wohnbereiche.find(w => w.id === wbId);
        if (!wb) continue;
        const u = updates[wbId];
        await base44.entities.Wohnbereich.update(wbId, {
          belegung_ruestige: u.ruestige,
          belegung_pg0: u.pg0,
          belegung_pg1: u.pg1,
          belegung_pg2: u.pg2,
          belegung_pg3: u.pg3,
          belegung_pg4: u.pg4,
          belegung_pg5: u.pg5,
          stichtag: new Date().toISOString().split('T')[0],
        });
      }

      setStep('done');
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="p-2 bg-teal-100 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900">Bewohner-Pflegegrade importieren</h2>
            <p className="text-xs text-slate-500">Excel-Liste mit Einstufungen → Wohnbereiche</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Laden Sie die Excel-Datei mit den Bewohner-Einstufungen hoch (z.B. aus MediFox). 
                Die Datei muss eine Spalte „Bereich" und Pflegegrade enthalten.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-10 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-all">
                <Upload className="w-8 h-8 text-slate-300" />
                <span className="text-sm text-slate-500">
                  {file ? file.name : 'Datei auswählen (.xlsx)'}
                </span>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </label>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                {groups.length} Bereich(e) erkannt. Ordnen Sie jeden Bereich einem Wohnbereich zu:
              </p>
              <div className="space-y-3">
                {groups.map(g => (
                  <div key={g.bereich} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-slate-800 flex-1">{g.bereich}</span>
                      <span className="text-xs text-slate-400">{g.total} Bewohner</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {g.ruestige > 0 && <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Rüstige: {g.ruestige}</span>}
                      {g.pg1 > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">PG1: {g.pg1}</span>}
                      {g.pg2 > 0 && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">PG2: {g.pg2}</span>}
                      {g.pg3 > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">PG3: {g.pg3}</span>}
                      {g.pg4 > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">PG4: {g.pg4}</span>}
                      {g.pg5 > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">PG5: {g.pg5}</span>}
                    </div>
                    <select
                      value={mapping[g.bereich] || '__skip'}
                      onChange={e => setMapping(p => ({ ...p, [g.bereich]: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600"
                    >
                      <option value="__skip">— Nicht zuordnen —</option>
                      {wohnbereiche.map(wb => (
                        <option key={wb.id} value={wb.id}>{wb.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
                ⚠️ Achtung: Beim Speichern werden die aktuellen Belegungszahlen der zugeordneten Wohnbereiche überschrieben.
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-teal-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">Import erfolgreich</h3>
              <p className="text-sm text-slate-500">Die Pflegegrade wurden den Wohnbereichen zugeordnet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          {step === 'upload' && (
            <button onClick={parse} disabled={!file || parsing}
              className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {parsing ? 'Wird geprüft...' : 'Datei prüfen'}
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('upload')}
                className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                Zurück
              </button>
              <button onClick={apply} disabled={applying}
                className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {applying ? 'Speichert...' : 'In Wohnbereiche übernehmen'}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose}
              className="bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              Schließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}