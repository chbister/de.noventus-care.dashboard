import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, AlertCircle, CheckCircle, Loader, Download, Save } from 'lucide-react';

export default function MediFoxImportManager({ onSuccess, bereich = 'Tagespflege' }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const fileRef = useRef(null);

  const today = new Date().toISOString().substring(0, 10);
  const kw = Math.ceil((new Date().getDate() + new Date(new Date().getFullYear(), 0, 1).getDay()) / 7);
  const jahr = new Date().getFullYear();
  const defaultBatch = `KW${kw}_${jahr}`;

  // Parse CSV
  const handleFileSelect = async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    setFile(f);
    setValidationErrors([]);
    setImportErrors([]);
    setData(null);

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

  // Validierung
  const validateData = (rows) => {
    const errors = [];
    const requiredFields = ['leistungsdatum', 'klienten_id', 'pflegegrad', 'kst_nr', 'stunden'];

    // Dubletten-Check
    const seen = new Set();
    rows.forEach((row, idx) => {
      // Erforderliche Felder
      requiredFields.forEach(field => {
        if (!row[field]) {
          errors.push(`Zeile ${idx + 1}: ${field} fehlt`);
        }
      });

      // Datum-Validierung
      if (row.leistungsdatum && !/^\d{4}-\d{2}-\d{2}$/.test(row.leistungsdatum)) {
        errors.push(`Zeile ${idx + 1}: Datum muss YYYY-MM-DD sein`);
      }

      // Stunden-Validierung
      if (isNaN(parseFloat(row.stunden)) || parseFloat(row.stunden) <= 0) {
        errors.push(`Zeile ${idx + 1}: Stunden muss > 0 sein`);
      }

      // Pflegegrad-Validierung
      if (row.pflegegrad && !['PG1', 'PG2', 'PG3', 'PG4', 'PG5'].includes(row.pflegegrad.toUpperCase())) {
        errors.push(`Zeile ${idx + 1}: Ungültiger Pflegegrad ${row.pflegegrad}`);
      }

      // Dubletten-Check
      const key = `${row.leistungsdatum}_${row.klienten_id}`;
      if (seen.has(key)) {
        errors.push(`Zeile ${idx + 1}: ⚠️ Dublette mit Datum ${row.leistungsdatum} und Klient ${row.klienten_id}`);
      }
      seen.add(key);
    });

    return errors;
  };

  // Snapshot erstellen
  const createSnapshot = async () => {
    try {
      const summeStunden = data.reduce((s, row) => s + parseFloat(row.stunden || 0), 0);
      await base44.entities.Import_Snapshot.create({
        snapshot_name: `Vor_MediFox_Import_${defaultBatch}_${bereich}`,
        snapshot_datum: today,
        import_quelle: 'MediFox',
        import_batch: defaultBatch,
        anzahl_datensaetze: data.length,
        anzahl_leistungen: Math.round(summeStunden * 100) / 100,
        bereich: bereich,
        notiz: `Snapshot vor MediFox-Import für ${bereich}`,
      });
      return true;
    } catch (err) {
      setImportErrors([`Snapshot-Fehler: ${err.message}`]);
      return false;
    }
  };

  // Daten importieren
  const importData = async () => {
    if (!data || data.length === 0) return;

    // Snapshot vor Import
    if (!await createSnapshot()) {
      setImporting(false);
      return;
    }

    setImporting(true);
    const errors = [];

    try {
      // Mappings laden
      const mappings = await base44.entities.Mapping_MediFox.list();

      // Batch import
      const rohdaten = data.map(row => {
        const mapping = mappings.find(m => m.kst_nr_medifox === row.kst_nr);
        const statusValidierung = validationErrors.length > 0 ? '⚠️ Dublette' : '✅ OK';

        return {
          import_datum: today,
          import_batch: defaultBatch,
          leistungsdatum: row.leistungsdatum,
          klienten_id_medifox: row.klienten_id,
          klienten_id_base44: row.klienten_id,
          pflegegrad: row.pflegegrad.toUpperCase(),
          kst_nr: row.kst_nr,
          l_art: row.l_art || 'SGB11',
          ma_handzeichen: row.ma_handzeichen || '',
          stunden: parseFloat(row.stunden || 0),
          status_validierung: statusValidierung,
          status_mapping: mapping ? '✅ Zugeordnet' : '⚠️ Teilweise',
          fehlermeldung: mapping ? '' : `Mapping für KSt ${row.kst_nr} fehlt`,
        };
      });

      await base44.entities.Leistung_Rohdaten_MediFox.bulkCreate(rohdaten);

      setData(null);
      setFile(null);
      setValidationErrors([]);
      setImportErrors([]);
      onSuccess?.();
    } catch (err) {
      setImportErrors([`Import-Fehler: ${err.message}`]);
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      {/* Infobanner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Anforderungen:</strong> CSV mit Spalten: leistungsdatum (YYYY-MM-DD), klienten_id, pflegegrad (PG1-5), kst_nr, stunden (dezimal), l_art, ma_handzeichen (optional)
        </p>
      </div>

      {/* Upload */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
        onClick={() => fileRef.current?.click()}>
        <Upload className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="font-medium text-slate-700">MediFox CSV-Datei auswählen</p>
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

      {/* Validierungsfehler */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertCircle className="w-4 h-4" />
            Validierungsfehler ({validationErrors.length})
          </div>
          <div className="space-y-0.5 text-xs text-red-600 max-h-40 overflow-y-auto">
            {validationErrors.slice(0, 10).map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
            {validationErrors.length > 10 && <p className="font-medium">...und {validationErrors.length - 10} weitere</p>}
          </div>
        </div>
      )}

      {/* Import-Fehler */}
      {importErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertCircle className="w-4 h-4" />
            Import-Fehler
          </div>
          <div className="space-y-0.5 text-xs text-red-600">
            {importErrors.map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Vorschau + Import */}
      {data && validationErrors.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">{data.length} Zeilen validiert ✓</span>
          </div>

          {/* Vorschau */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Datum</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Klient</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">PG</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Stunden</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">KSt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{row.leistungsdatum}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.klienten_id}</td>
                    <td className="px-3 py-2 text-slate-600">{row.pflegegrad}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{parseFloat(row.stunden).toFixed(2)}h</td>
                    <td className="px-3 py-2 text-slate-600">{row.kst_nr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 5 && <p className="px-3 py-2 text-xs text-slate-400">...und {data.length - 5} weitere Zeilen</p>}
          </div>

          {/* Optionen */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showSnapshot} onChange={e => setShowSnapshot(e.target.checked)}
                className="rounded border-slate-300 text-blue-600" />
              <span className="text-slate-700">📸 Snapshot VOR Import erstellen (empfohlen)</span>
            </label>
            <p className="text-xs text-slate-500 ml-6">Name: Vor_MediFox_Import_{defaultBatch}_{bereich}</p>
          </div>

          {/* Import-Button */}
          <button onClick={importData} disabled={importing || !showSnapshot}
            className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              importing || !showSnapshot
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
            {importing ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? 'Import läuft...' : 'Jetzt importieren'}
          </button>
        </div>
      )}
    </div>
  );
}