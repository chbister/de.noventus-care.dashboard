import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Trash2, AlertTriangle, Database, RefreshCw, Building2, ChevronDown, ChevronUp } from 'lucide-react';

// Entities that support filtering by einrichtung_id
const FACILITY_ENTITIES = [
  { name: 'Mitarbeiter', label: 'Mitarbeiter' },
  { name: 'Wohnbereich', label: 'Wohnbereiche' },
  { name: 'MitarbeiterFehlzeiten', label: 'Fehlzeiten' },
  { name: 'Heimkosten', label: 'Heimkosten' },
  { name: 'MediFoxAbrechnung', label: 'MediFox-Abrechnungen' },
  { name: 'BewohnerHeimkosten', label: 'Bewohner-Heimkosten' },
  { name: 'Verguetung', label: 'Vergütungsvereinbarungen' },
  { name: 'BelegungsSnapshot', label: 'Belegungs-Snapshots' },
  { name: 'MonatsabschlussHistorie', label: 'Monatsabschlüsse' },
  { name: 'SachkostenAusgaben', label: 'Sachkosten-Ausgaben' },
  { name: 'SachkostenBudgetwerte', label: 'Sachkosten-Budgetwerte' },
  { name: 'BewohnerAbwesenheiten', label: 'Bewohner-Abwesenheiten' },
  { name: 'OneDriveImportLog', label: 'OneDrive-Import-Logs' },
];

const BEREICHE = [
  {
    key: 'stationaer',
    label: 'Stationär / Pflege',
    accent: 'teal',
    entities: [
      { name: 'Mitarbeiter', query: {}, label: 'Mitarbeiter' },
      { name: 'Wohnbereich', query: {}, label: 'Wohnbereiche' },
      { name: 'Heimkosten', query: { bereich: 'stationär' }, label: 'Heimkosten (stationär)' },
      { name: 'MediFoxAbrechnung', query: {}, label: 'MediFox-Abrechnungen' },
      { name: 'BewohnerHeimkosten', query: {}, label: 'Bewohner-Heimkosten' },
      { name: 'Verguetung', query: {}, label: 'Vergütungsvereinbarungen' },
      { name: 'BelegungsSnapshot', query: {}, label: 'Belegungs-Snapshots' },
      { name: 'MonatsabschlussHistorie', query: {}, label: 'Monatsabschlüsse' },
    ],
  },
  {
    key: 'tagespflege',
    label: 'Tagespflege',
    accent: 'orange',
    entities: [
      { name: 'TP_Gaeste', query: {}, label: 'Gäste' },
      { name: 'TP_Anwesenheit', query: {}, label: 'Anwesenheiten' },
      { name: 'TP_Finanzen', query: {}, label: 'Finanzen' },
      { name: 'Tagespflege', query: {}, label: 'Tagespflege-Daten' },
      { name: 'Heimkosten', query: { bereich: 'tagespflege' }, label: 'Heimkosten (Tagespflege)' },
    ],
  },
  {
    key: 'egh',
    label: 'Eingliederungshilfe',
    accent: 'blue',
    entities: [
      { name: 'EGH_Klienten', query: {}, label: 'Klienten' },
      { name: 'EGH_Leistungserfassung', query: {}, label: 'Leistungserfassungen' },
      { name: 'EGH_Finanzen', query: {}, label: 'Finanzen' },
      { name: 'Leistung_Rohdaten_MediFox', query: {}, label: 'MediFox-Rohdaten' },
      { name: 'Mapping_MediFox', query: {}, label: 'MediFox-Mappings' },
      { name: 'Import_Snapshot', query: {}, label: 'Import-Snapshots' },
    ],
  },
  {
    key: 'betreutes_wohnen',
    label: 'Betreutes Wohnen',
    accent: 'violet',
    entities: [
      { name: 'BetreutesWohnenPersonal', query: {}, label: 'Personal' },
      { name: 'BetreutesWohnenFinanzen', query: {}, label: 'Finanzen' },
      { name: 'WohneinheitenStamm', query: {}, label: 'Wohneinheiten' },
      { name: 'Leistungskatalog', query: {}, label: 'Leistungskatalog' },
      { name: 'BetreutesWohnenWahlleistungen', query: {}, label: 'Wahlleistungen' },
      { name: 'BetreutesWohnenBelegung', query: {}, label: 'Belegungen' },
    ],
  },
  {
    key: 'sachkosten',
    label: 'Sachkosten-Benchmark',
    accent: 'amber',
    entities: [
      { name: 'SachkostenAusgaben', query: {}, label: 'Ausgaben / Buchungen' },
      { name: 'SachkostenBudgetwerte', query: {}, label: 'Budgetwerte' },
      { name: 'SachkostenImporte', query: {}, label: 'Import-Vorgänge' },
      { name: 'BewohnerAbwesenheiten', query: {}, label: 'Bewohner-Abwesenheiten' },
    ],
  },
];

