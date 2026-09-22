import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, AlertCircle, CheckCircle, Loader } from 'lucide-react';

export default function LeistungsImport({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const validateData = (rows) => {
    const errors = [];
    const requiredFields = ['datum', 'wohneinheit_id', 'leistungs_id', 'menge'];

    rows.forEach((row, idx) => {
      requiredFields.forEach(field => {
        if (!row[field]) {
          errors.push(`Zeile ${idx + 1}: ${field} fehlt`);
        }
      });

      if (row.datum && !/^\d{4}-\d{2}-\d{2}$/.test(row.datum)) {
        errors.push(`Zeile ${idx + 1}: Datum muss YYYY-MM-DD sein`);
      }

      if (isNaN(parseFloat(row.menge))) {
        errors.push(`Zeile ${idx + 1}: Menge muss eine Zahl sein`);
      }
    });

    return errors;
  };

  const handleFileSelect = async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    setFile(f);
    setValidationErrors([]);
    setData(null);

    // Simulierter Import - in Produktion würde hier xlsx/Papa Parse genutzt
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = values[i];
          });
          return obj;
        });

        const errors = validateData(rows);
        if (errors.length > 0) {
          setValidationErrors(errors);
          return;
        }

        setData(rows);
      } catch (err) {
        setValidationErrors([`Datei-Parse-Fehler: ${err.message}`]);
      }
    };
    reader.readAsText(f);
  };

  const importData = async () => {
    if (!data || data.length === 0) return;
    
    setImporting(true);
    try {
      // Batch-Import in Wahlleistungen
      await base44.entities.BetreutesWohnenWahlleistungen.bulkCreate(
        data.map(row => ({
          datum: row.datum,
          wohneinheit_id: row.wohneinheit_id,
          leistungs_id: row.leistungs_id,
          menge: parseFloat(row.menge),
          netto_betrag: parseFloat(row.netto_betrag || 0),
          bemerkung: row.bemerkung || '',
        }))
      );
      setData(null);
      setFile(null);
      setValidationErrors([]);
      onSuccess?.();
    } catch (err) {
      setValidationErrors([`Import-Fehler: ${err.message}`]);
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700">
          <strong>Anforderungen:</strong> CSV mit Spalten: datum (YYYY-MM-DD), wohneinheit_id, leistungs_id, menge, netto_betrag (optional)
        </p>
      </div>

      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer"
        onClick={() => fileRef.current?.click()}>
        <Upload className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="font-medium text-slate-700">CSV-Datei auswählen</p>
        <p className="text-xs text-slate-400 mt-1">oder hier ablegen</p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
      </div>

      {file && (
        <div className="bg-white rounded-xl border border-slate-100 p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">{file.name}</span>
          <button onClick={() => { setFile(null); setData(null); }} className="text-xs text-slate-400 hover:text-red-600">
            Zurücksetzen
          </button>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertCircle className="w-4 h-4" />
            Validierungsfehler
          </div>
          <div className="space-y-0.5 text-xs text-red-600">
            {validationErrors.slice(0, 5).map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
            {validationErrors.length > 5 && <p>...und {validationErrors.length - 5} weitere</p>}
          </div>
        </div>
      )}

      {data && validationErrors.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">{data.length} Zeilen validiert</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Datum</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Wohneinheit</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Leistung</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Menge</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Netto €</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{row.datum}</td>
                    <td className="px-3 py-2 font-medium">{row.wohneinheit_id}</td>
                    <td className="px-3 py-2">{row.leistungs_id}</td>
                    <td className="px-3 py-2 text-right">{row.menge}</td>
                    <td className="px-3 py-2 text-right">{parseFloat(row.netto_betrag || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 5 && <p className="px-3 py-2 text-xs text-slate-400">...und {data.length - 5} weitere Zeilen</p>}
          </div>

          <button onClick={importData} disabled={importing}
            className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {importing ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {importing ? 'Wird importiert...' : 'Jetzt importieren'}
          </button>
        </div>
      )}
    </div>
  );
}