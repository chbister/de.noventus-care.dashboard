import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Save, X, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ERPMapping from '@/components/betreutesWohnen/ERPMapping';
import LeistungsImport from '@/components/betreutesWohnen/LeistungsImport';

const EMPTY_WE = { wohneinheit_id: '', bezeichnung: '', flaeche_qm: 0, kostenstelle: '', soll_kaltmiete: 0, soll_nebenkosten: 0, soll_grundservice: 0, status_aktiv: true };
const EMPTY_BELEGUNG = { wohneinheit_id: '', mieter_id: '', mieter_name: '', einzug_datum: '', auszug_datum: '', pflegegrad: 'PG 2', status: 'Aktiv' };

export default function BetreutesWohnen() {
  const { selectedEinrichtung } = useEinrichtung();
  const [wohneinheiten, setWohneinheiten] = useState([]);
  const [belegungen, setBelegungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWEForm, setShowWEForm] = useState(false);
  const [showBelForm, setShowBelForm] = useState(false);
  const [editingWE, setEditingWE] = useState(null);
  const [editingBel, setEditingBel] = useState(null);
  const [weForm, setWeForm] = useState(EMPTY_WE);
  const [belForm, setBelForm] = useState(EMPTY_BELEGUNG);

  const load = async () => {
    if (!selectedEinrichtung) return;
    try {
      const [we, bel] = await Promise.all([
        base44.entities.WohneinheitenStamm.list(),
        base44.entities.BetreutesWohnenBelegung.list(),
      ]);
      setWohneinheiten(we);
      setBelegungen(bel);
    } catch (e) {
      console.error('Fehler beim Laden:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  // Wohneinheiten CRUD
  const saveWE = async () => {
    if (!weForm.wohneinheit_id || !weForm.bezeichnung) return;
    if (editingWE) {
      await base44.entities.WohneinheitenStamm.update(editingWE, weForm);
    } else {
      await base44.entities.WohneinheitenStamm.create(weForm);
    }
    setShowWEForm(false);
    setEditingWE(null);
    setWeForm(EMPTY_WE);
    load();
  };

  const deleteWE = async (id) => {
    if (confirm('Wohneinheit löschen?')) {
      await base44.entities.WohneinheitenStamm.delete(id);
      load();
    }
  };

  // Belegungen CRUD
  const saveBel = async () => {
    if (!belForm.wohneinheit_id || !belForm.mieter_name || !belForm.einzug_datum) return;
    if (editingBel) {
      await base44.entities.BetreutesWohnenBelegung.update(editingBel, belForm);
    } else {
      await base44.entities.BetreutesWohnenBelegung.create(belForm);
    }
    setShowBelForm(false);
    setEditingBel(null);
    setBelForm(EMPTY_BELEGUNG);
    load();
  };

  const deleteBel = async (id) => {
    if (confirm('Belegung löschen?')) {
      await base44.entities.BetreutesWohnenBelegung.delete(id);
      load();
    }
  };

  // KPIs
  const activeBelegungen = belegungen.filter(b => b.status === 'Aktiv');
  const totalWE = wohneinheiten.filter(w => w.status_aktiv).length;
  const belegungsquote = totalWE > 0 ? Math.round((activeBelegungen.length / totalWE) * 100) : 0;
  const sollMieten = wohneinheiten.reduce((s, w) => s + (w.soll_kaltmiete || 0) + (w.soll_nebenkosten || 0), 0);
  const freiEinheiten = totalWE - activeBelegungen.length;

  if (loading) return <div className="p-8 text-center text-slate-400">Laden...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Stammdaten – Betreutes Wohnen</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Wohneinheiten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-600">{totalWE}</div>
            <p className="text-xs text-slate-400 mt-1">{activeBelegungen.length} belegt, {freiEinheiten} frei</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Belegungsquote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-600">{belegungsquote}%</div>
            <p className="text-xs text-slate-400 mt-1">{activeBelegungen.length} / {totalWE}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Soll-Mieten (Monat)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-600">{Math.round(sollMieten).toLocaleString('de-DE')} €</div>
            <p className="text-xs text-slate-400 mt-1">Brutto monatlich</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Leerstandsverlust</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {Math.round((freiEinheiten / totalWE * sollMieten) / totalWE).toLocaleString('de-DE')} €
            </div>
            <p className="text-xs text-slate-400 mt-1">pro freie Einheit</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="wohneinheiten" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="wohneinheiten">Wohneinheiten</TabsTrigger>
          <TabsTrigger value="belegungen">Belegungsspiegel</TabsTrigger>
          <TabsTrigger value="erp-mapping">ERP-Mapping</TabsTrigger>
          <TabsTrigger value="import">Leistungs-Import</TabsTrigger>
        </TabsList>

        {/* Wohneinheiten Tab */}
        <TabsContent value="wohneinheiten" className="space-y-4">
          <div className="flex justify-end mb-4">
            <button onClick={() => { setWeForm(EMPTY_WE); setEditingWE(null); setShowWEForm(true); }}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Neue Wohneinheit
            </button>
          </div>

          {showWEForm && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
              <h3 className="font-semibold text-slate-900 mb-4">{editingWE ? 'Bearbeiten' : 'Neue Wohneinheit'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">ID/Nummer *</label>
                  <input value={weForm.wohneinheit_id} onChange={e => setWeForm(p => ({ ...p, wohneinheit_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. WE-01" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Bezeichnung *</label>
                  <input value={weForm.bezeichnung} onChange={e => setWeForm(p => ({ ...p, bezeichnung: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. Apartment 101" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Fläche (m²)</label>
                  <input type="number" step="0.1" value={weForm.flaeche_qm || 0} onChange={e => setWeForm(p => ({ ...p, flaeche_qm: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Kostenstelle</label>
                  <input value={weForm.kostenstelle || ''} onChange={e => setWeForm(p => ({ ...p, kostenstelle: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Kaltmiete (Soll) €</label>
                  <input type="number" step="0.01" value={weForm.soll_kaltmiete || 0} onChange={e => setWeForm(p => ({ ...p, soll_kaltmiete: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Nebenkosten (Soll) €</label>
                  <input type="number" step="0.01" value={weForm.soll_nebenkosten || 0} onChange={e => setWeForm(p => ({ ...p, soll_nebenkosten: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Grundservice (Soll) €</label>
                  <input type="number" step="0.01" value={weForm.soll_grundservice || 0} onChange={e => setWeForm(p => ({ ...p, soll_grundservice: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Status</label>
                  <select value={weForm.status_aktiv ? 'aktiv' : 'inaktiv'} onChange={e => setWeForm(p => ({ ...p, status_aktiv: e.target.value === 'aktiv' }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="aktiv">Aktiv</option>
                    <option value="inaktiv">Inaktiv</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveWE} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
                  <Save className="w-4 h-4" /> Speichern
                </button>
                <button onClick={() => setShowWEForm(false)} className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <X className="w-4 h-4" /> Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Bezeichnung</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Fläche</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Kaltmiete</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">NK</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wohneinheiten.map(we => (
                  <tr key={we.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{we.wohneinheit_id}</td>
                    <td className="px-4 py-3 text-slate-600">{we.bezeichnung}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{we.flaeche_qm} m²</td>
                    <td className="px-4 py-3 text-right text-slate-600">{we.soll_kaltmiete?.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-right text-slate-600">{we.soll_nebenkosten?.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${we.status_aktiv ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                        {we.status_aktiv ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-1 justify-end">
                      <button onClick={() => { setWeForm(we); setEditingWE(we.id); setShowWEForm(true); }} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-teal-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteWE(we.id)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wohneinheiten.length === 0 && (
              <div className="px-6 py-12 text-center text-slate-400">Keine Wohneinheiten angelegt</div>
            )}
          </div>
        </TabsContent>

        {/* Belegungen Tab */}
        <TabsContent value="belegungen" className="space-y-4">
          <div className="flex justify-end mb-4">
            <button onClick={() => { setBelForm(EMPTY_BELEGUNG); setEditingBel(null); setShowBelForm(true); }}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Neue Belegung
            </button>
          </div>

          {showBelForm && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
              <h3 className="font-semibold text-slate-900 mb-4">{editingBel ? 'Bearbeiten' : 'Neue Belegung'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Wohneinheit *</label>
                  <select value={belForm.wohneinheit_id} onChange={e => setBelForm(p => ({ ...p, wohneinheit_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Wählen --</option>
                    {wohneinheiten.map(we => (
                      <option key={we.id} value={we.wohneinheit_id}>{we.wohneinheit_id} - {we.bezeichnung}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Mieter Name *</label>
                  <input value={belForm.mieter_name} onChange={e => setBelForm(p => ({ ...p, mieter_name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Mieter ID</label>
                  <input value={belForm.mieter_id || ''} onChange={e => setBelForm(p => ({ ...p, mieter_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Pflegegrad</label>
                  <select value={belForm.pflegegrad} onChange={e => setBelForm(p => ({ ...p, pflegegrad: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option>PG 1</option>
                    <option>PG 2</option>
                    <option>PG 3</option>
                    <option>PG 4</option>
                    <option>PG 5</option>
                    <option>Ohne PG</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Einzug *</label>
                  <input type="date" value={belForm.einzug_datum} onChange={e => setBelForm(p => ({ ...p, einzug_datum: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Auszug (optional)</label>
                  <input type="date" value={belForm.auszug_datum || ''} onChange={e => setBelForm(p => ({ ...p, auszug_datum: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Status</label>
                  <select value={belForm.status} onChange={e => setBelForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option>Aktiv</option>
                    <option>Ausgezogen</option>
                    <option>Reserviert</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveBel} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
                  <Save className="w-4 h-4" /> Speichern
                </button>
                <button onClick={() => setShowBelForm(false)} className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <X className="w-4 h-4" /> Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Wohneinheit</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Mieter</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">PG</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Einzug</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Auszug</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {belegungen.map(bel => (
                  <tr key={bel.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{bel.wohneinheit_id}</td>
                    <td className="px-4 py-3 text-slate-600">{bel.mieter_name}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{bel.pflegegrad}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{bel.einzug_datum}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{bel.auszug_datum || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        bel.status === 'Aktiv' ? 'bg-teal-100 text-teal-700' :
                        bel.status === 'Ausgezogen' ? 'bg-slate-100 text-slate-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {bel.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-1 justify-end">
                      <button onClick={() => { setBelForm(bel); setEditingBel(bel.id); setShowBelForm(true); }} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-teal-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteBel(bel.id)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {belegungen.length === 0 && (
              <div className="px-6 py-12 text-center text-slate-400">Keine Belegungen erfasst</div>
            )}
          </div>
        </TabsContent>

        {/* ERP-Mapping Tab */}
        <TabsContent value="erp-mapping">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 mb-4">ERP-Kontonummern Mapping</h3>
            <p className="text-sm text-slate-500 mb-6">Ordnen Sie ERP-Konten den Base44-Kategorien zu, um Finanzdaten automatisch korrekt zu kategorisieren.</p>
            <ERPMapping />
          </div>
        </TabsContent>

        {/* Leistungs-Import Tab */}
        <TabsContent value="import">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Wahlleistungen importieren</h3>
            <p className="text-sm text-slate-500 mb-6">Laden Sie CSV-Dateien mit Leistungsnachweisen hoch. Diese werden validiert und mit Ihren Wohneinheiten verknüpft.</p>
            <LeistungsImport onSuccess={() => {
              // Optional: refresh data
              load();
            }} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}