import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, BedDouble, Save, X, Upload } from 'lucide-react';
import BewohnerImport from '@/components/wohnbereiche/BewohnerImport';

const EMPTY = {
  name: '', sollbelegung: 34,
  belegung_ruestige: 0, belegung_pg0: 0, belegung_pg1: 0,
  belegung_pg2: 0, belegung_pg3: 0, belegung_pg4: 0, belegung_pg5: 0,
  geplant_pg2: 0, geplant_pg3: 0, geplant_pg4: 0, geplant_pg5: 0,
  kommentar: '', stichtag: '', aktiv: true
};

export default function Wohnbereiche() {
  const { selectedEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id })
      .then(d => { setItems(d); setLoading(false); });
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  const save = async () => {
    const data = { ...form, einrichtung_id: selectedEinrichtung.id };
    if (editing) {
      await base44.entities.Wohnbereich.update(editing, data);
    } else {
      await base44.entities.Wohnbereich.create(data);
    }
    setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const del = async (id) => {
    if (!confirm('Wohnbereich löschen?')) return;
    await base44.entities.Wohnbereich.delete(id); load();
  };

  const startEdit = (item) => {
    setForm({ ...item }); setEditing(item.id); setShowForm(true);
  };

  const BelegungsRow = ({ label, field }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500 w-24 shrink-0">{label}</label>
      <input type="number" value={form[field] || 0} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
        className="w-20 border border-slate-200 rounded px-2 py-1 text-sm" min="0" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Wohnbereiche</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium">
            <Upload className="w-4 h-4" /> Bewohner-Import
          </button>
          <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Neu
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Wohnbereich bearbeiten' : 'Neuer Wohnbereich'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. Wohnbereich 1" />
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
              <BelegungsRow label="Rüstige/AH" field="belegung_ruestige" />
              <BelegungsRow label="PG 0" field="belegung_pg0" />
              <BelegungsRow label="PG 1" field="belegung_pg1" />
              <BelegungsRow label="PG 2" field="belegung_pg2" />
              <BelegungsRow label="PG 3" field="belegung_pg3" />
              <BelegungsRow label="PG 4" field="belegung_pg4" />
              <BelegungsRow label="PG 5" field="belegung_pg5" />
            </div>
          </div>
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Geplante Einzüge</p>
            <div className="flex flex-wrap gap-3">
              <BelegungsRow label="PG 2" field="geplant_pg2" />
              <BelegungsRow label="PG 3" field="geplant_pg3" />
              <BelegungsRow label="PG 4" field="geplant_pg4" />
              <BelegungsRow label="PG 5" field="geplant_pg5" />
            </div>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.aktiv !== false} onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-teal-600" />
              Aktiv
            </label>
            {!form.aktiv && <span className="text-xs text-slate-400">(Inaktive Wohnbereiche erhalten keine verteilten Mitarbeiter)</span>}
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
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
          <BedDouble className="w-10 h-10 mx-auto mb-3" />
          <p>Noch keine Wohnbereiche für diese Einrichtung</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(wb => {
            const ist = (wb.belegung_pg1||0)+(wb.belegung_pg2||0)+(wb.belegung_pg3||0)+(wb.belegung_pg4||0)+(wb.belegung_pg5||0)+(wb.belegung_ruestige||0)+(wb.belegung_pg0||0);
            const soll = wb.sollbelegung || 0;
            const pct = soll > 0 ? Math.round((ist / soll) * 100) : 0;
            return (
              <div key={wb.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{wb.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wb.aktiv !== false ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                      {wb.aktiv !== false ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(wb)} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => del(wb.id)} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                      <div className="font-semibold text-slate-700">{wb[`belegung_pg${pg}`] || 0}</div>
                      <div className="text-slate-400">PG{pg}</div>
                    </div>
                  ))}
                </div>
                {wb.kommentar && <p className="text-xs text-slate-400 mt-2 italic">{wb.kommentar}</p>}
              </div>
            );
          })}
        </div>
      )}

      {showImport && (
        <BewohnerImport
          wohnbereiche={items}
          onDone={load}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}