import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';
import { parseNum, parseDate } from '../../shared/excelUtils.ts';

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

    // WB-Blätter finden (Namen enthalten "WB")
    const wbSheets = wb.SheetNames.filter(n => /WB\s*\d/i.test(n));

    const allRows = [];

    for (const sheetName of wbSheets) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

      // Header-Zeile finden (enthält "Name" und "Berufsbezeichnung")
      let headerIdx = -1;
      let colMap = {};
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const cells = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
        const findCol = (test) => cells.findIndex(h => h && test(h));
        const nameIdx = findCol(h => h === 'name, vorname' || h === 'name' || (h.includes('name') && !h.includes('vor')));
        const berufIdx = findCol(h => h.includes('beruf'));
        if (nameIdx >= 0 && berufIdx >= 0) {
          headerIdx = i;
          colMap = {
            name: nameIdx,
            pnr: findCol(h => h.includes('pnr') || h.includes('pers.nr') || h.includes('personalnr')),
            beruf: berufIdx,
            funktion: findCol(h => h === 'funktion' || h.includes('funktion')),
            vkPfk: findCol(h => h.includes('pfk') && h.includes('stell') || (h.includes('stellenant') && h.includes('pfk'))),
            vkPhk: findCol(h => h.includes('phk') && (h.includes('stell') || h.includes('stellenant'))),
            std: findCol(h => h.includes('std') && h.includes('wo') || h === 'std./ wo.'),
            eintritt: findCol(h => h.includes('eintritt')),
            austritt: findCol(h => h.includes('austritt')),
            behinderung: findCol(h => h.includes('behinder')),
          };
          break;
        }
      }

      if (headerIdx === -1) continue;

      // Wohnbereich-Name aus Sheet-Name normalisieren ("WB 1", " WB 3" → "WB 1", "WB 3")
      const wbName = String(sheetName).trim().replace(/\s+/g, ' ');

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const name = colMap.name >= 0 ? String(row[colMap.name] || '').trim() : '';
        if (!name) continue;
        // Summenzeilen überspringen
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell.includes('summe') || firstCell.includes('gesamt')) continue;

        const beruf = colMap.beruf >= 0 ? String(row[colMap.beruf] || '').trim() : '';
        const vkPfk = colMap.vkPfk >= 0 ? parseNum(row[colMap.vkPfk]) : 0;
        const vkPhk = colMap.vkPhk >= 0 ? parseNum(row[colMap.vkPhk]) : 0;
        const std = colMap.std >= 0 ? Math.round(parseNum(row[colMap.std]) * 4) / 4 : 0;

        allRows.push({
          wohnbereich: wbName,
          name,
          personalnummer: colMap.pnr >= 0 ? String(row[colMap.pnr] || '').trim() : '',
          berufsbezeichnung: beruf,
          funktion: colMap.funktion >= 0 ? String(row[colMap.funktion] || '').trim() : '',
          vk_pfk: vkPfk,
          vk_phk: vkPhk,
          wochenstunden: std,
          eintrittsdatum: colMap.eintritt >= 0 ? parseDate(row[colMap.eintritt]) : '',
          befristet_bis: colMap.austritt >= 0 ? parseDate(row[colMap.austritt]) : '',
          behinderung: colMap.behinderung >= 0 ? String(row[colMap.behinderung] || '').trim() : '',
        });
      }
    }

    return Response.json({ success: true, rows: allRows, total: allRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});