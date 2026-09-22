import React from 'react';
import { Printer, BookOpen, LayoutDashboard, Users, BedDouble, Wallet, TrendingUp, Brain, Settings, Cloud, Database, FileText, Shield } from 'lucide-react';
import HandbuchDokumente from '@/components/handbuch/HandbuchDokumente';

const SECTIONS = [
  {
    icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50',
    title: 'Dashboard',
    desc: 'Zentrale Übersicht aller Kennzahlen einer Einrichtung.',
    points: [
      'Belegung: Bewohner vs. Sollplätze mit Ampelsystem (Grün ≥ 95%, Gelb 85–94%, Rot < 85%)',
      'Pflegegradverteilung (PG1–PG5) als Diagramm',
      'Personalbedarf: VK Soll (PeBeM-Schlüssel) vs. VK Ist',
      '§43b Betreuung: 1 Kraft pro X Bewohner',
      'Fachkraftquote in %',
      'Pro Wohnbereich: detaillierte Belegungs- und Personal-Karten',
    ],
  },
  {
    icon: Users, color: 'text-teal-600', bg: 'bg-teal-50',
    title: 'Mitarbeiter',
    desc: 'Verwaltung aller Mitarbeitenden inkl. VK-Berechnung und Fehlzeiten.',
    points: [
      'Mitarbeiterstammdaten: Name, Personalnummer, Kategorie, Tarifgruppe/-stufe, Wochenstunden',
      'Automatische VK-Berechnung: PFK, PHK mit/ohne Ausbildung, Geronto',
      'Gehaltsdaten: Monatsgehalt brutto, Funktionszulagen, SV-AG-Anteil, steuerfreie Zuschläge',
      'Leiharbeiter-Verwaltung mit separaten VK-Feldern',
      'Geringfügig Beschäftigte (GFB) mit eigenen Monatsstunden',
      'Archivierung und Aktiv/Inaktiv-Status',
      'Fehlzeiten-Tab: Erfassung von Krank/Urlaub/Fortbildung/Sonderurlaub mit automatischer Werktagsberechnung',
      'Monatliche Fehlzeiten-Auswertung pro Wohnbereich',
      'Excel-Import für Fehlzeiten (Mapping über Personalnummer/Name)',
    ],
  },
  {
    icon: BedDouble, color: 'text-cyan-600', bg: 'bg-cyan-50',
    title: 'Wohnbereiche',
    desc: 'Belegungsstruktur und Pflegegrade pro Wohnbereich.',
    points: [
      'Belegung pro Pflegegrad (PG0–PG5, Rüstige)',
      'Sollbelegung pro Wohnbereich',
      'Zuordnung von Mitarbeitern zu Wohnbereichen',
      'Bewohner-Import über Excel',
    ],
  },
  {
    icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50',
    title: 'Heimkosten',
    desc: 'Finanzübersicht: Personalkosten, Sachkosten und Vergütung.',
    points: [
      'Monatliche Kosten-Übersicht: Erlöse vs. Personal- und Sachkosten',
      'Gehaltsimport (DATEV) und MediFox-Abrechnung import',
      'Sachkosten-Benchmark: Kosten je Belegungstag',
      'Heimkosten pro Bewohner',
      'Vergütungsvereinbarung (VK-Felder schreibgeschützt für Nutzer)',
    ],
  },
  {
    icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50',
    title: 'Controlling & Sachkosten',
    desc: 'Benchmarking, Budgetierung und Import von Sachkosten.',
    points: [
      'Sachkosten-Dashboard mit monatlichen KPIs',
      'Budget je Kategorie und Belegungstag',
      'Auto-Kategorisierung über Sachkonto-Zuordnungen',
      'Toleranz-Überschreitungen mit Ampel-Status',
      'Sachkosten-Import über Excel mit Duplikatserkennung',
      'Budgetwerte zentral verwalten',
    ],
  },
  {
    icon: Brain, color: 'text-indigo-600', bg: 'bg-indigo-50',
    title: 'KI-Analyse',
    desc: 'Prognose, Alerts, Benchmarking und What-If-Simulator.',
    points: [
      'KI-Prognose: 3-Monats-Forecast für Sachkosten, Personalbedarf und Belegung',
      'Real-time Alerts: Budgetüberschreitung, Belegungsrückgang, Fehlzeiten-Spitzen (stündliche Prüfung)',
      'Cross-Facility Benchmarking: Heatmap aller Einrichtungen mit Filter nach Bereich (stationär, Tagespflege, etc.)',
      'Direktvergleich zweier Einrichtungen mit Differenz-Analyse',
      'Prognose-Tool: Interaktive What-If-Szenarien (Belegung, Fehlzeiten, Sachkosten)',
    ],
  },
  {
    icon: Cloud, color: 'text-blue-600', bg: 'bg-blue-50',
    title: 'OneDrive Auto-Import',
    desc: 'Automatischer Datenimport aus SharePoint (alle 10 Minuten).',
    points: [
      'Automatischer Scan aller 10 Minuten',
      'Einrichtungserkennung anhand des Ordnernamens (Nummern-Präfix wird entfernt)',
      'Deduplizierung über Dateiname + Einrichtung + Bereich',
      'Import-Protokoll mit Status (Erfolg/Fehler/Übersprungen)',
    ],
  },
  {
    icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50',
    title: 'Einstellungen',
    desc: 'Zentrale Konfiguration aller Parameter.',
    points: [
      'Einrichtungen anlegen/bearbeiten: PeBeM-Schlüssel, Personalmodell, Vollzeitstunden',
      'Vergütungsparameter und Sollvorgaben pro VK',
      'Export-Einstellungen (Monatsabschluss)',
      'SharePoint-Verbindung und OneDrive-Status',
    ],
  },
  {
    icon: Shield, color: 'text-rose-600', bg: 'bg-rose-50',
    title: 'Admin',
    desc: 'Datenverwaltung und Änderungsprotokoll.',
    points: [
      'Datenverwaltung: Einrichtungen, Wohnbereiche, Mitarbeiter verwalten',
      'Änderungsprotokoll: alle create/update/delete-Aktionen nachvervollbar',
      'Benutzer-Verwaltung (Admin-Rolle)',
    ],
  },
];

