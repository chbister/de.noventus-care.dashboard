import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { formatEUR } from '@/lib/sachkostenUtils';

export default function SachkostenCharts({ kategorien, trendData }) {
  const barData = kategorien.map(k => ({
    name: k.name.length > 15 ? k.name.substring(0, 13) + '…' : k.name,
    Sollbudget: k.sollbudget,
    Istkosten: k.istkosten,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4 text-sm">Soll- vs. Istkosten je Kategorie</h3>
        {barData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Keine Daten verfügbar</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Sollbudget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Istkosten" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4 text-sm">Monatlicher Kostenverlauf</h3>
        {trendData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Keine Verlaufsdaten verfügbar</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="Sollbudget" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} name="Sollbudget" />
              <Line dataKey="Istkosten" stroke="#0d9488" strokeWidth={2} name="Istkosten" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}