import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Save, Users, Download, Mail } from 'lucide-react';

const DEFAULT_CFG = {
  export_heimkosten: true,
  export_bewohner_kosten: true,
  export_mitarbeiter: true,
  export_verguetung: true,
  export_wohnbereiche: true,
  export_tagespflege: true,
  export_dashboard: true,
  auto_export_aktiv: false,
  vierzehntaegig_aktiv: false,
  vierzehntaegig_uhrzeit: '07:00',
  export_empfaenger_ids: [],
};

export default function ExportEinstellungen() {
  const { selectedEinrichtung } = useEinrichtung();
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const [cfgId, setCfgId] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!selectedEinrichtung) return;
    Promise.all([
      base44.entities.ExportEinstellung.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.User.list(),
    ]).then(([settings, userList]) => {
      setUsers(userList);
      if (settings.length > 0) {
        setCfg({ ...DEFAULT_CFG, ...settings[0] });
        setCfgId(settings[0].id);
      } else {
        setCfg({ ...DEFAULT_CFG });
        setCfgId(null);
      }
    });
  }, [selectedEinrichtung]);

  const save = async () => {
    setSaving(true);
    const data = { ...cfg, einrichtung_id: selectedEinrichtung.id };
    if (cfgId) {
      await base44.entities.ExportEinstellung.update(cfgId, data);
    } else {
      const created = await base44.entities.ExportEinstellung.create(data);
      setCfgId(created.id);
    }
    setSaving(false);
    setMsg({ type: 'success', text: 'Einstellungen gespeichert.' });
    setTimeout(() => setMsg(null), 3000);
  };

  const exportNow = async () => {
    setExporting(true);
    setMsg(null);
    try {
      const response = await base44.functions.invoke('exportXlsx', {});
      // Blob download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      a.download = `RFC_Export_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: 'Export erfolgreich!' });
    } catch (e) {
      setMsg({ type: 'error', text: `Fehler: ${e.message}` });
    }
    setExporting(false);
  };

  const toggleEmpfaenger = (userId) => {
    const ids = cfg.export_empfaenger_ids || [];
    setCfg(p => ({
      ...p,
      export_empfaenger_ids: ids.includes(userId) ? ids.filter(i => i !== userId) : [...ids, userId],
    }));
  };

  const CheckRow = ({ label, field }) => (
    <label className="flex items-center gap-3 py-2 cursor-pointer hover:bg-slate-50 rounded px-2">
      <input type="checkbox" checked={cfg[field] !== false}
        onChange={e => setCfg(p => ({ ...p, [field]: e.target.checked }))}
        className="w-4 h-4 rounded border-slate-300 text-teal-600" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );

  if (!selectedEinrichtung) {
    return <p className="text-slate-400 text-sm">Bitte zuerst eine Einrichtung auswählen.</p>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Export-Inhalte */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-teal-600" /> Export-Inhalte
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          <CheckRow label="Dashboard / Kennzahlen" field="export_dashboard" />
          <CheckRow label="Wohnbereiche" field="export_wohnbereiche" />
          <CheckRow label="Tagespflege" field="export_tagespflege" />
          <CheckRow label="Mitarbeiter" field="export_mitarbeiter" />
          <CheckRow label="Heimkosten" field="export_heimkosten" />
          <CheckRow label="Bewohner Kosten" field="export_bewohner_kosten" />
          <CheckRow label="Vergütung" field="export_verguetung" />
        </div>
      </div>

      {/* Empfänger */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal-600" /> E-Mail Empfänger
        </h3>
        <p className="text-xs text-slate-400 mb-3">Ausgewählte Benutzer erhalten den Export automatisch per E-Mail.</p>
        <div className="space-y-1">
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-3 py-2 px-2 cursor-pointer hover:bg-slate-50 rounded">
              <input type="checkbox"
                checked={(cfg.export_empfaenger_ids || []).includes(u.id)}
                onChange={() => toggleEmpfaenger(u.id)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600" />
              <div>
                <span className="text-sm text-slate-700">{u.full_name || u.email}</span>
                <span className="text-xs text-slate-400 ml-2">{u.email}</span>
              </div>
            </label>
          ))}
          {users.length === 0 && <p className="text-xs text-slate-400">Keine Benutzer gefunden.</p>}
        </div>
      </div>

      {/* 14-tägige Erinnerung */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" /> 14-tägige Export-Erinnerung
        </h3>
        <label className="flex items-center gap-3 cursor-pointer mb-3">
          <input type="checkbox" checked={cfg.vierzehntaegig_aktiv}
            onChange={e => setCfg(p => ({ ...p, vierzehntaegig_aktiv: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 text-teal-600" />
          <span className="text-sm text-slate-700">Alle 14 Tage Erinnerung per E-Mail senden</span>
        </label>
        {cfg.vierzehntaegig_aktiv && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Uhrzeit</label>
            <input type="time" value={cfg.vierzehntaegig_uhrzeit || '07:00'}
              onChange={e => setCfg(p => ({ ...p, vierzehntaegig_uhrzeit: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Speichert...' : 'Einstellungen speichern'}
        </button>
        <button onClick={exportNow} disabled={exporting}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 text-sm font-medium disabled:opacity-50">
          <Download className="w-4 h-4" /> {exporting ? 'Exportiert...' : 'Export jetzt starten'}
        </button>
      </div>
    </div>
  );
}