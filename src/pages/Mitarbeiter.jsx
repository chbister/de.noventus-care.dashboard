import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Edit, Trash2, Users, Save, X, Search, Upload, Trash, Archive, ArchiveRestore, CalendarDays, Download } from 'lucide-react';
import MitarbeiterImport from '@/components/mitarbeiter/MitarbeiterImport';
import MitarbeiterFehlzeiten from '@/components/mitarbeiter/MitarbeiterFehlzeiten';
import { maskName } from '@/lib/nameMask';

const PFK_KEYWORDS = ['pflegefachkraft', 'fachkraft', 'gesundheits- und krankenpfleger', 'gesundheits- und krankenpflegerin', 'examinierte', 'altenpfleger', 'altenpflegerin', 'pflegefachmann', 'pflegefachfrau', 'krankenpfleger', 'krankenpflegerin', 'exami', 'pflegedienstleitung', 'pdl', 'stationsleitung', 'wohnbereichsleitung', 'wbl'];
const PHK_MIT_KEYWORDS = ['altenpflegehelfer', 'altenpflegehelferin', 'pflegehelfer', 'pflegehelferin', 'gesundheits- und krankenpflegehelfer', 'pflegeassistent'];
const PHK_OHNE_KEYWORDS = ['pflegehilfskraft', 'betreuungskraft', '43b', 'alltagsbegleiter', 'hauswirtschaft', 'reinigung', 'küche', 'koch'];

function classifyBeruf(beruf) {
  const b = beruf.toLowerCase().trim();
  if (!b) return null;
  if (PFK_KEYWORDS.some(k => b.includes(k))) return 'pfk';
  if (PHK_MIT_KEYWORDS.some(k => b.includes(k))) return 'phk_mit';
  if (PHK_OHNE_KEYWORDS.some(k => b.includes(k))) return 'phk_ohne';
  return null;
}

function autoFillVK(beruf, wochenstunden, monatsstunden_gfb) {
  const gfb = Number(monatsstunden_gfb) || 0;
  const vk = gfb > 0
    ? Math.round((gfb / 173.33) * 100) / 100
    : (Number(wochenstunden) > 0 ? Math.round((Number(wochenstunden) / 40) * 100) / 100 : 0);
  const typ = classifyBeruf(beruf);
  if (typ === 'pfk') return { vk_pfk: vk, vk_phk_mit_ausbildung: 0, vk_phk_ohne_ausbildung: 0, vk_anteil: vk };
  if (typ === 'phk_mit') return { vk_pfk: 0, vk_phk_mit_ausbildung: vk, vk_phk_ohne_ausbildung: 0, vk_anteil: vk };
  if (typ === 'phk_ohne') return { vk_pfk: 0, vk_phk_mit_ausbildung: 0, vk_phk_ohne_ausbildung: vk, vk_anteil: vk };
  return { vk_pfk: 0, vk_phk_mit_ausbildung: 0, vk_phk_ohne_ausbildung: 0, vk_anteil: vk };
}

function getMitarbeiterTyp(m) {
  if ((m.vk_pfk || 0) > 0) return 'pfk';
  if ((m.vk_phk_mit_ausbildung || 0) > 0) return 'phk_mit';
  if ((m.vk_phk_ohne_ausbildung || 0) > 0) return 'phk_ohne';
  const typ = classifyBeruf(m.berufsbezeichnung || '');
  return typ || 'other';
}

const KATEGORIEN = [
  { value: 'pflege', label: 'Pflege' },
  { value: 'nachtwache', label: 'Nachtwache' },
  { value: 'pflegedienstleitung', label: 'Pflegedienstleitung' },
  { value: 'leitung', label: 'Leitung' },
  { value: 'betreuung_43b', label: 'Betreuung §43b' },
  { value: 'gfb', label: 'GfB' },
  { value: 'sonstiges', label: 'Sonstiges' },
  { value: 'kueche_reinigung', label: 'Küche/Reinigung' },
  { value: 'verwaltung', label: 'Verwaltung' },
  { value: 'azubi', label: 'Azubi' },
];