const ALLE_ENTITIES = [...new Set(BEREICHE.flatMap(b => b.entities.map(e => e.name)))];

const accentMap = {
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const queryKey = (name, query) => `${name}::${JSON.stringify(query)}`;

export default function Datenverwaltung() {
  const { einrichtungen } = useEinrichtung();
  const [counts, setCounts] = useState({});
  const [facilityCounts, setFacilityCounts] = useState({});
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load overall counts
  const loadCounts = useCallback(async () => {
    setLoading(true);
    const entries = BEREICHE.flatMap(b =>
      b.entities.map(e => ({ entity: e.name, query: e.query, key: queryKey(e.name, e.query) }))
    );

    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        const data = await base44.entities[entry.entity].filter(entry.query);
        return { key: entry.key, count: data.length };
      })
    );

    const newCounts = {};
    results.forEach((r, i) => {
      newCounts[entries[i].key] = r.status === 'fulfilled' ? r.value.count : 0;
    });
    setCounts(newCounts);
    setLoading(false);
  }, []);

  // Load per-facility counts
  const loadFacilityCounts = useCallback(async (facilityId) => {
    if (!facilityId) { setFacilityCounts({}); return; }
    setFacilityLoading(true);
    const results = await Promise.allSettled(
      FACILITY_ENTITIES.map(async (e) => {
        const data = await base44.entities[e.name].filter({ einrichtung_id: facilityId });
        return { name: e.name, count: data.length };
      })
    );
    const newCounts = {};
    results.forEach((r, i) => {
      newCounts[FACILITY_ENTITIES[i].name] = r.status === 'fulfilled' ? r.value.count : 0;
    });
    setFacilityCounts(newCounts);
    setFacilityLoading(false);
  }, []);

  useEffect(() => { loadCounts(); }, [refreshKey]);

  useEffect(() => {
    if (selectedFacilityId) loadFacilityCounts(selectedFacilityId);
    else setFacilityCounts({});
  }, [selectedFacilityId, refreshKey]);

  const getAreaCount = (bereich) =>
    bereich.entities.reduce((sum, e) => sum + (counts[queryKey(e.name, e.query)] || 0), 0);

  const totalCount = BEREICHE.reduce((sum, b) => sum + getAreaCount(b), 0);

  const facilityTotal = FACILITY_ENTITIES.reduce((sum, e) => sum + (facilityCounts[e.name] || 0), 0);

  const deleteFacility = async (facilityId) => {
    const facility = einrichtungen.find(e => e.id === facilityId);
    if (!facility) return;
    if (facilityTotal === 0) { alert('Keine Daten für diese Einrichtung vorhanden.'); return; }
    if (!confirm(
      `⚠ Wirklich ALLE Daten der Einrichtung "${facility.name}" löschen?\n\n` +
      `${facilityTotal} Datensätze werden unwiderruflich entfernt.\n\n` +
      `Die Einrichtung selbst bleibt erhalten – nur deren Daten werden gelöscht.\n\n` +
      `Diese Aktion kann NICHT rückgängig gemacht werden!`
    )) return;

    setDeleting('facility');
    try {
      for (const e of FACILITY_ENTITIES) {
        await base44.entities[e.name].deleteMany({ einrichtung_id: facilityId });
      }
      alert(`Daten für "${facility.name}" wurden gelöscht (${facilityTotal} Datensätze).`);
    } catch (err) {
      alert('Fehler beim Löschen: ' + (err.message || err));
    }
    setDeleting(null);
    setRefreshKey(k => k + 1);
  };

  const deleteFacilityEntity = async (entityName, facilityId) => {
    const entityDef = FACILITY_ENTITIES.find(e => e.name === entityName);
    const count = facilityCounts[entityName] || 0;
    if (count === 0) return;
    const facility = einrichtungen.find(e => e.id === facilityId);
    if (!confirm(
      `⚠ ${count} Datensätze "${entityDef.label}" für "${facility.name}" löschen?\n\nDiese Aktion kann NICHT rückgängig gemacht werden!`
    )) return;

    setDeleting(`facility_${entityName}`);
    try {
      await base44.entities[entityName].deleteMany({ einrichtung_id: facilityId });
      alert(`${count} Datensätze gelöscht.`);
    } catch (err) {
      alert('Fehler: ' + (err.message || err));
    }
    setDeleting(null);
    setRefreshKey(k => k + 1);
  };

  const deleteArea = async (bereich) => {
    const total = getAreaCount(bereich);
    if (total === 0) { alert('Keine Daten in diesem Bereich vorhanden.'); return; }
    if (!confirm(
      `⚠ Wirklich ALLE Daten im Bereich "${bereich.label}" löschen?\n\n` +
      `${total} Datensätze werden unwiderruflich entfernt.\n\n` +
      `Einrichtungs-Einstellungen, Kategorien, Konto-Zuordnungen und Benutzerkonten bleiben erhalten.\n\n` +
      `Diese Aktion kann NICHT rückgängig gemacht werden!`
    )) return;

    setDeleting(bereich.key);
    try {
      for (const e of bereich.entities) {
        await base44.entities[e.name].deleteMany(e.query);
      }
      alert(`Bereich "${bereich.label}" wurde geleert (${total} Datensätze gelöscht).`);
    } catch (err) {
      alert('Fehler beim Löschen: ' + (err.message || err));
    }
    setDeleting(null);
    setRefreshKey(k => k + 1);
  };

  const deleteAll = async () => {
    if (totalCount === 0) { alert('Keine Daten vorhanden.'); return; }
    if (!confirm(
      `⚠ Wirklich ALLE Daten in ALLEN Bereichen löschen?\n\n` +
      `${totalCount} Datensätze werden unwiderruflich entfernt.\n\n` +
      `Einrichtungs-Einstellungen, Kategorien, Konto-Zuordnungen und Benutzerkonten bleiben erhalten.\n\n` +
      `Diese Aktion kann NICHT rückgängig gemacht werden!`
    )) return;

    setDeleting('gesamt');
    try {
      for (const entityName of ALLE_ENTITIES) {
        await base44.entities[entityName].deleteMany({});
      }
      alert(`Alle Daten wurden gelöscht (${totalCount} Datensätze).`);
    } catch (err) {
      alert('Fehler beim Löschen: ' + (err.message || err));
    }
    setDeleting(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Daten unwiderruflich löschen</p>
          <p className="text-xs text-red-600 mt-0.5">
            Hier können alle Daten pro Einrichtung, pro Bereich oder komplett gelöscht werden.
            Einrichtungen, Sachkosten-Kategorien, Konto-Zuordnungen und Benutzerkonten bleiben erhalten.
            Diese Aktion kann <strong>nicht rückgängig</strong> gemacht werden!
          </p>
        </div>
      </div>

      {/* Per Einrichtung */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Building2 className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Pro Einrichtung löschen</h3>
            <p className="text-xs text-slate-500 mt-0.5">Wählen Sie ein Haus und löschen Sie gezielt dessen Daten</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Facility Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">Einrichtung auswählen</label>
            <select
              value={selectedFacilityId}
              onChange={e => setSelectedFacilityId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">— Einrichtung wählen —</option>
              {einrichtungen.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {selectedFacilityId && (
            <>
              {/* Summary + Delete All for facility */}
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {einrichtungen.find(e => e.id === selectedFacilityId)?.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {facilityLoading ? 'Lädt…' : `${facilityTotal} Datensätze gesamt`}
                  </p>
                </div>
                <button
                  onClick={() => deleteFacility(selectedFacilityId)}
                  disabled={facilityLoading || deleting !== null || facilityTotal === 0}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting === 'facility' ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Wird gelöscht…</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Alle Daten dieses Hauses löschen</>
                  )}
                </button>
              </div>

              {/* Per entity breakdown */}
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-4 py-2.5 font-medium text-slate-600">Datenart</th>
                      <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Datensätze</th>
                      <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {FACILITY_ENTITIES.map(e => {
                      const c = facilityCounts[e.name] || 0;
                      const isDeleting = deleting === `facility_${e.name}`;
                      return (
                        <tr key={e.name} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 text-slate-700">{e.label}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`font-medium ${c > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{c}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => deleteFacilityEntity(e.name, selectedFacilityId)}
                              disabled={c === 0 || deleting !== null}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:text-slate-300 disabled:cursor-not-allowed font-medium"
                            >
                              {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Löschen
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gesamt */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Alle Daten (Gesamt)</h3>
              <p className="text-xs text-slate-500 mt-0.5">{totalCount} Datensätze über alle Bereiche</p>
            </div>
          </div>
          <button
            onClick={deleteAll}
            disabled={loading || deleting !== null || totalCount === 0}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting === 'gesamt' ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Wird gelöscht…</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Alle Daten löschen</>
            )}
          </button>
        </div>
      </div>

      {/* Per Bereich */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Löschen nach Bereich</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BEREICHE.map(bereich => {
            const count = getAreaCount(bereich);
            const accent = accentMap[bereich.accent];
            return (
              <div key={bereich.key} className={`rounded-xl border ${accent.border} ${accent.bg} p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className={`font-semibold ${accent.text}`}>{bereich.label}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{count} Datensätze</p>
                  </div>
                  <button
                    onClick={() => deleteArea(bereich)}
                    disabled={loading || deleting !== null || count === 0}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting === bereich.key ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Löschen
                  </button>
                </div>
                <div className="space-y-1">
                  {bereich.entities.map(e => {
                    const c = counts[queryKey(e.name, e.query)] || 0;
                    return (
                      <div key={queryKey(e.name, e.query)} className="flex justify-between text-xs">
                        <span className="text-slate-600">{e.label}</span>
                        <span className={`font-medium ${c > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-center">
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading || deleting !== null}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>
    </div>
  );
}