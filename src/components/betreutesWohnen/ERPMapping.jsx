import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

const EMPTY_MAP = { konto_nr: '', base44_kategorie: '', kontentyp: 'Haben', beschreibung: '' };

const KATEGORIEN = [
  'Wahlleistung_Umsatz',
  'Basismiete_Ist',
  'Personalaufwand_Gesamt',
  'Sachkosten_Gebäude',
  'Sonstiges',
];

export default function ERPMapping() {
  const [mappings, setMappings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_MAP);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      // Hier würde eine separate Mapping-Entity geladen
      // Für jetzt simulieren wir mit lokalem Storage
      const stored = localStorage.getItem('erp_mappings');
      setMappings(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error('Fehler beim Laden:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.konto_nr || !form.base44_kategorie) return;
    let updated;
    if (editing) {
      updated = mappings.map(m => m.konto_nr === editing ? form : m);
    } else {
      updated = [...mappings, { ...form, id: Date.now() }];
    }
    setMappings(updated);
    localStorage.setItem('erp_mappings', JSON.stringify(updated));
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_MAP);
  };

  const del = (id) => {
    const updated = mappings.filter(m => m.id !== id);
    setMappings(updated);
    localStorage.setItem('erp_mappings', JSON.stringify(updated));
  };

  if (loading) return <div className="text-center text-slate-400 py-8">Laden...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm(EMPTY_MAP); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Neues Mapping
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-4">
          <h3 className="font-semibold text-slate-900 mb-4">{editing ? 'Bearbeiten' : 'Neues ERP-Mapping'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Konto-Nr (z.B. 8000) *</label>
              <input value={form.konto_nr} onChange={e => setForm(p => ({ ...p, konto_nr: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Base44 Kategorie *</label>
              <select value={form.base44_kategorie} onChange={e => setForm(p => ({ ...p, base44_kategorie: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">-- Wählen --</option>
                {KATEGORIEN.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Kontentyp</label>
              <select value={form.kontentyp} onChange={e => setForm(p => ({ ...p, kontentyp: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option>Haben</option>
                <option>Soll</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Beschreibung</label>
              <input value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. Erlöse 19%" />
            </div>
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

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-medium text-slate-600">Konto-Nr</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Beschreibung</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Base44 Kategorie</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Typ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mappings.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{m.konto_nr}</td>
                <td className="px-4 py-3 text-slate-600 text-sm">{m.beschreibung}</td>
                <td className="px-4 py-3 text-slate-600 text-sm">{m.base44_kategorie}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${m.kontentyp === 'Haben' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {m.kontentyp}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-1 justify-end">
                  <button onClick={() => { setForm(m); setEditing(m.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-teal-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => del(m.id)} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mappings.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">Keine Mappings definiert</div>
        )}
      </div>
    </div>
  );
}