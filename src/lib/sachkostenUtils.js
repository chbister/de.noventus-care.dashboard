// Hilfsfunktionen für Sachkosten-Benchmark

export const round2 = (n) => Math.round((n || 0) * 100) / 100;

export const formatEUR = (n) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export const formatProzent = (n) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n || 0) + ' %';

export const formatDateDE = (str) => {
  if (!str) return '—';
  if (str.length === 7) return str.replace('-', '.'); // YYYY-MM -> YYYY.MM
  const [y, m, d] = str.split('-');
  if (y && m && d) return `${d}.${m}.${y}`;
  return str;
};

export const daysInMonth = (monat, jahr) => new Date(jahr, monat, 0).getDate();

export const parseLocalDate = (str) => {
  if (!str) return null;
  if (str.length === 7) {
    const [y, m] = str.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  const parts = str.split('-').map(Number);
  if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  return null;
};

// Belegungstage pro Bewohner berechnen
export const calculateBelegungstage = (einzugStr, auszugStr, monat, jahr) => {
  const firstDay = new Date(jahr, monat - 1, 1);
  const lastDay = new Date(jahr, monat, 0);
  const einzug = einzugStr ? parseLocalDate(einzugStr) : firstDay;
  const auszug = auszugStr ? parseLocalDate(auszugStr) : lastDay;
  if (!einzug) return 0;
  const start = einzug > firstDay ? einzug : firstDay;
  const end = auszug && auszug < lastDay ? auszug : lastDay;
  if (start > end) return 0;
  return Math.floor((end - start) / 86400000) + 1;
};

export const STATUS_STYLES = {
  im_soll: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200', label: 'Im Soll' },
  toleranzbereich: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-200', label: 'Toleranzbereich' },
  ueber_budget: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200', label: 'Über Budget' },
  unvollstaendig: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', border: 'border-slate-200', label: 'Unvollständig' },
};

export const getStatus = (istkosten, sollbudget, toleranzProzent) => {
  if (!sollbudget || sollbudget <= 0) return 'unvollstaendig';
  if (istkosten <= sollbudget) return 'im_soll';
  const toleranzBetrag = sollbudget * ((toleranzProzent || 0) / 100);
  if (istkosten <= sollbudget + toleranzBetrag) return 'toleranzbereich';
  return 'ueber_budget';
};

// Gültigen Budgetwert finden
export const findBudgetwert = (budgetwerte, kategorieId, einrichtungId, wohnbereichId, monat, jahr) => {
  const refDate = new Date(jahr, monat - 1, 15);
  return budgetwerte.find(b => {
    if (b.kategorie_id !== kategorieId) return false;
    if (b.einrichtung_id !== einrichtungId) return false;
    if (wohnbereichId) {
      if (b.wohnbereich_id && b.wohnbereich_id !== wohnbereichId) return false;
    } else {
      if (b.wohnbereich_id) return false;
    }
    const ab = b.gueltig_ab ? parseLocalDate(b.gueltig_ab) : null;
    const bis = b.gueltig_bis ? parseLocalDate(b.gueltig_bis) : null;
    if (ab && ab > refDate) return false;
    if (bis && bis < refDate) return false;
    return true;
  });
};

// Sachkonto einer Kategorie zuordnen
export const categorizeSachkonto = (sachkonto, zuordnungen) => {
  if (!sachkonto) return null;
  const s = String(sachkonto).trim();
  const exakt = zuordnungen.find(z => z.aktiv && z.sachkonto_exakt && String(z.sachkonto_exakt).trim() === s);
  if (exakt) return exakt.kategorie_id;
  const range = zuordnungen.find(z => {
    if (!z.aktiv || !z.sachkonto_von) return false;
    const von = String(z.sachkonto_von).trim();
    const bis = z.sachkonto_bis ? String(z.sachkonto_bis).trim() : von;
    return s >= von && s <= bis;
  });
  return range ? range.kategorie_id : null;
};

export const computeBuchungsschluessel = (row) =>
  `${row.buchungsdatum}|${row.belegnummer || ''}|${row.sachkonto || ''}|${row.nettobetrag || 0}|${row.lieferant || ''}`;

// Komplette Dashboard-Berechnung
export const computeDashboard = (kategorien, budgetwerte, ausgaben, belegungstage, monat, jahr, einrichtungId, wohnbereichId, kostenstelleFilter) => {
  const activeKategorien = kategorien.filter(k => k.aktiv).sort((a, b) => (a.sortierung || 0) - (b.sortierung || 0));

  const kategorieErgebnisse = activeKategorien.map(kat => {
    const bw = findBudgetwert(budgetwerte, kat.id, einrichtungId, wohnbereichId, monat, jahr);
    const betragJeBelegungstag = bw?.betrag_je_belegungstag || 0;
    const sollbudget = round2(belegungstage * betragJeBelegungstag);
    let filtered = ausgaben.filter(a => a.kategorie_id === kat.id && !a.ist_storniert);
    if (kostenstelleFilter) filtered = filtered.filter(a => a.kostenstelle === kostenstelleFilter);
    const istkosten = round2(filtered.reduce((s, a) => s + (a.verwendeter_betrag || 0), 0));
    const restbudget = round2(sollbudget - istkosten);
    const abweichung = round2(istkosten - sollbudget);
    const budgetverbrauchProzent = sollbudget > 0 ? round2((istkosten / sollbudget) * 100) : 0;
    const ueberschreitungProzent = sollbudget > 0 && abweichung > 0 ? round2((abweichung / sollbudget) * 100) : 0;
    const status = getStatus(istkosten, sollbudget, kat.toleranz_prozent);
    return { id: kat.id, name: kat.name, betragJeBelegungstag, belegungstage, sollbudget, istkosten, restbudget, abweichung, budgetverbrauchProzent, ueberschreitungProzent, status, anzahlBuchungen: filtered.length };
  });

  const sollbudgetGesamt = round2(kategorieErgebnisse.reduce((s, k) => s + k.sollbudget, 0));
  const istkostenGesamt = round2(kategorieErgebnisse.reduce((s, k) => s + k.istkosten, 0));
  const restbudgetGesamt = round2(sollbudgetGesamt - istkostenGesamt);
  const budgetverbrauchGesamt = sollbudgetGesamt > 0 ? round2((istkostenGesamt / sollbudgetGesamt) * 100) : 0;
  const nichtZugeordnet = ausgaben.filter(a => a.zuordnungsstatus === 'offen' && !a.ist_storniert).length;

  return {
    kpi: { belegungstage, sollbudgetGesamt, istkostenGesamt, restbudgetGesamt, budgetverbrauchGesamt, nichtZugeordnet },
    kategorien: kategorieErgebnisse,
  };
};

export const MONATE_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];