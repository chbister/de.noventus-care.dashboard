import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Brain, TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatEUR, MONATE_KURZ } from '@/lib/sachkostenUtils';

export default function ForecastPanel() {
  const { selectedEinrichtung } = useEinrichtung();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const runForecast = async () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    setError('');
    try {
      const resp = await base44.functions.invoke('generateForecast', { einrichtung_id: selectedEinrichtung.id });
      if (resp.data?.success) {
        setData(resp.data);
      } else {
        setError(resp.data?.error || 'Unbekannter Fehler');
      }
    } catch (e) {
      setError(e.message || 'Fehler beim Abruf der Prognose');
    }
    setLoading(false);
  };

  const riskConfig = {
    niedrig: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle, label: 'Niedrig' },
    mittel: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: AlertTriangle, label: 'Mittel' },
    hoch: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle, label: 'Hoch' },
  };
  const risk = data?.forecast?.risiko_level ? riskConfig[data.forecast.risiko_level] || riskConfig.niedrig : null;

  // Chart data: historical + forecast
  const sachkostenChart = [];
  if (data?.historical?.sachkosten) {
    const hist = data.historical.sachkosten;
    Object.keys(hist).forEach(m => {
      const [y, mo] = m.split('-');
      sachkostenChart.push({ monat: `${MONATE_KURZ[parseInt(mo) - 1]} ${y}`, Historisch: hist[m], Prognose: null });
    });
  }
  if (data?.forecast?.sachkosten_prognose) {
    data.forecast.sachkosten_prognose.forEach(p => {
      const [y, mo] = p.monat.split('-');
      sachkostenChart.push({ monat: `${MONATE_KURZ[parseInt(mo) - 1] || p.monat} ${y}`, Historisch: null, Prognose: p.betrag });
    });
  }

  const personalChart = data?.forecast?.personalbedarf_prognose?.map(p => {
    const [y, mo] = p.monat.split('-');
    return { monat: `${MONATE_KURZ[parseInt(mo) - 1] || p.monat} ${y}`, 'VK Soll': p.vk_soll, 'VK Ist': p.vk_ist };
  }) || [];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">KI-Prognose & Forecasting</h2>
            <p className="text-sm text-violet-100">Analyse für Kosten, Belegung und Personalbedarf</p>
          </div>
        </div>
        <button onClick={runForecast} disabled={loading || !selectedEinrichtung}
          className="bg-white text-violet-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-50 disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Prognose wird erstellt…' : 'KI-Prognose starten'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Risk Level + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {risk && (
              <div className={`rounded-2xl border p-5 ${risk.bg} ${risk.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <risk.icon className={`w-5 h-5 ${risk.text}`} />
                  <span className="text-xs font-medium text-slate-600">Risiko-Level</span>
                </div>
                <p className={`text-2xl font-bold ${risk.text}`}>{risk.label}</p>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Zusammenfassung</h3>
              <p className="text-sm text-slate-600">{data.forecast.zusammenfassung}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Sachkosten: Historisch vs. Prognose</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={sachkostenChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="monat" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatEUR(v)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line dataKey="Historisch" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  <Line dataKey="Prognose" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Personalbedarf: VK Soll vs. Ist</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={personalChart} barSize={20} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="monat" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="VK Soll" fill="#94a3b8" radius={[4,4,0,0]} />
                  <Bar dataKey="VK Ist" fill="#8b5cf6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommendations */}
          {data.forecast.empfehlungen?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">KI-Empfehlungen</h3>
              <div className="space-y-2">
                {data.forecast.empfehlungen.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Bewohner" value={data.historical.bewohner} sub={`von ${data.historical.sollPlaetze} (${data.historical.auslastung}%)`} />
            <KpiCard label="Personalkosten/Monat" value={formatEUR(data.historical.personalCosts)} sub={`${data.historical.vkIst} VK Ist`} />
            <KpiCard label="Fehltage aktuell" value={data.historical.fehlTage} sub={`Monat ${data.historical.monate?.[5] || ''}`} />
            <KpiCard label="Sachkosten letzter Monat" value={formatEUR(data.historical.sachkosten?.[data.historical.monate?.[5]] || 0)} sub="Letzter abgeschlossener Monat" />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}