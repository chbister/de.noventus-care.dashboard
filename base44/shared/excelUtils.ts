// Gemeinsame Excel-Parsing-Hilfsfunktionen für alle Excel-Parser-Funktionen.
// Nur reine Funktionen — kein Deno.serve, keine Side-Effects.

// Parst deutsche Zahlenformate ("1.234,56" → 1234.56, "3,5" → 3.5).
export function parseNum(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  let s = String(val).trim().replace(/[^\d,.-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    // Deutsches Tausenderformat: Punkte entfernen, Komma → Punkt
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Parst Datumswerte aus Excel (Date-Objekt, "yyyy-mm-dd", "dd.mm.yyyy").
// Gibt ISO-String "yyyy-mm-dd" oder bei unerkannten Werten den Original-String zurück.
export function parseDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  const m1 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return s;
}

// Parst Leistungsmonate ("2024-05", "05.2024", "01.05.2024" → "yyyy-mm").
export function parseMonat(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/(\d{4})-(\d{2})/);
  if (m) return m[0];
  const m2 = s.match(/(\d{2})\.(\d{4})/);
  if (m2) return `${m2[2]}-${m2[1]}`;
  const m3 = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m3) return `${m3[3]}-${m3[2]}`;
  return s;
}