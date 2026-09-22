import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { Upload, TrendingUp, TrendingDown, Minus, Download, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const KOSTENARTEN = ['Wäsche', 'Lebensmitteleinkauf', 'Pflegebedarf', 'Sonstiges'];
const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmt2 = (n) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// Benchmark-Werte aus Pflegesatzverhandlung (pro Belegungstag)
// Wäsche: aus Wäscherei-Auswertung (Frau Schuberth)
// Beköstigung: U&V-Satz aus Vergütung
// Pflegebedarf: PG-gewichteter Pflegesatz
const STORAGE_KEY = 'sachkosten_benchmarks';

const BENCHMARK_DEFAULTS = {
  Wäsche: 4.50,
  Lebensmitteleinkauf: 0,
  Pflegebedarf: 0,
  Sonstiges: 0,
};

function loadBenchmarksFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function TrendIcon({ ist, benchmark }) {
  if (!benchmark || benchmark === 0) return null;
  const diff = ((ist - benchmark) / benchmark) * 100;
  if (diff > 5) return <TrendingUp className="w-4 h-4 text-red-500" />;
  if (diff < -5) return <TrendingDown className="w-4 h-4 text-green-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

export default function SachkostenBenchmark() {
  const { selectedEinrichtung, einrichtungen } = useEinrichtung();
  const [heimkosten, setHeimkosten] = useState([]);
  const [alleHeimkosten, setAlleHeimkosten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKostenart, setSelectedKostenart] = useState('Wäsche');
  const [benchmarks, setBenchmarks] = useState(() => loadBenchmarksFromStorage() || BENCHMARK_DEFAULTS);
  const [editingBenchmark, setEditingBenchmark] = useState(false);
  const [benchmarkDraft, setBenchmarkDraft] = useState({});
  const [bereichFilter, setBereichFilter] = useState('stationär');
  const [viewMode, setViewMode] = useState('verlauf'); // 'verlauf' | 'vergleich'
  const [importKostenart, setImportKostenart] = useState('Lebensmittel-Getränke');
  const fileRef = useRef();

  const load = async () => {
    if (!selectedEinrichtung) return;
    setLoading(true);

    // Aktuelle Einrichtung + alle Einrichtungen für Vergleich
    const [hk, vg, alleHk] = await Promise.all([
      base44.entities.Heimkosten.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Verguetung.filter({ einrichtung_id: selectedEinrichtung.id }),
      base44.entities.Heimkosten.list(),
    ]);
    setHeimkosten(hk);
    setAlleHeimkosten(alleHk);

    // Aktuellste Vergütung für Benchmark-Basis – nur wenn noch keine gespeicherten Werte
    const stored = loadBenchmarksFromStorage();
    if (!stored) {
      const aktuelleVg = vg.sort((a, b) => (b.gueltig_ab || '').localeCompare(a.gueltig_ab || ''))[0];
      if (aktuelleVg) {
        const pgDurchschnitt = (
          (aktuelleVg.pflegesatz_pg2 || 0) +
          (aktuelleVg.pflegesatz_pg3 || 0) +
          (aktuelleVg.pflegesatz_pg4 || 0) +
          (aktuelleVg.pflegesatz_pg5 || 0)
        ) / 4;
        const auto = {
          ...BENCHMARK_DEFAULTS,
          Lebensmitteleinkauf: aktuelleVg.unterkunft_verpflegung || 0,
          Pflegebedarf: pgDurchschnitt,
        };
        setBenchmarks(auto);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(auto));
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedEinrichtung]);

  // Import (CSV oder Excel)
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isExcel = file.name.match(/\.(xlsx|xls)$/i);

    if (isExcel) {
      setLoading(true);
      try {
        const upload = await base44.integrations.Core.UploadFile({ file });
        const resp = await base44.functions.invoke('parseKontoblatt', { file_url: upload.file_url });
        const result = resp.data;
        if (!result?.success || !result.months?.length) {
          alert('Keine Buchungen im Kontoblatt gefunden.');
          return;
        }

        // Belegungstage aus existierenden Einträgen lookup
        const records = result.months.map(m => {
          const monatDate = m.monat + '-01';
          const existingBelegung = heimkosten.find(h =>
            h.monat === monatDate && h.bereich === bereichFilter && h.belegungstage > 0
          );
          return {
            einrichtung_id: selectedEinrichtung.id,
            monat: monatDate,
            kostenart: importKostenart,
            gesamtbetrag: m.gesamtbetrag,
            belegungstage: existingBelegung?.belegungstage || 0,
            bereich: bereichFilter,
            bemerkung: `${result.accountName} (${m.anzahl} Buchungen)`,
          };
        });

        // Dedup: existierende Einträge aktualisieren, neue anlegen
        const existingByMonth = {};
        heimkosten.forEach(h => {
          if (h.kostenart === importKostenart && h.bereich === bereichFilter) {
            existingByMonth[h.monat] = h;
          }
        });

        const toUpdate = [];
        const toCreate = [];
        records.forEach(r => {
          const existing = existingByMonth[r.monat];
          if (existing) {
            toUpdate.push({
              id: existing.id,
              gesamtbetrag: r.gesamtbetrag,
              belegungstage: r.belegungstage || existing.belegungstage,
              bemerkung: r.bemerkung,
            });
          } else {
            toCreate.push(r);
          }
        });

        const previewText = records.map(r =>
          `${r.monat.substring(0, 7)}: ${fmt(r.gesamtbetrag)}${r.belegungstage > 0 ? ` (${r.belegungstage} Beleg.-tage)` : ''}`
        ).join('\n');

        if (!confirm(`Import als "${importKostenart}"?\n\nKonto: ${result.accountName}\n\n${previewText}\n\n${toUpdate.length} aktualisiert, ${toCreate.length} neu angelegt`)) {
          return;
        }

        if (toUpdate.length > 0) await base44.entities.Heimkosten.bulkUpdate(toUpdate);
        if (toCreate.length > 0) await base44.entities.Heimkosten.bulkCreate(toCreate);
        load();
        alert(`Import erfolgreich: ${toUpdate.length} aktualisiert, ${toCreate.length} neu angelegt.`);
      } catch (err) {
        alert('Fehler beim Excel-Import: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(';').map(c => c.trim().replace(',', '.'));
          const row = {};
          headers.forEach((h, idx) => { row[h] = cols[idx]; });
          if (row.monat && row.gesamtbetrag) {
            records.push({
              einrichtung_id: selectedEinrichtung.id,
              monat: row.monat.length === 7 ? row.monat + '-01' : row.monat,
              kostenart: row.kostenart || 'Sonstiges',
              gesamtbetrag: parseFloat(row.gesamtbetrag) || 0,
              belegungstage: parseFloat(row.belegungstage) || 0,
              bereich: row.bereich || 'stationär',
              bemerkung: row.bemerkung || '',
            });
          }
        }
        if (records.length > 0) {
          await base44.entities.Heimkosten.bulkCreate(records);
          load();
          alert(`${records.length} Datensätze importiert.`);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
    e.target.value = '';
  };

  // Gefilterter Datensatz (Bereich)
  const gefiltert = heimkosten.filter(h => h.bereich === bereichFilter);

  // Daten für Verlaufs-Chart
  const kostenartData = gefiltert
    .filter(h => h.kostenart === selectedKostenart && h.belegungstage > 0)
    .sort((a, b) => (a.monat || '').localeCompare(b.monat || ''))
    .slice(-12)
    .map(h => {
      const istProTag = h.gesamtbetrag / h.belegungstage;
      const benchmark = benchmarks[selectedKostenart] || 0;
      const d = new Date(h.monat);
      return {
        monat: `${MONATE[d.getMonth()]} ${d.getFullYear()}`,
        'Ist €/Tag': parseFloat(istProTag.toFixed(2)),
        'Benchmark': parseFloat(benchmark.toFixed(2)),
        gesamtbetrag: h.gesamtbetrag,
        belegungstage: h.belegungstage,
      };
    });

  // KPI-Übersicht alle Kostenarten letzter Monat
  const letzterMonat = [...gefiltert]
    .sort((a, b) => (b.monat || '').localeCompare(a.monat || ''))[0]?.monat;

  const kpiData = KOSTENARTEN.map(ka => {
    const eintraege = gefiltert.filter(h => h.kostenart === ka && h.monat === letzterMonat);
    const gesamt = eintraege.reduce((s, h) => s + (h.gesamtbetrag || 0), 0);
    const tage = eintraege.reduce((s, h) => s + (h.belegungstage || 0), 0);
    const proTag = tage > 0 ? gesamt / tage : 0;
    const benchmark = benchmarks[ka] || 0;
    const abweichung = benchmark > 0 ? proTag - benchmark : null;
    return { ka, gesamt, tage, proTag, benchmark, abweichung };
  });

  // Einrichtungsvergleich: letzter verfügbarer Monat je Einrichtung, für selectedKostenart
  const vergleichData = (einrichtungen || []).map(einr => {
    const einrHk = alleHeimkosten.filter(h =>
      h.einrichtung_id === einr.id &&
      h.kostenart === selectedKostenart &&
      h.bereich === bereichFilter &&
      h.belegungstage > 0
    );
    if (einrHk.length === 0) return null;
    const letzterM = [...einrHk].sort((a, b) => (b.monat || '').localeCompare(a.monat || ''))[0];
    const proTag = letzterM.gesamtbetrag / letzterM.belegungstage;
    return {
      einrichtung: einr.name,
      'Ist €/Tag': parseFloat(proTag.toFixed(2)),
      'Benchmark': parseFloat((benchmarks[selectedKostenart] || 0).toFixed(2)),
      istAktuell: einr.id === selectedEinrichtung?.id,
    };
  }).filter(Boolean).sort((a, b) => a['Ist €/Tag'] - b['Ist €/Tag']);

  // CSV-Export der aktuellen Tabellendaten
  const exportCSV = () => {
    const rows = [['Monat', 'Kostenart', 'Bereich', 'Gesamtbetrag', 'Belegungstage', '€/Tag', 'Benchmark', 'Abweichung']];
    KOSTENARTEN.forEach(ka => {
      gefiltert
        .filter(h => h.belegungstage > 0)
        .filter(h => h.kostenart === ka)
        .sort((a, b) => (a.monat || '').localeCompare(b.monat || ''))
        .forEach(h => {
          const proTag = h.gesamtbetrag / h.belegungstage;
          const bm = benchmarks[ka] || 0;
          rows.push([
            h.monat, ka, h.bereich,
            h.gesamtbetrag.toFixed(2),
            h.belegungstage,
            proTag.toFixed(2),
            bm.toFixed(2),
            bm > 0 ? (proTag - bm).toFixed(2) : '—',
          ]);
        });
    });
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sachkosten_${bereichFilter}_${new Date().toISOString().substring(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sachkosten-Benchmarking</h2>
          <p className="text-xs text-slate-500 mt-0.5">Kosten pro Belegungstag im Vergleich zum Benchmark (Pflegesatzverhandlung)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Bereichs-Filter */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {['stationär','tagespflege'].map(b => (
              <button key={b} onClick={() => setBereichFilter(b)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${bereichFilter === b ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                {b === 'stationär' ? 'Stationär' : 'Tagespflege'}
              </button>
            ))}
          </div>
          {/* Ansichts-Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setViewMode('verlauf')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'verlauf' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
              Verlauf
            </button>
            <button onClick={() => setViewMode('vergleich')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'vergleich' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
              <Building2 className="w-3 h-3" /> Einrichtungen
            </button>
          </div>
          <button onClick={() => {
            if (!editingBenchmark) {
              const draft = {};
              KOSTENARTEN.forEach(ka => { draft[ka] = String(benchmarks[ka] ?? 0); });
              setBenchmarkDraft(draft);
            }
            setEditingBenchmark(!editingBenchmark);
          }}
            className="border border-slate-200 bg-white px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">
            ⚙️ Benchmarks
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <select value={importKostenart} onChange={e => setImportKostenart(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white">
            {KOSTENARTEN.map(ka => <option key={ka} value={ka}>{ka}</option>)}
          </select>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 border border-teal-200 bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-100">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Benchmark-Editor */}
      {editingBenchmark && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-3">Benchmark-Werte anpassen (€ pro Belegungstag)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {KOSTENARTEN.map(ka => (
              <div key={ka}>
                <label className="text-xs text-amber-700 mb-1 block">{ka}</label>
                <input
                  type="text" inputMode="decimal"
                  value={benchmarkDraft[ka] ?? ''}
                  onChange={e => setBenchmarkDraft(p => ({ ...p, [ka]: e.target.value }))}
                  onBlur={() => {
                    const val = parseFloat(String(benchmarkDraft[ka]).replace(',', '.')) || 0;
                    const updated = { ...benchmarks, [ka]: val };
                    setBenchmarks(updated);
                    setBenchmarkDraft(p => ({ ...p, [ka]: String(val) }));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.target.blur(); }
                  }}
                  className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">* Beköstigung und Pflegebedarf werden automatisch aus der aktuellen Vergütung übernommen</p>
        </div>
      )}

      {/* KPI-Karten: alle Kostenarten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpiData.map(({ ka, gesamt, proTag, benchmark, abweichung }) => (
          <div
            key={ka}
            onClick={() => setSelectedKostenart(ka)}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${
              selectedKostenart === ka
                ? 'border-teal-400 bg-teal-50 shadow-sm'
                : 'border-slate-100 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{ka}</span>
              <TrendIcon ist={proTag} benchmark={benchmark} />
            </div>
            <div className="text-xl font-bold text-slate-900">{fmt2(proTag)} €</div>
            <div className="text-xs text-slate-400 mt-0.5">pro Belegungstag</div>
            {benchmark > 0 && (
              <div className={`text-xs mt-1.5 font-medium ${
                abweichung > 0 ? 'text-red-500' : abweichung < 0 ? 'text-green-600' : 'text-slate-400'
              }`}>
                {abweichung > 0 ? '+' : ''}{fmt2(abweichung)} € vs. Benchmark
              </div>
            )}
            <div className="text-xs text-slate-300 mt-0.5">Gesamt: {fmt(gesamt)}</div>
          </div>
        ))}
      </div>

      {/* Kostenart-Tabs */}
      <div className="flex gap-1 flex-wrap">
        {KOSTENARTEN.map(ka => (
          <button key={ka} onClick={() => setSelectedKostenart(ka)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedKostenart === ka ? 'bg-teal-600 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}>
            {ka}
          </button>
        ))}
      </div>

      {/* Chart: Verlauf oder Einrichtungsvergleich */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">
          {viewMode === 'verlauf'
            ? `${selectedKostenart} – Verlauf (€/Belegungstag)`
            : `${selectedKostenart} – Einrichtungsvergleich (€/Belegungstag)`}
        </h3>

        {viewMode === 'verlauf' && (
          kostenartData.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="text-sm">Keine Daten für {selectedKostenart} · {bereichFilter}</p>
              <p className="text-xs mt-1">Bitte CSV importieren oder Einträge mit Belegungstagen erfassen</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={kostenartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val, name) => [`${fmt2(val)} €`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ist €/Tag" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Benchmark" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        )}

        {viewMode === 'vergleich' && (
          (einrichtungen || []).length <= 1 ? (
            <div className="py-16 text-center text-slate-400">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-sm">Nur eine Einrichtung vorhanden</p>
              <p className="text-xs mt-1">Lege weitere Einrichtungen an, um einen Vergleich zu sehen</p>
            </div>
          ) : vergleichData.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="text-sm">Keine Vergleichsdaten vorhanden</p>
              <p className="text-xs mt-1">Andere Einrichtungen benötigen Heimkosten-Einträge mit Belegungstagen</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={vergleichData} layout="vertical" margin={{ top: 5, right: 60, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="einrichtung" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(val, name) => [`${fmt2(val)} €`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {benchmarks[selectedKostenart] > 0 && (
                    <ReferenceLine x={benchmarks[selectedKostenart]} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Benchmark', position: 'top', fontSize: 10, fill: '#f59e0b' }} />
                  )}
                  <Bar dataKey="Ist €/Tag" radius={[0, 4, 4, 0]}
                    fill="#0d9488"
                    label={{ position: 'right', fontSize: 11, formatter: v => `${fmt2(v)} €` }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-400 mt-2">* Zeigt den letzten verfügbaren Monat je Einrichtung · sortiert aufsteigend</p>
            </>
          )
        )}
      </div>

      {/* Import-Hinweis */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1">
        <p className="text-xs font-semibold text-blue-800">📄 Import (Excel-Kontoblatt oder CSV)</p>
        <p className="text-xs text-blue-700"><strong>Excel-Kontoblatt:</strong> ERP-Export mit Spalten "Datum", "Umsatz Soll" und "Buchungstext". Beträge werden automatisch nach Monat summiert und der ausgewählten Kostenart (Dropdown links) zugeordnet.</p>
        <p className="text-xs text-blue-600"><strong>CSV-Format:</strong> <span className="font-mono">monat;kostenart;gesamtbetrag;belegungstage;bereich;bemerkung</span></p>
        <p className="text-xs text-blue-500">Kostenarten: Wäsche | Lebensmittel-Getränke | Lebensmitteleinkauf | Pflegebedarf | Sonstiges</p>
      </div>
    </div>
  );
}