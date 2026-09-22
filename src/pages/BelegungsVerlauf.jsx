import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function BelegungsVerlauf() {
  const { selectedEinrichtung } = useEinrichtung();
  const [snapshots, setSnapshots] = useState([]);
  const [historien, setHistorien] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    Promise.all([
      base44.entities.BelegungsSnapshot.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.MonatsabschlussHistorie.filter({ einrichtung_id: selectedEinrichtung.id }),
    ]).then(([snaps, hist]) => {
      setSnapshots(snaps);
      setHistorien(hist.sort((a,b) => a.jahr - b.jahr || a.monat - b.monat));
      setLoading(false);
    });
  }, [selectedEinrichtung]);

  const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  const verlaufData = historien.map(h => ({
    name: `${MONATE[(h.monat||1)-1]} ${h.jahr}`,
    Bewohner: h.bewohner_gesamt || 0,
    Soll: h.sollbelegung || 0,
    Auslastung: h.auslastung_prozent || 0,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Belegungsverlauf</h1>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : verlaufData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
          Noch keine Daten vorhanden. Erstelle zuerst Monatsabschlüsse.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-4">Belegung & Sollbelegung</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={verlaufData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Bewohner" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Soll" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Auslastung (%)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={verlaufData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 110]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="Auslastung" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}