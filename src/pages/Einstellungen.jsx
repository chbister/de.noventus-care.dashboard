import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Save, X, Building2, Download, FolderOpen, Cloud } from 'lucide-react';
import ExportEinstellungen from '@/components/ExportEinstellungen';
import SharePointEinstellungen from '@/components/SharePointEinstellungen';
import OneDriveImportStatus from '@/components/onedrive/OneDriveImportStatus';

const EMPTY_E = {
  name: '', standort: '', vollzeit_wochenstunden: 40, pebem_aktiv: true,
  personalmodell: 'pebem',
  schluessel_pg2_fk: 0.1017, schluessel_pg3_fk: 0.1521, schluessel_pg4_fk: 0.2416, schluessel_pg5_fk: 0.3768,
  schluessel_pg2_hk_mit: 0.0136, schluessel_pg3_hk_mit: 0.0217, schluessel_pg4_hk_mit: 0.0285, schluessel_pg5_hk_mit: 0.0223,
  schluessel_pg2_hk_ohne: 0.1173, schluessel_pg3_hk_ohne: 0.1414, schluessel_pg4_hk_ohne: 0.1588, schluessel_pg5_hk_ohne: 0.1716,
  schluessel_43b: 20, sollvorgabe_pro_vk: 0, begl_dienst_schluessel: 36.25,
  neu_pg1_ratio: 6.283, neu_pg2_ratio: 4.229, neu_pg3_ratio: 3.037, neu_pg4_ratio: 2.347, neu_pg5_ratio: 2.129,
  neu_fachkraftquote: 49.99, neu_anteil_fachkraefte: 50.00,
  neu_leitung_verwaltung: 24, neu_wirtschaftsdienst: 6, neu_technischer_dienst: 69, neu_qualitaetsmanagement: 110,
};

