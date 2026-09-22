import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Plus, Save, X, CreditCard, Edit, Trash2, Upload, Archive, ArchiveRestore } from 'lucide-react';
import Verguetung from './Verguetung';
import MediFoxAbrechnung from '@/components/heimkosten/MediFoxAbrechnung';
import SachkostenDashboard from '@/pages/SachkostenDashboard';
import GehaltsImport from '@/components/heimkosten/GehaltsImport';

const EMPTY = { bereich: 'stationär', kostenart: 'Sonstiges', monat: '', gesamtbetrag: '', belegungstage: '', bemerkung: '' };
const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function HeimkostenTab() {
  const { selectedEinrichtung } = useEinrichtung();
  const [items, setItems] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [medifoxData, setMedifoxData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [viewMode, setViewMode] = useState('aktuell'); // 'aktuell' | 'alle'
  const [showGehaltsImport, setShowGehaltsImport] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const fileRef = useRef();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    Promise.all([
      base44.entities.Heimkosten.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Mitarbeiter.filter({ einrichtung_id: selectedEinrichtung.id, aktiv: true }),
      base44.entities.MediFoxAbrechnung.filter({ einrichtung_id: selectedEinrichtung.id, monat: currentMonth, jahr: currentYear }),
    ]).then(([hk, ma, mf]) => {
      setItems(hk.sort((a, b) => b.monat?.localeCompare(a.monat)));
      setMitarbeiter(ma);
      setMedifoxData(mf);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  const save = async () => {
    const data = {
      ...form,
      monat: form.monat ? form.monat + '-01' : null,
      gesamtbetrag: parseFloat(form.gesamtbetrag) || 0,
      belegungstage: parseInt(form.belegungstage) || 0,
      einrichtung_id: selectedEinrichtung.id,
    };
    if (editing) await base44.entities.Heimkosten.update(editing, data);
    else await base44.entities.Heimkosten.create(data);
    setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  const del = async (id) => {
    if (!confirm('Eintrag löschen?')) return;
    await base44.entities.Heimkosten.delete(id); load();
  };

  const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const fmtMonat = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${MONATE[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Enter-Taste springt ins nächste Feld
  const handleEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const formEl = e.target.closest('form') || e.target.closest('.grid');
    if (!formEl) return;
    const focusables = Array.from(formEl.querySelectorAll('input, select, textarea, button'));
    const idx = focusables.indexOf(e.target);
    if (idx >= 0 && idx + 1 < focusables.length) {
      focusables[idx + 1].focus();
    }
  };

  // Personalkosten berechnen
  const monatsgehaelter = mitarbeiter.reduce((s, m) => s + (m.monatsgehalt_brutto || 0) + (m.funktionszulagen || 0), 0);
  const gesamtbrutto = monatsgehaelter;
  const agAnteilIst = mitarbeiter.reduce((s, m) => s + (m.sv_ag_anteil || 0), 0);
  const agAnteil = agAnteilIst > 0 ? agAnteilIst : monatsgehaelter * 0.21;
  const personalGesamt = gesamtbrutto + agAnteil;

  // Filterung nach Monat und Archiv-Status
  const displayedItems = (viewMode === 'aktuell'
    ? items.filter(i => {
        if (!i.monat) return false;
        const d = new Date(i.monat);
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
      })
    : items).filter(i => showArchived ? i.archiviert === true : !i.archiviert);

  const toggleArchive = async (id, current) => {
    await base44.entities.Heimkosten.update(id, { archiviert: !current });
    load();
  };

  const total = displayedItems.reduce((s, i) => s + (i.gesamtbetrag || 0), 0);

  return (
    <div>
      {showGehaltsImport && (
        <GehaltsImport
          einrichtungId={selectedEinrichtung?.id}
          onClose={() => setShowGehaltsImport(false)}
          onSuccess={() => { setShowGehaltsImport(false); load(); }}
        />
      )}
      {/* Einnahmen vs. Ausgaben */}
      {(() => {
        const einnahmen = medifoxData.reduce((s, i) => s + (i.abger_betrag || 0), 0);
        const sachkosten = items
          .filter(i => {
            if (!i.monat) return false;
            const d = new Date(i.monat);
            return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear && !i.archiviert;
          })
          .reduce((s, i) => s + (i.gesamtbetrag || 0), 0);
        const ergebnis = einnahmen - personalGesamt - sachkosten;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-teal-600 rounded-2xl p-5 text-white">
              <p className="text-xs text-teal-100 mb-1">Einnahmen (MediFox)</p>
              <p className="text-2xl font-bold">{fmt(einnahmen)}</p>
              <p className="text-xs text-teal-200 mt-1">{MONATE[currentMonth - 1]} {currentYear} · {medifoxData.length} Pos.</p>
            </div>
            <div className="bg-slate-900 rounded-2xl p-5 text-white">
              <p className="text-xs text-slate-400 mb-1">Personalkosten</p>
              <p className="text-2xl font-bold">{fmt(personalGesamt)}</p>
              <p className="text-xs text-slate-500 mt-1">{mitarbeiter.length} aktive Mitarbeiter</p>
            </div>
            <div className="bg-slate-700 rounded-2xl p-5 text-white">
              <p className="text-xs text-slate-300 mb-1">Sachkosten</p>
              <p className="text-2xl font-bold">{fmt(sachkosten)}</p>
              <p className="text-xs text-slate-400 mt-1">Wäsche · Lebensmitteleinkauf · Pflegebedarf · Sonstiges</p>
            </div>
            <div className={`rounded-2xl p-5 text-white ${ergebnis >= 0 ? 'bg-green-600' : 'bg-red-600'}`}>
              <p className={`text-xs mb-1 ${ergebnis >= 0 ? 'text-green-100' : 'text-red-100'}`}>{ergebnis >= 0 ? 'Tatsächl. Überschuss' : 'Defizit'}</p>
              <p className="text-2xl font-bold">{ergebnis >= 0 ? '+' : ''}{fmt(ergebnis)}</p>
              <p className={`text-xs mt-1 ${ergebnis >= 0 ? 'text-green-200' : 'text-red-200'}`}>Einnahmen − Personal − Sachkosten</p>
            </div>
          </div>
        );
      })()}

      {/* Personalkosten-Box */}
      <div className="bg-slate-900 rounded-2xl p-6 mb-6 text-white">
        <p className="font-bold text-white mb-3">Personalkosten</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm text-slate-300">
            <span>Lohnart Gesamtbrutto:</span>
            <span>{fmt(gesamtbrutto)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>Arbeitgeberanteil {agAnteilIst > 0 ? '(IST)' : '(Pauschal 21%)'}:</span>
            <span>{fmt(agAnteil)}</span>
          </div>
          <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-slate-700 mt-2">
            <span>Gesamt:</span>
            <span>{fmt(personalGesamt)}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* View Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setViewMode('aktuell')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'aktuell' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Aktueller Monat
          </button>
          <button
            onClick={() => setViewMode('alle')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'alle' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Alle Monate
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowArchived(p => !p)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${showArchived ? 'bg-amber-600 text-white hover:bg-amber-700' : 'border border-amber-200 bg-white text-amber-700 hover:bg-amber-50'}`}
        >
          {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          {showArchived ? 'Aktive anzeigen' : 'Archiv'}
        </button>

        <button
          onClick={() => setShowGehaltsImport(true)}
          className="flex items-center gap-2 border border-teal-200 bg-teal-50 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-100 text-sm font-medium"
        >
          <Upload className="w-4 h-4" /> Gehaltsimport
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700"
        >
          <Upload className="w-4 h-4" /> Excel Import
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" />

        <button
          onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Eintrag hinzufügen
        </button>
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">{editing ? 'Bearbeiten' : 'Neuer Eintrag'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bereich</label>
              <select value={form.bereich} onChange={e => setForm(p => ({ ...p, bereich: e.target.value }))} onKeyDown={handleEnter}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="stationär">Stationär</option>
                <option value="tagespflege">Tagespflege</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Kostenart</label>
              <select value={form.kostenart || 'Sonstiges'} onChange={e => setForm(p => ({ ...p, kostenart: e.target.value }))} onKeyDown={handleEnter}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option>Wäsche</option>
                <option>Lebensmitteleinkauf</option>
                <option>Pflegebedarf</option>
                <option>Sonstiges</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Monat *</label>
              <input type="month" value={form.monat || ''} onChange={e => setForm(p => ({ ...p, monat: e.target.value }))} onKeyDown={handleEnter}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Gesamtbetrag (EUR)</label>
              <input type="number" step="0.01" value={form.gesamtbetrag ?? ''} onChange={e => setForm(p => ({ ...p, gesamtbetrag: e.target.value }))} onKeyDown={handleEnter}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Belegungstage</label>
              <input type="number" value={form.belegungstage ?? ''} onChange={e => setForm(p => ({ ...p, belegungstage: e.target.value }))} onKeyDown={handleEnter}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="z.B. 680" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bemerkung</label>
              <input value={form.bemerkung || ''} onChange={e => setForm(p => ({ ...p, bemerkung: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Monat</th>
                <th className="px-4 py-3 font-medium text-slate-600">Bereich</th>
                <th className="px-4 py-3 font-medium text-slate-600">Kostenart</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Betrag</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right hidden sm:table-cell">€/Beleg.tag</th>
                <th className="px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Bemerkung</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayedItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{fmtMonat(item.monat)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.bereich === 'stationär' ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-orange-700'}`}>
                      {item.bereich}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{item.kostenart || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(item.gesamtbetrag)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">
                    {item.belegungstage > 0 ? `${(item.gesamtbetrag / item.belegungstage).toFixed(2)} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{item.bemerkung || '—'}</td>
                  <td className="px-4 py-3 flex gap-1 justify-end">
                    <button onClick={() => { setForm({ ...item, monat: item.monat ? item.monat.substring(0, 7) : '' }); setEditing(item.id); setShowForm(true); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => del(item.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => toggleArchive(item.id, item.archiviert)} title={item.archiviert ? 'Wiederherstellen' : 'Archivieren'}
                      className={`p-1.5 hover:bg-slate-100 rounded ${item.archiviert ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-amber-500'}`}>
                      {item.archiviert ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayedItems.length === 0 && (
            <div className="px-6 py-16 text-center text-slate-400">
              <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p>Noch keine Einträge vorhanden.</p>
            </div>
          )}
          {displayedItems.length > 0 && (
            <>
              {/* Summen je Kostenart – nur im "Alle Monate"-Modus sinnvoll */}
              {viewMode === 'alle' && (() => {
                const KARTEN = ['Wäsche','Lebensmitteleinkauf','Pflegebedarf','Sonstiges'];
                return (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {KARTEN.map(ka => {
                      const kaItems = displayedItems.filter(i => i.kostenart === ka);
                      const kaGesamt = kaItems.reduce((s, i) => s + (i.gesamtbetrag || 0), 0);
                      const kaTage = kaItems.reduce((s, i) => s + (i.belegungstage || 0), 0);
                      return (
                        <div key={ka} className="text-xs">
                          <span className="text-slate-500 font-medium">{ka}</span>
                          <div className="font-semibold text-slate-800">{fmt(kaGesamt)}</div>
                          {kaTage > 0 && <div className="text-slate-400">{(kaGesamt/kaTage).toFixed(2)} €/Tag</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-100 flex justify-between text-sm font-semibold text-slate-700">
                <span>Gesamt</span>
                <span>{fmt(total)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: 'heimkosten', label: 'Mitarbeiterkosten /Heimkosten' },
  { key: 'benchmark', label: '📊 Sachkosten-Benchmark' },
  { key: 'verguetung', label: 'Vergütungsvereinbarung' },
  { key: 'bewohner', label: 'Heimkosten pro Monat' },
];

export default function Heimkosten() {
  const [activeTab, setActiveTab] = useState('heimkosten');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'heimkosten' && <HeimkostenTab />}
      {activeTab === 'benchmark' && <SachkostenDashboard />}
      {activeTab === 'verguetung' && <Verguetung embedded />}
      {activeTab === 'bewohner' && <MediFoxAbrechnung />}
    </div>
  );
}