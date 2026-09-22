import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Save, X, Download, AlertCircle, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const EMPTY_KLIENT = { klienten_id: '', leistungstyp: 'Qualifizierte Assistenz', fls_bewilligung_woche: 0, bescheid_gueltig_bis: '', kostentraeger: '', notiz: '' };
const EMPTY_LEISTUNG = { datum: '', klienten_id: '', dauer_minuten: 0, mitarbeiter_id: '', mitarbeiter_qualifikation: 'Assistenzkraft', abrechenbar: true, bemerkung: '' };

export default function Eingliederungshilfe() {
  const { selectedEinrichtung } = useEinrichtung();
  const [klienten, setKlienten] = useState([]);
  const [leistungen, setLeistungen] = useState([]);
  const [finanzen, setFinanzen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showKlientForm, setShowKlientForm] = useState(false);
  const [showLeistungForm, setShowLeistungForm] = useState(false);
  const [editingKlient, setEditingKlient] = useState(null);
  const [editingLeistung, setEditingLeistung] = useState(null);
  const [klientForm, setKlientForm] = useState(EMPTY_KLIENT);
  const [leistungForm, setLeistungForm] = useState(EMPTY_LEISTUNG);
  const [filterMonat, setFilterMonat] = useState(new Date().toISOString().substring(0, 7));

  const load = async () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    try {
      const [k, l, f] = await Promise.all([
        base44.entities.EGH_Klienten.list(),
        base44.entities.EGH_Leistungserfassung.list(),
        base44.entities.EGH_Finanzen.list(),
      ]);
      setKlienten(k);
      setLeistungen(l);
      setFinanzen(f);
    } catch (e) {
      console.error('Fehler beim Laden:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  // Berechne Dezimalstunden
  const calcDecimalStunden = (minuten) => Math.round((minuten / 60) * 100) / 100;

  // Berechne Status für Bescheid
  const getStatusBescheid = (datum) => {
    if (!datum) return '✅ Aktiv';
    const diff = Math.floor((new Date(datum) - new Date()) / (1000 * 60 * 60 * 24));
    return diff < 60 ? '⚠️ VERLÄNGERUNG BEANTRAGEN' : '✅ Aktiv';
  };

  // CRUD Klienten
  const saveKlient = async () => {
    if (!klientForm.klienten_id || !klientForm.leistungstyp) return;
    const data = {
      ...klientForm,
      status_bescheid: getStatusBescheid(klientForm.bescheid_gueltig_bis),
    };
    if (editingKlient) {
      await base44.entities.EGH_Klienten.update(editingKlient, data);
    } else {
      await base44.entities.EGH_Klienten.create(data);
    }
    setShowKlientForm(false);
    setEditingKlient(null);
    setKlientForm(EMPTY_KLIENT);
    load();
  };

  const deleteKlient = async (id) => {
    if (!confirm('Klient löschen?')) return;
    await base44.entities.EGH_Klienten.delete(id);
    load();
  };

  // CRUD Leistungen
  const saveLeistung = async () => {
    if (!leistungForm.datum || !leistungForm.klienten_id || leistungForm.dauer_minuten === 0) return;
    const data = {
      ...leistungForm,
      stunden_dezimal: calcDecimalStunden(leistungForm.dauer_minuten),
    };
    if (editingLeistung) {
      await base44.entities.EGH_Leistungserfassung.update(editingLeistung, data);
    } else {
      await base44.entities.EGH_Leistungserfassung.create(data);
    }
    setShowLeistungForm(false);
    setEditingLeistung(null);
    setLeistungForm(EMPTY_LEISTUNG);
    load();
  };

  const deleteLeistung = async (id) => {
    if (!confirm('Leistung löschen?')) return;
    await base44.entities.EGH_Leistungserfassung.delete(id);
    load();
  };

  // Berechnungen
  const monatlicheLeistungen = leistungen.filter(l => l.datum?.startsWith(filterMonat));
  const gesamtStundenMonat = monatlicheLeistungen.reduce((s, l) => s + calcDecimalStunden(l.dauer_minuten || 0), 0);
  
  const flsMonitor = klienten.map(k => {
    const istStunden = monatlicheLeistungen
      .filter(l => l.klienten_id === k.klienten_id)
      .reduce((s, l) => s + calcDecimalStunden(l.dauer_minuten || 0), 0);
    const sollStunden = k.fls_bewilligung_woche * 4.33;
    const auslastung = sollStunden > 0 ? Math.round((istStunden / sollStunden) * 100) : 0;
    return {
      klienten_id: k.klienten_id,
      soll: Math.round(sollStunden * 10) / 10,
      ist: Math.round(istStunden * 10) / 10,
      auslastung,
    };
  });

  const fachkraftStunden = monatlicheLeistungen
    .filter(l => l.mitarbeiter_qualifikation === 'Fachkraft')
    .reduce((s, l) => s + calcDecimalStunden(l.dauer_minuten || 0), 0);
  const assistenzStunden = gesamtStundenMonat - fachkraftStunden;

  const fachkraftquoteData = [
    { name: 'Fachkraft', value: Math.round(fachkraftStunden * 10) / 10 },
    { name: 'Assistenzkraft', value: Math.round(assistenzStunden * 10) / 10 },
  ];

  const aktuelleFinanzen = finanzen.filter(f => f.monat_jahr?.startsWith(filterMonat));
  const totalErloese = aktuelleFinanzen.reduce((s, f) => s + (f.erloese_fls || 0), 0);
  const totalPersonalkosten = aktuelleFinanzen.reduce((s, f) => s + (f.personalkosten || 0), 0);

  const durchschnittStundensatz = gesamtStundenMonat > 0 ? totalErloese / gesamtStundenMonat : 0;
  const gegenwertIstStunden = gesamtStundenMonat * durchschnittStundensatz;
  const abweichung = totalErloese - gegenwertIstStunden;

  if (loading) return <div className="p-8 text-center text-slate-400">Laden...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Eingliederungshilfe (EGH)</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fachleistungsstunden (FLS) & Budget-Controlling</p>
        </div>
      </div>

      {/* Monat Filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-slate-600">Monat:</label>
        <input type="month" value={filterMonat} onChange={e => setFilterMonat(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Gesamtstunden (Monat)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{gesamtStundenMonat.toFixed(1)}h</div>
            <p className="text-xs text-slate-400 mt-1">Gesamt erbracht</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Fachkraftquote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{gesamtStundenMonat > 0 ? Math.round((fachkraftStunden / gesamtStundenMonat) * 100) : 0}%</div>
            <p className="text-xs text-slate-400 mt-1">{fachkraftStunden.toFixed(1)}h Fachkraft</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Erlöse (ERP)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{Math.round(totalErloese)} €</div>
            <p className="text-xs text-slate-400 mt-1">Monatlich</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Erlös-Abweichung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${abweichung >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Math.round(abweichung)} €
            </div>
            <p className="text-xs text-slate-400 mt-1">{abweichung >= 0 ? 'Überschuss' : 'Unterschuss'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="klienten" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="klienten">Klienten</TabsTrigger>
          <TabsTrigger value="leistungen">Leistungserfassung</TabsTrigger>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="finanzen">Finanzen</TabsTrigger>
        </TabsList>

        {/* Klienten Tab */}
        <TabsContent value="klienten" className="space-y-4">
          <div className="flex justify-end mb-4">
            <button onClick={() => { setKlientForm(EMPTY_KLIENT); setEditingKlient(null); setShowKlientForm(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Neuer Klient
            </button>
          </div>

          {showKlientForm && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
              <h3 className="font-semibold text-slate-900 mb-4">{editingKlient ? 'Bearbeiten' : 'Neuer Klient'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Klienten-ID *</label>
                  <input value={klientForm.klienten_id} onChange={e => setKlientForm(p => ({ ...p, klienten_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. K-10023" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Leistungstyp *</label>
                  <select value={klientForm.leistungstyp} onChange={e => setKlientForm(p => ({ ...p, leistungstyp: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option>Qualifizierte Assistenz</option>
                    <option>Einfache Assistenz</option>
                    <option>TS</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">FLS Bewilligung (Woche) *</label>
                  <input type="number" step="0.5" value={klientForm.fls_bewilligung_woche} onChange={e => setKlientForm(p => ({ ...p, fls_bewilligung_woche: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Bescheid gültig bis</label>
                  <input type="date" value={klientForm.bescheid_gueltig_bis} onChange={e => setKlientForm(p => ({ ...p, bescheid_gueltig_bis: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Kostenträger</label>
                  <input value={klientForm.kostentraeger} onChange={e => setKlientForm(p => ({ ...p, kostentraeger: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. LVR" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Notiz</label>
                  <input value={klientForm.notiz} onChange={e => setKlientForm(p => ({ ...p, notiz: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveKlient} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                  <Save className="w-4 h-4" /> Speichern
                </button>
                <button onClick={() => setShowKlientForm(false)} className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <X className="w-4 h-4" /> Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Klienten-ID</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Leistungstyp</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">FLS/Woche</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Kostenträger</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {klienten.map(k => (
                  <tr key={k.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{k.klienten_id}</td>
                    <td className="px-4 py-3 text-slate-600">{k.leistungstyp}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{k.fls_bewilligung_woche}h</td>
                    <td className="px-4 py-3 text-slate-600">{k.kostentraeger || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${getStatusBescheid(k.bescheid_gueltig_bis).includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
                        {getStatusBescheid(k.bescheid_gueltig_bis)}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-1 justify-end">
                      <button onClick={() => { setKlientForm(k); setEditingKlient(k.id); setShowKlientForm(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteKlient(k.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {klienten.length === 0 && <div className="px-6 py-12 text-center text-slate-400">Keine Klienten angelegt</div>}
          </div>
        </TabsContent>

        {/* Leistungserfassung Tab */}
        <TabsContent value="leistungen" className="space-y-4">
          <div className="flex justify-end mb-4">
            <button onClick={() => { setLeistungForm(EMPTY_LEISTUNG); setEditingLeistung(null); setShowLeistungForm(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Neue Leistung
            </button>
          </div>

          {showLeistungForm && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
              <h3 className="font-semibold text-slate-900 mb-4">{editingLeistung ? 'Bearbeiten' : 'Neue Leistung'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Datum *</label>
                  <input type="date" value={leistungForm.datum} onChange={e => setLeistungForm(p => ({ ...p, datum: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Klienten-ID *</label>
                  <select value={leistungForm.klienten_id} onChange={e => setLeistungForm(p => ({ ...p, klienten_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Wählen --</option>
                    {klienten.map(k => <option key={k.id} value={k.klienten_id}>{k.klienten_id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Dauer (Minuten) *</label>
                  <input type="number" value={leistungForm.dauer_minuten} onChange={e => setLeistungForm(p => ({ ...p, dauer_minuten: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Mitarbeiter-ID</label>
                  <input value={leistungForm.mitarbeiter_id} onChange={e => setLeistungForm(p => ({ ...p, mitarbeiter_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Qualifikation</label>
                  <select value={leistungForm.mitarbeiter_qualifikation} onChange={e => setLeistungForm(p => ({ ...p, mitarbeiter_qualifikation: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option>Fachkraft</option>
                    <option>Assistenzkraft</option>
                    <option>Sonstiges</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={leistungForm.abrechenbar} onChange={e => setLeistungForm(p => ({ ...p, abrechenbar: e.target.checked }))}
                      className="rounded border-slate-300" />
                    <span className="text-slate-600">Abrechenbar</span>
                  </label>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-slate-500 mb-1 block">Bemerkung</label>
                <textarea value={leistungForm.bemerkung} onChange={e => setLeistungForm(p => ({ ...p, bemerkung: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveLeistung} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                  <Save className="w-4 h-4" /> Speichern
                </button>
                <button onClick={() => setShowLeistungForm(false)} className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <X className="w-4 h-4" /> Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Datum</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Klient</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Dauer</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Stunden</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Mitarbeiter</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Qualifikation</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Abrechenbar</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monatlicheLeistungen.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{l.datum}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{l.klienten_id}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{l.dauer_minuten} min</td>
                    <td className="px-4 py-3 text-right text-slate-600">{calcDecimalStunden(l.dauer_minuten).toFixed(2)}h</td>
                    <td className="px-4 py-3 text-slate-600">{l.mitarbeiter_id}</td>
                    <td className="px-4 py-3 text-slate-600">{l.mitarbeiter_qualifikation}</td>
                    <td className="px-4 py-3 text-center">
                      {l.abrechenbar ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 flex gap-1 justify-end">
                      <button onClick={() => { setLeistungForm(l); setEditingLeistung(l.id); setShowLeistungForm(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteLeistung(l.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {monatlicheLeistungen.length === 0 && <div className="px-6 py-12 text-center text-slate-400">Keine Leistungen im gewählten Monat</div>}
          </div>
        </TabsContent>

        {/* Dashboards Tab */}
        <TabsContent value="dashboards" className="space-y-6">
          {/* FLS-Monitor */}
          <Card>
            <CardHeader>
              <CardTitle>FLS-Monitor: Soll vs. Ist</CardTitle>
            </CardHeader>
            <CardContent>
              {flsMonitor.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={flsMonitor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="klienten_id" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="soll" fill="#94a3b8" name="Bewilligt" />
                    <Bar dataKey="ist" fill="#14b8a6" name="Erbracht" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm">Keine Daten vorhanden</p>
              )}
            </CardContent>
          </Card>

          {/* Fachkraftquote */}
          <Card>
            <CardHeader>
              <CardTitle>Fachkraftquote</CardTitle>
            </CardHeader>
            <CardContent>
              {gesamtStundenMonat > 0 ? (
                <div className="flex gap-8 items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={fachkraftquoteData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                        <Cell fill="#3b82f6" />
                        <Cell fill="#06b6d4" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 text-sm">
                    <p className="flex justify-between gap-4">
                      <span>Fachkraft:</span>
                      <span className="font-bold">{fachkraftStunden.toFixed(1)}h ({Math.round((fachkraftStunden / gesamtStundenMonat) * 100)}%)</span>
                    </p>
                    <p className="flex justify-between gap-4">
                      <span>Assistenzkraft:</span>
                      <span className="font-bold">{assistenzStunden.toFixed(1)}h ({Math.round((assistenzStunden / gesamtStundenMonat) * 100)}%)</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Keine Leistungsdaten</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finanzen Tab */}
        <TabsContent value="finanzen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Erlös-Abgleich: ERP vs. Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Monat</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Erlöse (ERP)</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Gegenwert (Excel)</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Abweichung</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{filterMonat}</td>
                    <td className="px-4 py-3 text-right font-medium">{Math.round(totalErloese)} €</td>
                    <td className="px-4 py-3 text-right font-medium">{Math.round(gegenwertIstStunden)} €</td>
                    <td className={`px-4 py-3 text-right font-medium ${abweichung >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {abweichung >= 0 ? '+' : ''}{Math.round(abweichung)} €
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-4">💡 Differenzen deuten auf Dokumentationslücken hin.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}