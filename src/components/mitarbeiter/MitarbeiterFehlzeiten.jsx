import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Save, X, Trash2, CalendarDays, Loader2, Upload } from 'lucide-react';
import FehlzeitenImport from '@/components/mitarbeiter/FehlzeitenImport';
import { maskName } from '@/lib/nameMask';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const ARTEN = ['Krank', 'Urlaub', 'Fortbildung', 'Sonderurlaub', 'Unbezahlter Urlaub', 'Sonstiges'];
const ART_FARBEN = {
  'Krank': '#ef4444',
  'Urlaub': '#22c55e',
  'Fortbildung': '#3b82f6',
  'Sonderurlaub': '#a855f7',
  'Unbezahlter Urlaub': '#f59e0b',
  'Sonstiges': '#64748b',
};
const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

// Werktage (Mo-Fr) zwischen zwei Daten (inklusive)
function werktage(von, bis) {
  if (!von || !bis) return 0;
  const start = new Date(von);
  const end = new Date(bis);
  if (end < start) return 0;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

const EMPTY = { mitarbeiter_id: '', art: 'Krank', von_datum: '', bis_datum: '', bemerkung: '' };

export default function MitarbeiterFehlzeiten({ mitarbeiter, isAdmin = false }) {
  const { selectedEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [showImport, setShowImport] = useState(false);

  const maById = useMemo(() => {
    const m = {};
    (mitarbeiter || []).forEach(ma => { m[ma.id] = ma; });
    return m;
  }, [mitarbeiter]);

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    Promise.all([
      base44.entities.MitarbeiterFehlzeiten.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id }),
    ]).then(([data, wb]) => { setItems(data); setWohnbereiche(wb); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  const save = async () => {
    if (!form.mitarbeiter_id || !form.von_datum) return;
    const tage = form.bis_datum ? werktage(form.von_datum, form.bis_datum) : 1;
    const data = {
      ...form,
      einrichtung_id: selectedEinrichtung.id,
      bis_datum: form.bis_datum || form.von_datum,
      tage,
    };
    await base44.entities.MitarbeiterFehlzeiten.create(data);
    setForm(EMPTY); setShowForm(false); load();
  };

  const del = async (id) => {
    if (!confirm('Fehlzeit löschen?')) return;
    await base44.entities.MitarbeiterFehlzeiten.delete(id); load();
  };

  // Diagramm: Fehltage pro Monat (gestapelt nach Art) im gewählten Jahr
  const chartData = useMemo(() => {
    const monate = MONATE.map((m, i) => ({ monat: m, ...Object.fromEntries(ARTEN.map(a => [a, 0])) }));
    items.forEach(f => {
      if (!f.von_datum) return;
      const d = new Date(f.von_datum);
      if (d.getFullYear() !== jahr) return;
      const idx = d.getMonth();
      if (idx < 0 || idx > 11) return;
      monate[idx][f.art] = (monate[idx][f.art] || 0) + (f.tage || 1);
    });
    return monate;
  }, [items, jahr]);

  // Zusammenfassung pro Mitarbeiter
  const proMitarbeiter = useMemo(() => {
    const map = {};
    items.forEach(f => {
      if (!f.von_datum) return;
      const d = new Date(f.von_datum);
      if (d.getFullYear() !== jahr) return;
      if (!map[f.mitarbeiter_id]) {
        map[f.mitarbeiter_id] = { id: f.mitarbeiter_id, name: maskName(maById[f.mitarbeiter_id]?.name, isAdmin) || '—', gesamt: 0, krank: 0, urlaub: 0 };
      }
      map[f.mitarbeiter_id].gesamt += (f.tage || 1);
      if (f.art === 'Krank') map[f.mitarbeiter_id].krank += (f.tage || 1);
      if (f.art === 'Urlaub') map[f.mitarbeiter_id].urlaub += (f.tage || 1);
    });
    return Object.values(map).sort((a, b) => b.gesamt - a.gesamt);
  }, [items, jahr, maById, isAdmin]);

  // Übersicht pro Wohnbereich (monatlich)
  const wbById = useMemo(() => {
    const m = {};
    wohnbereiche.forEach(wb => { m[wb.id] = wb; });
    return m;
  }, [wohnbereiche]);

  const proWohnbereich = useMemo(() => {
    const map = {};
    const ensure = (wbId) => {
      if (!map[wbId]) {
        map[wbId] = {
          id: wbId,
          name: wbId ? (wbById[wbId]?.name || 'Unbekannt') : 'Ohne Zuordnung',
          gesamt: 0,
          krank: 0,
          monate: Array(12).fill(0),
        };
      }
      return map[wbId];
    };
    items.forEach(f => {
      if (!f.von_datum) return;
      const d = new Date(f.von_datum);
      if (d.getFullYear() !== jahr) return;
      const ma = maById[f.mitarbeiter_id];
      const wbId = ma?.wohnbereich_id || '';
      const entry = ensure(wbId);
      const tage = f.tage || 1;
      entry.gesamt += tage;
      entry.monate[d.getMonth()] += tage;
      if (f.art === 'Krank') entry.krank += tage;
    });
    return Object.values(map).sort((a, b) => b.gesamt - a.gesamt);
  }, [items, jahr, maById, wbById]);

  const gesamtTage = items.filter(f => f.von_datum && new Date(f.von_datum).getFullYear() === jahr).reduce((s, f) => s + (f.tage || 1), 0);

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-teal-500 animate-spin" /></div>
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Fehlzeiten</h2>
          <p className="text-sm text-slate-500">{gesamtTage} Fehltage im Jahr {jahr}</p>
        </div>
        <div className="flex gap-2">
          <select value={jahr} onChange={e => setJahr(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-teal-200 bg-teal-50 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-100 text-sm font-medium">
            <Upload className="w-4 h-4" /> Excel Import
          </button>
          <button onClick={() => { setForm(EMPTY); setShowForm(true); }}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Fehlzeit erfassen
          </button>
        </div>
      </div>

      {showImport && (
        <FehlzeitenImport
          einrichtungId={selectedEinrichtung?.id}
          mitarbeiter={mitarbeiter}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); load(); }}
        />
      )}

      {/* Formular */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Neue Fehlzeit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Mitarbeiter *</label>
              <select value={form.mitarbeiter_id} onChange={e => setForm(p => ({ ...p, mitarbeiter_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">— Wählen —</option>
                {mitarbeiter.map(ma => <option key={ma.id} value={ma.id}>{maskName(ma.name, isAdmin)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Art</label>
              <select value={form.art} onChange={e => setForm(p => ({ ...p, art: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                {ARTEN.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Von *</label>
              <input type="date" value={form.von_datum || ''} onChange={e => setForm(p => ({ ...p, von_datum: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bis</label>
              <input type="date" value={form.bis_datum || ''} onChange={e => setForm(p => ({ ...p, bis_datum: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-500 mb-1 block">Bemerkung</label>
            <input value={form.bemerkung || ''} onChange={e => setForm(p => ({ ...p, bemerkung: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Save className="w-4 h-4" /> Speichern
            </button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <X className="w-4 h-4" /> Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Diagramm */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Fehltage pro Monat ({jahr})</h3>
        {gesamtTage === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">Keine Fehlzeiten im {jahr} erfasst.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="monat" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {ARTEN.map(a => (
                <Bar key={a} dataKey={a} stackId="a" fill={ART_FARBEN[a]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pro-Mitarbeiter Übersicht */}
      {proMitarbeiter.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Übersicht pro Mitarbeiter ({jahr})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Mitarbeiter</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Krank</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Urlaub</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {proMitarbeiter.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-medium text-slate-800">{maskName(m.name, isAdmin)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{m.krank}</td>
                  <td className="px-4 py-2 text-right text-green-600">{m.urlaub}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-800">{m.gesamt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Übersicht pro Wohnbereich */}
      {proWohnbereich.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 mb-1">Fehltage pro Wohnbereich ({jahr})</h3>
            <p className="text-xs text-slate-400 mb-4">Auf einen Blick sehen, in welcher Abteilung die meisten Ausfälle sind</p>
            <ResponsiveContainer width="100%" height={Math.max(200, proWohnbereich.length * 44)}>
              <BarChart data={proWohnbereich.map(w => ({ name: w.name, Gesamt: w.gesamt, Krank: w.krank }))} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} width={140} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Gesamt" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={18} />
                <Bar dataKey="Krank" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Monatliche Übersicht pro Wohnbereich ({jahr})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600 sticky left-0 bg-slate-50">Wohnbereich</th>
                    {MONATE.map(m => <th key={m} className="px-2 py-2 font-medium text-slate-600 text-center">{m}</th>)}
                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Krank</th>
                    <th className="px-3 py-2 font-medium text-slate-600 text-center bg-slate-100">Gesamt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {proWohnbereich.map(w => {
                    const max = Math.max(...w.monate, 1);
                    return (
                      <tr key={w.id || 'ohne'} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-800 sticky left-0 bg-white">{w.name}</td>
                        {w.monate.map((tage, i) => (
                          <td key={i} className="px-2 py-2 text-center">
                            {tage > 0 ? (
                              <span className="inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: tage >= max * 0.75 ? '#fee2e2' : tage >= max * 0.5 ? '#fef3c7' : '#f1f5f9',
                                  color: tage >= max * 0.75 ? '#dc2626' : tage >= max * 0.5 ? '#d97706' : '#475569',
                                }}>
                                {tage}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center text-red-600 font-medium">{w.krank}</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900 bg-slate-50">{w.gesamt}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold">
                    <td className="px-4 py-2 text-slate-800 sticky left-0 bg-slate-100">Gesamt</td>
                    {MONATE.map((_, i) => (
                      <td key={i} className="px-2 py-2 text-center text-slate-700">
                        {proWohnbereich.reduce((s, w) => s + w.monate[i], 0) || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-red-700">{proWohnbereich.reduce((s, w) => s + w.krank, 0)}</td>
                    <td className="px-3 py-2 text-center text-slate-900 bg-slate-200">{proWohnbereich.reduce((s, w) => s + w.gesamt, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Alle Fehlzeiten (Liste) */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Alle Fehlzeiten ({jahr})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-2 font-medium text-slate-600">Mitarbeiter</th>
              <th className="px-4 py-2 font-medium text-slate-600">Art</th>
              <th className="px-4 py-2 font-medium text-slate-600">Von</th>
              <th className="px-4 py-2 font-medium text-slate-600">Bis</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Tage</th>
              <th className="px-4 py-2 font-medium text-slate-600">Bemerkung</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.filter(f => f.von_datum && new Date(f.von_datum).getFullYear() === jahr)
              .sort((a, b) => b.von_datum?.localeCompare(a.von_datum))
              .map(f => (
                <tr key={f.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-medium text-slate-800">{maskName(maById[f.mitarbeiter_id]?.name, isAdmin) || '—'}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${ART_FARBEN[f.art]}22`, color: ART_FARBEN[f.art] }}>
                      {f.art}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{f.von_datum ? new Date(f.von_datum).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{f.bis_datum ? new Date(f.bis_datum).toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{f.tage || 1}</td>
                  <td className="px-4 py-2 text-slate-500">{f.bemerkung || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => del(f.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {items.filter(f => f.von_datum && new Date(f.von_datum).getFullYear() === jahr).length === 0 && (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">Keine Fehlzeiten erfasst.</div>
        )}
      </div>
    </div>
  );
}