const EMPTY = {
  name: '', personalnummer: '', kategorie: 'pflege', berufsbezeichnung: '', tarifgruppe: '', tarifstufe: '', wochenstunden: 0,
  vk_pfk: 0, vk_phk_mit_ausbildung: 0, vk_phk_ohne_ausbildung: 0,
  zuschlaege_steuerfrei: 0,
  monatsgehalt_vertrag: 0, monatsgehalt_brutto: 0, funktionszulagen: 0, sv_ag_anteil: 0, funktion: '',
  eintrittsdatum: '', befristet_bis: '', bemerkung: '', aktiv: true,
  wohnbereich_id: '', verteilt_auf_alle: false, monatsstunden_gfb: 0
};

export default function Mitarbeiter() {
  const { selectedEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [wohnbereiche, setWohnbereiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [filterKat, setFilterKat] = useState('alle');
  const [filterFunktion, setFilterFunktion] = useState('alle');
  const [filterAktiv, setFilterAktiv] = useState('aktiv');
  const [showImport, setShowImport] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [importMode, setImportMode] = useState('datev');
  const [activeTab, setActiveTab] = useState('mitarbeiter');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => { base44.auth.me().then(u => setCurrentUser(u)).catch(() => {}); }, []);
  const isAdmin = currentUser?.role === 'admin';

  const load = async () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    try {
      const [ma, wb] = await Promise.all([
        base44.entities.Mitarbeiter.filter({ einrichtung_id: selectedEinrichtung.id }),
        base44.entities.Wohnbereich.filter({ einrichtung_id: selectedEinrichtung.id }),
      ]);

      // Automatische Deaktivierung: Mitarbeiter mit abgelaufenem "Beschäft. bis"-Datum
      const today = new Date().toISOString().split('T')[0];
      const expired = ma.filter(m => m.aktiv && m.befristet_bis && m.befristet_bis < today);
      if (expired.length > 0) {
        await base44.entities.Mitarbeiter.bulkUpdate(
          expired.map(m => ({ id: m.id, aktiv: false }))
        );
        expired.forEach(m => { m.aktiv = false; });
      }

      setItems(ma); setWohnbereiche(wb);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  const save = async () => {
    const brutto = Number(form.monatsgehalt_brutto) || 0;
    const data = { ...form, einrichtung_id: selectedEinrichtung.id, sv_ag_anteil: Math.round(brutto * 0.2 * 100) / 100 };
    if (editing) await base44.entities.Mitarbeiter.update(editing, data);
    else await base44.entities.Mitarbeiter.create(data);
    setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const del = async (id) => {
    if (!confirm('Mitarbeiter löschen?')) return;
    await base44.entities.Mitarbeiter.delete(id); load();
  };

  const delAll = async () => {
    if (items.length === 0) return;
    if (!confirm(`Wirklich alle ${items.length} Mitarbeiter löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    await base44.entities.Mitarbeiter.deleteMany({ einrichtung_id: selectedEinrichtung.id });
    load();
  };

  const filtered = items.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const matchKat = filterKat === 'alle' || m.kategorie === filterKat;
    const matchArchiv = showArchived ? m.archiviert === true : !m.archiviert;
    const matchFunktion = filterFunktion === 'alle' || getMitarbeiterTyp(m) === filterFunktion;
    const matchAktiv = filterAktiv === 'alle' || (filterAktiv === 'aktiv' ? m.aktiv : !m.aktiv);
    return matchSearch && matchKat && matchArchiv && matchFunktion && matchAktiv;
  });

  const filteredVK = filtered.filter(m => m.aktiv && !m.archiviert).reduce((s, m) => {
    const vkSum = (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0);
    return s + (vkSum > 0 ? vkSum : (m.vk_anteil||0));
  }, 0);
  const isFiltered = !!search || filterKat !== 'alle' || filterFunktion !== 'alle' || filterAktiv !== 'aktiv';

  const toggleArchive = async (id, current) => {
    await base44.entities.Mitarbeiter.update(id, { archiviert: !current });
    load();
  };

  const gesamtVK = items.filter(m => m.aktiv && !m.archiviert).reduce((s, m) => s + (m.vk_pfk || 0) + (m.vk_phk_mit_ausbildung || 0) + (m.vk_phk_ohne_ausbildung || 0), 0);

  const exportExcel = () => {
    const headers = ['Name', 'Personalnummer', 'Kategorie', 'Berufsbezeichnung', 'Funktion', 'Wohnbereich', 'Tarifgruppe', 'Tarifstufe', 'Wochenstunden', 'VK Anteil', 'VK PFK', 'VK PHK m.A.', 'VK PHK o.A.', 'GfB', 'Monatsstunden GfB', 'Monatsgehalt Brutto', 'SV-AG-Anteil', 'Funktionszulagen', 'Steuerfreie Zuschläge', 'Eintrittsdatum', 'Beschäft. bis', 'Aktiv', 'Bemerkung'];
    const katLabel = (k) => KATEGORIEN.find(kat => kat.value === k)?.label || k || '';
    const rows = filtered.map(m => {
      const wb = wohnbereiche.find(w => w.id === m.wohnbereich_id);
      return [
        m.name || '', m.personalnummer || '', katLabel(m.kategorie), m.berufsbezeichnung || '', m.funktion || '',
        wb?.name || (m.verteilt_auf_alle ? 'Alle' : ''),
        m.tarifgruppe || '', m.tarifstufe || '', m.wochenstunden || 0, m.vk_anteil || 0,
        m.vk_pfk || 0, m.vk_phk_mit_ausbildung || 0, m.vk_phk_ohne_ausbildung || 0,
        m.ist_gfb ? 'Ja' : 'Nein', m.monatsstunden_gfb || 0, m.monatsgehalt_brutto || 0,
        m.sv_ag_anteil || 0, m.funktionszulagen || 0, m.zuschlaege_steuerfrei || 0,
        m.eintrittsdatum || '', m.befristet_bis || '', m.aktiv ? 'Ja' : 'Nein', m.bemerkung || '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mitarbeiter_${selectedEinrichtung?.name || 'Export'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mitarbeiter</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gesamt VK: {gesamtVK.toFixed(2)}</p>
          {isFiltered && (
            <p className="text-teal-600 text-sm font-medium mt-0.5">Ist VK (gefiltert): {filteredVK.toFixed(2)}</p>
          )}
        </div>
        {activeTab === 'mitarbeiter' && (
          <div className="flex gap-2">
            <button onClick={() => { setImportMode('datev'); setShowImport(true); }}
              className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
              <Upload className="w-4 h-4" /> DATEV Import
            </button>
            <button onClick={() => { setImportMode('medifox'); setShowImport(true); }}
              className="flex items-center gap-2 border border-blue-200 bg-white px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium text-blue-700">
              <Upload className="w-4 h-4" /> MediFox Import
            </button>
            <button onClick={exportExcel} disabled={filtered.length === 0}
              className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Neu
            </button>
            <button onClick={delAll} disabled={items.length === 0}
              className="flex items-center gap-2 border border-red-200 bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash className="w-4 h-4" /> Alle löschen
            </button>
            <button onClick={() => setShowArchived(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${showArchived ? 'bg-amber-600 text-white hover:bg-amber-700' : 'border border-amber-200 bg-white text-amber-700 hover:bg-amber-50'}`}>
              {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {showArchived ? 'Aktive anzeigen' : 'Archiv'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('mitarbeiter')}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mitarbeiter' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          <Users className="w-4 h-4" /> Mitarbeiter
        </button>
        <button onClick={() => setActiveTab('fehlzeiten')}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'fehlzeiten' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          <CalendarDays className="w-4 h-4" /> Fehlzeiten
        </button>
      </div>

      {activeTab === 'mitarbeiter' && (
        <>
          {showImport && (
            <MitarbeiterImport
              einrichtungId={selectedEinrichtung?.id}
              wohnbereiche={wohnbereiche}
              mode={importMode}
              onClose={() => setShowImport(false)}
              onSuccess={() => { setShowImport(false); load(); }}
            />
          )}

          {/* Filter */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..." className="outline-none text-sm flex-1" />
            </div>
            <select value={filterKat} onChange={e => setFilterKat(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
              <option value="alle">Alle Kategorien</option>
              {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <select value={filterFunktion} onChange={e => setFilterFunktion(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
              <option value="alle">Alle Funktionen</option>
              <option value="pfk">Fachkraft (PFK)</option>
              <option value="phk_mit">Helfer m.A. (PHK)</option>
              <option value="phk_ohne">Helfer o.A. (PHK)</option>
            </select>
            <select value={filterAktiv} onChange={e => setFilterAktiv(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
              <option value="aktiv">Nur Aktive</option>
              <option value="inaktiv">Nur Inaktive</option>
              <option value="alle">Alle Status</option>
            </select>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
              <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Name *', field: 'name', type: 'text' },
                  { label: 'Personalnummer', field: 'personalnummer', type: 'text' },
                  { label: 'Berufsbezeichnung', field: 'berufsbezeichnung', type: 'text' },
                  { label: 'Tarifgruppe', field: 'tarifgruppe', type: 'text' },
                  { label: 'Tarifstufe', field: 'tarifstufe', type: 'text' },

                  { label: 'Wochenstunden', field: 'wochenstunden', type: 'number' },
                  { label: 'VK (auto, 40h = 1 VK)', field: 'vk_anteil', type: 'number', readonly: true },

                  { label: 'Monatsgehalt brutto', field: 'monatsgehalt_brutto', type: 'number' },
                  { label: 'SV-AG-Anteil (auto, 20%)', field: 'sv_ag_anteil', type: 'number', readonly: true },
                  { label: 'Funktionszulagen', field: 'funktionszulagen', type: 'number' },
                  { label: 'VK PFK', field: 'vk_pfk', type: 'number', readonly: true },
                  { label: 'VK PHK m.A.', field: 'vk_phk_mit_ausbildung', type: 'number', readonly: true },
                  { label: 'VK PHK o.A.', field: 'vk_phk_ohne_ausbildung', type: 'number', readonly: true },

                  { label: 'Monatsstunden GfB', field: 'monatsstunden_gfb', type: 'number' },
                  { label: 'Eintrittsdatum', field: 'eintrittsdatum', type: 'date' },
                  { label: 'Beschäft. bis', field: 'befristet_bis', type: 'date' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                    <input type={f.type} value={form[f.field] || ''} readOnly={f.readonly}
                      onChange={e => {
                        const val = f.type === 'number' ? Number(e.target.value) : e.target.value;
                        setForm(p => {
                          const updated = { ...p, [f.field]: val };
                          if (f.field === 'wochenstunden') {
                            updated.vk_anteil = Math.round((val / 40) * 100) / 100;
                            const vkFields = autoFillVK(updated.berufsbezeichnung, val, updated.monatsstunden_gfb);
                            updated.vk_pfk = vkFields.vk_pfk;
                            updated.vk_phk_mit_ausbildung = vkFields.vk_phk_mit_ausbildung;
                            updated.vk_phk_ohne_ausbildung = vkFields.vk_phk_ohne_ausbildung;
                          }
                          if (f.field === 'monatsgehalt_brutto') {
                            updated.sv_ag_anteil = Math.round(val * 0.2 * 100) / 100;
                          }
                          if (f.field === 'monatsstunden_gfb') {
                            const vkFields = autoFillVK(updated.berufsbezeichnung, updated.wochenstunden, val);
                            updated.vk_anteil = vkFields.vk_anteil;
                            updated.vk_pfk = vkFields.vk_pfk;
                            updated.vk_phk_mit_ausbildung = vkFields.vk_phk_mit_ausbildung;
                            updated.vk_phk_ohne_ausbildung = vkFields.vk_phk_ohne_ausbildung;
                          }
                          if (f.field === 'berufsbezeichnung') {
                            const vkFields = autoFillVK(val, updated.wochenstunden, updated.monatsstunden_gfb);
                            updated.vk_anteil = vkFields.vk_anteil;
                            updated.vk_pfk = vkFields.vk_pfk;
                            updated.vk_phk_mit_ausbildung = vkFields.vk_phk_mit_ausbildung;
                            updated.vk_phk_ohne_ausbildung = vkFields.vk_phk_ohne_ausbildung;
                          }
                          return updated;
                        });
                      }}
                      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${f.readonly ? 'bg-slate-100 text-slate-500' : ''}`} step={f.type === 'number' ? '0.01' : undefined} />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Funktion</label>
                  <input type="text" value={form.funktion || ''} onChange={e => setForm(p => ({ ...p, funktion: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. Wohnbereichsleitung" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Kategorie</label>
                  <select value={form.kategorie} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Wohnbereich</label>
                  <select value={form.wohnbereich_id || ''} onChange={e => setForm(p => ({ ...p, wohnbereich_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Kein / Alle</option>
                    {wohnbereiche.map(wb => <option key={wb.id} value={wb.id}>{wb.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.aktiv} onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))} />
                  Aktiv
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox"
                    checked={!!form.ist_gfb}
                    onChange={e => setForm(p => ({ ...p, ist_gfb: e.target.checked }))} />
                  GfB (geringfügig beschäftigt)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.verteilt_auf_alle} onChange={e => setForm(p => ({ ...p, verteilt_auf_alle: e.target.checked }))} />
                  Auf alle Wohnbereiche verteilen
                </label>
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

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Kategorie</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Wohnbereich</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Beruf</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Funktion</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">Std/Wo</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">VK</th>
                    <th className="px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">Gehalt</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(m => {
                    const wb = wohnbereiche.find(w => w.id === m.wohnbereich_id);
                    const kat = KATEGORIEN.find(k => k.value === m.kategorie);
                    const vkSum = (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0);
                    const vkGesamt = (vkSum > 0 ? vkSum : (m.vk_anteil||0)).toFixed(2);
                    const fmt = (n) => n ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : '—';
                    const istGfb = m.ist_gfb || (m.monatsstunden_gfb||0) > 0;
                    const keinWohnbereich = !m.wohnbereich_id && !m.verteilt_auf_alle;
                    const keinVK = !istGfb && (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0) === 0;
                    const unzugeordnet = keinWohnbereich || keinVK;
                    return (
                      <tr key={m.id} className={`hover:bg-slate-50/50 ${unzugeordnet ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-800">{maskName(m.name, isAdmin)}</td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{kat?.label}</td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                          {wb?.name || (m.verteilt_auf_alle ? 'Alle' : <span className="text-red-600 font-medium">⚠ Nicht zugeordnet</span>)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{m.berufsbezeichnung || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{m.funktion || (istGfb ? <span className="text-violet-600 font-medium">GfB</span> : '—')}</td>
                        <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">
                          {istGfb
                            ? <span className="text-violet-600 font-medium">{Math.round((m.monatsstunden_gfb || 0) * 4) / 4}h/Mo</span>
                            : m.wochenstunden ? `${Math.round((m.wochenstunden || 0) * 4) / 4}h` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">{vkGesamt}</td>
                        <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">{fmt(m.monatsgehalt_brutto)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.aktiv ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                            {m.aktiv ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="px-4 py-3 flex gap-1 justify-end">
                          <button onClick={() => { setForm({ ...m }); setEditing(m.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => del(m.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                          <button onClick={() => toggleArchive(m.id, m.archiviert)} title={m.archiviert ? 'Wiederherstellen' : 'Archivieren'}
                            className={`p-1.5 hover:bg-slate-100 rounded ${m.archiviert ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-amber-500'}`}>
                            {m.archiviert ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2" /><p>Keine Mitarbeiter gefunden</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'fehlzeiten' && (
        <MitarbeiterFehlzeiten mitarbeiter={items} isAdmin={isAdmin} />
      )}
    </div>
  );
}