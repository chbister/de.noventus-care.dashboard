import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { History, Plus, Edit, Trash2, Filter, ChevronDown, ChevronUp, Download } from 'lucide-react';

const ACTION_CONFIG = {
  create: { label: 'Neu', icon: Plus, color: 'text-teal-600 bg-teal-50' },
  update: { label: 'Geändert', icon: Edit, color: 'text-amber-600 bg-amber-50' },
  delete: { label: 'Gelöscht', icon: Trash2, color: 'text-red-600 bg-red-50' },
};

const ENTITY_LABELS = {
  Mitarbeiter: 'Mitarbeiter',
  Wohnbereich: 'Wohnbereich',
  Heimkosten: 'Heimkosten',
  Tagespflege: 'Tagespflege',
  Einrichtung: 'Einrichtung',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Aenderungsprotokoll() {
  const { einrichtungen } = useEinrichtung();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('alle');
  const [filterEinrichtung, setFilterEinrichtung] = useState('alle');
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const all = await base44.entities.Aenderungsprotokoll.list('-created_date', 500);
    setEntries(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke('exportAenderungsprotokoll', {});
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      a.download = match ? match[1] : 'Aenderungsprotokoll.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export fehlgeschlagen:', err);
    } finally {
      setExporting(false);
    }
  };

  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const filtered = entries.filter(e => {
    const entryDate = new Date(e.created_date).getTime();
    const inLast14Days = entryDate >= fourteenDaysAgo;
    const matchEntity = filterEntity === 'alle' || e.entity_type === filterEntity;
    const matchEinr = filterEinrichtung === 'alle' || e.einrichtung_id === filterEinrichtung;
    return inLast14Days && matchEntity && matchEinr;
  });

  // Group by day
  const grouped = {};
  filtered.forEach(e => {
    const day = new Date(e.created_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  });

  const entityTypes = ['Mitarbeiter', 'Wohnbereich', 'Heimkosten', 'Tagespflege', 'Einrichtung'];

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-violet-100 rounded-lg">
          <History className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900">Änderungsprotokoll (letzte 14 Tage)</h2>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} Änderungen erfasst</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || loading || filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-all shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exportiert...' : 'Excel-Export'}
        </button>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600">
          <option value="alle">Alle Bereiche</option>
          {entityTypes.map(t => <option key={t} value={t}>{ENTITY_LABELS[t] || t}</option>)}
        </select>
        <select value={filterEinrichtung} onChange={e => setFilterEinrichtung(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600">
          <option value="alle">Alle Einrichtungen</option>
          {einrichtungen.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-400">
          <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Keine Änderungen in den letzten 14 Tagen</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <div className="sticky top-0 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider z-10">
                {day} · {items.length} {items.length === 1 ? 'Änderung' : 'Änderungen'}
              </div>
              {items.map((entry, i) => {
                const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.update;
                const Icon = cfg.icon;
                const isExpanded = expanded === entry.id;
                const fields = entry.changed_fields ? entry.changed_fields.split(', ').filter(Boolean) : [];
                return (
                  <div key={entry.id || i} className="px-5 py-3 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{ENTITY_LABELS[entry.entity_type] || entry.entity_type}</span>
                          {entry.entity_name_snapshot && (
                            <span className="text-sm text-slate-500">— {entry.entity_name_snapshot}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{formatDate(entry.created_date)}</span>
                          <span>·</span>
                          <span>{cfg.label}</span>
                          {entry.changed_by && (
                            <>
                              <span>·</span>
                              <span>von {entry.changed_by}</span>
                            </>
                          )}
                          {fields.length > 0 && fields[0] !== 'Neu angelegt' && fields[0] !== 'Gelöscht' && (
                            <>
                              <span>·</span>
                              <button onClick={() => setExpanded(isExpanded ? null : entry.id)}
                                className="text-teal-600 hover:underline flex items-center gap-0.5">
                                {fields.length} Felder {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded && fields.length > 0 && (
                      <div className="mt-2 ml-10 flex flex-wrap gap-1">
                        {fields.map(f => (
                          <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}