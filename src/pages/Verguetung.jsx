import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

const EMPTY = {
  bezeichnung: '', gueltig_ab: '', gueltig_bis: '',
  pflegesatz_pg2: 0, pflegesatz_pg3: 0, pflegesatz_pg4: 0, pflegesatz_pg5: 0,
  investitionskosten: 0, unterkunft_verpflegung: 0, ausbildungsumlage: 0,
  zusaetzliche_betreuung_43b: 0, bemerkung: '',
};

const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';

export default function Verguetung({ embedded = false }) {
  const { selectedEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    base44.entities.Verguetung.filter({ einrichtung_id: selectedEinrichtung.id })
      .then(d => { setItems(d.sort((a, b) => (b.gueltig_ab || '').localeCompare(a.gueltig_ab || ''))); setLoading(false); });
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  const save = async () => {
    const data = { ...form, einrichtung_id: selectedEinrichtung.id };
    if (editing) await base44.entities.Verguetung.update(editing, data);
    else await base44.entities.Verguetung.create(data);
    setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const del = async (id) => {
    if (!confirm('Vergütung löschen?')) return;
    await base44.entities.Verguetung.delete(id); load();
  };

  const F = ({ label, field, type = 'text' }) => (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input type={type} step={type === 'number' ? '0.01' : undefined}
        value={form[field] ?? ''} onChange={e => setForm(p => ({ ...p, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );

  return (
    <div className={embedded ? '' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
      <div className="flex items-center justify-between mb-6">
        {!embedded && <h1 className="text-2xl font-bold text-slate-900">Vergütung</h1>}
        <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Neu
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Bearbeiten' : 'Neue Vergütung'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <F label="Bezeichnung *" field="bezeichnung" />
            </div>
            <F label="Gültig ab" field="gueltig_ab" type="date" />
            <F label="Gültig bis" field="gueltig_bis" type="date" />
          </div>
          <p className="text-xs font-medium text-slate-600 mb-2">Pflegesätze (EUR/Tag)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <F label="PG 2" field="pflegesatz_pg2" type="number" />
            <F label="PG 3" field="pflegesatz_pg3" type="number" />
            <F label="PG 4" field="pflegesatz_pg4" type="number" />
            <F label="PG 5" field="pflegesatz_pg5" type="number" />
          </div>
          <p className="text-xs font-medium text-slate-600 mb-2">Weitere Sätze (EUR/Tag)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <F label="Investitionskosten" field="investitionskosten" type="number" />
            <F label="Unterkunft & Verpflegung" field="unterkunft_verpflegung" type="number" />
            <F label="Ausbildungsumlage" field="ausbildungsumlage" type="number" />
            <F label="Zusätzl. Betreuung §43b" field="zusaetzliche_betreuung_43b" type="number" />
          </div>
          <div className="mb-4">
            <F label="Bemerkung" field="bemerkung" />
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
          Noch keine Vergütungen erfasst
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{v.bezeichnung}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmtDate(v.gueltig_ab)} — {v.gueltig_bis ? fmtDate(v.gueltig_bis) : 'offen'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setForm({ ...v }); setEditing(v.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => del(v.id)} className="p-1.5 hover:bg-slate-50 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'PG 2', val: v.pflegesatz_pg2 },
                  { label: 'PG 3', val: v.pflegesatz_pg3 },
                  { label: 'PG 4', val: v.pflegesatz_pg4 },
                  { label: 'PG 5', val: v.pflegesatz_pg5 },
                  { label: 'Investition', val: v.investitionskosten },
                  { label: 'Unterk. & Verp.', val: v.unterkunft_verpflegung },
                  { label: 'Ausbildung', val: v.ausbildungsumlage },
                  { label: '§43b Betreuung', val: v.zusaetzliche_betreuung_43b },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded p-2">
                    <div className="text-slate-400 mb-0.5">{s.label}</div>
                    <div className="font-semibold text-slate-800">{fmt(s.val)}</div>
                  </div>
                ))}
              </div>
              {v.bemerkung && <p className="text-xs text-slate-400 mt-2 italic">{v.bemerkung}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}