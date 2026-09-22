import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    const { event, data, old_data, changed_fields } = payload;

    if (!event) return Response.json({ error: 'No event provided' }, { status: 400 });

    const entityType = event.entity_name || 'Unbekannt';
    const action = event.type || 'update';
    const entityId = event.entity_id || '';

    // Human-readable snapshot name
    let nameSnapshot = '';
    if (data) {
      nameSnapshot = data.name || data.bezeichnung || data.wohneinheit_id || data.title || data.bereich || '';
      if (!nameSnapshot && data.personalnummer) nameSnapshot = `${data.name || ''} (${data.personalnummer})`;
    }
    if (!nameSnapshot && old_data) {
      nameSnapshot = old_data.name || old_data.bezeichnung || '';
    }

    // Changed fields
    let fieldsChanged = '';
    if (action === 'update' && Array.isArray(changed_fields)) {
      fieldsChanged = changed_fields.join(', ');
    } else if (action === 'create') {
      fieldsChanged = 'Neu angelegt';
    } else if (action === 'delete') {
      fieldsChanged = 'Gelöscht';
    }

    // Einrichtung ID
    const einrichtungId = data?.einrichtung_id || old_data?.einrichtung_id || '';

    // User info — try to get current user
    let userEmail = 'System';
    try {
      const user = await base44.auth.me();
      if (user) userEmail = user.email || user.full_name || 'Unbekannt';
    } catch (_) {}

    await base44.asServiceRole.entities.Aenderungsprotokoll.create({
      entity_type: entityType,
      action: action,
      entity_id: entityId,
      entity_name_snapshot: nameSnapshot,
      changed_fields: fieldsChanged,
      changed_by: userEmail,
      einrichtung_id: einrichtungId,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Protokollieren:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});