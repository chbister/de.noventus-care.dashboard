import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Save, History, FileDown, Loader2, ExternalLink } from 'lucide-react';

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

// ══════════════════════════════════════════════════════════════════════════════
// 1. BELEGUNGSZAHLEN TAB
// ══════════════════════════════════════════════════════════════════════════════
function BelegungszahlenTab() {
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

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Übersicht */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. MONATSABSCHLUSS TAB
// ══════════════════════════════════════════════════════════════════════════════
function MonatsabschlussTab() {
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
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

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

  const generatePDF = async () => {
    setGeneratingPDF(true);
    setPdfUrl(null);
    try {
      const res = await base44.functions.invoke('monatsabschlussExport', {
        monat, jahr, einrichtung_id: selectedEinrichtung.id,
      });
      setPdfUrl(res.data?.pdf_url || null);
      load();
    } catch (e) {
      alert('Fehler beim Generieren des PDF: ' + (e.message || e));
    } finally {
      setGeneratingPDF(false);
    }
  };

  const c = berechne();

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Aktueller Snapshot */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
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
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={speichern} disabled={saving} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Speichert...' : 'Abschluss speichern'}
          </button>
          <button onClick={generatePDF} disabled={generatingPDF}
            className="flex items-center gap-2 border border-violet-200 bg-violet-50 text-violet-700 px-4 py-2 rounded-lg hover:bg-violet-100 text-sm font-medium disabled:opacity-50">
            {generatingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {generatingPDF ? 'PDF wird erstellt...' : 'PDF generieren'}
          </button>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 border border-green-200 bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 text-sm font-medium">
              <ExternalLink className="w-4 h-4" /> PDF öffnen
            </a>
          )}
        </div>
      </div>

      {/* Historie */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Historie</h2>
        </div>
        {historien.length === 0 ? (
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

// ══════════════════════════════════════════════════════════════════════════════
// 3. BELEGUNGSVERLAUF TAB
// ══════════════════════════════════════════════════════════════════════════════
function BelegungsverlaufTab() {
  const { selectedEinrichtung } = useEinrichtung();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    base44.entities.BelegungsSnapshot.filter({ einrichtung_id: selectedEinrichtung.id })
      .then(s => { setSnapshots(s.sort((a,b) => b.datum?.localeCompare(a.datum))); setLoading(false); });
  }, [selectedEinrichtung]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>;

  const wohnbereicheNames = [...new Set(snapshots.map(s => s.wohnbereich_name))];
  const chartData = wohnbereicheNames.flatMap(name => {
    const bereiche = snapshots.filter(s => s.wohnbereich_name === name).sort((a,b) => a.datum?.localeCompare(b.datum));
    return bereiche.map(b => ({
      datum: new Date(b.datum).toLocaleDateString('de-DE'),
      [name]: (b.belegung_pg2||0)+(b.belegung_pg3||0)+(b.belegung_pg4||0)+(b.belegung_pg5||0)+(b.belegung_ruestige||0)+(b.belegung_pg0||0)+(b.belegung_pg1||0),
    }));
  });

  const colors = ['#14b8a6','#0d9488','#2dd4bf','#5eead4','#f97316','#06b6d4'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Belegungsverlauf im zeitlichen Überblick</h2>
        {chartData.length === 0 ? (
          <div className="py-12 text-center text-slate-400">Keine Snapshots vorhanden</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="datum" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {wohnbereicheNames.map((name, idx) => (
                <Line key={name} type="monotone" dataKey={name} stroke={colors[idx % colors.length]} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {snapshots.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 font-medium text-slate-600 text-left">Datum</th>
                <th className="px-4 py-3 font-medium text-slate-600">Wohnbereich</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Belegung</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right hidden sm:table-cell">Soll</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {snapshots.sort((a,b) => b.datum?.localeCompare(a.datum)).map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-800">{new Date(s.datum).toLocaleDateString('de-DE')}</td>
                  <td className="px-4 py-3 text-slate-600">{s.wohnbereich_name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-600">{s.gesamt || 0}</td>
                  <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{s.sollbelegung || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE WITH TABS
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'belegung', label: '📊 Belegungszahlen' },
  { key: 'abschluss', label: '💾 Monatsabschluss' },
  { key: 'verlauf', label: '📈 Belegungsverlauf' },
];

export default function Controlling() {
  const [activeTab, setActiveTab] = useState('belegung');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'belegung' && <BelegungszahlenTab />}
      {activeTab === 'abschluss' && <MonatsabschlussTab />}
      {activeTab === 'verlauf' && <BelegungsverlaufTab />}
    </div>
  );
}