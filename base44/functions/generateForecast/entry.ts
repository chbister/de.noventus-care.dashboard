import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const einrichtungId = body?.einrichtung_id;
    if (!einrichtungId) return Response.json({ error: 'einrichtung_id required' }, { status: 400 });

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const currentMonth = months[months.length - 1];

    // 1. Sachkosten-Verlauf (6 Monate)
    const sachkostenByMonth = {};
    const sachkostenByKat = {};
    for (const m of months) {
      const data = await base44.asServiceRole.entities.SachkostenAusgaben.filter({ einrichtung_id: einrichtungId, leistungsmonat: m });
      const active = data.filter(a => !a.ist_storniert);
      sachkostenByMonth[m] = Math.round(active.reduce((s, a) => s + (a.verwendeter_betrag || 0), 0) * 100) / 100;
      active.forEach(a => {
        if (a.kategorie_id) sachkostenByKat[a.kategorie_id] = (sachkostenByKat[a.kategorie_id] || 0) + (a.verwendeter_betrag || 0);
      });
    }

    // 2. Kategorien laden
    const kategorien = await base44.asServiceRole.entities.SachkostenKategorien.filter({ aktiv: true });
    const katNames = {};
    kategorien.forEach(k => katNames[k.id] = k.name);

    // 3. Aktuelle Personalkosten
    const mitarbeiter = await base44.asServiceRole.entities.Mitarbeiter.filter({ einrichtung_id: einrichtungId, aktiv: true });
    const personalCosts = mitarbeiter.reduce((s, m) =>
      s + (m.monatsgehalt_brutto || 0) + (m.sv_ag_anteil || 0) + (m.funktionszulagen || 0) + (m.zuschlaege_steuerfrei || 0), 0);
    const vkIst = mitarbeiter.reduce((s, m) => s + (m.vk_pfk || 0) + (m.vk_phk_mit_ausbildung || 0) + (m.vk_phk_ohne_ausbildung || 0), 0);

    // 4. Aktuelle Belegung
    const wohnbereiche = await base44.asServiceRole.entities.Wohnbereich.filter({ einrichtung_id: einrichtungId });
    const bewohner = wohnbereiche.reduce((s, w) =>
      s + (w.belegung_pg1||0)+(w.belegung_pg2||0)+(w.belegung_pg3||0)+(w.belegung_pg4||0)+(w.belegung_pg5||0)+(w.belegung_ruestige||0)+(w.belegung_pg0||0), 0);
    const sollPlaetze = wohnbereiche.reduce((s, w) => s + (w.sollbelegung || 0), 0);
    const auslastung = sollPlaetze > 0 ? Math.round((bewohner / sollPlaetze) * 100) : 0;

    // 5. Fehlzeiten aktueller Monat
    const fehlzeiten = await base44.asServiceRole.entities.MitarbeiterFehlzeiten.filter({ einrichtung_id: einrichtungId });
    const currentFehlzeiten = fehlzeiten.filter(f => f.von_datum && f.von_datum.startsWith(currentMonth));
    const fehlTage = currentFehlzeiten.reduce((s, f) => s + (f.tage || 0), 0);

    // 6. MediFox-Erlöse (letzte 6 Monate falls vorhanden)
    const erloeseByMonth = {};
    for (const m of months) {
      const [y, mo] = m.split('-').map(Number);
      const data = await base44.asServiceRole.entities.MediFoxAbrechnung.filter({ einrichtung_id: einrichtungId, jahr: y, monat: mo });
      erloeseByMonth[m] = Math.round(data.reduce((s, d) => s + (d.abger_betrag || 0), 0) * 100) / 100;
    }

    const sachkostenByKatText = Object.entries(sachkostenByKat)
      .sort((a, b) => b[1] - a[1])
      .map(([id, sum]) => `- ${katNames[id] || 'Unbekannt'}: ${Math.round(sum)} EUR`)
      .join('\n');

    const prompt = `Du bist ein KI-Analyst für Pflegeeinrichtungen. Analysiere die folgenden Daten und erstelle eine Prognose für die nächsten 3 Monate.

EINRICHTUNG AKTUELL:
- Bewohner: ${bewohner} von ${sollPlaetze} Plätzen (${auslastung}% Auslastung)
- Aktive Mitarbeiter: ${mitarbeiter.length} (VK Ist: ${Math.round(vkIst * 100) / 100})
- Personalkosten/Monat: ${Math.round(personalCosts)} EUR
- Fehltage aktueller Monat: ${fehlTage}

SACHKOSTEN VERLAUF (6 Monate, EUR):
${months.map(m => `- ${m}: ${sachkostenByMonth[m] || 0} EUR`).join('\n')}

SACHKOSTEN NACH KATEGORIE (kumuliert 6 Monate):
${sachkostenByKatText || '- Keine Daten'}

ERLÖSE VERLAUF (MediFox, 6 Monate, EUR):
${months.map(m => `- ${m}: ${erloeseByMonth[m] || 0} EUR`).join('\n')}

Erstelle eine fundierte Prognose für die nächsten 3 Monate. Berücksichtige Saisonalität, Trends und typische Pflegeheim-Muster.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          sachkosten_prognose: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                monat: { type: 'string' },
                betrag: { type: 'number' },
                trend: { type: 'string' }
              }
            }
          },
          belegung_prognose: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                monat: { type: 'string' },
                bewohner: { type: 'number' },
                auslastung_prozent: { type: 'number' }
              }
            }
          },
          personalbedarf_prognose: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                monat: { type: 'string' },
                vk_soll: { type: 'number' },
                vk_ist: { type: 'number' },
                personalkosten: { type: 'number' }
              }
            }
          },
          zusammenfassung: { type: 'string' },
          risiko_level: { type: 'string' },
          empfehlungen: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    return Response.json({
      success: true,
      forecast: result,
      historical: {
        sachkosten: sachkostenByMonth,
        erloese: erloeseByMonth,
        bewohner,
        sollPlaetze,
        auslastung,
        personalCosts: Math.round(personalCosts),
        vkIst: Math.round(vkIst * 100) / 100,
        fehlTage,
        monate: months,
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});