import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

function werktage(von, bis) {
  if (!von || !bis) return 1;
  const start = new Date(von);
  const end = new Date(bis);
  if (end < start) return 1;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 1;
}

export default function FehlzeitenImport({ einrichtungId, mitarbeiter, onClose, onSuccess }) {
  const fileRef = useRef();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [errors, setErrors] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setErrors([]);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const resp = await base44.functions.invoke('parseFehlzeitenExcel', { file_url });
    const result = resp.data;
    if (!result?.success) {
      setErrors([`Fehler: ${result?.error || 'Unbekannter Fehler'}`]);
      setLoading(false);
      return;
    }

    const byPnr = {};
    const byName = {};
    (mitarbeiter || []).forEach(ma => {
      const pnr = String(ma.personalnummer || '').trim();
      const nm = String(ma.name || '').trim().toLowerCase();
      if (pnr) byPnr[pnr] = ma;
      if (nm) byName[nm] = ma;
    });

    const parsed = (result.rows || []).map(r => {
      let matched = null;
      if (r.personalnummer && byPnr[r.personalnummer]) matched = byPnr[r.personalnummer];
      else if (r.name) {
        const nk = r.name.toLowerCase();
        if (byName[nk]) matched = byName[nk];
      }
      const tage = r.tage > 0 ? r.tage : werktage(r.von_datum, r.bis_datum);
      return {
        ...r,
        mitarbeiter_id: matched?.id || '',
        matched_name: matched?.name || '',
        matched: !!matched,
        tage,
        _selected: !!matched,
      };
    });

    setRows(parsed);
    setLoading(false);
  };

  const toggleRow = (i) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, _selected: !r._selected } : r));
  };

  const toggleAll = () => {
    const all = rows.filter(r => r.matched).every(r => r._selected);
    setRows(prev => prev.map(r => ({ ...r, _selected: r.matched ? !all : r._selected })));
  };

  const doImport = async () => {
    setImporting(true);
    const valid = rows.filter(r => r.matched && r._selected);
    const records = valid.map(r => ({
      mitarbeiter_id: r.mitarbeiter_id,
      einrichtung_id: einrichtungId,
      art: r.art,
      von_datum: r.von_datum,
      bis_datum: r.bis_datum,
      tage: r.tage,
      bemerkung: r.bemerkung || '',
    }));
    let created = 0;
    if (records.length > 0) {
      await base44.entities.MitarbeiterFehlzeiten.bulkCreate(records);
      created = records.length;
    }
    setImportResult({ created });
    setDone(true);
    setImporting(false);
    onSuccess();
  };

  const downloadTemplate = () => {
    const csv = 'Personalnummer;Name;Art;Von;Bis;Bemerkung\n952248;Bösel;Krank;01.03.2026;05.03.2026;Grippe\n952248;Bösel;Urlaub;10.04.2026;15.04.2026;Erholung\n;Müller;Fortbildung;20.05.2026;20.05.2026;Brandschutz';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Fehlzeiten_Vorlage.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-lg text-teal-700">Fehlzeiten Import</h2>
            <p className="text-xs text-slate-400 mt-0.5">Excel/CSV mit Name, Personalnummer, Art, Von, Bis</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!done ? (
            <>
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
                      {loading ? 'Datei wird verarbeitet...' : 'Excel/CSV hier ablegen'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">.xlsx, .xls oder .csv</p>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                  </div>
                  <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-teal-600 hover:underline">
                    <Download className="w-4 h-4" /> Vorlage herunterladen (CSV)
                  </button>
                </div>
              )}

              {errors.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}

              {rows.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">
                      Vorschau: <span className="text-teal-600">{rows.filter(r => r.matched && r._selected).length}</span> von {rows.length} Einträgen ausgewählt
                    </p>
                    <button onClick={toggleAll} className="text-xs text-teal-600 hover:underline font-medium">
                      {rows.filter(r => r.matched).every(r => r._selected) ? 'Alle abwählen' : 'Alle auswählen'}
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="px-3 py-2 w-8"><input type="checkbox" checked={rows.filter(r => r.matched).every(r => r._selected)} onChange={toggleAll} className="rounded border-slate-300" /></th>
                          <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                          <th className="px-3 py-2 font-medium text-slate-600">PNR</th>
                          <th className="px-3 py-2 font-medium text-slate-600">Art</th>
                          <th className="px-3 py-2 font-medium text-slate-600">Von</th>
                          <th className="px-3 py-2 font-medium text-slate-600">Bis</th>
                          <th className="px-3 py-2 font-medium text-slate-600 text-right">Tage</th>
                          <th className="px-3 py-2 font-medium text-slate-600">Mitarbeiter</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map((r, i) => (
                          <tr key={i} className={`${!r.matched ? 'bg-red-50' : r._selected ? 'hover:bg-slate-50/50' : 'opacity-40 bg-slate-50'}`}>
                            <td className="px-3 py-2"><input type="checkbox" checked={!!r._selected} disabled={!r.matched} onChange={() => toggleRow(i)} className="rounded border-slate-300" /></td>
                            <td className="px-3 py-2 font-medium text-slate-800">{r.name || <span className="text-red-500">fehlt</span>}</td>
                            <td className="px-3 py-2 text-slate-500">{r.personalnummer || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{r.art}</td>
                            <td className="px-3 py-2 text-slate-600">{r.von_datum}</td>
                            <td className="px-3 py-2 text-slate-600">{r.bis_datum}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{r.tage}</td>
                            <td className="px-3 py-2">
                              {r.matched
                                ? <span className="text-teal-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {r.matched_name}</span>
                                : <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Nicht gefunden</span>}
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
              <p className="text-xl font-bold text-slate-900">{importResult?.created} Fehlzeiten importiert</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            {done ? 'Schließen' : 'Abbrechen'}
          </button>
          {!done && rows.filter(r => r.matched).length > 0 && (
            <button onClick={doImport} disabled={importing || rows.filter(r => r.matched && r._selected).length === 0}
              className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importiere...' : `${rows.filter(r => r.matched && r._selected).length} Fehlzeiten importieren`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}