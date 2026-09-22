import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Upload, Download, Settings, Undo2, BedDouble, TrendingUp, Wallet, AlertTriangle, Copy, ChevronRight, CheckCircle } from 'lucide-react';
import SachkostenCharts from '@/components/sachkosten/SachkostenCharts';
import SachkostenImport from '@/components/sachkosten/SachkostenImport';
import { computeDashboard, daysInMonth, formatEUR, formatProzent, formatDateDE, round2, STATUS_STYLES, MONATE_FULL, MONATE_KURZ } from '@/lib/sachkostenUtils';

export default function SachkostenDashboard() {
  const { selectedEinrichtung } = useEinrichtung();
  const now = new Date();
  const [monat, setMonat] = useState(now.getMonth() + 1);
  const [jahr, setJahr] = useState(now.getFullYear());
  const [wohnbereichId, setWohnbereichId] = useState('');
  const [katFilter, setKatFilter] = useState('');
  const [kostenstelleFilter, setKostenstelleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [bulkKat, setBulkKat] = useState('');
  const [bulkKatMap, setBulkKatMap] = useState({});
  const [kategorien, setKategorien] = useState([]);
  const [budgetwerte, setBudgetwerte] = useState([]);
  const [ausgaben, setAusgaben] = useState([]);
  const [zuordnungen, setZuordnungen] = useState([]);
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [abwesenheiten, setAbwesenheiten] = useState([]);
  const [importe, setImporte] = useState([]);
  const [trendData, setTrendData] = useState([]);

  const leistungsmonat = `${jahr}-${String(monat).padStart(2, '0')}`;

  const load = async () => {
    if (!selectedEinrichtung) { setLoading(false); return; }
    setLoading(true);
    const eId = selectedEinrichtung.id;
    try {
      const [kats, bwerte, ausg, zuord, wb, abw, imp] = await Promise.all([
        base44.entities.SachkostenKategorien.filter({ aktiv: true }),
        base44.entities.SachkostenBudgetwerte.filter({ einrichtung_id: eId }),
        base44.entities.SachkostenAusgaben.filter({ einrichtung_id: eId, leistungsmonat: leistungsmonat }),
        base44.entities.SachkontoZuordnungen.filter({ aktiv: true }),
        base44.entities.Wohnbereich.filter({ einrichtung_id: eId }),
        base44.entities.BewohnerAbwesenheiten.filter({ einrichtung_id: eId }),
        base44.entities.SachkostenImporte.list('-importdatum', 10),
      ]);
      setKategorien(kats); setBudgetwerte(bwerte); setAusgaben(ausg); setZuordnungen(zuord);
      setWohnbereiche(wb); setAbwesenheiten(abw); setImporte(imp);

      const trendMonths = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(jahr, monat - 1 - i, 1);
        trendMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const trendResults = await Promise.all(trendMonths.map(m =>
        base44.entities.SachkostenAusgaben.filter({ einrichtung_id: eId, leistungsmonat: m })
      ));
      setTrendData(trendMonths.map((m, i) => ({
        monat: `${MONATE_KURZ[parseInt(m.split('-')[1]) - 1]} ${m.split('-')[0]}`,
        Istkosten: round2(trendResults[i].filter(a => !a.ist_storniert).reduce((s, a) => s + (a.verwendeter_betrag || 0), 0)),
      })));
    } catch (e) { console.error('Load error:', e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEinrichtung, leistungsmonat]);

  const belegungstage = useMemo(() => {
    const days = daysInMonth(monat, jahr);
    const wb = wohnbereichId ? wohnbereiche.filter(w => w.id === wohnbereichId) : wohnbereiche;
    const total = wb.reduce((s, w) => s + (w.belegung_pg0||0)+(w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0), 0);
    return total * days;
  }, [wohnbereiche, wohnbereichId, monat, jahr]);

  const dashboard = useMemo(() =>
    computeDashboard(kategorien, budgetwerte, ausgaben, belegungstage, monat, jahr, selectedEinrichtung?.id, wohnbereichId, kostenstelleFilter),
    [kategorien, budgetwerte, ausgaben, belegungstage, monat, jahr, selectedEinrichtung, wohnbereichId, kostenstelleFilter]
  );

  const filteredAusgaben = useMemo(() => {
    let r = ausgaben;
    if (katFilter) r = r.filter(a => a.kategorie_id === katFilter);
    if (kostenstelleFilter) r = r.filter(a => a.kostenstelle === kostenstelleFilter);
    return r;
  }, [ausgaben, katFilter, kostenstelleFilter]);

  const offenListe = ausgaben.filter(a => a.zuordnungsstatus === 'offen' && !a.ist_storniert);
  const duplikateGesamt = importe.reduce((s, i) => s + (i.anzahl_duplikate || 0), 0);

  const assignBulk = async (katId, bookingIds) => {
    if (!katId || bookingIds.length === 0) return;
    await base44.entities.SachkostenAusgaben.bulkUpdate(bookingIds.map(id => ({ id, kategorie_id: katId, zuordnungsstatus: 'zugeordnet' })));
    setBulkKat(''); setBulkKatMap({});
    load();
  };

  // Offene Buchungen nach Sachkonto gruppieren
  const offenBySachkonto = {};
  offenListe.forEach(a => {
    const sk = a.sachkonto || 'Ohne Sachkonto';
    if (!offenBySachkonto[sk]) offenBySachkonto[sk] = [];
    offenBySachkonto[sk].push(a);
  });
  const avgPlaetze = belegungstage > 0 ? (belegungstage / daysInMonth(monat, jahr)) : 0;
  const kostenstellen = [...new Set(ausgaben.map(a => a.kostenstelle).filter(Boolean))].sort();

  const exportCSV = () => {
    const rows = [
      ['Kategorie', '€/Belegungstag', 'Belegungstage', 'Sollbudget', 'Istkosten', 'Restbudget', 'Abweichung', 'Budgetverbrauch %', 'Status'],
      ...dashboard.kategorien.map(k => [
        k.name, k.betragJeBelegungstag.toFixed(2), k.belegungstage,
        k.sollbudget.toFixed(2), k.istkosten.toFixed(2), k.restbudget.toFixed(2),
        k.abweichung.toFixed(2), k.budgetverbrauchProzent.toFixed(1), STATUS_STYLES[k.status]?.label || k.status
      ])
    ];
    const blob = new Blob(['\uFEFF' + rows.map(r => r.join(';')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sachkosten_benchmark_${leistungsmonat}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const rollbackImport = async (importId, dateiname) => {
    if (!confirm(`Alle Buchungen des Imports "${dateiname}" wirklich löschen?`)) return;
    await base44.entities.SachkostenAusgaben.deleteMany({ import_vorgang_id: importId });
    await base44.entities.SachkostenImporte.update(importId, { status: 'abgebrochen' });
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>;

  const kpi = dashboard.kpi;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {showImport && (
        <SachkostenImport
          einrichtungId={selectedEinrichtung?.id}
          kategorien={kategorien}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); load(); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sachkosten-Benchmark</h1>
          <p className="text-xs text-slate-500 mt-0.5">{MONATE_FULL[monat - 1]} {jahr} · {selectedEinrichtung?.name || 'Keine Einrichtung'}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/budgetwerte" className="flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Settings className="w-4 h-4" /> Budgetwerte
          </Link>
          <button onClick={exportCSV} className="flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
            <Upload className="w-4 h-4" /> Ausgaben importieren
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <select value={monat} onChange={e => setMonat(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
          {MONATE_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={jahr} onChange={e => setJahr(Number(e.target.value))} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={wohnbereichId} onChange={e => setWohnbereichId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">Alle Wohnbereiche</option>
          {wohnbereiche.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={katFilter} onChange={e => setKatFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">Alle Kategorien</option>
          {kategorien.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <select value={kostenstelleFilter} onChange={e => setKostenstelleFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">Alle Kostenstellen</option>
          {kostenstellen.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-900 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1"><BedDouble className="w-4 h-4 text-teal-400" /><p className="text-xs text-slate-400">Belegungstage</p></div>
          <p className="text-2xl font-bold">{kpi.belegungstage.toLocaleString('de-DE')}</p>
          <p className="text-xs text-slate-500 mt-1">Ø {avgPlaetze.toFixed(1)} belegte Plätze</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-400">Sollbudget gesamt</p></div>
          <p className="text-2xl font-bold text-slate-900">{formatEUR(kpi.sollbudgetGesamt)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-400">Istkosten gesamt</p></div>
          <p className="text-2xl font-bold text-slate-900">{formatEUR(kpi.istkostenGesamt)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className={`rounded-2xl border shadow-sm p-5 ${kpi.restbudgetGesamt >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs mb-1 ${kpi.restbudgetGesamt >= 0 ? 'text-green-600' : 'text-red-600'}`}>Restbudget</p>
          <p className={`text-2xl font-bold ${kpi.restbudgetGesamt >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatEUR(kpi.restbudgetGesamt)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-5 ${kpi.budgetverbrauchGesamt > 100 ? 'bg-red-50 border-red-200' : kpi.budgetverbrauchGesamt > 90 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`text-xs mb-1 ${kpi.budgetverbrauchGesamt > 100 ? 'text-red-600' : kpi.budgetverbrauchGesamt > 90 ? 'text-yellow-600' : 'text-green-600'}`}>Budgetverbrauch</p>
          <p className={`text-2xl font-bold ${kpi.budgetverbrauchGesamt > 100 ? 'text-red-700' : kpi.budgetverbrauchGesamt > 90 ? 'text-yellow-700' : 'text-green-700'}`}>{formatProzent(kpi.budgetverbrauchGesamt)}</p>
        </div>
      </div>

      {/* Additional KPIs */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs">
        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5" /> Nicht zugeordnet: <strong>{kpi.nichtZugeordnet}</strong>
        </div>
        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
          <Copy className="w-3.5 h-3.5" /> Duplikate (gesamt): <strong>{duplikateGesamt}</strong>
        </div>
      </div>

      {/* Category Cards (Ampel) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {dashboard.kategorien.map(kat => {
          const st = STATUS_STYLES[kat.status] || STATUS_STYLES.unvollstaendig;
          return (
            <div key={kat.id} className={`rounded-xl border p-4 ${st.bg} ${st.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-700 truncate">{kat.name}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shrink-0`} />
              </div>
              <div className={`text-lg font-bold ${kat.abweichung > 0 ? 'text-red-600' : kat.abweichung < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                {kat.abweichung > 0 ? '+' : ''}{formatEUR(kat.abweichung)}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{formatProzent(kat.budgetverbrauchProzent)} Verbrauch</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {[['uebersicht', 'Übersicht'], ['buchungen', 'Buchungen'], ['offen', 'Offene Zuordnungen'], ['bewohner', 'Bewohner & Belegung'], ['importe', 'Importe']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === key ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'uebersicht' && (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Kategorie</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">€/Beleg.tag</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Beleg.tage</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Sollbudget</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Istkosten</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Restbudget</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Abweichung</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Verbrauch</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dashboard.kategorien.map(kat => {
                  const st = STATUS_STYLES[kat.status] || STATUS_STYLES.unvollstaendig;
                  return (
                    <tr key={kat.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{kat.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatEUR(kat.betragJeBelegungstag)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{kat.belegungstage.toLocaleString('de-DE')}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatEUR(kat.sollbudget)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatEUR(kat.istkosten)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${kat.restbudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatEUR(kat.restbudget)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${kat.abweichung > 0 ? 'text-red-600' : kat.abweichung < 0 ? 'text-green-600' : 'text-slate-500'}`}>{kat.abweichung > 0 ? '+' : ''}{formatEUR(kat.abweichung)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatProzent(kat.budgetverbrauchProzent)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold">
                  <td className="px-4 py-3 text-slate-800" colSpan={3}>Gesamt</td>
                  <td className="px-4 py-3 text-right text-slate-800">{formatEUR(kpi.sollbudgetGesamt)}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{formatEUR(kpi.istkostenGesamt)}</td>
                  <td className={`px-4 py-3 text-right ${kpi.restbudgetGesamt >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatEUR(kpi.restbudgetGesamt)}</td>
                  <td className={`px-4 py-3 text-right ${kpi.istkostenGesamt - kpi.sollbudgetGesamt > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatEUR(kpi.istkostenGesamt - kpi.sollbudgetGesamt)}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{formatProzent(kpi.budgetverbrauchGesamt)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Charts */}
          <SachkostenCharts kategorien={dashboard.kategorien} trendData={trendData} />
        </>
      )}

      {activeTab === 'buchungen' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Datum</th>
              <th className="px-3 py-2 font-medium text-slate-600">Belegnr.</th>
              <th className="px-3 py-2 font-medium text-slate-600">Lieferant</th>
              <th className="px-3 py-2 font-medium text-slate-600">Sachkonto</th>
              <th className="px-3 py-2 font-medium text-slate-600">KST</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Betrag</th>
              <th className="px-3 py-2 font-medium text-slate-600">Kategorie</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAusgaben.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Keine Buchungen für diesen Zeitraum</td></tr>
              ) : filteredAusgaben.map(a => (
                <tr key={a.id} className={`hover:bg-slate-50/50 ${a.ist_storniert ? 'opacity-50 line-through' : ''}`}>
                  <td className="px-3 py-2 text-slate-600">{formatDateDE(a.buchungsdatum)}</td>
                  <td className="px-3 py-2 text-slate-500">{a.belegnummer || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{a.lieferant || a.buchungstext}</td>
                  <td className="px-3 py-2 text-slate-600">{a.sachkonto || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{a.kostenstelle || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{formatEUR(a.verwendeter_betrag)}</td>
                  <td className="px-3 py-2">{a.kategorie_id ? <span className="text-teal-700 text-xs">{kategorien.find(k => k.id === a.kategorie_id)?.name}</span> : <span className="text-amber-600 text-xs">offen</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'offen' && (
        <div className="space-y-4">
          {/* Global bulk assign */}
          {offenListe.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-teal-800">
                <AlertTriangle className="w-4 h-4" /> Alle {offenListe.length} offenen Buchungen zuweisen:
              </div>
              <select value={bulkKat} onChange={e => setBulkKat(e.target.value)} className="border border-teal-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value="">— Kategorie wählen —</option>
                {kategorien.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <button onClick={() => assignBulk(bulkKat, offenListe.map(a => a.id))} disabled={!bulkKat}
                className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                Alle {offenListe.length} Buchungen zuweisen
              </button>
            </div>
          )}

          {/* Per-sachkonto groups */}
          {offenListe.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-12 text-center text-slate-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
              Keine offenen Zuordnungen
            </div>
          ) : Object.entries(offenBySachkonto).map(([sk, group]) => (
            <div key={sk} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Group header with bulk assign */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-slate-800 text-sm">{sk}</span>
                  <span className="text-xs text-slate-400">{group.length} Buchung(en)</span>
                  <span className="text-xs text-slate-500">· {formatEUR(group.reduce((s, a) => s + (a.verwendeter_betrag || 0), 0))}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <select value={bulkKatMap[sk] || ''} onChange={e => setBulkKatMap(p => ({ ...p, [sk]: e.target.value }))}
                    className="border border-slate-200 rounded px-2 py-1 text-xs bg-white">
                    <option value="">— Kategorie —</option>
                    {kategorien.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                  <button onClick={() => assignBulk(bulkKatMap[sk], group.map(a => a.id))} disabled={!bulkKatMap[sk]}
                    className="bg-teal-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-50">
                    Alle dieses Kontos
                  </button>
                </div>
              </div>
              {/* Individual rows */}
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {group.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-600 w-28">{formatDateDE(a.buchungsdatum)}</td>
                      <td className="px-4 py-2 text-slate-700">{a.lieferant || a.buchungstext}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800 w-32">{formatEUR(a.verwendeter_betrag)}</td>
                      <td className="px-4 py-2 w-48">
                        <select value="" onChange={async (e) => {
                          if (!e.target.value) return;
                          await base44.entities.SachkostenAusgaben.update(a.id, { kategorie_id: e.target.value, zuordnungsstatus: 'zugeordnet' });
                          load();
                        }} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white w-full">
                          <option value="">— Einzeln zuweisen —</option>
                          {kategorien.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'bewohner' && (
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <p className="text-xs text-slate-400 mb-1">Berechnete Belegungstage</p>
            <p className="text-3xl font-bold">{belegungstage.toLocaleString('de-DE')}</p>
            <p className="text-xs text-slate-500 mt-1">{MONATE_FULL[monat - 1]} {jahr} · Ø {avgPlaetze.toFixed(1)} Plätze/Tag · {daysInMonth(monat, jahr)} Tage</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Wohnbereich</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Belegung</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Belegungstage</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {wohnbereiche.map(w => {
                  const total = (w.belegung_pg0||0)+(w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0);
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-medium text-slate-700">{w.name}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{total} / {w.sollbelegung || 0}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">{(total * daysInMonth(monat, jahr)).toLocaleString('de-DE')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'importe' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-4 py-2 font-medium text-slate-600">Datum</th>
              <th className="px-4 py-2 font-medium text-slate-600">Dateiname</th>
              <th className="px-4 py-2 font-medium text-slate-600">Monat</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Importiert</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Duplikate</th>
              <th className="px-4 py-2 font-medium text-slate-600 text-right">Summe</th>
              <th className="px-4 py-2 font-medium text-slate-600">Status</th>
              <th className="px-4 py-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {importe.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Keine Importe vorhanden</td></tr>
              ) : importe.map(imp => (
                <tr key={imp.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 text-slate-600">{formatDateDE(imp.importdatum)}</td>
                  <td className="px-4 py-2 text-slate-700">{imp.dateiname}</td>
                  <td className="px-4 py-2 text-slate-600">{imp.leistungsmonat}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{imp.anzahl_importiert}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{imp.anzahl_duplikate}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{formatEUR(imp.gesamtsumme)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${imp.status === 'abgeschlossen' ? 'bg-green-100 text-green-700' : imp.status === 'abgebrochen' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'}`}>{imp.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {imp.status === 'abgeschlossen' && (
                      <button onClick={() => rollbackImport(imp.id, imp.dateiname)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                        <Undo2 className="w-3.5 h-3.5" /> Rückgängig
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}