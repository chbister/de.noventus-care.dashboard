import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MediFoxImportManager from '@/components/medifox/MediFoxImportManager';

const EMPTY = {
  name: '', sollbelegung: 20,
  belegung_ruestige: 0, belegung_pg0: 0, belegung_pg1: 0,
  belegung_pg2: 0, belegung_pg3: 0, belegung_pg4: 0, belegung_pg5: 0,
  geplant_pg2: 0, geplant_pg3: 0, geplant_pg4: 0, geplant_pg5: 0,
  kommentar: '', stichtag: ''
};

export default function TagespflegePage() {
  const { selectedEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [activeTab, setActiveTab] = useState('stammdaten');

  const load = () => {
    if (!selectedEinrichtung) { setLoading(false); return; }
    setLoading(true);
    base44.entities.Tagespflege.filter({ einrichtung_id: selectedEinrichtung.id })
      .then(d => { setItems(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setActiveTab('stammdaten');
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
    load();
  }, [selectedEinrichtung]);

  const save = async () => {
    const data = { ...form, einrichtung_id: selectedEinrichtung.id };
    if (editing) await base44.entities.Tagespflege.update(editing, data);
    else await base44.entities.Tagespflege.create(data);
    setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const del = async (id) => {
    if (!confirm('Tagespflege löschen?')) return;
    await base44.entities.Tagespflege.delete(id); load();
  };

  const F = ({ label, field }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500 w-24 shrink-0">{label}</label>
      <input type="number" value={form[field] || 0} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
        className="w-20 border border-slate-200 rounded px-2 py-1 text-sm" min="0" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tagespflege</h1>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Neu
        </button>
      </div>

      {/* Tabs: Stammdaten vs. MediFox-Import */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
          <TabsTrigger value="medifox">MediFox-Import</TabsTrigger>
        </TabsList>

        <TabsContent value="medifox" className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📊 MediFox-Datenimport</h3>
            <p className="text-xs text-blue-700 leading-relaxed mb-3">
              Importieren Sie Leistungsdaten aus MediFox. Das System validiert Dubletten, prüft Pflegegrade und erstellt automatisch einen Snapshot vor dem Import für Datensicherung.
            </p>
            <p className="text-xs text-blue-600 font-medium">✓ Snapshot vor Import ✓ Validierung ✓ Mapping-Zuordnung ✓ DSGVO-konform (ID statt Namen)</p>
          </div>
          <MediFoxImportManager onSuccess={() => load()} bereich="Tagespflege" />
        </TabsContent>

        <TabsContent value="stammdaten" className="space-y-4">
          {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Bearbeiten' : 'Neue Tagespflege'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sollbelegung</label>
              <input type="number" value={form.sollbelegung} onChange={e => setForm(p => ({ ...p, sollbelegung: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Stichtag</label>
              <input type="date" value={form.stichtag || ''} onChange={e => setForm(p => ({ ...p, stichtag: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Aktuelle Belegung</p>
            <div className="flex flex-wrap gap-3">
              <F label="Rüstige/AH" field="belegung_ruestige" />
              <F label="PG 1" field="belegung_pg1" />
              <F label="PG 2" field="belegung_pg2" />
              <F label="PG 3" field="belegung_pg3" />
              <F label="PG 4" field="belegung_pg4" />
              <F label="PG 5" field="belegung_pg5" />
            </div>
          </div>
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Geplante Aufnahmen</p>
            <div className="flex flex-wrap gap-3">
              <F label="PG 2" field="geplant_pg2" />
              <F label="PG 3" field="geplant_pg3" />
              <F label="PG 4" field="geplant_pg4" />
              <F label="PG 5" field="geplant_pg5" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-500 mb-1 block">Kommentar</label>
            <textarea value={form.kommentar || ''} onChange={e => setForm(p => ({ ...p, kommentar: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>
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

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(tp => {
            const ist = (tp.belegung_pg1||0)+(tp.belegung_pg2||0)+(tp.belegung_pg3||0)+(tp.belegung_pg4||0)+(tp.belegung_pg5||0)+(tp.belegung_ruestige||0);
            const soll = tp.sollbelegung || 0;
            const pct = soll > 0 ? Math.round((ist / soll) * 100) : 0;
            return (
              <div key={tp.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{tp.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => { setForm({ ...tp }); setEditing(tp.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => del(tp.id)} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">Belegung</span>
                  <span className="font-medium">{ist} / {soll}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : pct >= 90 ? 'bg-orange-400' : 'bg-teal-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {[2,3,4,5].map(pg => (
                    <div key={pg} className="bg-slate-50 rounded p-1.5 text-center">
                      <div className="font-semibold text-slate-700">{tp[`belegung_pg${pg}`] || 0}</div>
                      <div className="text-slate-400">PG{pg}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="col-span-3 bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
              Noch keine Tagespflege für diese Einrichtung
            </div>
          )}
          </div>
          )}
          </TabsContent>
          </Tabs>
          </div>
          );
          }