import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Save, X, Search, CheckCircle, Clock, AlertCircle, Upload } from 'lucide-react';
import BewohnerKostenImport from '@/components/bewohnerkosten/BewohnerKostenImport';

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

const STATUS_CFG = {
  offen: { label: 'Offen', icon: Clock, color: 'bg-red-100 text-red-700' },
  teilweise_bezahlt: { label: 'Teilw. bezahlt', icon: AlertCircle, color: 'bg-amber-100 text-amber-700' },
  bezahlt: { label: 'Bezahlt', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
};

const PFLEGEGRADE = ['PG1','PG2','PG3','PG4','PG5'];

const EMPTY_FORM = {
  bewohner_name: '', zimmer: '', pflegegrad: 'PG3',
  anteil_pflegekasse: 0, anteil_sozialamt: 0,
  sozialamt_wohngeld: 0, sozialamt_pflegewohngeld: 0,
  sozialamt_uebergeleitet_rente: 0, sozialamt_sozialhilfe: 0,
  anteil_bewohner: 0, betrag_gesamt: 0,
  bezahlt_pflegekasse: 0, bezahlt_sozialamt: 0,
  bezahlt_sozialamt_wohngeld: 0, bezahlt_sozialamt_pflegewohngeld: 0,
  bezahlt_sozialamt_uebergeleitet_rente: 0, bezahlt_sozialamt_sozialhilfe: 0,
  bezahlt_bewohner: 0, betrag_bezahlt: 0,
  status: 'offen', zahlungsdatum: '', bemerkung: '',
};

export default function BewohnerKosten({ embedded = false }) {
  const { selectedEinrichtung } = useEinrichtung();
  const now = new Date();
  const [monat, setMonat] = useState(now.getMonth() + 1);
  const [jahr, setJahr] = useState(now.getFullYear());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [suche, setSuche] = useState('');
  const [showImport, setShowImport] = useState(false);

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    base44.entities.BewohnerHeimkosten.filter({ einrichtung_id: selectedEinrichtung.id, monat, jahr })
      .then(d => { setItems(d.sort((a,b) => (a.bewohner_name||'').localeCompare(b.bewohner_name||''))); setLoading(false); });
  };

  useEffect(() => { load(); }, [selectedEinrichtung, monat, jahr]);

  const calcBezahlt = (f) =>
    (parseFloat(f.bezahlt_pflegekasse)||0) + (parseFloat(f.bezahlt_sozialamt)||0) + (parseFloat(f.bezahlt_bewohner)||0);

  const calcStatus = (bezahlt, gesamt) =>
    bezahlt >= gesamt && gesamt > 0 ? 'bezahlt' : bezahlt > 0 ? 'teilweise_bezahlt' : 'offen';

  const save = async () => {
    const bezahlt = calcBezahlt(form);
    const data = {
      ...form,
      einrichtung_id: selectedEinrichtung.id,
      monat, jahr,
      betrag_bezahlt: bezahlt,
      status: calcStatus(bezahlt, form.betrag_gesamt),
    };
    if (editing) await base44.entities.BewohnerHeimkosten.update(editing, data);
    else await base44.entities.BewohnerHeimkosten.create(data);
    setShowForm(false); setEditing(null); setForm(EMPTY_FORM); load();
  };

  const del = async (id) => {
    if (!confirm('Eintrag löschen?')) return;
    await base44.entities.BewohnerHeimkosten.delete(id); load();
  };

  const N = ({ label, field }) => (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input type="number" step="0.01" value={form[field] || 0}
        onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
    </div>
  );

  const filtered = suche.trim() ? items.filter(i => i.bewohner_name?.toLowerCase().includes(suche.toLowerCase())) : items;
  const gesamtSumme = items.reduce((s, i) => s + (i.betrag_gesamt || 0), 0);
  const bezahltSumme = items.reduce((s, i) => s + (i.betrag_bezahlt || 0), 0);
  const offenSumme = gesamtSumme - bezahltSumme;
  const jahre = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className={embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
      <div className="flex items-center justify-between mb-6">
        {!embedded && <h1 className="text-2xl font-bold text-slate-900">Bewohner Heimkosten</h1>}
        <div className="flex gap-2">
          <button onClick={() => setShowImport(v => !v)}
            className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
            <Upload className="w-4 h-4" /> Excel Import
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Neu
          </button>
        </div>
      </div>

      {showImport && (
        <BewohnerKostenImport
          einrichtungId={selectedEinrichtung?.id}
          monat={monat}
          jahr={jahr}
          onSuccess={() => { load(); setShowImport(false); }}
        />
      )}

      {/* Monat/Jahr Filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={monat} onChange={e => setMonat(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          {MONATE.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={jahr} onChange={e => setJahr(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          {jahre.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Bewohner suchen..." className="outline-none text-sm flex-1 bg-transparent" />
        </div>
      </div>

      {/* Summenkarten */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <div className="text-lg font-bold text-slate-900">{fmt(gesamtSumme)}</div>
          <div className="text-xs text-slate-400">Gesamt</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <div className="text-lg font-bold text-green-600">{fmt(bezahltSumme)}</div>
          <div className="text-xs text-slate-400">Bezahlt</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <div className="text-lg font-bold text-red-500">{fmt(offenSumme)}</div>
          <div className="text-xs text-slate-400">Offen</div>
        </div>
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Bearbeiten' : 'Neuer Eintrag'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bewohner Name *</label>
              <input value={form.bewohner_name} onChange={e => setForm(p => ({ ...p, bewohner_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Zimmer</label>
              <input value={form.zimmer || ''} onChange={e => setForm(p => ({ ...p, zimmer: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Pflegegrad</label>
              <select value={form.pflegegrad} onChange={e => setForm(p => ({ ...p, pflegegrad: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {PFLEGEGRADE.map(pg => <option key={pg} value={pg}>{pg}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-600 mb-2">Kostenanteile (Soll)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <N label="Pflegekasse" field="anteil_pflegekasse" />
            <N label="Sozialamt gesamt" field="anteil_sozialamt" />
            <N label="Bewohner" field="anteil_bewohner" />
            <N label="Betrag gesamt" field="betrag_gesamt" />
          </div>

          <p className="text-xs font-medium text-slate-600 mb-2">Sozialamt Aufschlüsselung</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <N label="Wohngeld" field="sozialamt_wohngeld" />
            <N label="Pflegewohngeld" field="sozialamt_pflegewohngeld" />
            <N label="Übergel. Rente" field="sozialamt_uebergeleitet_rente" />
            <N label="Sozialhilfe" field="sozialamt_sozialhilfe" />
          </div>

          <p className="text-xs font-medium text-slate-600 mb-2">Eingegangene Zahlungen (Ist)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <N label="Pflegekasse bez." field="bezahlt_pflegekasse" />
            <N label="Sozialamt bez." field="bezahlt_sozialamt" />
            <N label="Bewohner bez." field="bezahlt_bewohner" />
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Zahlungsdatum</label>
              <input type="date" value={form.zahlungsdatum || ''} onChange={e => setForm(p => ({ ...p, zahlungsdatum: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-slate-500 mb-1 block">Bemerkung</label>
            <textarea value={form.bemerkung || ''} onChange={e => setForm(p => ({ ...p, bemerkung: e.target.value }))}
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

      {/* Tabelle */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Bewohner</th>
                <th className="px-4 py-3 font-medium text-slate-600">PG</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Pflegekasse</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Sozialamt</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Bewohner</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Gesamt</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Bezahlt</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(item => {
                const sc = STATUS_CFG[item.status] || STATUS_CFG.offen;
                const Icon = sc.icon;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.bewohner_name}{item.zimmer ? <span className="text-xs text-slate-400 ml-1">Zim. {item.zimmer}</span> : ''}</td>
                    <td className="px-4 py-3 text-slate-500">{item.pflegegrad || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(item.anteil_pflegekasse)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(item.anteil_sozialamt)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(item.anteil_bewohner)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(item.betrag_gesamt)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(item.betrag_bezahlt)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${sc.color}`}>
                        <Icon className="w-3 h-3" />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-1 justify-end">
                      <button onClick={() => { setForm({ ...item }); setEditing(item.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => del(item.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">Keine Einträge für diesen Monat</div>
          )}
        </div>
      )}
    </div>
  );
}