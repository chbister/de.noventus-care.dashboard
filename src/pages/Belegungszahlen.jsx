import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Belegungszahlen() {
  const { selectedEinrichtung } = useEinrichtung();
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [tagespflege, setTagespflege] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    Promise.all([
      base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Tagespflege.filter({ einrichtung_id: selectedEinrichtung.id }),
    ]).then(([wb, tp]) => { setWohnbereiche(wb); setTagespflege(tp); setLoading(false); });
  }, [selectedEinrichtung]);

  const wbData = wohnbereiche.map(wb => ({
    name: wb.name,
    PG2: wb.belegung_pg2 || 0,
    PG3: wb.belegung_pg3 || 0,
    PG4: wb.belegung_pg4 || 0,
    PG5: wb.belegung_pg5 || 0,
    Rüstige: wb.belegung_ruestige || 0,
    Soll: wb.sollbelegung || 0,
  }));

  const gesamtBewohner = wohnbereiche.reduce((s, w) =>
    s + (w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0), 0);
  const gesamtSoll = wohnbereiche.reduce((s, w) => s + (w.sollbelegung || 0), 0);

  const pgVerteilung = [2,3,4,5].map(pg => ({
    name: `PG ${pg}`,
    Stationär: wohnbereiche.reduce((s, w) => s + (w[`belegung_pg${pg}`] || 0), 0),
    Tagespflege: tagespflege.reduce((s, t) => s + (t[`belegung_pg${pg}`] || 0), 0),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Belegungszahlen</h1>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Übersicht */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Bewohner gesamt', value: gesamtBewohner, color: 'text-teal-600' },
              { label: 'Sollbelegung', value: gesamtSoll, color: 'text-blue-600' },
              { label: 'Auslastung', value: `${gesamtSoll > 0 ? Math.round(gesamtBewohner/gesamtSoll*100) : 0}%`, color: 'text-violet-600' },
              { label: 'Freie Plätze', value: Math.max(0, gesamtSoll - gesamtBewohner), color: 'text-orange-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Belegung pro Wohnbereich */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-4">Belegung nach Wohnbereich</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={wbData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="PG2" fill="#5eead4" stackId="a" />
                <Bar dataKey="PG3" fill="#2dd4bf" stackId="a" />
                <Bar dataKey="PG4" fill="#14b8a6" stackId="a" />
                <Bar dataKey="PG5" fill="#0d9488" stackId="a" />
                <Bar dataKey="Rüstige" fill="#94a3b8" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* PG-Verteilung */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Pflegegrad-Verteilung</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pgVerteilung}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Stationär" fill="#14b8a6" />
                <Bar dataKey="Tagespflege" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}