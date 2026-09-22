import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';
import { parseNum, parseDate, parseMonat } from '../../shared/excelUtils.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url erforderlich' }, { status: 400 });

    const resp = await fetch(file_url);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    // Header-Zeile finden (enthält "Buchungsdatum" oder "Datum")
    let headerIdx = -1;
    const colMap = {};

    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
      for (let j = 0; j < cells.length; j++) {
        const h = cells[j];
        if (!h) continue;
        if ((h === 'buchungsdatum' || h === 'datum' || h === 'buchungstag') && colMap.buchungsdatum === undefined) { colMap.buchungsdatum = j; headerIdx = i; }
        if ((h === 'leistungsmonat' || h === 'monat' || h.includes('leistungszeitraum')) && colMap.leistungsmonat === undefined) colMap.leistungsmonat = j;
        if ((h === 'belegnummer' || h === 'beleg' || h === 'belegfeld1' || h.includes('belegfeld')) && colMap.belegnummer === undefined) colMap.belegnummer = j;
        if ((h === 'lieferant' || h === 'empfänger' || h === 'empfaenger' || h === 'name') && colMap.lieferant === undefined) colMap.lieferant = j;
        if ((h === 'sachkonto' || h === 'konto') && colMap.sachkonto === undefined) colMap.sachkonto = j;
        if ((h === 'kostenstelle' || h === 'kst' || h === 'kost1' || h === 'kost2') && colMap.kostenstelle === undefined) colMap.kostenstelle = j;
        if ((h === 'buchungstext' || h === 'text' || h === 'verwendungszweck') && colMap.buchungstext === undefined) colMap.buchungstext = j;
        if ((h === 'nettobetrag' || h === 'netto' || h === 'umsatz soll') && colMap.nettobetrag === undefined) colMap.nettobetrag = j;
        if ((h === 'bruttobetrag' || h === 'brutto') && colMap.bruttobetrag === undefined) colMap.bruttobetrag = j;
      }
    }

    if (headerIdx === -1 || colMap.buchungsdatum === undefined) {
      return Response.json({ error: 'Excel-Struktur nicht erkannt (Spalte "Buchungsdatum" oder "Datum" nicht gefunden)' }, { status: 400 });
    }

    // Sachkonto aus Kontoblatt-Titel extrahieren (z.B. "Monatskonto 6510000 Getränke")
    let titleSachkonto = '';
    let titleAccountName = '';
    for (let i = 0; i <= headerIdx; i++) {
      const cells = (rows[i] || []).map(c => String(c || ''));
      for (const cell of cells) {
        const m = cell.match(/Monatskonto\s+(\d+)\s*(.*)/i);
        if (m) { titleSachkonto = m[1]; titleAccountName = (m[2] || '').trim(); break; }
      }
      if (titleSachkonto) break;
    }

    // Datenzeilen extrahieren
    const dataRows = [];
    let lastLieferant = '';

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const buchungsdatum = colMap.buchungsdatum !== undefined ? parseDate(row[colMap.buchungsdatum]) : '';
      if (!buchungsdatum) continue;

      // Summenzeilen überspringen
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell.includes('summe') || firstCell.includes('gesamt') || firstCell.includes('total') || firstCell.includes('abschluss')) continue;

      let leistungsmonat = colMap.leistungsmonat !== undefined ? parseMonat(row[colMap.leistungsmonat]) : '';
      if (!leistungsmonat && buchungsdatum.length >= 7) {
        leistungsmonat = buchungsdatum.substring(0, 7);
      }

      const lieferant = colMap.lieferant !== undefined ? String(row[colMap.lieferant] || '').trim() : '';
      if (lieferant) lastLieferant = lieferant;

      const buchungstext = colMap.buchungstext !== undefined ? String(row[colMap.buchungstext] || '').trim() : '';
      const sachkonto = colMap.sachkonto !== undefined ? String(row[colMap.sachkonto] || '').trim() : titleSachkonto;
      const kostenstelle = colMap.kostenstelle !== undefined ? String(row[colMap.kostenstelle] || '').trim() : '';
      const belegnummer = colMap.belegnummer !== undefined ? String(row[colMap.belegnummer] || '').trim() : '';

      let netto = colMap.nettobetrag !== undefined ? parseNum(row[colMap.nettobetrag]) : 0;
      let brutto = colMap.bruttobetrag !== undefined ? parseNum(row[colMap.bruttobetrag]) : 0;
      if (netto === 0 && brutto > 0) netto = brutto;
      if (brutto === 0 && netto > 0) brutto = netto;

      const finalLieferant = lieferant || buchungstext || lastLieferant;
      if (finalLieferant) lastLieferant = finalLieferant;

      dataRows.push({
        buchungsdatum,
        leistungsmonat,
        belegnummer,
        lieferant: finalLieferant,
        sachkonto,
        kostenstelle,
        buchungstext: buchungstext || finalLieferant,
        nettobetrag: Math.round(netto * 100) / 100,
        bruttobetrag: Math.round(brutto * 100) / 100,
      });
    }

    return Response.json({ success: true, rows: dataRows, totalRows: dataRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});