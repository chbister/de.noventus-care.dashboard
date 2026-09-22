import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Upload, FileSpreadsheet, TrendingUp } from 'lucide-react';
import MediFoxAbrechnungImport from './MediFoxAbrechnungImport';

const MONATE_FULL = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function MediFoxAbrechnung() {
  const { selectedEinrichtung } = useEinrichtung();
  const now = new Date();
  const [monat, setMonat] = useState(now.getMonth() + 1);
  const [jahr, setJahr] = useState(now.getFullYear());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const load = () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    base44.entities.MediFoxAbrechnung.filter({ einrichtung_id: selectedEinrichtung.id, monat, jahr })
      .then(d => { setItems(d); setLoading(false); });
  };

  useEffect(() => { load(); }, [selectedEinrichtung, monat, jahr]);

  // Nach Leistungsgruppe gruppieren
  const grouped = {};
  items.forEach(item => {
    const lg = item.leistungsgruppe || 'Ohne Angabe';
    if (!grouped[lg]) grouped[lg] = [];
    grouped[lg].push(item);
  });

  const gesamtBetrag = items.reduce((s, i) => s + (i.abger_betrag || 0), 0);
  const jahre = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={monat} onChange={e => setMonat(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          {MONATE_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={jahr} onChange={e => setJahr(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
          {jahre.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowImport(v => !v)}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Upload className="w-4 h-4" /> MediFox Import
        </button>
      </div>

      {showImport && (
        <MediFoxAbrechnungImport
          einrichtungId={selectedEinrichtung?.id}
          onClose={() => setShowImport(false)}
          onSuccess={() => { load(); setShowImport(false); }}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            <p className="text-xs text-slate-400">Gesamt abgerechnet</p>
          </div>
          <p className="text-2xl font-bold">{fmt(gesamtBetrag)}</p>
          <p className="text-xs text-slate-500 mt-1">{MONATE_FULL[monat - 1]} {jahr}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-400 mb-1">Leistungspositionen</p>
          <p className="text-2xl font-bold text-slate-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-400 mb-1">Leistungsgruppen</p>
          <p className="text-2xl font-bold text-slate-900">{Object.keys(grouped).length}</p>
        </div>
      </div>

      {/* Tabelle nach Leistungsgruppe */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p>Keine MediFox-Daten für {MONATE_FULL[monat - 1]} {jahr}</p>
          <p className="text-xs mt-1">Importieren Sie die Excel-Datei "Abgerechnete Leistungen nach Monat" aus MediFox</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([lg, lgItems]) => {
            const lgSum = lgItems.reduce((s, i) => s + (i.abger_betrag || 0), 0);
            return (
              <div key={lg} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex justify-between items-center">
                  <span className="font-semibold text-slate-800 text-sm">{lg}</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(lgSum)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 text-xs border-b border-slate-50">
                      <th className="px-4 py-2 font-medium">Kürzel</th>
                      <th className="px-4 py-2 font-medium">Bezeichnung</th>
                      <th className="px-4 py-2 font-medium text-right">Einzelpreis</th>
                      <th className="px-4 py-2 font-medium text-right">Anzahl</th>
                      <th className="px-4 py-2 font-medium text-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lgItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{item.abkuerzung}</td>
                        <td className="px-4 py-2.5 text-slate-600">{item.bezeichnung}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmt(item.einzelpreis)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtNum(item.abger_anzahl)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(item.abger_betrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}