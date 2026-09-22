import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, TrendingDown, TrendingUp, Users } from 'lucide-react';

export default function TagespflegeDashboard() {
  const { selectedEinrichtung } = useEinrichtung();
  const [gaeste, setGaeste] = useState([]);
  const [anwesenheit, setAnwesenheit] = useState([]);
  const [finanzen, setFinanzen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonat, setFilterMonat] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    loadData();
  }, [selectedEinrichtung]);

  const loadData = async () => {
    if (!selectedEinrichtung) return;
    try {
      const [g, a, f] = await Promise.all([
        base44.entities.TP_Gaeste.list(),
        base44.entities.TP_Anwesenheit.list(),
        base44.entities.TP_Finanzen.filter({ einrichtung_id: selectedEinrichtung.id }),
      ]);
      setGaeste(g);
      setAnwesenheit(a);
      setFinanzen(f);
    } catch (e) {
      console.error('Fehler beim Laden:', e);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Laden...</div>;

  // Filter nach Monat
  const monatlicheAnwesenheit = anwesenheit.filter(a => a.datum?.startsWith(filterMonat));

  // Auslastungsberechnung
  const aktivGaeste = gaeste.filter(g => g.status === 'Aktiv');
  const maxPlatz = aktivGaeste.length * 5; // Annahme: 5 Arbeitstage pro Woche
  const anwesenTage = monatlicheAnwesenheit.filter(a => a.status === 'Anwesend').length;
  const auslastungProzent = maxPlatz > 0 ? Math.round((anwesenTage / maxPlatz) * 100) : 0;

  // Budget-Wächter
  const monatlicheFinanzen = finanzen.find(f => f.monat_jahr?.startsWith(filterMonat));
  const erlöseGesamt = (monatlicheFinanzen?.erloese_pflegesatz || 0) + (monatlicheFinanzen?.erloese_u_v || 0);
  const personalUndSachkosten = (monatlicheFinanzen?.personalkosten || 0) + (monatlicheFinanzen?.fahrtkosten || 0) + (monatlicheFinanzen?.verpflegungskosten || 0);
  const deckungesgradProzent = personalUndSachkosten > 0 ? Math.round((erlöseGesamt / personalUndSachkosten) * 100) : 0;

  // Belegung nach Wochentag
  const wochentagData = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((tag, idx) => {
    const count = monatlicheAnwesenheit.filter(a => {
      const d = new Date(a.datum);
      return d.getDay() === (idx + 1) && a.status === 'Anwesend';
    }).length;
    return { tag, besuche: count };
  });

  // Pflegegrad-Verteilung
  const pgData = ['PG1', 'PG2', 'PG3', 'PG4', 'PG5'].map(pg => ({
    pg,
    count: gaeste.filter(g => g.pflegegrad === pg).length,
  })).filter(d => d.count > 0);

  // Fahrdienst-Nutzung
  const fahrdienst = monatlicheAnwesenheit.filter(a => a.fahrdienst_hinfahrt || a.fahrdienst_ruckfahrt).length;

  // Monatsvergleich Belegung
  const monatlicheAuslastung = [
    { monat: 'Monat -2', auslastung: 65 },
    { monat: 'Monat -1', auslastung: 72 },
    { monat: 'Aktuell', auslastung: auslastungProzent },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tagespflege – Dashboard</h1>
            <p className="text-slate-500 mt-1">{selectedEinrichtung?.name}</p>
          </div>
          <input type="month" value={filterMonat} onChange={e => setFilterMonat(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Users className="w-4 h-4" /> Aktive Gäste
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">{aktivGaeste.length}</div>
              <p className="text-xs text-slate-400 mt-1">{aktivGaeste.filter(g => g.fahrdienst_nutzer).length} mit Fahrdienst</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Auslastung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${auslastungProzent >= 80 ? 'text-teal-600' : auslastungProzent >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {auslastungProzent}%
              </div>
              <p className="text-xs text-slate-400 mt-1">{anwesenTage} / {maxPlatz} Plätze</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Erlöse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">{Math.round(erlöseGesamt).toLocaleString('de-DE')} €</div>
              <p className="text-xs text-slate-400 mt-1">Pflegekasse + U&V</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Deckungsgrad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${deckungesgradProzent >= 100 ? 'text-green-600' : deckungesgradProzent >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                {deckungesgradProzent}%
              </div>
              <p className="text-xs text-slate-400 mt-1">Erlöse / Kosten</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget-Wächter Alert */}
        {deckungesgradProzent < 90 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Budget-Warnung</p>
              <p className="text-sm text-red-700 mt-1">Deckungsgrad unter 90%. Kosten übersteigen Erlöse um {Math.round(personalUndSachkosten - erlöseGesamt)} €.</p>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Belegung nach Wochentag</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={wochentagData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tag" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="besuche" fill="#14b8a6">
                    {wochentagData.map((d, i) => (
                      <Cell key={i} fill={d.besuche > 0 ? '#14b8a6' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pflegegrad-Verteilung</CardTitle>
            </CardHeader>
            <CardContent>
              {pgData.length > 0 ? (
                <div className="space-y-2">
                  {pgData.map(d => (
                    <div key={d.pg} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                      <span className="font-medium">{d.pg}</span>
                      <div className="flex items-center gap-3">
                        <div className="h-2 bg-teal-200 rounded w-24" style={{ width: `${(d.count / aktivGaeste.length) * 100}px` }} />
                        <span className="text-sm text-slate-600">{d.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Keine Daten</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auslastung Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monatlicheAuslastung}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monat" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Line type="monotone" dataKey="auslastung" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Finanzübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-slate-600">Erlöse Pflegekasse</span>
                  <span className="font-semibold text-teal-600">{Math.round(monatlicheFinanzen?.erloese_pflegesatz || 0).toLocaleString('de-DE')} €</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-slate-600">U&V / Eigenanteile</span>
                  <span className="font-semibold text-teal-600">{Math.round(monatlicheFinanzen?.erloese_u_v || 0).toLocaleString('de-DE')} €</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-slate-600">Personal</span>
                  <span className="font-semibold text-red-600">–{Math.round(monatlicheFinanzen?.personalkosten || 0).toLocaleString('de-DE')} €</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-slate-600">Fahrtkosten</span>
                  <span className="font-semibold text-red-600">–{Math.round(monatlicheFinanzen?.fahrtkosten || 0).toLocaleString('de-DE')} €</span>
                </div>
                <div className="flex justify-between pt-2 font-semibold text-base">
                  <span>Ergebnis</span>
                  <span className={deckungesgradProzent >= 100 ? 'text-green-600' : 'text-red-600'}>
                    {Math.round(erlöseGesamt - personalUndSachkosten).toLocaleString('de-DE')} €
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fahrdienst-Nutzung */}
        <Card>
          <CardHeader>
            <CardTitle>Fahrdienst-Nutzung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-600">{fahrdienst}</div>
            <p className="text-sm text-slate-500 mt-2">Fahrten im Monat {filterMonat}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}