import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Save, History } from 'lucide-react';

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export default function Monatsabschluss() {
  const { selectedEinrichtung } = useEinrichtung();
  const [historien, setHistorien] = useState([]);
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [monat, setMonat] = useState(now.getMonth() + 1);
  const [jahr, setJahr] = useState(now.getFullYear());
  const [bemerkung, setBemerkung] = useState('');

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    Promise.all([
      base44.entities.MonatsabschlussHistorie.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Mitarbeiter.filter({ einrichtung_id: selectedEinrichtung.id, aktiv: true }),
    ]).then(([h, wb, ma]) => {
      setHistorien(h.sort((a,b) => b.jahr - a.jahr || b.monat - a.monat));
      setWohnbereiche(wb); setMitarbeiter(ma); setLoading(false);
    });
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  const berechne = () => {
    const bewohner = wohnbereiche.reduce((s, w) =>
      s+(w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0)+(w.belegung_pg0||0), 0);
    const soll = wohnbereiche.reduce((s, w) => s + (w.sollbelegung || 0), 0);
    const auslastung = soll > 0 ? Math.round(bewohner / soll * 100) : 0;
    const istFk = mitarbeiter.reduce((s, m) => s + (m.vk_pfk || 0), 0);
    const istHkMit = mitarbeiter.reduce((s, m) => s + (m.vk_phk_mit_ausbildung || 0), 0);
    const istHkOhne = mitarbeiter.reduce((s, m) => s + (m.vk_phk_ohne_ausbildung || 0), 0);
    return { bewohner, soll, auslastung, istFk, istHkMit, istHkOhne };
  };

  const speichern = async () => {
    setSaving(true);
    const c = berechne();
    await base44.entities.MonatsabschlussHistorie.create({
      einrichtung_id: selectedEinrichtung.id,
      monat, jahr,
      bewohner_gesamt: c.bewohner,
      sollbelegung: c.soll,
      auslastung_prozent: c.auslastung,
      personal_ist_fk: c.istFk,
      personal_ist_hk_mit: c.istHkMit,
      personal_ist_hk_ohne: c.istHkOhne,
      bemerkung,
    });
    setBemerkung(''); load(); setSaving(false);
  };

  const c = berechne();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Monatsabschluss</h1>

      {/* Aktueller Snapshot */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Abschluss erfassen</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Monat</label>
            <select value={monat} onChange={e => setMonat(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {MONATE.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Jahr</label>
            <input type="number" value={jahr} onChange={e => setJahr(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Bewohner', value: c.bewohner },
            { label: 'Sollbelegung', value: c.soll },
            { label: 'Auslastung', value: `${c.auslastung}%` },
            { label: 'VK Fachkräfte', value: c.istFk.toFixed(2) },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-lg p-3">
              <div className="text-lg font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-1 block">Bemerkung</label>
          <textarea value={bemerkung} onChange={e => setBemerkung(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
        </div>
        <button onClick={speichern} disabled={saving} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Speichert...' : 'Abschluss speichern'}
        </button>
      </div>

      {/* Historie */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Historie</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-slate-400">Lade...</div>
        ) : historien.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Noch keine Abschlüsse</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 font-medium text-slate-600 text-left">Zeitraum</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Bewohner</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Auslastung</th>
                <th className="px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Bemerkung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historien.map(h => (
                <tr key={h.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{MONATE[(h.monat||1)-1]} {h.jahr}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{h.bewohner_gesamt}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-600">{h.auslastung_prozent}%</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{h.bemerkung || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}