export default function Einstellungen() {
  const { einrichtungen, selectedEinrichtung, selectEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_E);
  const [activeTab, setActiveTab] = useState('einrichtungen');

  const load = () => {
    base44.entities.Einrichtung.list().then(d => setItems(d));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const NUM_FIELDS = [
      'vollzeit_wochenstunden', 'sollvorgabe_pro_vk', 'schluessel_43b', 'begl_dienst_schluessel',
      'schluessel_pg2_fk', 'schluessel_pg2_hk_mit', 'schluessel_pg2_hk_ohne',
      'schluessel_pg3_fk', 'schluessel_pg3_hk_mit', 'schluessel_pg3_hk_ohne',
      'schluessel_pg4_fk', 'schluessel_pg4_hk_mit', 'schluessel_pg4_hk_ohne',
      'schluessel_pg5_fk', 'schluessel_pg5_hk_mit', 'schluessel_pg5_hk_ohne',
      'neu_pg1_ratio', 'neu_pg2_ratio', 'neu_pg3_ratio', 'neu_pg4_ratio', 'neu_pg5_ratio',
      'neu_fachkraftquote', 'neu_anteil_fachkraefte',
      'neu_leitung_verwaltung', 'neu_wirtschaftsdienst', 'neu_technischer_dienst', 'neu_qualitaetsmanagement',
    ];
    const data = { ...form };
    NUM_FIELDS.forEach(f => { data[f] = parseFloat(data[f]) || 0; });
    if (editing) await base44.entities.Einrichtung.update(editing, data);
    else await base44.entities.Einrichtung.create(data);
    setShowForm(false); setEditing(null); setForm(EMPTY_E);
    load();
    window.location.reload();
  };

  const del = async (id) => {
    if (!confirm('Einrichtung löschen? Alle zugehörigen Daten bleiben erhalten.')) return;
    await base44.entities.Einrichtung.delete(id); load();
  };

  const F = ({ label, field, type = 'text' }) => (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input type={type} step={type === 'number' ? '0.0001' : undefined}
        value={form[field] ?? ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );

  const TABS = [
    { id: 'einrichtungen', label: 'Einrichtungen', icon: Building2 },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'sharepoint', label: 'SharePoint', icon: FolderOpen },
    { id: 'onedrive', label: 'OneDrive', icon: Cloud },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Einstellungen</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Einrichtungen */}
      {activeTab === 'einrichtungen' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setForm(EMPTY_E); setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Neue Einrichtung
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
              <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Einrichtung bearbeiten' : 'Neue Einrichtung'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <F label="Name *" field="name" />
                <F label="Standort" field="standort" />
                <F label="Vollzeit-Wochenstunden" field="vollzeit_wochenstunden" type="number" />
                <F label="Sollvorgabe pro VK (EUR)" field="sollvorgabe_pro_vk" type="number" />
                <F label="§43b Schlüssel" field="schluessel_43b" type="number" />
                <F label="Begl. Dienst Schlüssel" field="begl_dienst_schluessel" type="number" />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.pebem_aktiv} onChange={e => setForm(p => ({ ...p, pebem_aktiv: e.target.checked }))} />
                  PeBeM-Personalschlüssel aktiv
                </label>
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">PeBeM-Personalschlüssel</h3>
                <p className="text-xs text-slate-400 mb-3">VK-Bedarf pro Bewohner je Pflegegrad und Qualifikationsgruppe</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-600">
                        <th className="px-3 py-2 font-medium">Pflegegrad</th>
                        <th className="px-3 py-2 font-medium text-right">Fachkraft (FK)</th>
                        <th className="px-3 py-2 font-medium text-right">HK m.A.</th>
                        <th className="px-3 py-2 font-medium text-right">HK o.A.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[
                        { pg: 'PG2', fk: 'schluessel_pg2_fk', hkMit: 'schluessel_pg2_hk_mit', hkOhne: 'schluessel_pg2_hk_ohne' },
                        { pg: 'PG3', fk: 'schluessel_pg3_fk', hkMit: 'schluessel_pg3_hk_mit', hkOhne: 'schluessel_pg3_hk_ohne' },
                        { pg: 'PG4', fk: 'schluessel_pg4_fk', hkMit: 'schluessel_pg4_hk_mit', hkOhne: 'schluessel_pg4_hk_ohne' },
                        { pg: 'PG5', fk: 'schluessel_pg5_fk', hkMit: 'schluessel_pg5_hk_mit', hkOhne: 'schluessel_pg5_hk_ohne' },
                      ].map(row => (
                        <tr key={row.pg}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{row.pg}</td>
                          {[row.fk, row.hkMit, row.hkOhne].map((field, i) => (
                            <td key={field} className="px-3 py-2">
                              <input type="number" step="0.0001" value={form[field] ?? ''}
                                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                                className="w-full text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modell-Umschaltung */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">Personalschlüssel-Modell (für PDF)</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, personalmodell: 'pebem' }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${(form.personalmodell || 'pebem') === 'pebem' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    PeBeM (VK-Bedarf pro Bewohner)
                  </button>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, personalmodell: 'neu' }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${form.personalmodell === 'neu' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Neu (1-zu-X Ratio + Fachkraftquote)
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Beide Modelle bleiben gespeichert. Das gewählte Modell wird im Monatsabschluss-PDF verwendet.</p>
              </div>

              {/* Neues Modell: 1-zu-X Ratios */}
              {form.personalmodell === 'neu' && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-1">Personelle Ausstattung (1-zu-X)</h3>
                  <p className="text-xs text-amber-600 mb-3">Pflege und Betreuung – 1 Kraft pro X Bewohner je Pflegegrad</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                    {[
                      { pg: 'PG1', field: 'neu_pg1_ratio' },
                      { pg: 'PG2', field: 'neu_pg2_ratio' },
                      { pg: 'PG3', field: 'neu_pg3_ratio' },
                      { pg: 'PG4', field: 'neu_pg4_ratio' },
                      { pg: 'PG5', field: 'neu_pg5_ratio' },
                    ].map(r => (
                      <div key={r.pg}>
                        <label className="text-xs text-amber-700 mb-1 block">{r.pg} (1 zu)</label>
                        <input type="number" step="0.001" value={form[r.field] ?? ''}
                          onChange={e => setForm(p => ({ ...p, [r.field]: e.target.value }))}
                          className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-right bg-white" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <F label="Fachkraftquote (%)" field="neu_fachkraftquote" type="number" />
                    <F label="Anteil Fachkräfte (%)" field="neu_anteil_fachkraefte" type="number" />
                    <F label="Leitung/Verwaltung (1 zu)" field="neu_leitung_verwaltung" type="number" />
                    <F label="Wirtschaftsdienst (1 zu)" field="neu_wirtschaftsdienst" type="number" />
                    <F label="Technischer Dienst (1 zu)" field="neu_technischer_dienst" type="number" />
                    <F label="Qualitätsmanagement (1 zu)" field="neu_qualitaetsmanagement" type="number" />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={save} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
                  <Save className="w-4 h-4" /> Speichern
                </button>
                <button onClick={() => { setShowForm(false); setEditing(null); }} className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  <X className="w-4 h-4" /> Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {items.map(e => (
              <div key={e.id} className={`bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between ${selectedEinrichtung?.id === e.id ? 'border-teal-300 ring-1 ring-teal-200' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedEinrichtung?.id === e.id ? 'bg-teal-100' : 'bg-slate-100'}`}>
                    <Building2 className={`w-5 h-5 ${selectedEinrichtung?.id === e.id ? 'text-teal-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{e.name}</p>
                    {e.standort && <p className="text-xs text-slate-400">{e.standort}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedEinrichtung?.id !== e.id && (
                    <button onClick={() => selectEinrichtung(e)} className="px-3 py-1.5 text-xs bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium">
                      Aktivieren
                    </button>
                  )}
                  {selectedEinrichtung?.id === e.id && (
                    <span className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg font-medium">Aktiv</span>
                  )}
                  <button onClick={() => { setForm({ ...e }); setEditing(e.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => del(e.id)} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-3" />
                <p>Noch keine Einrichtungen angelegt</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab: Export */}
      {activeTab === 'export' && (
        <div>
          {selectedEinrichtung && (
            <p className="text-sm text-slate-500 mb-4">
              Export-Einstellungen für: <span className="font-semibold text-slate-800">{selectedEinrichtung.name}</span>
            </p>
          )}
          <ExportEinstellungen />
        </div>
      )}

      {/* Tab: SharePoint */}
      {activeTab === 'sharepoint' && (
        <SharePointEinstellungen />
      )}

      {/* Tab: OneDrive */}
      {activeTab === 'onedrive' && (
        <OneDriveImportStatus />
      )}
    </div>
  );
}