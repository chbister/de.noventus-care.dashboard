import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Save, X, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatEUR, formatDateDE } from '@/lib/sachkostenUtils';

const KAT_EMPTY = { name: '', beschreibung: '', aktiv: true, standard_sachkonto: '', toleranz_prozent: 5, sortierung: 0 };
const BW_EMPTY = { kategorie_id: '', wohnbereich_id: '', betrag_je_belegungstag: '', gueltig_ab: '', gueltig_bis: '', bemerkung: '' };
const ZUO_EMPTY = { sachkonto_von: '', sachkonto_bis: '', sachkonto_exakt: '', kategorie_id: '', aktiv: true };

export default function BudgetwerteVerwalten() {
  const { selectedEinrichtung } = useEinrichtung();
  const [tab, setTab] = useState('kategorien');
  const [kategorien, setKategorien] = useState([]);
  const [budgetwerte, setBudgetwerte] = useState([]);
  const [zuordnungen, setZuordnungen] = useState([]);
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [loading, setLoading] = useState(true);

  const [katForm, setKatForm] = useState(KAT_EMPTY);
  const [katEdit, setKatEdit] = useState(null);
  const [bwForm, setBwForm] = useState(BW_EMPTY);
  const [bwEdit, setBwEdit] = useState(null);
  const [zuoForm, setZuoForm] = useState(ZUO_EMPTY);
  const [zuoEdit, setZuoEdit] = useState(null);

  const load = async () => {
    if (!selectedEinrichtung) { setLoading(false); return; }
    setLoading(true);
    const eId = selectedEinrichtung.id;
    const [kats, bws, zuos, wbs] = await Promise.all([
      base44.entities.SachkostenKategorien.list('sortierung'),
      base44.entities.SachkostenBudgetwerte.filter({ einrichtung_id: eId }),
      base44.entities.SachkontoZuordnungen.filter({ aktiv: true }),
      base44.entities.Wohnbereich.filter({ einrichtung_id: eId }),
    ]);
    setKategorien(kats); setBudgetwerte(bws); setZuordnungen(zuos); setWohnbereiche(wbs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  // --- Kategorien CRUD ---
  const saveKat = async () => {
    if (!katForm.name) return;
    if (katEdit) await base44.entities.SachkostenKategorien.update(katEdit, katForm);
    else await base44.entities.SachkostenKategorien.create(katForm);
    setKatForm(KAT_EMPTY); setKatEdit(null); load();
  };
  const editKat = (k) => { setKatForm({ ...k }); setKatEdit(k.id); };
  const delKat = async (id) => { if (!confirm('Kategorie löschen?')) return; await base44.entities.SachkostenKategorien.delete(id); load(); };

  // --- Budgetwerte CRUD ---
  const saveBw = async () => {
    if (!bwForm.kategorie_id || !bwForm.gueltig_ab) return;
    const data = { ...bwForm, einrichtung_id: selectedEinrichtung.id, betrag_je_belegungstag: parseFloat(bwForm.betrag_je_belegungstag) || 0, wohnbereich_id: bwForm.wohnbereich_id || '' };
    if (bwEdit) await base44.entities.SachkostenBudgetwerte.update(bwEdit, data);
    else await base44.entities.SachkostenBudgetwerte.create(data);
    setBwForm(BW_EMPTY); setBwEdit(null); load();
  };
  const editBw = (b) => { setBwForm({ ...b, betrag_je_belegungstag: String(b.betrag_je_belegungstag ?? ''), wohnbereich_id: b.wohnbereich_id || '' }); setBwEdit(b.id); };
  const delBw = async (id) => { if (!confirm('Budgetwert löschen?')) return; await base44.entities.SachkostenBudgetwerte.delete(id); load(); };

  // --- Zuordnungen CRUD ---
  const saveZuo = async () => {
    if (!zuoForm.kategorie_id) return;
    if (zuoEdit) await base44.entities.SachkontoZuordnungen.update(zuoEdit, zuoForm);
    else await base44.entities.SachkontoZuordnungen.create(zuoForm);
    setZuoForm(ZUO_EMPTY); setZuoEdit(null); load();
  };
  const editZuo = (z) => { setZuoForm({ ...z }); setZuoEdit(z.id); };
  const delZuo = async (id) => { if (!confirm('Zuordnung löschen?')) return; await base44.entities.SachkontoZuordnungen.delete(id); load(); };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>;

  const katName = (id) => kategorien.find(k => k.id === id)?.name || '—';
  const wbName = (id) => wohnbereiche.find(w => w.id === id)?.name || 'Alle';

  const TABS = [
    ['kategorien', 'Kategorien'],
    ['budgetwerte', 'Budgetwerte'],
    ['zuordnungen', 'Sachkonto-Zuordnungen'],
  ];

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm";
  const labelCls = "text-xs text-slate-500 mb-1 block";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/sachkosten-dashboard" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budgetwerte verwalten</h1>
          <p className="text-xs text-slate-500">{selectedEinrichtung?.name || 'Keine Einrichtung'}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === key ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Kategorien Tab */}
      {tab === 'kategorien' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">{katEdit ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div><label className={labelCls}>Name *</label><input value={katForm.name} onChange={e => setKatForm(p => ({ ...p, name: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Standard-Sachkonto</label><input value={katForm.standard_sachkonto || ''} onChange={e => setKatForm(p => ({ ...p, standard_sachkonto: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Toleranz (%)</label><input type="number" value={katForm.toleranz_prozent ?? ''} onChange={e => setKatForm(p => ({ ...p, toleranz_prozent: parseFloat(e.target.value) || 0 }))} className={inputCls} /></div>
              <div><label className={labelCls}>Sortierung</label><input type="number" value={katForm.sortierung ?? ''} onChange={e => setKatForm(p => ({ ...p, sortierung: parseInt(e.target.value) || 0 }))} className={inputCls} /></div>
              <div><label className={labelCls}>Beschreibung</label><input value={katForm.beschreibung || ''} onChange={e => setKatForm(p => ({ ...p, beschreibung: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Aktiv</label><label className="flex items-center gap-2 mt-1.5"><input type="checkbox" checked={katForm.aktiv} onChange={e => setKatForm(p => ({ ...p, aktiv: e.target.checked }))} className="accent-teal-600" /><span className="text-sm text-slate-600">Ja</span></label></div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveKat} className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"><Save className="w-4 h-4" /> Speichern</button>
              {katEdit && <button onClick={() => { setKatForm(KAT_EMPTY); setKatEdit(null); }} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><X className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Name</th>
                <th className="px-4 py-2 font-medium text-slate-600">Sachkonto</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Toleranz</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Sort.</th>
                <th className="px-4 py-2 font-medium text-slate-600">Aktiv</th>
                <th className="px-4 py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {kategorien.map(k => (
                  <tr key={k.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-medium text-slate-800">{k.name}<span className="text-xs text-slate-400 block">{k.beschreibung}</span></td>
                    <td className="px-4 py-2 text-slate-600 font-mono">{k.standard_sachkonto || '—'}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{k.toleranz_prozent}%</td>
                    <td className="px-4 py-2 text-right text-slate-600">{k.sortierung}</td>
                    <td className="px-4 py-2">{k.aktiv ? <span className="text-green-600">✓</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-2 flex gap-1">
                      <button onClick={() => editKat(k)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => delKat(k.id)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budgetwerte Tab */}
      {tab === 'budgetwerte' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">{bwEdit ? 'Budgetwert bearbeiten' : 'Neuer Budgetwert'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div><label className={labelCls}>Kategorie *</label>
                <select value={bwForm.kategorie_id} onChange={e => setBwForm(p => ({ ...p, kategorie_id: e.target.value }))} className={inputCls}>
                  <option value="">— Auswählen —</option>
                  {kategorien.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Wohnbereich (optional)</label>
                <select value={bwForm.wohnbereich_id} onChange={e => setBwForm(p => ({ ...p, wohnbereich_id: e.target.value }))} className={inputCls}>
                  <option value="">Gesamte Einrichtung</option>
                  {wohnbereiche.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Betrag je Belegungstag (€)</label><input type="number" step="0.01" value={bwForm.betrag_je_belegungstag} onChange={e => setBwForm(p => ({ ...p, betrag_je_belegungstag: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Gültig ab *</label><input type="date" value={bwForm.gueltig_ab} onChange={e => setBwForm(p => ({ ...p, gueltig_ab: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Gültig bis (optional)</label><input type="date" value={bwForm.gueltig_bis || ''} onChange={e => setBwForm(p => ({ ...p, gueltig_bis: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Bemerkung</label><input value={bwForm.bemerkung || ''} onChange={e => setBwForm(p => ({ ...p, bemerkung: e.target.value }))} className={inputCls} /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveBw} className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"><Save className="w-4 h-4" /> Speichern</button>
              {bwEdit && <button onClick={() => { setBwForm(BW_EMPTY); setBwEdit(null); }} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><X className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Kategorie</th>
                <th className="px-4 py-2 font-medium text-slate-600">Wohnbereich</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">€/Beleg.tag</th>
                <th className="px-4 py-2 font-medium text-slate-600">Gültig</th>
                <th className="px-4 py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {budgetwerte.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-medium text-slate-800">{katName(b.kategorie_id)}</td>
                    <td className="px-4 py-2 text-slate-600">{b.wohnbereich_id ? wbName(b.wohnbereich_id) : 'Alle'}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">{formatEUR(b.betrag_je_belegungstag)}</td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{formatDateDE(b.gueltig_ab)} – {b.gueltig_bis ? formatDateDE(b.gueltig_bis) : '∞'}</td>
                    <td className="px-4 py-2 flex gap-1">
                      <button onClick={() => editBw(b)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => delBw(b.id)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Zuordnungen Tab */}
      {tab === 'zuordnungen' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">{zuoEdit ? 'Zuordnung bearbeiten' : 'Neue Sachkonto-Zuordnung'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
              <div><label className={labelCls}>Kategorie *</label>
                <select value={zuoForm.kategorie_id} onChange={e => setZuoForm(p => ({ ...p, kategorie_id: e.target.value }))} className={inputCls}>
                  <option value="">— Auswählen —</option>
                  {kategorien.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Sachkonto von</label><input value={zuoForm.sachkonto_von || ''} onChange={e => setZuoForm(p => ({ ...p, sachkonto_von: e.target.value }))} className={inputCls} placeholder="z.B. 6510000" /></div>
              <div><label className={labelCls}>Sachkonto bis</label><input value={zuoForm.sachkonto_bis || ''} onChange={e => setZuoForm(p => ({ ...p, sachkonto_bis: e.target.value }))} className={inputCls} placeholder="leer = nur 'von'" /></div>
              <div><label className={labelCls}>Exaktes Sachkonto</label><input value={zuoForm.sachkonto_exakt || ''} onChange={e => setZuoForm(p => ({ ...p, sachkonto_exakt: e.target.value }))} className={inputCls} placeholder="Alternative zum Bereich" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveZuo} className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"><Save className="w-4 h-4" /> Speichern</button>
              {zuoEdit && <button onClick={() => { setZuoForm(ZUO_EMPTY); setZuoEdit(null); }} className="border border-slate-200 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"><X className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Kategorie</th>
                <th className="px-4 py-2 font-medium text-slate-600">Sachkonto von</th>
                <th className="px-4 py-2 font-medium text-slate-600">Sachkonto bis</th>
                <th className="px-4 py-2 font-medium text-slate-600">Exakt</th>
                <th className="px-4 py-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {zuordnungen.map(z => (
                  <tr key={z.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-medium text-slate-800">{katName(z.kategorie_id)}</td>
                    <td className="px-4 py-2 text-slate-600 font-mono">{z.sachkonto_von || '—'}</td>
                    <td className="px-4 py-2 text-slate-600 font-mono">{z.sachkonto_bis || '—'}</td>
                    <td className="px-4 py-2 text-slate-600 font-mono">{z.sachkonto_exakt || '—'}</td>
                    <td className="px-4 py-2 flex gap-1">
                      <button onClick={() => editZuo(z)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => delZuo(z.id)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}