import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

const ART_NORMALIZE = {
  'krank': 'Krank', 'krankheit': 'Krank', 'krankengeld': 'Krank', 'ku': 'Krank',
  'urlaub': 'Urlaub', 'erholungsurlaub': 'Urlaub', 'urlaubsanspruch': 'Urlaub',
  'fortbildung': 'Fortbildung', 'weiterbildung': 'Fortbildung', 'schulung': 'Fortbildung', 'seminar': 'Fortbildung',
  'sonderurlaub': 'Sonderurlaub',
  'unbezahlter urlaub': 'Unbezahlter Urlaub', 'unbezahlter_urlaub': 'Unbezahlter Urlaub', 'ohne lohn': 'Unbezahlter Urlaub',
  'sonstiges': 'Sonstiges', 'sonstige': 'Sonstiges',
};

function normalizeArt(val) {
  if (!val) return 'Krank';
  const s = String(val).trim().toLowerCase();
  if (ART_NORMALIZE[s]) return ART_NORMALIZE[s];
  for (const [k, v] of Object.entries(ART_NORMALIZE)) {
    if (s.includes(k)) return v;
  }
  return 'Sonstiges';
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (m) {
    const dd = String(m[1]).padStart(2, '0');
    const mm = String(m[2]).padStart(2, '0');
    let yy = m[3];
    if (yy.length === 2) yy = '20' + yy;
    return `${yy}-${mm}-${dd}`;
  }
  const m2 = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) return `${m2[1]}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}`;
  return s;
}

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

    let headerIdx = -1;
    const colMap = {};

    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
      for (let j = 0; j < cells.length; j++) {
        const h = cells[j];
        if (!h) continue;
        if ((h === 'name' || h === 'nachname' || h.includes('name')) && colMap.name === undefined) { colMap.name = j; headerIdx = i; }
        if ((h === 'personalnummer' || h.includes('pers') || h === 'pnr') && colMap.personalnummer === undefined) colMap.personalnummer = j;
        if ((h === 'art' || h.includes('fehlzeit') || h.includes('grund') || h.includes('art der')) && colMap.art === undefined) colMap.art = j;
        if ((h === 'von' || h.includes('von') || h.includes('start') || h.includes('beginn') || h === 'ab' || h.includes('ab ')) && colMap.von === undefined) colMap.von = j;
        if ((h === 'bis' || h.includes('bis') || h.includes('ende') || h.includes('end')) && colMap.bis === undefined) colMap.bis = j;
        if ((h === 'bemerkung' || h.includes('bemerk') || h.includes('notiz')) && colMap.bemerkung === undefined) colMap.bemerkung = j;
        if ((h === 'tage' || h.includes('tage') || h.includes('anzahl')) && colMap.tage === undefined) colMap.tage = j;
      }
    }

    if (headerIdx === -1 || (colMap.name === undefined && colMap.personalnummer === undefined)) {
      return Response.json({ error: 'Header-Zeile nicht gefunden (Spalte "Name" oder "Personalnummer" nicht erkannt)' }, { status: 400 });
    }

    const dataRows = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const name = colMap.name !== undefined ? String(row[colMap.name] || '').trim() : '';
      const personalnummer = colMap.personalnummer !== undefined ? String(row[colMap.personalnummer] || '').trim() : '';
      if (!name && !personalnummer) continue;

      const firstCell = String(row[0] || '').toLowerCase();
      if (firstCell.includes('summe') || firstCell.includes('gesamt') || firstCell.includes('total')) continue;

      const von = colMap.von !== undefined ? formatDate(row[colMap.von]) : '';
      if (!von) continue;

      const bis = colMap.bis !== undefined ? formatDate(row[colMap.bis]) : '';

      dataRows.push({
        name,
        personalnummer,
        art: colMap.art !== undefined ? normalizeArt(row[colMap.art]) : 'Krank',
        von_datum: von,
        bis_datum: bis || von,
        bemerkung: colMap.bemerkung !== undefined ? String(row[colMap.bemerkung] || '').trim() : '',
        tage: colMap.tage !== undefined ? Number(row[colMap.tage]) || 0 : 0,
      });
    }

    return Response.json({ success: true, rows: dataRows, totalRows: dataRows.length, detectedColumns: colMap });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});