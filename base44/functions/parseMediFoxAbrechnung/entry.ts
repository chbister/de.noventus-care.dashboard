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
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

    // Header-Zeile finden (enthält "Jahr" und "Abkürzung")
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const cells = (rows[i] || []).map(c => String(c || '').toLowerCase());
      if (cells.some(c => c.includes('jahr')) &&
          cells.some(c => c.includes('abkürz') || c.includes('abkurz'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return Response.json({ error: 'Header-Zeile nicht gefunden (Jahr/Abkürzung erwartet)' }, { status: 400 });
    }

    const headers = (rows[headerIdx] || []).map(c => String(c || '').toLowerCase().trim());

    // Spalten zuordnen
    const col = {};
    headers.forEach((h, idx) => {
      if (h.includes('jahr')) col.jahr = idx;
      else if (h.includes('monat')) col.monat = idx;
      else if (h.includes('abkürz') || h.includes('abkurz')) col.abkuerzung = idx;
      else if (h.includes('bezeichnung')) col.bezeichnung = idx;
      else if (h.includes('leistungsgruppe')) col.leistungsgruppe = idx;
      else if (h.includes('einzelpreis')) col.einzelpreis = idx;
      else if (h.includes('abger') && h.includes('anzahl')) col.anzahl = idx;
      else if (h.includes('abger') && h.includes('betrag')) col.betrag = idx;
    });

    // Zeitraum suchen (z.B. "01.07.2026 - 31.07.2026")
    let zeitraum = '';
    for (let i = 0; i < headerIdx; i++) {
      const cells = (rows[i] || []).map(c => String(c || ''));
      for (let j = 0; j < cells.length; j++) {
        if (cells[j].toLowerCase().includes('zeitraum')) {
          zeitraum = cells[j + 1] || '';
          break;
        }
      }
      if (zeitraum) break;
    }

    let zeitraumVon = '';
    let zeitraumBis = '';
    if (zeitraum) {
      const parseDate = (s) => {
        const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
      };
      const parts = zeitraum.split('-').map(s => s.trim());
      if (parts.length >= 2) {
        zeitraumVon = parseDate(parts[0]);
        zeitraumBis = parseDate(parts[1]);
      }
    }

    // Datenzeilen extrahieren
    const dataRows = [];
    let lastJahr = 0;
    let lastMonat = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const jahrVal = col.jahr !== undefined ? Number(row[col.jahr]) : 0;
      const monatVal = col.monat !== undefined ? Number(row[col.monat]) : 0;
      const abkuerzung = col.abkuerzung !== undefined ? String(row[col.abkuerzung] || '').trim() : '';

      // Leere Zeilen überspringen
      if (!abkuerzung && !jahrVal && !monatVal) continue;
      // Summen-Zeilen überspringen
      const abkLower = abkuerzung.toLowerCase();
      if (abkLower.includes('summe') || abkLower.includes('gesamt') || abkLower.includes('total')) continue;

      // Jahr/Monat für verbundene Zellen übernehmen
      if (jahrVal) lastJahr = jahrVal;
      if (monatVal) lastMonat = monatVal;

      dataRows.push({
        jahr: jahrVal || lastJahr,
        monat: monatVal || lastMonat,
        abkuerzung,
        bezeichnung: String(col.bezeichnung !== undefined ? row[col.bezeichnung] || '' : '').trim(),
        leistungsgruppe: String(col.leistungsgruppe !== undefined ? row[col.leistungsgruppe] || '' : '').trim() || 'Ohne Angabe',
        einzelpreis: Number(col.einzelpreis !== undefined ? row[col.einzelpreis] : 0) || 0,
        abger_anzahl: Number(col.anzahl !== undefined ? row[col.anzahl] : 0) || 0,
        abger_betrag: Number(col.betrag !== undefined ? row[col.betrag] : 0) || 0,
      });
    }

    return Response.json({
      success: true,
      zeitraum_von: zeitraumVon,
      zeitraum_bis: zeitraumBis,
      rows: dataRows,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});