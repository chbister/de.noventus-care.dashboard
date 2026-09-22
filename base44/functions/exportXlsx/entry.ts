import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

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

    const settingsList = await base44.asServiceRole.entities.ExportEinstellung.list();
    const cfg = settingsList[0] || {
      export_heimkosten: true,
      export_bewohner_kosten: true,
      export_mitarbeiter: true,
      export_verguetung: true,
      export_wohnbereiche: true,
      export_tagespflege: true,
      export_dashboard: true,
    };

    const [heimkosten, bewohnerKosten, mitarbeiter, verguetung, wohnbereiche, tagespflege] = await Promise.all([
      base44.asServiceRole.entities.Heimkosten.list(),
      base44.asServiceRole.entities.BewohnerHeimkosten.list(),
      base44.asServiceRole.entities.Mitarbeiter.list(),
      base44.asServiceRole.entities.Verguetung.list(),
      base44.asServiceRole.entities.Wohnbereich.list(),
      base44.asServiceRole.entities.Tagespflege.list(),
    ]);

    const wb = XLSX.utils.book_new();

    if (cfg.export_heimkosten !== false && heimkosten.length > 0) {
      const ws = XLSX.utils.json_to_sheet(heimkosten.map(r => ({
        'Bereich': r.bereich || '',
        'Monat': r.monat || '',
        'Gesamtbetrag (EUR)': r.gesamtbetrag || 0,
        'Bemerkung': r.bemerkung || '',
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Heimkosten');
    }

    if (cfg.export_bewohner_kosten !== false && bewohnerKosten.length > 0) {
      const ws = XLSX.utils.json_to_sheet(bewohnerKosten.map(r => ({
        'Bewohner': r.bewohner_name || '',
        'Zimmer': r.zimmer || '',
        'Pflegegrad': r.pflegegrad || '',
        'Monat': r.monat || '',
        'Jahr': r.jahr || '',
        'Pflegekasse (EUR)': r.anteil_pflegekasse || 0,
        'Sozialamt (EUR)': r.anteil_sozialamt || 0,
        'Bewohner Anteil (EUR)': r.anteil_bewohner || 0,
        'Gesamt (EUR)': r.betrag_gesamt || 0,
        'Status': r.status || '',
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Bewohner Kosten');
    }

    if (cfg.export_mitarbeiter !== false && mitarbeiter.length > 0) {
      const ws = XLSX.utils.json_to_sheet(mitarbeiter.map(r => ({
        'Name': r.name || '',
        'Kategorie': r.kategorie || '',
        'Berufsbezeichnung': r.berufsbezeichnung || '',
        'Wochenstunden': r.wochenstunden || 0,
        'VK Anteil': r.vk_anteil || 0,
        'Monatsgehalt Brutto (EUR)': r.monatsgehalt_brutto || 0,
        'Aktiv': r.aktiv ? 'Ja' : 'Nein',
        'Eintrittsdatum': r.eintrittsdatum || '',
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Mitarbeiter');
    }

    if (cfg.export_verguetung !== false && verguetung.length > 0) {
      const ws = XLSX.utils.json_to_sheet(verguetung.map(r => ({
        'Bezeichnung': r.bezeichnung || '',
        'Gültig ab': r.gueltig_ab || '',
        'Gültig bis': r.gueltig_bis || '',
        'Pflegesatz PG2 (EUR/Tag)': r.pflegesatz_pg2 || 0,
        'Pflegesatz PG3 (EUR/Tag)': r.pflegesatz_pg3 || 0,
        'Pflegesatz PG4 (EUR/Tag)': r.pflegesatz_pg4 || 0,
        'Pflegesatz PG5 (EUR/Tag)': r.pflegesatz_pg5 || 0,
        'Investitionskosten (EUR/Tag)': r.investitionskosten || 0,
        'Unterkunft & Verpflegung (EUR/Tag)': r.unterkunft_verpflegung || 0,
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Vergütung');
    }

    if (cfg.export_wohnbereiche !== false && wohnbereiche.length > 0) {
      const ws = XLSX.utils.json_to_sheet(wohnbereiche.map(r => ({
        'Name': r.name || '',
        'Sollbelegung': r.sollbelegung || 0,
        'PG1': r.belegung_pg1 || 0,
        'PG2': r.belegung_pg2 || 0,
        'PG3': r.belegung_pg3 || 0,
        'PG4': r.belegung_pg4 || 0,
        'PG5': r.belegung_pg5 || 0,
        'Stichtag': r.stichtag || '',
        'Kommentar': r.kommentar || '',
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Wohnbereiche');
    }

    if (cfg.export_tagespflege !== false && tagespflege.length > 0) {
      const ws = XLSX.utils.json_to_sheet(tagespflege.map(r => ({
        'Name': r.name || '',
        'Sollbelegung': r.sollbelegung || 0,
        'PG1': r.belegung_pg1 || 0,
        'PG2': r.belegung_pg2 || 0,
        'PG3': r.belegung_pg3 || 0,
        'PG4': r.belegung_pg4 || 0,
        'PG5': r.belegung_pg5 || 0,
        'Stichtag': r.stichtag || '',
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Tagespflege');
    }

    if (cfg.export_dashboard !== false) {
      const einrichtungen = await base44.asServiceRole.entities.Einrichtung.list();
      const e = einrichtungen[0] || {};

      const bewohnerGesamt = wohnbereiche.reduce((s, w) =>
        s + (w.belegung_ruestige || 0) + (w.belegung_pg0 || 0) + (w.belegung_pg1 || 0)
        + (w.belegung_pg2 || 0) + (w.belegung_pg3 || 0) + (w.belegung_pg4 || 0) + (w.belegung_pg5 || 0)
        + (w.geplant_pg2 || 0) + (w.geplant_pg3 || 0) + (w.geplant_pg4 || 0) + (w.geplant_pg5 || 0), 0);
      const sollBelegung = wohnbereiche.reduce((s, w) => s + (w.sollbelegung || 0), 0);
      const auslastung = sollBelegung > 0 ? Math.round((bewohnerGesamt / sollBelegung) * 10000) / 100 : 0;

      let sollFk = 0, sollHkMit = 0, sollHkOhne = 0;
      wohnbereiche.forEach(w => {
        const pg2 = (w.belegung_pg2 || 0) + (w.geplant_pg2 || 0);
        const pg3 = (w.belegung_pg3 || 0) + (w.geplant_pg3 || 0);
        const pg4 = (w.belegung_pg4 || 0) + (w.geplant_pg4 || 0);
        const pg5 = (w.belegung_pg5 || 0) + (w.geplant_pg5 || 0);
        sollFk += pg2 * (e.schluessel_pg2_fk || 0.1017) + pg3 * (e.schluessel_pg3_fk || 0.1521)
                + pg4 * (e.schluessel_pg4_fk || 0.2416) + pg5 * (e.schluessel_pg5_fk || 0.3768);
        sollHkMit += pg2 * (e.schluessel_pg2_hk_mit || 0.0136) + pg3 * (e.schluessel_pg3_hk_mit || 0.0217)
                   + pg4 * (e.schluessel_pg4_hk_mit || 0.0285) + pg5 * (e.schluessel_pg5_hk_mit || 0.0223);
        sollHkOhne += pg2 * (e.schluessel_pg2_hk_ohne || 0.1173) + pg3 * (e.schluessel_pg3_hk_ohne || 0.1414)
                    + pg4 * (e.schluessel_pg4_hk_ohne || 0.1588) + pg5 * (e.schluessel_pg5_hk_ohne || 0.1716);
      });
      const sollGesamt = Math.round((sollFk + sollHkMit + sollHkOhne) * 100) / 100;

      const aktiveMa = mitarbeiter.filter(m => m.aktiv !== false);
      const pflegeMa = aktiveMa.filter(m => m.kategorie === 'pflege' || m.kategorie === 'nachtwache');
      let istFk = 0, istHkMit = 0, istHkOhne = 0;
      pflegeMa.forEach(m => {
        if ((m.vk_pfk || 0) + (m.vk_phk_mit_ausbildung || 0) + (m.vk_phk_ohne_ausbildung || 0) > 0) {
          istFk += (m.vk_pfk || 0) + (m.leih_pfk || 0);
          istHkMit += (m.vk_phk_mit_ausbildung || 0) + (m.leih_phk_mit || 0);
          istHkOhne += (m.vk_phk_ohne_ausbildung || 0) + (m.leih_phk_ohne || 0);
        } else {
          const vk = m.vk_anteil || 0;
          const bez = (m.berufsbezeichnung || '').toUpperCase();
          if (bez === 'AP' || bez === 'FK' || bez === 'PFK' || bez === 'KS') istFk += vk;
          else if (bez === 'APH') istHkMit += vk;
          else istHkOhne += vk;
        }
      });
      const istGesamt = Math.round((istFk + istHkMit + istHkOhne) * 100) / 100;
      const sollBetreuung = Math.round((bewohnerGesamt / (e.schluessel_43b || 20)) * 100) / 100;
      const istBetreuung = Math.round(aktiveMa.filter(m => m.kategorie === 'betreuung_43b')
        .reduce((s, m) => s + (m.vk_anteil || 0), 0) * 100) / 100;
      const pdlVk = aktiveMa.filter(m => m.kategorie === 'pflegedienstleitung')
        .reduce((s, m) => s + (m.vk_anteil || 0), 0);
      const fachkraftquoteIst = (istGesamt + pdlVk) > 0
        ? Math.round(((istFk + pdlVk) / (istGesamt + pdlVk)) * 10000) / 100 : 0;

      const ws = XLSX.utils.json_to_sheet([
        { 'Kennzahl': 'Bewohner (Ist)', 'Wert': bewohnerGesamt, 'Einheit': 'Personen' },
        { 'Kennzahl': 'Sollbelegung', 'Wert': sollBelegung, 'Einheit': 'Plätze' },
        { 'Kennzahl': 'Auslastung', 'Wert': auslastung, 'Einheit': '%' },
        { 'Kennzahl': 'Pflege Soll (VK)', 'Wert': sollGesamt, 'Einheit': 'VK' },
        { 'Kennzahl': 'Pflege Ist (VK)', 'Wert': istGesamt, 'Einheit': 'VK' },
        { 'Kennzahl': 'Pflege Differenz (VK)', 'Wert': Math.round((istGesamt - sollGesamt) * 100) / 100, 'Einheit': 'VK' },
        { 'Kennzahl': 'Betreuung §43b Soll (VK)', 'Wert': sollBetreuung, 'Einheit': 'VK' },
        { 'Kennzahl': 'Betreuung §43b Ist (VK)', 'Wert': istBetreuung, 'Einheit': 'VK' },
        { 'Kennzahl': 'Fachkraftquote Ist', 'Wert': fachkraftquoteIst, 'Einheit': '%' },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Dashboard');
    }

    if (wb.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Info: 'Keine Daten vorhanden' }]), 'Info');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const now = new Date();
    const dateiname = `RFC_Export_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;

    // E-Mail versenden falls Empfänger konfiguriert
    if (cfg.export_empfaenger_ids?.length > 0) {
      const blobForUpload = new Blob(
        [new Uint8Array(atob(excelBuffer).split('').map(c => c.charCodeAt(0)))],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      const fileObj = new File([blobForUpload], dateiname, { type: blobForUpload.type });
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileObj });

      const datumStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
      const allUsers = await base44.asServiceRole.entities.User.list();
      const empfaenger = allUsers.filter(u => cfg.export_empfaenger_ids.includes(u.id));

      for (const user of empfaenger) {
        await sendEmailBrevo({
          to: user.email,
          toName: user.full_name || '',
          subject: `Datenexport RFC Personal – ${datumStr}`,
          textContent: `Hallo ${user.full_name || ''},\n\nder aktuelle Datenexport vom ${datumStr} steht zum Download bereit:\n\n${file_url}\n\n(Datei: ${dateiname})\n\nMit freundlichen Grüßen\nRFC Personal System`,
        });
      }
    }

    // Datei direkt zurückgeben
    const binaryStr = atob(excelBuffer);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

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