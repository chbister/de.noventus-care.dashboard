import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url erforderlich' }, { status: 400 });

    // Excel herunterladen und parsen
    const resp = await fetch(file_url);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    // Header-Zeile finden (enthält "Datum")
    let headerIdx = -1;
    let dateCol = -1;
    let sollCol = -1;
    let habenCol = -1;
    let buchungstextCol = -1;

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const cells = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
      for (let j = 0; j < cells.length; j++) {
        if (cells[j] === 'datum') { dateCol = j; headerIdx = i; }
        if (cells[j] === 'umsatz soll') sollCol = j;
        if (cells[j] === 'umsatz haben') habenCol = j;
        if (cells[j] === 'buchungstext') buchungstextCol = j;
      }
    }

    if (headerIdx === -1 || dateCol === -1) {
      return Response.json({ error: 'Kontoblatt-Struktur nicht erkannt (Spalte "Datum" nicht gefunden)' }, { status: 400 });
    }

    // Account-Name aus Titel extrahieren
    let accountName = wb.SheetNames[0] || '';
    for (let i = 0; i <= headerIdx; i++) {
      const cells = (rows[i] || []).map(c => String(c || ''));
      for (const cell of cells) {
        const m = cell.match(/Monatskonto\s+(\d+)\s+(.+)/i);
        if (m) { accountName = `${m[1]} ${m[2]}`.trim(); }
      }
    }

    // Daten nach Monat gruppieren
    const monthlySums = {};

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const dateVal = row[dateCol];
      if (!dateVal) continue;

      // Datum parsen (DD.MM.YYYY als String oder Date-Objekt)
      let month = null;
      if (typeof dateVal === 'string') {
        const m = dateVal.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (m) month = `${m[3]}-${m[2]}`;
      } else if (dateVal instanceof Date) {
        month = `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!month) continue;

      // Betrag: Umsatz Soll - Umsatz Haben
      let soll = 0;
      let haben = 0;
      if (sollCol >= 0 && row[sollCol] != null) soll = parseFloat(row[sollCol]) || 0;
      if (habenCol >= 0 && row[habenCol] != null) haben = parseFloat(row[habenCol]) || 0;
      const betrag = soll - haben;

      if (!monthlySums[month]) {
        monthlySums[month] = { monat: month, gesamtbetrag: 0, anzahl: 0, buchungen: [] };
      }
      monthlySums[month].gesamtbetrag += betrag;
      monthlySums[month].anzahl++;
      if (buchungstextCol >= 0 && row[buchungstextCol]) {
        monthlySums[month].buchungen.push(String(row[buchungstextCol]).trim());
      }
    }

    const months = Object.values(monthlySums).map(m => ({
      monat: m.monat,
      gesamtbetrag: Math.round(m.gesamtbetrag * 100) / 100,
      anzahl: m.anzahl,
      buchungen: m.buchungen,
    })).sort((a, b) => a.monat.localeCompare(b.monat));

    return Response.json({ success: true, accountName, months });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});