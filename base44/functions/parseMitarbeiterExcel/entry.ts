import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { file_url, mode } = body;
    const isMedifox = mode === 'medifox';
    if (!file_url) return Response.json({ error: 'file_url erforderlich' }, { status: 400 });

    const resp = await fetch(file_url);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    // Spalten-Patterns (Reihenfolge wichtig: spezifische vor allgemeinen)
    const colPatterns = [
      { key: 'personalnummer', test: (h) => h === 'personalnummer' || h === 'pers.nr.' || h === 'pers.nr' || h === 'pers.-nr.' || h === 'pers.-nr' || h === 'pnr' || h === 'personal-nr.' || h === 'personalnr.' || h.includes('personalnr') || h.includes('personal-nr') || (h.includes('pers') && h.includes('nr')) || h === 'mitarbeiternr.' || h === 'mitarbeiternummer' || h === 'ma-nr.' || h === 'ma-nr' || h === 'personalnummer' },
      { key: 'name', test: (h) => h === 'name' || h === 'nachname' || h.includes('nachname') || h === 'name, vorname' || h === 'mitarbeiter' || (h.includes('name') && !h.includes('vorname')) || h === 'nachname, vorname' },
      { key: 'vorname', test: (h) => h === 'vorname' || h.includes('vorname') },
      // GfB vor Wochenstunden (spezifischer) — MediFox: "Arbeitszeit pro Monat"
      { key: 'monatsstunden_gfb', test: (h) => (h.includes('monatsstunden') && h.includes('gfb')) || h === 'gfb' || h.includes('gfb') || (h.includes('geringfüg') && h.includes('stund')) || (h.includes('minijob') && h.includes('stund')) || (h.includes('arbeitszeit') && h.includes('monat')) },
      { key: 'wochenstunden', test: (h) => h === 'wochenstunden' || h === 'wstd' || h === 'w-std' || h === 'wstd.' || h.includes('wochenstund') || h.includes('wochenarbeitszeit') || (h.includes('arbeitszeit') && h.includes('woche')) || h === 'faktor' || h.includes('regulär') || h === 'std/wo' || h === 'std./wo.' },
      { key: 'stellenumfang_prozent', test: (h) => h.includes('stellenumfang') || (h.includes('stelle') && h.includes('umfang')) || h.includes('beschäftigungsumfang') },
      { key: 'tarif', test: (h) => h === 'tarif' || h === 'tarifgruppe' || h === 'tg' || h.includes('tarifgruppe') || h === 'eg' || h === 'entgeltgruppe' || h.includes('entgeltgruppe') || h.includes('vergütungsgruppe') || h.includes('verguetungsgruppe') },
      { key: 'tarifstufe', test: (h) => h === 'tarifstufe' || h === 'ts' || h === 'stufe' || h.includes('tarifstuf') || h.includes('entgeltstuf') || h === 'estufe' || h.includes('vergütungsstuf') },
      { key: 'funktion', test: (h) => h === 'funktion' || h.includes('funktion') || h === 'tätigkeit' || h.includes('tätigkeit') },
      { key: 'beruf', test: (h) => h === 'beruf' || h.includes('beruf') || h === 'berufsbezeichnung' || h.includes('berufsbezeichnung') || h === 'qualifikation' || h.includes('qualifikation') },
      { key: 'wohnbereich', test: (h) => h === 'wohnbereich' || h.includes('wohnbereich') || h === 'bereich' || h === 'abteilung' },
      { key: 'eintrittsdatum', test: (h) => h.includes('eintritt') },
      { key: 'befristet_bis', test: (h) => h.includes('befristet') || (h.includes('beschäft') && h.includes('bis')) },
      // Steuerfrei vor Zulagen (spezifischer)
      { key: 'zuschlaege_steuerfrei', test: (h) => h.includes('steuerfrei') || (h.includes('steuer') && h.includes('frei')) || (h.includes('sonn') && h.includes('feiertag')) || h.includes('nachtzuschlag') || h.includes('sonn-/feiertag') || h.includes('sonn feiertag') },
      { key: 'funktionszulagen', test: (h) => h === 'zulage' || h === 'funktionszulage' || h === 'zulagen' || h === 'funktionszulagen' || h.includes('funktionszul') || h.includes('zulag') },
      { key: 'sv_ag_anteil', test: (h) => { if (h.includes('ohne')) return false; return (h.includes('sv') && h.includes('ag')) || h.includes('ag-anteil') || h.includes('ag anteil') || (h.includes('sozialvers') && h.includes('ag')) || h.includes('sozialversicherung') && h.includes('ag') || h.includes('arbeitgeberanteil') || h.includes('arbeitgeber') || h.includes('ag-anteil sv') || h.includes('ag sv') || h === 'sv-ag' || h === 'ag-sv'; } },
      { key: 'monatsgehalt_brutto', test: (h) => h === 'brutto' || h === 'gesamtbrutto' || h === 'bruttoentschädigung' || h === 'bruttobetrag' || h === 'brutto-bezug' || h.includes('bruttobezug') || h.includes('brutto-bezug') || h.includes('bruttoarbeitslohn') || h.includes('brutto') },
    ];

    // Header-Zeile finden: die Zeile mit den meisten Spalten-Matches
    let headerIdx = -1;
    let bestScore = 0;
    let colMap = {};

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const cells = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
      const rowCols = {};
      let score = 0;
      for (let j = 0; j < cells.length; j++) {
        const h = cells[j];
        if (!h) continue;
        for (const p of colPatterns) {
          if (rowCols[p.key] === undefined && p.test(h)) {
            rowCols[p.key] = j;
            score++;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        headerIdx = i;
        colMap = rowCols;
      }
    }

    if (headerIdx === -1 || colMap.name === undefined) {
      return Response.json({ error: 'Header-Zeile nicht gefunden (Spalte "Name" oder "Personalnummer" nicht erkannt)' }, { status: 400 });
    }

    const parseNum = (val) => {
      if (val == null) return 0;
      if (typeof val === 'number') return val;
      let s = String(val).trim().replace(/[^\d,.-]/g, '');
      // Deutsches Format: "1.234,56" → Punkte entfernen, Komma → Punkt
      if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    const parseDate = (val) => {
      if (!val) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      const s = String(val).trim();
      const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      const m2 = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
      return '';
    };

    // Datenzeilen extrahieren
    const dataRows = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const nachname = colMap.name !== undefined ? String(row[colMap.name] || '').trim() : '';
      const vorname = colMap.vorname !== undefined ? String(row[colMap.vorname] || '').trim() : '';
      // Nur Nachname (Name-Spalte) verwenden
      const name = nachname;
      const personalnummer = colMap.personalnummer !== undefined ? String(row[colMap.personalnummer] || '').trim() : '';
      if (!name && !personalnummer) continue;

      // Summenzeilen überspringen
      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell.includes('summe') || firstCell.includes('gesamt') || firstCell.includes('total')) continue;

      dataRows.push({
        name,
        personalnummer,
        wochenstunden: colMap.wochenstunden !== undefined ? Math.round(parseNum(row[colMap.wochenstunden]) * 4) / 4 : 0,
        stellenumfang_prozent: colMap.stellenumfang_prozent !== undefined ? parseNum(row[colMap.stellenumfang_prozent]) : 0,
        tarif: colMap.tarif !== undefined ? String(row[colMap.tarif] || '').trim() : '',
        tarifgruppe: colMap.tarif !== undefined ? String(row[colMap.tarif] || '').trim() : '',
        tarifstufe: colMap.tarifstufe !== undefined ? String(row[colMap.tarifstufe] || '').trim() : '',
        monatsstunden_gfb: colMap.monatsstunden_gfb !== undefined ? Math.round(parseNum(row[colMap.monatsstunden_gfb]) * 4) / 4 : 0,
        monatsgehalt_brutto: colMap.monatsgehalt_brutto !== undefined ? parseNum(row[colMap.monatsgehalt_brutto]) : 0,
        sv_ag_anteil: colMap.sv_ag_anteil !== undefined ? parseNum(row[colMap.sv_ag_anteil]) : 0,
        funktionszulagen: colMap.funktionszulagen !== undefined ? parseNum(row[colMap.funktionszulagen]) : 0,
        zuschlaege_steuerfrei: colMap.zuschlaege_steuerfrei !== undefined ? parseNum(row[colMap.zuschlaege_steuerfrei]) : 0,
        funktion: colMap.funktion !== undefined ? String(row[colMap.funktion] || '').trim() : '',
        beruf: colMap.beruf !== undefined ? String(row[colMap.beruf] || '').trim() : '',
        wohnbereich: colMap.wohnbereich !== undefined ? String(row[colMap.wohnbereich] || '').trim() : '',
        eintrittsdatum: colMap.eintrittsdatum !== undefined ? parseDate(row[colMap.eintrittsdatum]) : '',
        befristet_bis: colMap.befristet_bis !== undefined ? parseDate(row[colMap.befristet_bis]) : '',
      });
    }

    return Response.json({ success: true, rows: dataRows, totalRows: dataRows.length, detectedColumns: colMap });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});