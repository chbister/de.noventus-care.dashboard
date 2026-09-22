import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const entries = await base44.asServiceRole.entities.Aenderungsprotokoll.list('-created_date', 1000);

    const ws = XLSX.utils.json_to_sheet(entries.map(e => ({
      'Datum': e.created_date ? new Date(e.created_date).toLocaleString('de-DE') : '',
      'Bereich': e.entity_type || '',
      'Aktion': e.action || '',
      'Datensatz': e.entity_name_snapshot || '',
      'Geänderte Felder': e.changed_fields || '',
      'Geändert von': e.changed_by || '',
      'Einrichtung': e.einrichtung_id || '',
      'Datensatz-ID': e.entity_id || '',
    })));

    ws['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 30 },
      { wch: 40 }, { wch: 28 }, { wch: 20 }, { wch: 28 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Änderungsprotokoll');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const binaryStr = atob(excelBuffer);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const now = new Date();
    const dateiname = `Aenderungsprotokoll_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${dateiname}"`,
        'Content-Length': bytes.length.toString(),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});