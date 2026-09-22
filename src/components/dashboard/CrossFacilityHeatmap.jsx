import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, Loader2, Grid3x3, GitCompare } from 'lucide-react';

export default function CrossFacilityHeatmap() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [bereichFilter, setBereichFilter] = useState('alle');

  // Bereiche aus Daten ableiten
  const bereiche = useMemo(() => {
    const set = new Set();
    data.forEach(d => { if (d.bereich) set.add(d.bereich); });
    return Array.from(set).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    if (bereichFilter === 'alle') return data;
    return data.filter(d => d.bereich === bereichFilter);
  }, [data, bereichFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const einrichtungen = await base44.entities.Einrichtung.list();
        const [allWb, allMa, allFehl] = await Promise.all([
          base44.entities.Wohnbereich.filter({}),
          base44.entities.Mitarbeiter.filter({ aktiv: true }),
          base44.entities.MitarbeiterFehlzeiten.filter({}),
        ]);

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const allAusgaben = await base44.entities.SachkostenAusgaben.filter({ leistungsmonat: currentMonth });

        const result = einrichtungen.map(einr => {
          const wb = allWb.filter(w => w.einrichtung_id === einr.id);
          const ma = allMa.filter(m => m.einrichtung_id === einr.id);
          const fehl = allFehl.filter(f => f.einrichtung_id === einr.id && f.von_datum?.startsWith(currentMonth));
          const ausg = allAusgaben.filter(a => a.einrichtung_id === einr.id && !a.ist_storniert);

          const bewohner = wb.reduce((s, w) =>
            s + (w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0)+(w.belegung_pg0||0), 0);
          const sollPlaetze = wb.reduce((s, w) => s + (w.sollbelegung || 0), 0);
          const auslastung = sollPlaetze > 0 ? Math.round((bewohner / sollPlaetze) * 100) : 0;

          const vkIst = ma.reduce((s, m) => s + (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0), 0);
          const personalCosts = ma.reduce((s, m) => s + (m.monatsgehalt_brutto||0)+(m.sv_ag_anteil||0)+(m.funktionszulagen||0)+(m.zuschlaege_steuerfrei||0), 0);
          const sachkosten = ausg.reduce((s, a) => s + (a.verwendeter_betrag||0), 0);

          const fehlTage = fehl.reduce((s, f) => s + (f.tage||0), 0);
          const fehlQuote = ma.length > 0 ? Math.round((fehlTage / (ma.length * 20)) * 100) : 0;

          const sachkostenProBewohner = bewohner > 0 ? Math.round(sachkosten / bewohner) : 0;

          return {
            id: einr.id, name: einr.name, standort: einr.standort, bereich: einr.bereich || 'stationär',
            bewohner, sollPlaetze, auslastung, vkIst, personalCosts, sachkosten, fehlTage, fehlQuote, sachkostenProBewohner,
            mitarbeiterAnzahl: ma.length,
          };
        });
        setData(result);
        if (result.length >= 1) setCompareA(result[0].id);
        if (result.length >= 2) setCompareB(result[1].id);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const heatColor = (value, thresholds) => {
    // thresholds: [greenMax, yellowMax] — above yellowMax = red
    if (value <= thresholds[0]) return 'bg-green-100 text-green-800';
    if (value <= thresholds[1]) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  // Inverse: higher is worse (for auslastung: lower is worse)
  const inverseHeatColor = (value, thresholds) => {
    if (value >= thresholds[0]) return 'bg-green-100 text-green-800';
    if (value >= thresholds[1]) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const formatEUR = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>;

  const kpis = [
    { key: 'auslastung', label: 'Auslastung', unit: '%', thresholds: [95, 85], inverse: true, format: (v) => `${v}%` },
    { key: 'fehlQuote', label: 'Fehl-Quote', unit: '%', thresholds: [5, 10], format: (v) => `${v}%` },
    { key: 'personalCosts', label: 'Personal-€/Monat', thresholds: [Infinity, Infinity], format: (v) => formatEUR(v) },
    { key: 'sachkostenProBewohner', label: 'Sachkosten/Bew.', thresholds: [Infinity, Infinity], format: (v) => formatEUR(v) },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Grid3x3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cross-Facility Benchmarking</h2>
            <p className="text-sm text-cyan-100">Vergleich aller Einrichtungen in einer Heatmap</p>
          </div>
        </div>
      </div>

      {/* Legend + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-green-100 border border-green-200" /> Gut</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-100 border border-amber-200" /> Achtung</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-100 border border-red-200" /> Kritisch</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Filter:</label>
          <select value={bereichFilter} onChange={e => setBereichFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="alle">Alle Bereiche</option>
            {bereiche.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="text-xs text-slate-400">{filteredData.length} Einrichtungen</span>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-600 sticky left-0 bg-slate-50">Einrichtung</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-center">Bewohner</th>
              {kpis.map(k => (
                <th key={k.key} className="px-4 py-3 font-medium text-slate-600 text-center whitespace-nowrap">{k.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map(row => (
              <tr key={row.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <div>
                      <p className="text-sm">{row.name}</p>
                      <p className="text-xs text-slate-400">{row.bereich ? `${row.bereich} · ${row.standort || ''}` : row.standort}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{row.bewohner}/{row.sollPlaetze}</td>
                {kpis.map(k => {
                  const value = row[k.key];
                  const colorFn = k.inverse ? inverseHeatColor : heatColor;
                  const color = k.thresholds[0] === Infinity ? 'bg-slate-50 text-slate-700' : colorFn(value, k.thresholds);
                  return (
                    <td key={k.key} className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${color}`}>
                        {k.format(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Best/ Worst */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 mb-1">Beste Auslastung</p>
          {filteredData.filter(d => d.sollPlaetze > 0).sort((a, b) => b.auslastung - a.auslastung).slice(0, 3).map((d, i) => (
            <p key={d.id} className="text-sm text-slate-700">{i + 1}. {d.name} — {d.auslastung}%</p>
          ))}
          {filteredData.filter(d => d.sollPlaetze > 0).length === 0 && <p className="text-sm text-slate-400">Keine Daten</p>}
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-600 mb-1">Höchste Fehl-Quote</p>
          {filteredData.filter(d => d.mitarbeiterAnzahl > 0).sort((a, b) => b.fehlQuote - a.fehlQuote).slice(0, 3).map((d, i) => (
            <p key={d.id} className="text-sm text-slate-700">{i + 1}. {d.name} — {d.fehlQuote}%</p>
          ))}
          {filteredData.filter(d => d.mitarbeiterAnzahl > 0).length === 0 && <p className="text-sm text-slate-400">Keine Daten</p>}
        </div>
      </div>

      {/* Direktvergleich zweier Einrichtungen */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Direktvergleich</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Einrichtung A</label>
            <select value={compareA} onChange={e => setCompareA(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">— Wählen —</option>
              {filteredData.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Einrichtung B</label>
            <select value={compareB} onChange={e => setCompareB(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">— Wählen —</option>
              {filteredData.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {(() => {
          const a = filteredData.find(d => d.id === compareA);
          const b = filteredData.find(d => d.id === compareB);
          if (!a || !b) return <div className="px-5 py-8 text-center text-slate-400 text-sm">Bitte zwei Einrichtungen wählen.</div>;

          const rows = [
            { label: 'Bewohner / Sollplätze', a: `${a.bewohner} / ${a.sollPlaetze}`, b: `${b.bewohner} / ${b.sollPlaetze}`, diff: a.bewohner - b.bewohner, diffLabel: (d) => `${d >= 0 ? '+' : ''}${d}`, higherBetter: true },
            { label: 'Auslastung', a: `${a.auslastung}%`, b: `${b.auslastung}%`, diff: a.auslastung - b.auslastung, diffLabel: (d) => `${d >= 0 ? '+' : ''}${d} %`, higherBetter: true },
            { label: 'Mitarbeiter', a: a.mitarbeiterAnzahl, b: b.mitarbeiterAnzahl, diff: a.mitarbeiterAnzahl - b.mitarbeiterAnzahl, diffLabel: (d) => `${d >= 0 ? '+' : ''}${d}`, higherBetter: true },
            { label: 'VK Ist', a: a.vkIst, b: b.vkIst, diff: Math.round((a.vkIst - b.vkIst) * 10) / 10, diffLabel: (d) => `${d >= 0 ? '+' : ''}${d}`, higherBetter: true },
            { label: 'Personalkosten / Monat', a: formatEUR(a.personalCosts), b: formatEUR(b.personalCosts), diff: a.personalCosts - b.personalCosts, diffLabel: (d) => `${d >= 0 ? '+' : ''}${formatEUR(d)}`, higherBetter: false },
            { label: 'Sachkosten / Monat', a: formatEUR(a.sachkosten), b: formatEUR(b.sachkosten), diff: a.sachkosten - b.sachkosten, diffLabel: (d) => `${d >= 0 ? '+' : ''}${formatEUR(d)}`, higherBetter: false },
            { label: 'Sachkosten / Bewohner', a: formatEUR(a.sachkostenProBewohner), b: formatEUR(b.sachkostenProBewohner), diff: a.sachkostenProBewohner - b.sachkostenProBewohner, diffLabel: (d) => `${d >= 0 ? '+' : ''}${formatEUR(d)}`, higherBetter: false },
            { label: 'Fehltage', a: a.fehlTage, b: b.fehlTage, diff: a.fehlTage - b.fehlTage, diffLabel: (d) => `${d >= 0 ? '+' : ''}${d}`, higherBetter: false },
            { label: 'Fehl-Quote', a: `${a.fehlQuote}%`, b: `${b.fehlQuote}%`, diff: a.fehlQuote - b.fehlQuote, diffLabel: (d) => `${d >= 0 ? '+' : ''}${d} %`, higherBetter: false },
          ];

          return (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 font-medium text-slate-600">Kennzahl</th>
                  <th className="px-5 py-3 font-medium text-slate-600 text-right">{a.name}</th>
                  <th className="px-5 py-3 font-medium text-slate-600 text-right">{b.name}</th>
                  <th className="px-5 py-3 font-medium text-slate-600 text-center">Differenz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(r => {
                  const aBetter = r.higherBetter ? r.diff > 0 : r.diff < 0;
                  const bBetter = r.higherBetter ? r.diff < 0 : r.diff > 0;
                  return (
                    <tr key={r.label} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-700">{r.label}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${aBetter ? 'text-green-700' : 'text-slate-700'}`}>{r.a}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${bBetter ? 'text-green-700' : 'text-slate-700'}`}>{r.b}</td>
                      <td className={`px-5 py-3 text-center text-xs font-medium ${r.diff === 0 ? 'text-slate-400' : aBetter ? 'text-green-600' : 'text-red-600'}`}>
                        {r.diff === 0 ? '—' : r.diffLabel(r.diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
}