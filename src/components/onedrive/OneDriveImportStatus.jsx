import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Cloud, RefreshCw, CheckCircle, AlertCircle, FolderTree, Loader2 } from 'lucide-react';

const BEREICH_LABELS = {
  mitarbeiter_datev: 'Mitarbeiter (Gehalt/SV)',
  mitarbeiter_medifox: 'Mitarbeiter (MediFox)',
  sachkosten: 'Sachkosten',
  fehlzeiten: 'Fehlzeiten',
  medifox_abrechnung: 'MediFox-Abrechnung',
  bewohner: 'Bewohner-Pflegegrade',
  bewohner_kosten: 'Bewohner-Kosten',
  kontoblatt: 'Kontoblatt',
};

const STATUS_STYLES = {
  erfolg: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle, label: 'Erfolg' },
  fehler: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle, label: 'Fehler' },
  uebersprungen: { bg: 'bg-slate-50', text: 'text-slate-500', icon: CheckCircle, label: 'Übersprungen' },
};

export default function OneDriveImportStatus() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    base44.entities.OneDriveImportLog.list('-importdatum', 50)
      .then(data => { setLogs(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Status-Karte */}
      <div className="bg-gradient-to-br from-blue-50 to-teal-50 border border-blue-100 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-white rounded-lg shadow-sm">
            <Cloud className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">OneDrive Auto-Import</h3>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
              <CheckCircle className="w-3.5 h-3.5" /> Verbunden · Automatischer Scan alle 10 Min
            </p>
          </div>
        </div>
        <div className="bg-white/70 rounded-lg p-4 mt-3">
          <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
            <FolderTree className="w-4 h-4 text-blue-500" /> Dein SharePoint-Pfad:
          </p>
          <pre className="text-xs text-slate-600 font-mono leading-relaxed bg-slate-50 rounded-lg p-3 overflow-x-auto">
{`2. 0 Dashboard Synchronisation  ← Root
  └── {NN} {Einrichtungsname}/
      ├── Export Bewohner mit Einstufungen/  → Bewohner-Pflegegrade
      ├── Export Gehaltsbestandteile/        → Mitarbeiter (Gehalt)
      ├── Export SV-Anteile/                 → Mitarbeiter (SV-AG)
      ├── Export Mitarbeiter MediFox/         → Mitarbeiter (MediFox)
      ├── Export Fehlzeiten/                 → Fehlzeiten
      ├── Export MediFox-Abrechnung/         → MediFox-Abrechnung
      ├── Export Bewohner-Kosten/            → Bewohner-Kosten
      ├── Export Kontoblatt/                → Kontoblatt
      ├── Export Lebensmittel/              → Sachkosten
      ├── Export Pflegebedarf/              → Sachkosten
      └── Export Wäscherei/                 → Sachkosten`}
          </pre>
          <p className="text-xs text-slate-500 mt-2">
            Dateien werden automatisch importiert, sobald sie im entsprechenden Ordner abgelegt oder geändert werden.
            Das Nummern-Präfix (01, 02 …) wird automatisch entfernt — die Einrichtung wird anhand des Namens erkannt.
          </p>
        </div>
      </div>

      {/* Import-Protokoll */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Import-Protokoll</h3>
          <button onClick={load} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400">
            <Cloud className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">Noch keine Importe über OneDrive durchgeführt.</p>
            <p className="text-xs mt-1">Lege eine Datei im OneDrive-Ordner ab, um zu starten.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2 font-medium text-slate-600">Datum</th>
                  <th className="px-4 py-2 font-medium text-slate-600">Datei</th>
                  <th className="px-4 py-2 font-medium text-slate-600 hidden sm:table-cell">Einrichtung</th>
                  <th className="px-4 py-2 font-medium text-slate-600 hidden md:table-cell">Bereich</th>
                  <th className="px-4 py-2 font-medium text-slate-600 text-right">Neu/Update</th>
                  <th className="px-4 py-2 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(log => {
                  const style = STATUS_STYLES[log.status] || STATUS_STYLES.fehler;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">
                        {log.importdatum ? new Date(log.importdatum).toLocaleDateString('de-DE') : '—'}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800 max-w-[200px] truncate" title={log.dateiname}>
                        {log.dateiname}
                      </td>
                      <td className="px-4 py-2 text-slate-500 hidden sm:table-cell">{log.einrichtung_name || '—'}</td>
                      <td className="px-4 py-2 text-slate-500 hidden md:table-cell">
                        {BEREICH_LABELS[log.bereich] || log.bereich}
                      </td>
                      <td className="px-4 py-2 text-right text-xs">
                        {log.anzahl_neu > 0 && <span className="text-teal-600">{log.anzahl_neu} neu</span>}
                        {log.anzahl_neu > 0 && log.anzahl_aktualisiert > 0 && <span className="text-slate-300"> · </span>}
                        {log.anzahl_aktualisiert > 0 && <span className="text-blue-600">{log.anzahl_aktualisiert} upd.</span>}
                        {log.anzahl_neu === 0 && log.anzahl_aktualisiert === 0 && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          <style.icon className="w-3 h-3" />
                          {style.label}
                        </span>
                        {log.detail && (
                          <p className="text-xs text-slate-400 mt-0.5 max-w-[250px] truncate" title={log.detail}>{log.detail}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}