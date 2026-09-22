import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();

    // SSRF protection: only allow Base44 storage URLs
    if (!file_url || typeof file_url !== 'string') {
      return Response.json({ error: 'file_url fehlt' }, { status: 400 });
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(file_url);
    } catch {
      return Response.json({ error: 'Ungültige URL' }, { status: 400 });
    }
    if (parsedUrl.protocol !== 'https:') {
      return Response.json({ error: 'Nur HTTPS-URLs erlaubt' }, { status: 400 });
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    if (!hostname.endsWith('.base44.com') && !hostname.endsWith('.base44.io')) {
      return Response.json({ error: 'URL muss von Base44-Storage stammen' }, { status: 403 });
    }

    const resp = await fetch(file_url);
    const buffer = await resp.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('einstuf')) || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

    // Find header row (contains "Nachname")
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i] || [];
      if (row.some(c => String(c || '').toLowerCase().includes('nachname'))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return Response.json({ error: 'Header-Zeile nicht gefunden' }, { status: 400 });

    const header = rows[headerIdx].map(c => String(c || '').toLowerCase());
    const bereichCol = header.findIndex(c => c === 'bereich');
    if (bereichCol === -1) return Response.json({ error: 'Bereich-Spalte nicht gefunden' }, { status: 400 });

    const pgCol = 1; // Pflegegrad is in the second column

    // Parse data rows — carry forward PG if merged cells leave it blank
    const groups = {};
    let lastPg = null;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const bereichRaw = row[bereichCol];
      if (!bereichRaw) continue;

      const bereich = String(bereichRaw).trim();

      // Determine PG
      const col0 = String(row[0] || '').toLowerCase();
      const pgVal = row[pgCol];
      let pg = null;

      const pgNum = parseInt(String(pgVal), 10);
      if (!isNaN(pgNum) && pgNum >= 1 && pgNum <= 5) {
        pg = pgNum;
        lastPg = pgNum;
      } else if (col0.includes('rüstig') || col0.includes('ruestig')) {
        pg = 'ruestige';
        lastPg = 'ruestige';
      } else if (pgVal === null || pgVal === undefined || pgVal === '') {
        pg = lastPg;
      } else {
        pg = lastPg;
      }

      if (!groups[bereich]) {
        groups[bereich] = { bereich, ruestige: 0, pg0: 0, pg1: 0, pg2: 0, pg3: 0, pg4: 0, pg5: 0, total: 0 };
      }

      if (pg === 'ruestige') {
        groups[bereich].ruestige++;
      } else if (pg === null) {
        groups[bereich].pg0++;
      } else {
        groups[bereich][`pg${pg}`]++;
      }
      groups[bereich].total++;
    }

    return Response.json({ groups: Object.values(groups) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});