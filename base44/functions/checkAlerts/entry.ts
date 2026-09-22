import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const einrichtungen = await base44.asServiceRole.entities.Einrichtung.list();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const alertsCreated = [];

    for (const einr of einrichtungen) {
      // 1. Sachkosten-Budget-Überschreitung prüfen
      const ausgaben = await base44.asServiceRole.entities.SachkostenAusgaben.filter({ einrichtung_id: einr.id, leistungsmonat: currentMonth });
      const kategorien = await base44.asServiceRole.entities.SachkostenKategorien.filter({ aktiv: true });
      const budgetwerte = await base44.asServiceRole.entities.SachkostenBudgetwerte.filter({ einrichtung_id: einr.id });
      const wohnbereiche = await base44.asServiceRole.entities.Wohnbereich.filter({ einrichtung_id: einr.id });
      const bewohner = wohnbereiche.reduce((s, w) =>
        s + (w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0)+(w.belegung_pg0||0), 0);
      const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const belegungstage = bewohner * daysInCurrentMonth;

      for (const kat of kategorien) {
        const bw = budgetwerte.find(b => b.kategorie_id === kat.id && !b.wohnbereich_id);
        if (!bw || bw.betrag_je_belegungstag <= 0) continue;
        const sollbudget = belegungstage * bw.betrag_je_belegungstag;
        const katAusgaben = ausgaben.filter(a => a.kategorie_id === kat.id && !a.ist_storniert);
        const istkosten = katAusgaben.reduce((s, a) => s + (a.verwendeter_betrag || 0), 0);
        if (sollbudget > 0 && istkosten > sollbudget) {
          const existing = await base44.asServiceRole.entities.Alert.filter({ typ: 'budget_ueberschritten', einrichtung_id: einr.id, kategorie_id: kat.id, ist_aktiv: true });
          if (existing.length === 0) {
            const alert = await base44.asServiceRole.entities.Alert.create({
              typ: 'budget_ueberschritten', severity: 'critical',
              titel: `Budget überschritten: ${kat.name}`,
              nachricht: `Kategorie "${kat.name}" in ${einr.name} hat das Monatsbudget überschritten. Ist: ${Math.round(istkosten)} EUR, Budget: ${Math.round(sollbudget)} EUR.`,
              einrichtung_id: einr.id, einrichtung_name: einr.name, kategorie_id: kat.id,
              wert_aktuell: Math.round(istkosten), wert_schwellwert: Math.round(sollbudget), ist_aktiv: true,
            });
            alertsCreated.push(alert);
          }
        }
      }

      // 2. Belegungsrückgang prüfen (< 85%)
      const sollPlaetze = wohnbereiche.reduce((s, w) => s + (w.sollbelegung || 0), 0);
      const auslastung = sollPlaetze > 0 ? (bewohner / sollPlaetze) * 100 : 0;
      if (auslastung < 85 && sollPlaetze > 0) {
        const existing = await base44.asServiceRole.entities.Alert.filter({ typ: 'belegung_rueckgang', einrichtung_id: einr.id, ist_aktiv: true });
        if (existing.length === 0) {
          const alert = await base44.asServiceRole.entities.Alert.create({
            typ: 'belegung_rueckgang', severity: 'warning',
            titel: 'Belegungsrückgang',
            nachricht: `Die Auslastung von ${einr.name} liegt bei ${Math.round(auslastung)}% (Schwellwert: 85%). ${bewohner} von ${sollPlaetze} Plätzen belegt.`,
            einrichtung_id: einr.id, einrichtung_name: einr.name,
            wert_aktuell: Math.round(auslastung), wert_schwellwert: 85, ist_aktiv: true,
          });
          alertsCreated.push(alert);
        }
      }

      // 3. Fehlzeiten-Spitze prüfen (> 10% Quote)
      const mitarbeiter = await base44.asServiceRole.entities.Mitarbeiter.filter({ einrichtung_id: einr.id, aktiv: true });
      if (mitarbeiter.length > 3) {
        const fehlzeiten = await base44.asServiceRole.entities.MitarbeiterFehlzeiten.filter({ einrichtung_id: einr.id });
        const currentFehl = fehlzeiten.filter(f => f.von_datum && f.von_datum.startsWith(currentMonth));
        const fehlTage = currentFehl.reduce((s, f) => s + (f.tage || 0), 0);
        const maxArbeitstage = mitarbeiter.length * 20;
        const fehlQuote = maxArbeitstage > 0 ? (fehlTage / maxArbeitstage) * 100 : 0;
        if (fehlQuote > 10) {
          const existing = await base44.asServiceRole.entities.Alert.filter({ typ: 'fehlzeiten_spitze', einrichtung_id: einr.id, ist_aktiv: true });
          if (existing.length === 0) {
            const alert = await base44.asServiceRole.entities.Alert.create({
              typ: 'fehlzeiten_spitze', severity: 'warning',
              titel: 'Fehlzeiten-Spitze',
              nachricht: `Die Fehlzeitenquote von ${einr.name} liegt bei ${Math.round(fehlQuote)}% im aktuellen Monat (${fehlTage} Fehltage bei ${mitarbeiter.length} Mitarbeitern).`,
              einrichtung_id: einr.id, einrichtung_name: einr.name,
              wert_aktuell: Math.round(fehlQuote), wert_schwellwert: 10, ist_aktiv: true,
            });
            alertsCreated.push(alert);
          }
        }
      }
    }

    // 4. E-Mail an Admins senden
    if (alertsCreated.length > 0) {
      try {
        const users = await base44.asServiceRole.entities.User.list();
        const admins = users.filter(u => u.role === 'admin');
        for (const admin of admins) {
          const body = alertsCreated.map(a => `• ${a.titel}: ${a.nachricht}`).join('\n\n');
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `⚠️ ${alertsCreated.length} neue Alert(s) in Noventus Care`,
            body: `Guten Tag ${admin.full_name || ''},\n\nFolgende Alerts wurden erkannt:\n\n${body}\n\nBitte prüfen Sie die Details im Dashboard.\n\nMit freundlichen Grüßen\nIhr Noventus Care System`,
          });
        }
      } catch (e) { /* Email-Fehler nicht kritisch */ }
    }

    return Response.json({ success: true, alertsCreated: alertsCreated.length, alerts: alertsCreated.map(a => ({ id: a.id, titel: a.titel, einrichtung: a.einrichtung_name })) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});