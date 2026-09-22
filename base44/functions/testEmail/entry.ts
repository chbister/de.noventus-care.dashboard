import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'klaus.stender@noventus-care.de',
      subject: 'Test E-Mail vom RFC System',
      body: 'Dies ist eine Test-E-Mail.\n\nWenn du diese E-Mail erhältst, funktioniert das E-Mail-System korrekt.'
    });

    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});