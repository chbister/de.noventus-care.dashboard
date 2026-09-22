import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin-Rechte erforderlich' }, { status: 403 });
    }

    const exportEmail = Deno.env.get('EXPORT_EMAIL');
    const settings = await base44.asServiceRole.entities.ExportEinstellung.list();

    return Response.json({
      export_email_env: exportEmail || 'NICHT GESETZT',
      settings: settings[0] || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});