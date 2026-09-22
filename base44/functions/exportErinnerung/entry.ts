import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');

async function sendEmailBrevo({ to, toName, subject, textContent }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'RFC Barntrup', email: 'klaus.stender@noventus-care.de' },
      to: [{ email: to, name: toName || to }],
      subject,
      textContent,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo Fehler: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const datumStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

    const users = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    if (!users || users.length === 0) {
      return Response.json({ error: 'Kein Admin-Benutzer gefunden' }, { status: 500 });
    }

    for (const user of users) {
      await sendEmailBrevo({
        to: user.email,
        toName: user.full_name || 'Administrator',
        subject: `Erinnerung: Datenexport fällig – ${datumStr}`,
        textContent: `Hallo ${user.full_name || 'Administrator'},\n\nbitte denken Sie daran, den aktuellen Datenexport durchzuführen.\n\nDieser Export wird alle 14 Tage empfohlen, um die Daten zu sichern.\n\nSie können den Export unter Einstellungen → Export → "Export jetzt starten" auslösen.\n\nMit freundlichen Grüßen\nRFC Personal System`,
      });
    }

    return Response.json({ success: true, message: `Erinnerung an ${users.length} Admin(s) gesendet`, datum: datumStr });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});