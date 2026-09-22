import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Bell, AlertTriangle, TrendingDown, Wallet, CheckCheck, RefreshCw } from 'lucide-react';

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', icon: AlertTriangle, label: 'Kritisch' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', icon: AlertTriangle, label: 'Warnung' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500', icon: Bell, label: 'Info' },
};

const TYPE_ICONS = {
  budget_ueberschritten: Wallet,
  belegung_rueckgang: TrendingDown,
  fehlzeiten_spitze: AlertTriangle,
  personaldecke: TrendingDown,
};

export default function AlertsPanel() {
  const { selectedEinrichtung, einrichtungen } = useEinrichtung();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      let filter = { ist_aktiv: true };
      if (scope === 'einrichtung' && selectedEinrichtung) filter = { ist_aktiv: true, einrichtung_id: selectedEinrichtung.id };
      const data = await base44.entities.Alert.filter(filter);
      data.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
      setAlerts(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEinrichtung, scope]);

  const acknowledge = async (alertId) => {
    const user = await base44.auth.me();
    await base44.entities.Alert.update(alertId, { ist_aktiv: false, quittiert_von: user?.email || '', quittiert_am: new Date().toISOString() });
    load();
  };

  const acknowledgeAll = async () => {
    const user = await base44.auth.me();
    await base44.entities.Alert.updateMany({ ist_aktiv: true }, { $set: { ist_aktiv: false, quittiert_von: user?.email || '', quittiert_am: new Date().toISOString() } });
    load();
  };

  const grouped = {
    critical: alerts.filter(a => a.severity === 'critical'),
    warning: alerts.filter(a => a.severity === 'warning'),
    info: alerts.filter(a => a.severity === 'info'),
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-rose-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Real-time Alerts</h2>
            <p className="text-sm text-rose-100">Automatische Benachrichtigungen bei Budgetüberschreitungen, Belegungsrückgängen & Fehlzeiten-Spitzen</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setScope('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${scope === 'all' ? 'bg-white text-rose-700' : 'bg-white/20 text-white'}`}>
            Alle Einrichtungen
          </button>
          <button onClick={() => setScope('einrichtung')} disabled={!selectedEinrichtung} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${scope === 'einrichtung' ? 'bg-white text-rose-700' : 'bg-white/20 text-white'} disabled:opacity-50`}>
            {selectedEinrichtung?.name || 'Einrichtung'}
          </button>
          <button onClick={load} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-white/20 text-white hover:bg-white/30 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard count={grouped.critical.length} label="Kritisch" style={SEVERITY_STYLES.critical} />
        <SummaryCard count={grouped.warning.length} label="Warnungen" style={SEVERITY_STYLES.warning} />
        <SummaryCard count={grouped.info.length} label="Info" style={SEVERITY_STYLES.info} />
      </div>

      {alerts.length > 0 && (
        <button onClick={acknowledgeAll} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <CheckCheck className="w-4 h-4" /> Alle {alerts.length} Alerts quittieren
        </button>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" /></div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CheckCheck className="w-10 h-10 mx-auto mb-2 text-green-400" />
          <p className="text-sm text-slate-500">Keine aktiven Alerts — alles im grünen Bereich.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const st = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.warning;
            const TypeIcon = TYPE_ICONS[alert.typ] || Bell;
            return (
              <div key={alert.id} className={`rounded-xl border p-4 ${st.bg} ${st.border}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${st.bg} border ${st.border} flex items-center justify-center shrink-0`}>
                    <TypeIcon className={`w-4 h-4 ${st.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      <span className="text-xs text-slate-400">{alert.einrichtung_name}</span>
                    </div>
                    <p className="font-medium text-slate-900 text-sm">{alert.titel}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{alert.nachricht}</p>
                  </div>
                  <button onClick={() => acknowledge(alert.id)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                    Quittieren
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ count, label, style }) {
  return (
    <div className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
      <p className={`text-2xl font-bold ${style.text}`}>{count}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}