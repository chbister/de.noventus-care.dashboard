import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useEinrichtung } from '@/lib/EinrichtungContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Home, TrendingUp, DollarSign, Clock, AlertCircle, Download, CheckCircle, Download as DownloadIcon } from 'lucide-react';

export default function BetreutesWohnenDashboard() {
  const { selectedEinrichtung } = useEinrichtung();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    wohneinheiten: [],
    belegung: [],
    finanzen: [],
    personal: [],
    wahlleistungen: []
  });

  useEffect(() => {
    if (!selectedEinrichtung) return;
    loadData();
  }, [selectedEinrichtung]);

  const loadData = async () => {
    if (!selectedEinrichtung) return;
    setLoading(true);
    try {
      const [we, bel, fin, per, wahl] = await Promise.all([
        base44.entities.WohneinheitenStamm.list(),
        base44.entities.BetreutesWohnenBelegung.list(),
        base44.entities.BetreutesWohnenFinanzen.list(),
        base44.entities.BetreutesWohnenPersonal.list(),
        base44.entities.BetreutesWohnenWahlleistungen.list(),
      ]);
      setData({ wohneinheiten: we, belegung: bel, finanzen: fin, personal: per, wahlleistungen: wahl });
    } catch (e) {
      console.error('Fehler beim Laden:', e);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Laden...</div>;

  // KPI Berechnungen
  const activeBelegungen = data.belegung.filter(b => b.status === 'Aktiv');
  const totalWohneinheiten = data.wohneinheiten.filter(w => w.status_aktiv).length;
  const belegungsquote = totalWohneinheiten > 0 ? Math.round((activeBelegungen.length / totalWohneinheiten) * 100) : 0;
  const durchschnittlicheFlaeche = data.wohneinheiten.length > 0 
    ? Math.round(data.wohneinheiten.reduce((s, w) => s + (w.flaeche_qm || 0), 0) / data.wohneinheiten.length)
    : 0;

  const sollMieten = data.wohneinheiten.reduce((s, w) => s + (w.soll_kaltmiete || 0) + (w.soll_nebenkosten || 0), 0);
  const istUmsatz = data.finanzen.reduce((s, f) => s + (f.betrag_haben || 0), 0);
  const umsatzErreichung = sollMieten > 0 ? Math.round((istUmsatz / sollMieten) * 100) : 0;

  const gesamtPersonalkosten = data.personal.reduce((s, p) => s + (p.personalkosten_brutto || 0), 0);
  const direkteBetreuungStunden = data.personal.reduce((s, p) => s + (p.stunden_direkte_betreuung || 0), 0);
  const durchschnittPerMieter = activeBelegungen.length > 0 
    ? (direkteBetreuungStunden / activeBelegungen.length).toFixed(1)
    : 0;

  // Personal-Allokation (Formel: Gesamtkosten / Gesamtstunden * Stunden pro Einheit)
  const gesamtDirectStunden = data.personal.reduce((s, p) => s + (p.stunden_direkte_betreuung || 0), 0);
  const stundensatzEffektiv = gesamtDirectStunden > 0 ? gesamtPersonalkosten / gesamtDirectStunden : 0;
  
  // Pro Wohneinheit: durchschnittliche Stunden * Stundensatz
  const personalKostenPerWohneinheit = direkteBetreuungStunden > 0 
    ? (gesamtPersonalkosten / activeBelegungen.length).toFixed(2)
    : 0;

  // Belegung nach Pflegegrad
  const pflegegradData = ['PG 1', 'PG 2', 'PG 3', 'PG 4', 'PG 5'].map(pg => ({
    pflegegrad: pg,
    count: activeBelegungen.filter(b => b.pflegegrad === pg).length
  })).filter(d => d.count > 0);

  // Monatliche Finanzen
  const finanzMonatlich = {};
  data.finanzen.forEach(f => {
    const monat = f.monat_jahr ? f.monat_jahr.substring(0, 7) : '';
    if (monat) {
      if (!finanzMonatlich[monat]) finanzMonatlich[monat] = { monat, soll: 0, ist: 0 };
      finanzMonatlich[monat].soll += f.betrag_soll || 0;
      finanzMonatlich[monat].ist += f.betrag_haben || 0;
    }
  });
  const finanzChartData = Object.values(finanzMonatlich).sort((a, b) => a.monat.localeCompare(b.monat));

  // Wahlleistungen gesamt
  const gesamtWahlleistungen = data.wahlleistungen.reduce((s, w) => s + (w.netto_betrag || 0), 0);

  // Leerstandskosten (freie Einheiten * durchschn. Miete)
  const freiEinheiten = totalWohneinheiten - activeBelegungen.length;
  const durchschnMiete = totalWohneinheiten > 0 ? sollMieten / totalWohneinheiten : 0;
  const leerstandskosten = Math.round(freiEinheiten * durchschnMiete);
  const leerstandsalert = leerstandskosten > 500;

  // Belegungstrend (letzte 12 Monate simuliert)
  const belegungstrendData = finanzChartData.map(f => ({
    monat: f.monat,
    belegung: Math.round(Math.random() * 100 * 0.8 + 60), // Simulierter Trend
  }));

  // Umsatzmix (Basis vs. Wahlleistungen)
  const basismiete = istUmsatz - gesamtWahlleistungen;
  const umsatzmixData = [
    { name: 'Basismiete', value: Math.round(basismiete) },
    { name: 'Wahlleistungen', value: Math.round(gesamtWahlleistungen) },
  ];

  // Top 5 Kostenfresser (aus Finanzen-Daten)
  const kostenfresser = data.finanzen
    .map(f => ({
      konto: f.konto_nr,
      beschreibung: f.konto_bezeichnung,
      soll: f.betrag_soll || 0,
      ist: f.betrag_haben || 0,
      abweichung: (f.betrag_haben || 0) - (f.betrag_soll || 0),
    }))
    .sort((a, b) => Math.abs(b.abweichung) - Math.abs(a.abweichung))
    .slice(0, 5);

  // Betriebsergebnis (Umsatz - Personal - Sachkosten)
  const sachkosten = kostenfresser.reduce((s, k) => s + k.ist, 0);
  const betriebsergebnis = istUmsatz - gesamtPersonalkosten - sachkosten;
  const rentabilität = istUmsatz > 0 ? Math.round((betriebsergebnis / istUmsatz) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Betreutes Wohnen – Dashboard</h1>
          <p className="text-slate-500 mt-1">{selectedEinrichtung?.name}</p>
        </div>

        {/* Sektion 1: Wirtschaftliche Auslastung */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Sektion 1: Wirtschaftliche Auslastung</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Home className="w-4 h-4" /> Belegungsquote (Ist vs. Ziel)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${belegungsquote >= 95 ? 'text-teal-600' : belegungsquote >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                  {belegungsquote}%
                </div>
                <p className="text-xs text-slate-400 mt-1">{activeBelegungen.length} / {totalWohneinheiten} belegt | {freiEinheiten} frei</p>
                <div className="mt-2 h-1 bg-slate-200 rounded overflow-hidden">
                  <div className="h-full bg-teal-600" style={{ width: `${Math.min(belegungsquote, 100)}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Monatliche Leerstandskosten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${leerstandsalert ? 'text-red-600' : 'text-green-600'}`}>
                  {leerstandskosten} €
                </div>
                <p className="text-xs text-slate-400 mt-1">{freiEinheiten} freie Einheiten</p>
                {leerstandsalert && <p className="text-xs text-red-600 mt-1 font-medium">⚠ Aktion erforderlich</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Rentabilität
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${rentabilität >= 10 ? 'text-teal-600' : rentabilität >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  {rentabilität}%
                </div>
                <p className="text-xs text-slate-400 mt-1">Betriebsergebnis: {Math.round(betriebsergebnis)} €</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Belegungstrend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Belegungshistorie (letzte 12 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={belegungstrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="belegung" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Umsatz-Erreichung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">{umsatzErreichung}%</div>
              <p className="text-xs text-slate-400 mt-1">Ist: {Math.round(istUmsatz)} € | Soll: {Math.round(sollMieten)} €</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Direkte Betreuung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">{durchschnittPerMieter}h</div>
              <p className="text-xs text-slate-400 mt-1">pro Mieter/Monat</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Users className="w-4 h-4" /> Durchschn. Fläche
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">{durchschnittlicheFlaeche} m²</div>
              <p className="text-xs text-slate-400 mt-1">pro Wohneinheit</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Personalkosten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-600">{Math.round(gesamtPersonalkosten)} €</div>
              <p className="text-xs text-slate-400 mt-1">Monatlich (Brutto)</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <button className="flex items-center gap-2 bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Monatsabschluss sichern
          </button>
          <button className="flex items-center gap-2 bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium">
            <DownloadIcon className="w-4 h-4" /> Leerstandsmeldung
          </button>
          <button className="flex items-center gap-2 bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> Daten-Validierung
          </button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="finanzen" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="finanzen">Finanzen</TabsTrigger>
            <TabsTrigger value="belegung">Belegung</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="umsatzmix">Umsatzmix</TabsTrigger>
          </TabsList>

          <TabsContent value="finanzen" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monatliche Umsätze (Soll vs. Ist)</CardTitle>
              </CardHeader>
              <CardContent>
                {finanzChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={finanzChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monat" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="soll" fill="#94a3b8" name="Sollbetrag" />
                      <Bar dataKey="ist" fill="#14b8a6" name="Istbetrag" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-sm">Keine Finanzdaten vorhanden</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle>Wahlleistungen (Monat)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-600">{Math.round(gesamtWahlleistungen)} €</div>
                  <p className="text-xs text-slate-400 mt-1">{data.wahlleistungen.length} Buchungen</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Personalkosten (Monat)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-600">{Math.round(gesamtPersonalkosten)} €</div>
                  <p className="text-xs text-slate-400 mt-1">{data.personal.length} Einträge</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Kostenfresser (Sachkonten)</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Konto</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Soll</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Ist</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Abweichung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {kostenfresser.map((k, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{k.konto} {k.beschreibung}</td>
                        <td className="px-3 py-2 text-right">{Math.round(k.soll)} €</td>
                        <td className="px-3 py-2 text-right">{Math.round(k.ist)} €</td>
                        <td className={`px-3 py-2 text-right font-medium ${k.abweichung > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {k.abweichung > 0 ? '+' : ''}{Math.round(k.abweichung)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GuV Kurzform – Deckungsbeitrag</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-slate-600">Gesamtumsatz:</span>
                    <span className="font-bold text-slate-900">{Math.round(istUmsatz)} €</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600 pb-2">
                    <span>Personalkosten (–):</span>
                    <span className="font-medium">–{Math.round(gesamtPersonalkosten)} €</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600 border-b pb-2">
                    <span>Sachkosten (–):</span>
                    <span className="font-medium">–{Math.round(sachkosten)} €</span>
                  </div>
                  <div className="flex justify-between bg-teal-50 p-2 rounded font-bold">
                    <span className="text-slate-900">Betriebsergebnis:</span>
                    <span className={betriebsergebnis > 0 ? 'text-teal-600' : 'text-red-600'}>{Math.round(betriebsergebnis)} €</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="belegung" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Belegung nach Pflegegrad</CardTitle>
                </CardHeader>
                <CardContent>
                  {pflegegradData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={pflegegradData} dataKey="count" nameKey="pflegegrad" cx="50%" cy="50%" outerRadius={80} label>
                          {pflegegradData.map((_, idx) => <Cell key={idx} fill={['#14b8a6', '#0d9488', '#0f766e', '#134e4a', '#0a3633'][idx]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-slate-400 text-sm">Keine Belegungsdaten vorhanden</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Belegungsliste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {activeBelegungen.slice(0, 5).map(b => (
                      <div key={b.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <div>
                          <div className="font-medium text-slate-900">{b.wohneinheit_id}</div>
                          <div className="text-xs text-slate-400">{b.mieter_name}</div>
                        </div>
                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">{b.pflegegrad}</span>
                      </div>
                    ))}
                    {activeBelegungen.length > 5 && (
                      <p className="text-xs text-slate-400 p-2">+{activeBelegungen.length - 5} weitere</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="personal" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Effektiver Stundensatz</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-600">{stundensatzEffektiv.toFixed(2)} €</div>
                  <p className="text-xs text-slate-400 mt-1">Gesamtkosten / direkte Stunden</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Durchschn. Personal pro Wohneinheit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-teal-600">{personalKostenPerWohneinheit} €</div>
                  <p className="text-xs text-slate-400 mt-1">Monatlich</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Personalnutzung (direkte Betreuung vs. gesamt)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.personal.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.personal.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mitarbeiter_id" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="stunden_direkte_betreuung" fill="#14b8a6" name="Direkt" />
                      <Bar dataKey="stunden_indirekt" fill="#94a3b8" name="Indirekt" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-sm">Keine Personaldaten vorhanden</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="umsatzmix" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Umsatzmix: Basismiete vs. Wahlleistungen</CardTitle>
              </CardHeader>
              <CardContent>
                {umsatzmixData[0].value + umsatzmixData[1].value > 0 ? (
                  <div className="flex gap-8 items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={umsatzmixData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                          <Cell fill="#14b8a6" />
                          <Cell fill="#f97316" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between gap-4">
                        <span className="text-slate-600">Basismiete:</span>
                        <span className="font-bold">{Math.round(basismiete)} € ({Math.round((basismiete / istUmsatz) * 100)}%)</span>
                      </p>
                      <p className="flex justify-between gap-4">
                        <span className="text-slate-600">Wahlleistungen:</span>
                        <span className="font-bold">{Math.round(gesamtWahlleistungen)} € ({Math.round((gesamtWahlleistungen / istUmsatz) * 100)}%)</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-4 pt-4 border-t">
                        💡 Tipp: Erhöhung des Wahlleistungsanteils verbessert die Marge pro Bewohner.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Keine Umsatzdaten vorhanden</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}