const FOLDER_STRUCTURE = [
  { folder: 'Export Bewohner mit Einstufungen', target: 'Bewohner-Pflegegrade' },
  { folder: 'Export Gehaltsbestandteile', target: 'Mitarbeiter (Gehalt)' },
  { folder: 'Export SV-Anteile', target: 'Mitarbeiter (SV-AG)' },
  { folder: 'Export Mitarbeiter MediFox', target: 'Mitarbeiter (MediFox)' },
  { folder: 'Export Fehlzeiten', target: 'Fehlzeiten' },
  { folder: 'Export MediFox-Abrechnung', target: 'MediFox-Abrechnung' },
  { folder: 'Export Bewohner-Kosten', target: 'Bewohner-Kosten' },
  { folder: 'Export Kontoblatt', target: 'Kontoblatt' },
  { folder: 'Export Lebensmittel', target: 'Sachkosten' },
  { folder: 'Export Pflegebedarf', target: 'Sachkosten' },
  { folder: 'Export Wäscherei', target: 'Sachkosten' },
];

export default function Handbuch() {
  const handlePrint = () => window.print();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:py-0 print:px-0">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white print:bg-slate-800 print:rounded-none mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Noventus Care – Benutzerhandbuch</h1>
              <p className="text-sm text-slate-300">Digitale Schnittstelle für Finanz- und Betriebskennzahlen</p>
            </div>
          </div>
          <button onClick={handlePrint} className="hidden print:hidden flex items-center gap-2 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg text-sm font-medium">
            <Printer className="w-4 h-4" /> Drucken / PDF
          </button>
        </div>
      </div>

      {/* Dokumente & PDFs */}
      <HandbuchDokumente />

      {/* Einleitung */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Über diese Anwendung</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Noventus Care bündelt alle relevanten Finanz- und Betriebskennzahlen Ihrer Einrichtungen in einer zentralen Plattform.
          Von der Mitarbeiterverwaltung über Belegungsanalyse und Sachkosten-Benchmarking bis hin zur KI-gestützten Prognose –
          alle Module sind miteinander verknüpft und werden durch automatisierte OneDrive-Importe aktuell gehalten.
        </p>
      </div>

      {/* Module */}
      <div className="space-y-4 mb-6">
        {SECTIONS.map((sec, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden print:break-inside-avoid">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-50">
              <div className={`w-9 h-9 rounded-lg ${sec.bg} flex items-center justify-center`}>
                <sec.icon className={`w-5 h-5 ${sec.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{sec.title}</h3>
                <p className="text-xs text-slate-500">{sec.desc}</p>
              </div>
            </div>
            <div className="px-5 py-3">
              <ul className="space-y-1.5">
                {sec.points.map((pt, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-slate-300 mt-0.5">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* OneDrive Ordnerstruktur */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 print:break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">OneDrive / SharePoint-Ordnerstruktur</h2>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Lege Dateien in den entsprechenden Ordnern ab. Der automatische Scan (alle 10 Min.) importiert sie.
          Das Nummern-Präfix (01, 02 …) wird automatisch entfernt.
        </p>
        <pre className="text-xs text-slate-600 font-mono leading-relaxed bg-slate-50 rounded-lg p-3 overflow-x-auto mb-3">
{`2. 0 Dashboard Synchronisation  ← Root
  └── {NN} {Einrichtungsname}/`}
        </pre>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Ordnername</th>
              <th className="px-3 py-2 font-medium text-slate-600">Import-Ziel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {FOLDER_STRUCTURE.map((f, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{f.folder}/</td>
                <td className="px-3 py-2 text-slate-500">{f.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rollen & Berechtigungen */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 print:break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-rose-600" />
          <h2 className="text-sm font-semibold text-slate-900">Rollen & Berechtigungen</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-rose-50 rounded-lg p-3">
            <p className="text-sm font-medium text-rose-700 mb-1">Admin</p>
            <p className="text-xs text-slate-600">Voller Zugriff auf alle Einrichtungen. Kann Datensätze aller Nutzer erstellen, bearbeiten und löschen. Benutzer einladen und verwalten.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-700 mb-1">Benutzer</p>
            <p className="text-xs text-slate-600">Kann eigene Datensätze erstellen und bearbeiten. Lesender Zugriff auf alle Daten. VK-Felder (PFK, PHK) sind schreibgeschützt.</p>
          </div>
        </div>
      </div>

      {/* Tipps */}
      <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 print:break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-900">Praktische Tipps</h2>
        </div>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li className="flex items-start gap-2"><span className="text-amber-400">→</span> Formulare: Enter-Taste springt zum nächsten Feld – schnelleres Ausfüllen ohne Maus.</li>
          <li className="flex items-start gap-2"><span className="text-amber-400">→</span> Im KI-Benchmark: Filter auf „stationär", „tagespflege" oder „betreutes_wohnen" setzen.</li>
          <li className="flex items-start gap-2"><span className="text-amber-400">→</span> Fehlzeiten-Import: Excel muss Personalnummer oder Namen enthalten für automatisches Mapping.</li>
          <li className="flex items-start gap-2"><span className="text-amber-400">→</span> Alerts können einzeln oder alle gleichzeitig quittiert werden.</li>
          <li className="flex items-start gap-2"><span className="text-amber-400">→</span> Archivierte Datensätze sind ausgeblendet, bleiben aber über Admin wiederherstellbar.</li>
        </ul>
      </div>
    </div>
  );
}