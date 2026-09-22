import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    let { monat, jahr, einrichtung_id } = payload;
    if (!monat || !jahr) {
      const heute = new Date();
      monat = heute.getMonth();
      jahr = heute.getFullYear();
      if (monat === 0) { monat = 12; jahr -= 1; }
    }

    const [wohnbereicheAll, mitarbeiterAll, einrichtungen] = await Promise.all([
      base44.asServiceRole.entities.Wohnbereich.list(),
      base44.asServiceRole.entities.Mitarbeiter.list(),
      base44.asServiceRole.entities.Einrichtung.list(),
    ]);

    if (!einrichtung_id) einrichtung_id = einrichtungen[0]?.id;
    const einrichtung = einrichtungen.find(e => e.id === einrichtung_id) || einrichtungen[0] || {};

    const wohnbereiche = wohnbereicheAll.filter(wb => wb.einrichtung_id === einrichtung_id);
    const mitarbeiter = mitarbeiterAll.filter(m => m.einrichtung_id === einrichtung_id && m.aktiv !== false && !m.archiviert);

    // ── Belegung ──────────────────────────────────────────────
    const bewohnerGesamt = wohnbereiche.reduce((s, wb) =>
      s + (wb.belegung_ruestige || 0) + (wb.belegung_pg0 || 0) + (wb.belegung_pg1 || 0)
        + (wb.belegung_pg2 || 0) + (wb.belegung_pg3 || 0) + (wb.belegung_pg4 || 0) + (wb.belegung_pg5 || 0), 0);
    const sollbelegung = wohnbereiche.reduce((s, wb) => s + (wb.sollbelegung || 0), 0);
    const auslastung = sollbelegung > 0 ? Math.round((bewohnerGesamt / sollbelegung) * 10000) / 100 : 0;

    // ── Personal Soll ──────────────────────────────────────────
    const useNeuModell = einrichtung.personalmodell === 'neu';
    let sollFk = 0, sollHkMit = 0, sollHkOhne = 0;

    if (useNeuModell) {
      // Neues Modell: "1 zu X" Ratio pro Pflegegrad + Fachkraftquote
      let sollTotalNeu = 0;
      wohnbereiche.forEach(wb => {
        const pg1 = (wb.belegung_pg1 || 0) + (wb.belegung_ruestige || 0) + (wb.belegung_pg0 || 0);
        const pg2 = (wb.belegung_pg2 || 0) + (wb.geplant_pg2 || 0);
        const pg3 = (wb.belegung_pg3 || 0) + (wb.geplant_pg3 || 0);
        const pg4 = (wb.belegung_pg4 || 0) + (wb.geplant_pg4 || 0);
        const pg5 = (wb.belegung_pg5 || 0) + (wb.geplant_pg5 || 0);
        sollTotalNeu += pg1 / (einrichtung.neu_pg1_ratio || 6.283)
                      + pg2 / (einrichtung.neu_pg2_ratio || 4.229)
                      + pg3 / (einrichtung.neu_pg3_ratio || 3.037)
                      + pg4 / (einrichtung.neu_pg4_ratio || 2.347)
                      + pg5 / (einrichtung.neu_pg5_ratio || 2.129);
      });
      const fkQuote = (einrichtung.neu_fachkraftquote || 49.99) / 100;
      sollFk = Math.round(sollTotalNeu * fkQuote * 100) / 100;
      sollHkMit = 0;
      sollHkOhne = Math.round(sollTotalNeu * (1 - fkQuote) * 100) / 100;
    } else {
      // PeBeM-Modell
      wohnbereiche.forEach(wb => {
        const pg2 = (wb.belegung_pg2 || 0) + (wb.geplant_pg2 || 0);
        const pg3 = (wb.belegung_pg3 || 0) + (wb.geplant_pg3 || 0);
        const pg4 = (wb.belegung_pg4 || 0) + (wb.geplant_pg4 || 0);
        const pg5 = (wb.belegung_pg5 || 0) + (wb.geplant_pg5 || 0);
        sollFk += pg2 * (einrichtung.schluessel_pg2_fk || 0.1017) + pg3 * (einrichtung.schluessel_pg3_fk || 0.1521)
                + pg4 * (einrichtung.schluessel_pg4_fk || 0.2416) + pg5 * (einrichtung.schluessel_pg5_fk || 0.3768);
        sollHkMit += pg2 * (einrichtung.schluessel_pg2_hk_mit || 0.0136) + pg3 * (einrichtung.schluessel_pg3_hk_mit || 0.0217)
                   + pg4 * (einrichtung.schluessel_pg4_hk_mit || 0.0285) + pg5 * (einrichtung.schluessel_pg5_hk_mit || 0.0223);
        sollHkOhne += pg2 * (einrichtung.schluessel_pg2_hk_ohne || 0.1173) + pg3 * (einrichtung.schluessel_pg3_hk_ohne || 0.1414)
                     + pg4 * (einrichtung.schluessel_pg4_hk_ohne || 0.1588) + pg5 * (einrichtung.schluessel_pg5_hk_ohne || 0.1716);
      });
      sollFk = Math.round(sollFk * 100) / 100;
      sollHkMit = Math.round(sollHkMit * 100) / 100;
      sollHkOhne = Math.round(sollHkOhne * 100) / 100;
    }

    // ── Personal Ist (nur spezifische VK-Felder, kein Fallback) ──
    const pflegeMa = mitarbeiter.filter(m => m.kategorie === 'pflege' || m.kategorie === 'nachtwache');
    let istFk = 0, istHkMit = 0, istHkOhne = 0;
    pflegeMa.forEach(m => {
      istFk += (m.vk_pfk || 0) + (m.leih_pfk || 0);
      istHkMit += (m.vk_phk_mit_ausbildung || 0) + (m.leih_phk_mit || 0);
      istHkOhne += (m.vk_phk_ohne_ausbildung || 0) + (m.leih_phk_ohne || 0);
    });
    istFk = Math.round(istFk * 100) / 100;
    istHkMit = Math.round(istHkMit * 100) / 100;
    istHkOhne = Math.round(istHkOhne * 100) / 100;

    const abwFk = Math.round((istFk - sollFk) * 100) / 100;
    const abwHkMit = Math.round((istHkMit - sollHkMit) * 100) / 100;
    const abwHkOhne = Math.round((istHkOhne - sollHkOhne) * 100) / 100;

    // ── Betreuung §43b ────────────────────────────────────────
    const sollBetreuung = einrichtung.schluessel_43b > 0
      ? Math.round((bewohnerGesamt / einrichtung.schluessel_43b) * 100) / 100 : 0;
    const istBetreuung = Math.round(mitarbeiter.filter(m => m.kategorie === 'betreuung_43b')
      .reduce((s, m) => s + (m.vk_pfk || 0) + (m.vk_phk_mit_ausbildung || 0) + (m.vk_phk_ohne_ausbildung || 0), 0) * 100) / 100;
    const abwBetreuung = Math.round((istBetreuung - sollBetreuung) * 100) / 100;

    // ── Fachkraftquote ─────────────────────────────────────────
    const pdlVk = mitarbeiter.filter(m => m.kategorie === 'pflegedienstleitung')
      .reduce((s, m) => s + (m.vk_pfk || 0) + (m.vk_phk_mit_ausbildung || 0) + (m.vk_phk_ohne_ausbildung || 0), 0);
    const gesamtIst = Math.round((istFk + pdlVk + istHkMit + istHkOhne) * 100) / 100;
    const fachkraftquote = gesamtIst > 0
      ? Math.min(100, Math.round(((istFk + pdlVk) / gesamtIst) * 10000) / 100) : 0;

    // ── Personalkosten ────────────────────────────────────────
    const monatsgehaelter = mitarbeiter.reduce((s, m) => s + (m.monatsgehalt_brutto || 0) + (m.funktionszulagen || 0), 0);
    const zuschlaege = mitarbeiter.reduce((s, m) => s + (m.zuschlaege_steuerfrei || 0), 0);
    const agAnteilIst = mitarbeiter.reduce((s, m) => s + (m.sv_ag_anteil || 0), 0);
    const agAnteil = agAnteilIst > 0 ? agAnteilIst : monatsgehaelter * 0.21;
    const personalGesamt = monatsgehaelter + zuschlaege + agAnteil;

    // ── Wohnbereiche Detail ───────────────────────────────────
    const wbDetails = wohnbereiche.map(wb => {
      const ist = (wb.belegung_pg1||0)+(wb.belegung_pg2||0)+(wb.belegung_pg3||0)+(wb.belegung_pg4||0)+(wb.belegung_pg5||0)+(wb.belegung_ruestige||0)+(wb.belegung_pg0||0);
      const soll = wb.sollbelegung || 0;
      const pct = soll > 0 ? Math.round(ist / soll * 100) : 0;
      const wbMa = mitarbeiter.filter(m => m.wohnbereich_id === wb.id || (m.verteilt_auf_alle && wb.aktiv !== false));
      const activeWbCount = wohnbereiche.filter(w => w.aktiv !== false).length || 1;
      const wbVk = Math.round(wbMa.reduce((s, m) => {
        const vk = (m.vk_pfk||0)+(m.vk_phk_mit_ausbildung||0)+(m.vk_phk_ohne_ausbildung||0);
        return s + (m.verteilt_auf_alle ? vk / activeWbCount : vk);
      }, 0) * 100) / 100;
      return { name: wb.name, ist, soll, pct, vk: wbVk };
    });

    // ── PDF Erstellung ────────────────────────────────────────
    const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    let y = 20;

    const fmtEUR = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n || 0);

    // Header
    doc.setFillColor(20, 184, 166);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Monatsabschluss', margin, 8);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${monthNames[monat - 1]} ${jahr}`, pageWidth - margin, 8, { align: 'right' });

    y = 20;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(einrichtung.name || 'Einrichtung', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(einrichtung.standort || '', margin, y);
    y += 10;

    // ── Kennzahlen-Karten ─────────────────────────────────────
    const cards = [
      { label: 'Bewohner', value: String(bewohnerGesamt), sub: `von ${sollbelegung} Plätzen` },
      { label: 'Auslastung', value: `${auslastung}%`, sub: sollbelegung > 0 ? `${bewohnerGesamt}/${sollbelegung}` : '—' },
      { label: 'Pflege Ist (VK)', value: (istFk + istHkMit + istHkOhne).toFixed(2), sub: `Soll: ${(sollFk + sollHkMit + sollHkOhne).toFixed(2)}` },
      { label: 'Fachkraftquote', value: `${fachkraftquote}%`, sub: 'Ist-Personal' },
    ];
    const cardW = (pageWidth - margin * 2 - 9) / 4;
    cards.forEach((c, i) => {
      const x = margin + i * (cardW + 3);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, cardW, 22, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont(undefined, 'normal');
      doc.text(c.label, x + 3, y + 5);
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text(c.value, x + 3, y + 13);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont(undefined, 'normal');
      doc.text(c.sub, x + 3, y + 19);
    });
    y += 30;

    // ── Personalschlüssel-Analyse ──────────────────────────────
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text('Personalschlüssel-Analyse (VK)', margin, y);
    y += 7;

    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(71, 85, 105);
    const colKategorie = margin + 2;
    const colSoll = margin + 70;
    const colIst = margin + 100;
    const colAbw = margin + 130;
    const colTrend = margin + 165;
    doc.text('Kategorie', colKategorie, y);
    doc.text('Soll', colSoll, y);
    doc.text('Ist', colIst, y);
    doc.text('Abweichung', colAbw, y);
    doc.text('Trend', colTrend, y);
    y += 7;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const dataRows = useNeuModell ? [
      { name: 'Fachkräfte', soll: sollFk, ist: Math.round((istFk + pdlVk) * 100) / 100, abw: Math.round((istFk + pdlVk - sollFk) * 100) / 100 },
      { name: 'Hilfskräfte', soll: sollHkOhne, ist: Math.round((istHkMit + istHkOhne) * 100) / 100, abw: Math.round((istHkMit + istHkOhne - sollHkOhne) * 100) / 100 },
      { name: 'Betreuung §43b', soll: sollBetreuung, ist: istBetreuung, abw: abwBetreuung },
    ] : [
      { name: 'Fachkräfte (PFK)', soll: sollFk, ist: istFk, abw: abwFk },
      { name: 'HK mit Ausbildung', soll: sollHkMit, ist: istHkMit, abw: abwHkMit },
      { name: 'HK ohne Ausbildung', soll: sollHkOhne, ist: istHkOhne, abw: abwHkOhne },
      { name: 'Betreuung §43b', soll: sollBetreuung, ist: istBetreuung, abw: abwBetreuung },
    ];
    dataRows.forEach(row => {
      doc.setTextColor(30, 41, 59);
      doc.text(row.name, colKategorie, y);
      doc.text(row.soll.toFixed(2), colSoll, y);
      doc.text(row.ist.toFixed(2), colIst, y);
      if (row.abw >= 0) doc.setTextColor(20, 184, 166);
      else doc.setTextColor(239, 68, 68);
      doc.text(`${row.abw >= 0 ? '+' : ''}${row.abw.toFixed(2)}`, colAbw, y);
      doc.setTextColor(100, 116, 139);
      doc.text(row.abw > 0 ? '↑ Überbesetzung' : row.abw < 0 ? '↓ Unterbesetzung' : '= Soll erfüllt', colTrend, y);
      y += 6;
    });
    y += 4;

    // ── Personelle Ausstattung (nur bei neuem Modell) ─────────
    if (useNeuModell) {
      if (y > pageHeight - 50) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text('Personelle Ausstattung (Schlüssel)', margin, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      const ausstattung = [
        { label: 'PG1', value: `1 zu ${(einrichtung.neu_pg1_ratio || 6.283).toFixed(3)}` },
        { label: 'PG2', value: `1 zu ${(einrichtung.neu_pg2_ratio || 4.229).toFixed(3)}` },
        { label: 'PG3', value: `1 zu ${(einrichtung.neu_pg3_ratio || 3.037).toFixed(3)}` },
        { label: 'PG4', value: `1 zu ${(einrichtung.neu_pg4_ratio || 2.347).toFixed(3)}` },
        { label: 'PG5', value: `1 zu ${(einrichtung.neu_pg5_ratio || 2.129).toFixed(3)}` },
        { label: 'Fachkraftquote', value: `${(einrichtung.neu_fachkraftquote || 49.99).toFixed(2)}%` },
        { label: '§43b Betreuung', value: `1 zu ${einrichtung.schluessel_43b || 20}` },
        { label: 'Leitung/Verwaltung', value: `1 zu ${einrichtung.neu_leitung_verwaltung || 24}` },
        { label: 'Wirtschaftsdienst', value: `1 zu ${einrichtung.neu_wirtschaftsdienst || 6}` },
        { label: 'Technischer Dienst', value: `1 zu ${einrichtung.neu_technischer_dienst || 69}` },
        { label: 'Qualitätsmanagement', value: `1 zu ${einrichtung.neu_qualitaetsmanagement || 110}` },
      ];
      const colW = (pageWidth - margin * 2) / 2;
      ausstattung.forEach((row, i) => {
        const col = i % 2;
        const rowIdx = Math.floor(i / 2);
        const x = margin + col * colW;
        const ry = y + rowIdx * 5;
        doc.setTextColor(100, 116, 139);
        doc.text(row.label, x + 2, ry);
        doc.setTextColor(30, 41, 59);
        doc.setFont(undefined, 'bold');
        doc.text(row.value, x + 50, ry);
        doc.setFont(undefined, 'normal');
      });
      y += Math.ceil(ausstattung.length / 2) * 5 + 6;
    }

    // ── Personalkosten ────────────────────────────────────────
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text('Personalkosten', margin, y);
    y += 7;

    const costRows = [
      { label: 'Monatsgehälter + Zulagen', value: monatsgehaelter },
      { label: 'Steuerfreie Zuschläge', value: zuschlaege },
      { label: 'Arbeitgeberanteil SV' + (agAnteilIst > 0 ? ' (IST)' : ' (Pauschal 21%)'), value: agAnteil },
    ];
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    costRows.forEach(r => {
      doc.setTextColor(100, 116, 139);
      doc.text(r.label, margin + 2, y);
      doc.setTextColor(30, 41, 59);
      doc.text(fmtEUR(r.value), pageWidth - margin - 2, y, { align: 'right' });
      y += 5;
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 4;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Gesamt', margin + 2, y);
    doc.text(fmtEUR(personalGesamt), pageWidth - margin - 2, y, { align: 'right' });
    y += 10;

    // ── Wohnbereiche Detail ───────────────────────────────────
    if (y > pageHeight - 60) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text('Wohnbereiche', margin, y);
    y += 7;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Wohnbereich', margin + 2, y);
    doc.text('Belegung', margin + 90, y);
    doc.text('Soll', margin + 115, y);
    doc.text('Auslastung', margin + 135, y);
    doc.text('VK Ist', margin + 170, y);
    y += 7;

    doc.setFont(undefined, 'normal');
    wbDetails.forEach(wb => {
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      doc.setTextColor(30, 41, 59);
      doc.text(wb.name, margin + 2, y);
      doc.text(String(wb.ist), margin + 90, y);
      doc.text(String(wb.soll), margin + 115, y);
      const pctColor = wb.pct >= 100 ? [239, 68, 68] : wb.pct >= 90 ? [249, 115, 22] : [20, 184, 166];
      doc.setTextColor(pctColor[0], pctColor[1], pctColor[2]);
      doc.text(`${wb.pct}%`, margin + 135, y);
      doc.setTextColor(30, 41, 59);
      doc.text(wb.vk.toFixed(2), margin + 170, y);
      y += 6;
    });
    y += 8;

    // ── Fußzeile ──────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont(undefined, 'normal');
      doc.text(`Noventus Care – Monatsabschluss ${monthNames[monat - 1]} ${jahr}`, margin, pageHeight - 7);
      doc.text(`Seite ${p}/${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      if (p === totalPages) {
        doc.text(`Generiert: ${new Date().toLocaleString('de-DE')}`, margin, pageHeight - 3);
      }
    }

    const pdfBytes = doc.output('arraybuffer');
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const file = new File([blob], `Monatsabschluss_${jahr}_${String(monat).padStart(2, '0')}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    await base44.asServiceRole.entities.MonatsabschlussHistorie.create({
      einrichtung_id,
      monat,
      jahr,
      pdf_url: file_url,
      bewohner_gesamt: bewohnerGesamt,
      sollbelegung,
      auslastung_prozent: auslastung,
      personal_soll_fk: sollFk,
      personal_ist_fk: istFk,
      personal_abweichung_fk: abwFk,
      personal_soll_hk_mit: sollHkMit,
      personal_ist_hk_mit: istHkMit,
      personal_abweichung_hk_mit: abwHkMit,
      personal_soll_hk_ohne: sollHkOhne,
      personal_ist_hk_ohne: istHkOhne,
      personal_abweichung_hk_ohne: abwHkOhne,
      fachkraftquote_ist: fachkraftquote,
      betreuung_soll: sollBetreuung,
      betreuung_ist: istBetreuung,
      betreuung_abweichung: abwBetreuung,
    });

    return Response.json({
      success: true,
      message: `Monatsabschluss für ${monthNames[monat - 1]} ${jahr} erstellt`,
      pdf_url: file_url,
      monat,
      jahr,
      einrichtung_id,
    });
  } catch (error) {
    console.error('Fehler bei Monatsabschluss:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});