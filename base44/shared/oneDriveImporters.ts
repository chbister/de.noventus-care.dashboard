// OneDrive Import Processors
// Repliziert die Import-Logik der Frontend-Komponenten für das Backend.

// === VK-Klassifizierung (aus MitarbeiterImport.jsx) ===
const PFK_KEYWORDS = ['pflegefachkraft', 'fachkraft', 'gesundheits- und krankenpfleger', 'gesundheits- und krankenpflegerin', 'examinierte', 'altenpfleger', 'altenpflegerin', 'pflegefachmann', 'pflegefachfrau', 'krankenpfleger', 'krankenpflegerin', 'exami', 'pflegedienstleitung', 'pdl', 'stationsleitung', 'wohnbereichsleitung', 'wbl'];
const PHK_MIT_KEYWORDS = ['altenpflegehelfer', 'altenpflegehelferin', 'pflegehelfer', 'pflegehelferin', 'gesundheits- und krankenpflegehelfer', 'pflegeassistent', 'pflegeassistenz'];
const PHK_OHNE_KEYWORDS = ['pflegehilfskraft', 'betreuungskraft', '43b', 'alltagsbegleiter', 'hauswirtschaft', 'reinigung', 'küche', 'koch'];

function classifyFunktion(funktion) {
  const b = (funktion || '').toLowerCase().trim();
  if (!b) return null;
  if (PFK_KEYWORDS.some(k => b.includes(k))) return 'pfk';
  if (PHK_MIT_KEYWORDS.some(k => b.includes(k))) return 'phk_mit';
  if (PHK_OHNE_KEYWORDS.some(k => b.includes(k))) return 'phk_ohne';
  return null;
}

function kategorieFromFunktion(funktion) {
  const b = (funktion || '').toLowerCase().trim();
  if (!b) return 'pflege';
  if (b.includes('verwaltung') || b.includes('verwaltungs') || b.includes('büro') || b.includes('sekretär') || b.includes('empfang')) return 'verwaltung';
  if (b.includes('reinigung') || b.includes('hauswirtschaft') || b.includes('küche') || b.includes('koch')) return 'kueche_reinigung';
  if (b.includes('nachtwache') || b.includes('nacht')) return 'nachtwache';
  if (b.includes('pflegedienstleitung') || b.includes('pdl')) return 'pflegedienstleitung';
  if (b.includes('leitung')) return 'leitung';
  if (b.includes('betreuung') || b.includes('43b')) return 'betreuung_43b';
  if (b.includes('azubi') || b.includes('auszubildende')) return 'azubi';
  return 'pflege';
}

function werktage(von, bis) {
  if (!von || !bis) return 1;
  const start = new Date(von);
  const end = new Date(bis);
  if (end < start) return 1;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count || 1;
}

// === Sachkosten-Helper (aus sachkostenUtils.js) ===
function categorizeSachkonto(sachkonto, zuordnungen) {
  if (!sachkonto) return null;
  const s = String(sachkonto).trim();
  const exakt = zuordnungen.find(z => z.aktiv && z.sachkonto_exakt && String(z.sachkonto_exakt).trim() === s);
  if (exakt) return exakt.kategorie_id;
  const range = zuordnungen.find(z => {
    if (!z.aktiv || !z.sachkonto_von) return false;
    const von = String(z.sachkonto_von).trim();
    const bis = z.sachkonto_bis ? String(z.sachkonto_bis).trim() : von;
    return s >= von && s <= bis;
  });
  return range ? range.kategorie_id : null;
}

function computeBuchungsschluessel(row) {
  return `${row.buchungsdatum}|${row.belegnummer || ''}|${row.sachkonto || ''}|${row.nettobetrag || 0}|${row.lieferant || ''}`;
}

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// === Mitarbeiter Import (DATEV + MediFox) mit Profil-basiertem Merge ===
// profile: 'stammdaten' (MediFox), 'gehalt' (DATEV Gehaltsbestandteile), 'sv' (DATEV SV-Anteile)
export async function processMitarbeiter(base44, einrichtungId, file_url, mode, profile = null) {
  const isDatev = mode === 'datev';
  const resp = await base44.functions.invoke('parseMitarbeiterExcel', { file_url, mode });
  const result = resp.data;
  if (!result?.success) return { success: false, error: result?.error || 'Parse-Fehler', created: 0, updated: 0 };

  const rawRows = Array.isArray(result.rows) ? result.rows : [];
  const existing = await base44.entities.Mitarbeiter.filter({ einrichtung_id: einrichtungId });
  const byPnr = {}, byName = {};
  existing.forEach(m => {
    const pnr = String(m.personalnummer || '').trim();
    const nm = String(m.name || '').trim().toLowerCase();
    if (pnr) byPnr[pnr] = m;
    if (nm) byName[nm] = m;
  });

  let wohnbereichMap = {};
  if (!isDatev) {
    const wbs = await base44.entities.Wohnbereich.filter({ einrichtung_id: einrichtungId });
    wbs.forEach(wb => { const nm = String(wb.name || '').trim().toLowerCase(); if (nm) wohnbereichMap[nm] = wb.id; });
  }

  const byKey = {};
  rawRows.forEach(r => {
    const pnr = String(r.personalnummer || '').trim();
    const name = String(r.name || '').trim();
    if (!name && !pnr) return;
    const key = pnr || `__noPnr_${name.toLowerCase()}`;
    if (!byKey[key]) byKey[key] = { ...r, name, personalnummer: pnr };
  });

  const parsed = Object.values(byKey).map(r => {
    const gfbStd = Number(r.monatsstunden_gfb) || 0;
    const vk = gfbStd > 0
      ? Math.round((gfbStd / 173.33) * 100) / 100
      : (r.wochenstunden > 0 ? Math.round((r.wochenstunden / 40) * 100) / 100 : 0);
    let existingRec = null;
    if (r.personalnummer && byPnr[r.personalnummer]) existingRec = byPnr[r.personalnummer];
    else if (r.name && byName[r.name.toLowerCase()]) existingRec = byName[r.name.toLowerCase()];
    const berufsbezeichnung = !isDatev ? (r.beruf || r.funktion || '') : (r.beruf || '');
    const wohnbereich_id = !isDatev && r.wohnbereich ? (wohnbereichMap[r.wohnbereich.toLowerCase()] || '') : '';
    let vkFields = { vk_pfk: 0, vk_phk_mit_ausbildung: 0, vk_phk_ohne_ausbildung: 0 };
    if (!isDatev && berufsbezeichnung) {
      const typ = classifyFunktion(berufsbezeichnung);
      if (typ === 'pfk') vkFields.vk_pfk = vk;
      else if (typ === 'phk_mit') vkFields.vk_phk_mit_ausbildung = vk;
      else if (typ === 'phk_ohne') vkFields.vk_phk_ohne_ausbildung = vk;
    }
    return { ...r, berufsbezeichnung, wohnbereich_id, ...vkFields, monatsstunden_gfb: gfbStd, vk_anteil: vk,
      kategorie: !isDatev && berufsbezeichnung ? kategorieFromFunktion(berufsbezeichnung) : 'pflege',
      aktiv: true, einrichtung_id: einrichtungId, exists: !!existingRec, existing_id: existingRec?.id || null };
  });

  const valid = parsed.filter(r => r.name);

  // --- Profil-basiertes Mapping: nur Felder dieses Profils werden geschrieben ---
  // Jedes Profil definiert genau die Felder, die es aktualisieren darf (Partial-Update).
  const round2 = (n) => Math.round((n || 0) * 100) / 100;

  function buildGehaltFields(r) {
    const u = {};
    if (r.monatsgehalt_brutto) u.monatsgehalt_brutto = round2(r.monatsgehalt_brutto);
    if (r.funktionszulagen) u.funktionszulagen = round2(r.funktionszulagen);
    if (r.zuschlaege_steuerfrei) u.zuschlaege_steuerfrei = round2(r.zuschlaege_steuerfrei);
    if (r.wochenstunden) {
      u.wochenstunden = r.wochenstunden;
    }
    u.vk_anteil = r.monatsstunden_gfb > 0
      ? round2(r.monatsstunden_gfb / 173.33)
      : (r.wochenstunden > 0 ? round2(r.wochenstunden / 40) : 0);
    if (r.tarifgruppe) u.tarifgruppe = r.tarifgruppe;
    if (r.tarifstufe) u.tarifstufe = r.tarifstufe;
    u.ist_gfb = r.monatsstunden_gfb > 0;
    u.monatsstunden_gfb = r.monatsstunden_gfb > 0 ? r.monatsstunden_gfb : 0;
    return u;
  }

  function buildSvFields(r) {
    const u = {};
    if (r.sv_ag_anteil) u.sv_ag_anteil = round2(r.sv_ag_anteil);
    return u;
  }

  function buildStammdatenFields(r) {
    const u = {};
    if (r.berufsbezeichnung) {
      u.berufsbezeichnung = r.berufsbezeichnung; u.kategorie = r.kategorie;
      u.vk_pfk = r.vk_pfk || 0; u.vk_phk_mit_ausbildung = r.vk_phk_mit_ausbildung || 0; u.vk_phk_ohne_ausbildung = r.vk_phk_ohne_ausbildung || 0;
    }
    if (r.funktion) u.funktion = r.funktion;
    if (r.wohnbereich_id) u.wohnbereich_id = r.wohnbereich_id;
    if (r.wochenstunden) u.wochenstunden = r.wochenstunden;
    const stellenumfang = Number(r.stellenumfang_prozent) || 0;
    if (stellenumfang > 0) {
      u.vk_anteil = round2(stellenumfang / 100);
    } else if (r.monatsstunden_gfb > 0) {
      u.vk_anteil = round2(r.monatsstunden_gfb / 173.33);
    } else if (r.wochenstunden > 0) {
      u.vk_anteil = round2(r.wochenstunden / 40);
    }
    if (r.monatsstunden_gfb > 0) {
      u.ist_gfb = true;
      u.monatsstunden_gfb = r.monatsstunden_gfb;
    }
    if (r.eintrittsdatum) u.eintrittsdatum = r.eintrittsdatum;
    if (r.befristet_bis) u.befristet_bis = r.befristet_bis;
    return u;
  }

  function buildLsFields(r) {
    const u = {};
    if (r.personalnummer) u.personalnummer = r.personalnummer;
    if (r.monatsgehalt_brutto) u.monatsgehalt_brutto = round2(r.monatsgehalt_brutto);
    if (r.tarifgruppe) u.tarifgruppe = r.tarifgruppe;
    if (r.tarifstufe) u.tarifstufe = r.tarifstufe;
    return u;
  }

  // Ohne Profil: altes Verhalten (alle Felder) für Abwärtskompatibilität
  function buildAllFields(r) {
    const u = {};
    if (r.wochenstunden) { u.wochenstunden = r.wochenstunden; }
    u.vk_anteil = r.monatsstunden_gfb > 0
      ? round2(r.monatsstunden_gfb / 173.33)
      : (r.wochenstunden > 0 ? round2(r.wochenstunden / 40) : 0);
    if (r.tarifgruppe) u.tarifgruppe = r.tarifgruppe;
    if (r.tarifstufe) u.tarifstufe = r.tarifstufe;
    u.ist_gfb = r.monatsstunden_gfb > 0; u.monatsstunden_gfb = r.monatsstunden_gfb > 0 ? r.monatsstunden_gfb : 0;
    if (!isDatev) {
      if (r.berufsbezeichnung) {
        u.berufsbezeichnung = r.berufsbezeichnung; u.kategorie = r.kategorie;
        u.vk_pfk = r.vk_pfk || 0; u.vk_phk_mit_ausbildung = r.vk_phk_mit_ausbildung || 0; u.vk_phk_ohne_ausbildung = r.vk_phk_ohne_ausbildung || 0;
      }
      if (r.funktion) u.funktion = r.funktion;
      if (r.wohnbereich_id) u.wohnbereich_id = r.wohnbereich_id;
    }
    if (isDatev) {
      if (r.monatsgehalt_brutto) u.monatsgehalt_brutto = round2(r.monatsgehalt_brutto);
      if (r.sv_ag_anteil) u.sv_ag_anteil = round2(r.sv_ag_anteil);
      if (r.funktionszulagen) u.funktionszulagen = round2(r.funktionszulagen);
      if (r.zuschlaege_steuerfrei) u.zuschlaege_steuerfrei = round2(r.zuschlaege_steuerfrei);
    }
    return u;
  }

  function buildCreateFields(r) {
    const rest = { ...r };
    delete rest.exists; delete rest.existing_id; delete rest.beruf; delete rest.wohnbereich; delete rest.vorname;
    rest.vk_anteil = rest.monatsstunden_gfb > 0
      ? round2(rest.monatsstunden_gfb / 173.33)
      : (rest.wochenstunden > 0 ? round2(rest.wochenstunden / 40) : 0);
    rest.ist_gfb = rest.monatsstunden_gfb > 0;
    rest.monatsstunden_gfb = rest.monatsstunden_gfb > 0 ? rest.monatsstunden_gfb : 0;
    return rest;
  }

  // Felder für Updates je Profil auswählen
  const toCreate = valid.filter(r => !r.exists).map(buildCreateFields);
  const toUpdateRaw = valid.filter(r => r.exists && r.existing_id).map(r => {
    let fields;
    if (profile === 'gehalt') fields = buildGehaltFields(r);
    else if (profile === 'sv') fields = buildSvFields(r);
    else if (profile === 'stammdaten') fields = buildStammdatenFields(r);
    else if (profile === 'ls') fields = buildLsFields(r);
    else fields = buildAllFields(r);
    return { id: r.existing_id, ...fields };
  });
  // Duplikate ausschließen: mehrere Zeilen können denselben Mitarbeiter matchen
  const seenIds = new Set();
  const toUpdate = toUpdateRaw.filter(u => {
    if (seenIds.has(u.id)) return false;
    seenIds.add(u.id);
    return true;
  });

  let created = 0, updated = 0;
  if (toCreate.length > 0) { await base44.entities.Mitarbeiter.bulkCreate(toCreate); created = toCreate.length; }
  if (toUpdate.length > 0) { await base44.entities.Mitarbeiter.bulkUpdate(toUpdate); updated = toUpdate.length; }
  return { success: true, created, updated, detail: profile ? `Profil: ${profile}` : undefined };
}

// === Sachkosten Import ===
export async function processSachkosten(base44, einrichtungId, file_url, folderName) {
  const resp = await base44.functions.invoke('parseSachkostenExcel', { file_url });
  const result = resp.data;
  if (!result?.success || !result.rows?.length) return { success: false, error: 'Keine Daten gefunden', created: 0, updated: 0 };

  const zuordnungen = await base44.entities.SachkontoZuordnungen.filter({ aktiv: true });

  // Fallback-Kategorie aus Ordnername ermitteln (z.B. "Export Wäscherei" → "Wäsche")
  let fallbackKatId = null;
  if (folderName) {
    const folderKey = folderName.replace(/^Export\s+/i, '').trim().toLowerCase();
    const kategorien = await base44.entities.SachkostenKategorien.filter({ aktiv: true });
    const match = kategorien.find(k => {
      const kn = (k.name || '').toLowerCase();
      return kn === folderKey || kn.includes(folderKey) || folderKey.includes(kn);
    });
    if (match) fallbackKatId = match.id;
  }
  const monate = [...new Set(result.rows.map(r => r.leistungsmonat).filter(Boolean))];
  const existing = [];
  for (const m of monate) { const data = await base44.entities.SachkostenAusgaben.filter({ einrichtung_id: einrichtungId, leistungsmonat: m }); existing.push(...data); }
  const existingKeys = new Set(existing.map(a => a.buchungsschluessel).filter(Boolean));

  const processed = result.rows.map(row => {
    const katId = categorizeSachkonto(row.sachkonto, zuordnungen) || fallbackKatId;
    const schluessel = computeBuchungsschluessel(row);
    return { ...row, kategorie_id: katId, zuordnungsstatus: katId ? 'zugeordnet' : 'offen', buchungsschluessel: schluessel, isDuplicate: existingKeys.has(schluessel) };
  });

  const toImport = processed.filter(r => !r.isDuplicate);
  const duplikate = processed.filter(r => r.isDuplicate);
  const betragstyp = 'netto';
  const records = toImport.map(r => ({
    buchungsdatum: r.buchungsdatum, leistungsmonat: r.leistungsmonat, belegnummer: r.belegnummer || '', lieferant: r.lieferant || '',
    sachkonto: r.sachkonto || '', kostenstelle: r.kostenstelle || '', buchungstext: r.buchungstext || '',
    nettobetrag: r.nettobetrag || 0, bruttobetrag: r.bruttobetrag || 0,
    verwendeter_betrag: betragstyp === 'netto' ? r.nettobetrag : r.bruttobetrag,
    kategorie_id: r.kategorie_id || '', einrichtung_id: einrichtungId, import_vorgang_id: crypto.randomUUID(),
    buchungsschluessel: r.buchungsschluessel, zuordnungsstatus: r.zuordnungsstatus, ist_storniert: false,
  }));
  if (records.length > 0) await base44.entities.SachkostenAusgaben.bulkCreate(records);
  const gesamtsumme = round2(records.reduce((s, r) => s + r.verwendeter_betrag, 0));
  return { success: true, created: records.length, updated: 0, duplicates: duplikate.length, gesamtsumme };
}

// === Fehlzeiten Import ===
export async function processFehlzeiten(base44, einrichtungId, file_url) {
  const resp = await base44.functions.invoke('parseFehlzeitenExcel', { file_url });
  const result = resp.data;
  if (!result?.success) return { success: false, error: result?.error || 'Parse-Fehler', created: 0, updated: 0 };

  const mitarbeiter = await base44.entities.Mitarbeiter.filter({ einrichtung_id: einrichtungId });
  const byPnr = {}, byName = {};
  mitarbeiter.forEach(ma => { const pnr = String(ma.personalnummer || '').trim(); const nm = String(ma.name || '').trim().toLowerCase(); if (pnr) byPnr[pnr] = ma; if (nm) byName[nm] = ma; });

  const parsed = (result.rows || []).map(r => {
    let matched = null;
    if (r.personalnummer && byPnr[r.personalnummer]) matched = byPnr[r.personalnummer];
    else if (r.name && byName[r.name.toLowerCase()]) matched = byName[r.name.toLowerCase()];
    const tage = r.tage > 0 ? r.tage : werktage(r.von_datum, r.bis_datum);
    return { ...r, mitarbeiter_id: matched?.id || '', tage };
  }).filter(r => r.mitarbeiter_id);

  const records = parsed.map(r => ({ mitarbeiter_id: r.mitarbeiter_id, einrichtung_id: einrichtungId, art: r.art, von_datum: r.von_datum, bis_datum: r.bis_datum || r.von_datum, tage: r.tage, bemerkung: r.bemerkung || '' }));
  if (records.length > 0) await base44.entities.MitarbeiterFehlzeiten.bulkCreate(records);
  return { success: true, created: records.length, updated: 0, skipped: (result.rows || []).length - records.length };
}

// === MediFox-Abrechnung Import ===
export async function processMediFoxAbrechnung(base44, einrichtungId, file_url) {
  const resp = await base44.functions.invoke('parseMediFoxAbrechnung', { file_url });
  const result = resp.data;
  if (!result?.success || !result.rows?.length) return { success: false, error: result?.error || 'Keine Daten', created: 0, updated: 0 };

  const { jahr, monat } = result.rows[0];
  await base44.entities.MediFoxAbrechnung.deleteMany({ einrichtung_id: einrichtungId, jahr, monat });
  const records = result.rows.map(row => ({ ...row, einrichtung_id: einrichtungId, zeitraum_von: result.zeitraum_von || null, zeitraum_bis: result.zeitraum_bis || null }));
  await base44.entities.MediFoxAbrechnung.bulkCreate(records);
  return { success: true, created: records.length, updated: 0 };
}

// === Bewohner-Pflegegrade Import ===
export async function processBewohner(base44, einrichtungId, file_url) {
  const resp = await base44.functions.invoke('parseBewohnerImport', { file_url });
  const parsed = resp.data;
  if (parsed.error) return { success: false, error: parsed.error, created: 0, updated: 0 };

  const wohnbereiche = await base44.entities.Wohnbereich.filter({ einrichtung_id: einrichtungId });
  const groups = parsed.groups || [];
  const updates = {};
  groups.forEach(g => {
    const gl = g.bereich.toLowerCase();
    const match = wohnbereiche.find(wb => {
      const wl = wb.name.toLowerCase();
      return wl === gl || gl.includes(wl) || wl.includes(gl) || gl.includes(wb.name.toLowerCase().replace(/[^a-z0-9]/g, '')) || wb.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(gl.replace(/[^a-z0-9]/g, ''));
    });
    if (!match) return;
    if (!updates[match.id]) updates[match.id] = { ruestige: 0, pg0: 0, pg1: 0, pg2: 0, pg3: 0, pg4: 0, pg5: 0 };
    updates[match.id].ruestige += g.ruestige; updates[match.id].pg0 += g.pg0; updates[match.id].pg1 += g.pg1;
    updates[match.id].pg2 += g.pg2; updates[match.id].pg3 += g.pg3; updates[match.id].pg4 += g.pg4; updates[match.id].pg5 += g.pg5;
  });
  let updated = 0;
  for (const wbId of Object.keys(updates)) {
    const u = updates[wbId];
    await base44.entities.Wohnbereich.update(wbId, { belegung_ruestige: u.ruestige, belegung_pg0: u.pg0, belegung_pg1: u.pg1, belegung_pg2: u.pg2, belegung_pg3: u.pg3, belegung_pg4: u.pg4, belegung_pg5: u.pg5, stichtag: new Date().toISOString().split('T')[0] });
    updated++;
  }
  return { success: true, created: 0, updated, detail: `${groups.length} Bereiche, ${updated} Wohnbereiche aktualisiert` };
}

// === Bewohner-Kosten Import (LLM-basiert) ===
const FIELD_MAP = {
  bewohner_name: ['bewohner_name', 'name', 'bewohner', 'bewohnername'],
  zimmer: ['zimmer', 'zimmer_nr', 'room'],
  pflegegrad: ['pflegegrad', 'pg'],
  anteil_pflegekasse: ['anteil_pflegekasse', 'pflegekasse', 'pflegekasse_soll'],
  anteil_sozialamt: ['anteil_sozialamt', 'sozialamt', 'sozialamt_soll'],
  anteil_bewohner: ['anteil_bewohner', 'bewohner_anteil', 'eigenanteil'],
  betrag_gesamt: ['betrag_gesamt', 'gesamt', 'gesamtbetrag'],
  bezahlt_pflegekasse: ['bezahlt_pflegekasse', 'pflegekasse_ist', 'pflegekasse_bez'],
  bezahlt_sozialamt: ['bezahlt_sozialamt', 'sozialamt_ist', 'sozialamt_bez'],
  bezahlt_bewohner: ['bezahlt_bewohner', 'bewohner_ist', 'bewohner_bez'],
  sozialamt_wohngeld: ['sozialamt_wohngeld', 'wohngeld'],
  sozialamt_pflegewohngeld: ['sozialamt_pflegewohngeld', 'pflegewohngeld'],
  sozialamt_uebergeleitet_rente: ['sozialamt_uebergeleitet_rente', 'uebergeleitet_rente', 'rente'],
  sozialamt_sozialhilfe: ['sozialamt_sozialhilfe', 'sozialhilfe'],
  bemerkung: ['bemerkung', 'notiz', 'note'],
};

function mapBewohnerRow(rawRow) {
  const lower = {};
  Object.keys(rawRow).forEach(k => { lower[k.toLowerCase().replace(/\s+/g, '_')] = rawRow[k]; });
  const result = {};
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    for (const alias of aliases) { if (lower[alias] !== undefined && lower[alias] !== null && lower[alias] !== '') { result[field] = lower[alias]; break; } }
  }
  return result;
}

function calcStatus(bezahlt, gesamt) {
  if (bezahlt >= gesamt && gesamt > 0) return 'bezahlt';
  if (bezahlt > 0) return 'teilweise_bezahlt';
  return 'offen';
}

function extractMonatJahrFromFilename(fileName) {
  let m = fileName.match(/(\d{4})[-_](\d{2})/);
  if (m) return { jahr: parseInt(m[1]), monat: parseInt(m[2]) };
  m = fileName.match(/(\d{2})[-_](\d{4})/);
  if (m) return { jahr: parseInt(m[2]), monat: parseInt(m[1]) };
  const now = new Date();
  return { jahr: now.getFullYear(), monat: now.getMonth() + 1 };
}

export async function processBewohnerKosten(base44, einrichtungId, file_url, fileName) {
  const { jahr, monat } = extractMonatJahrFromFilename(fileName);
  const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url,
    json_schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              bewohner_name: { type: 'string' }, zimmer: { type: 'string' }, pflegegrad: { type: 'string' },
              anteil_pflegekasse: { type: 'number' }, anteil_sozialamt: { type: 'number' }, anteil_bewohner: { type: 'number' },
              betrag_gesamt: { type: 'number' }, bezahlt_pflegekasse: { type: 'number' }, bezahlt_sozialamt: { type: 'number' },
              bezahlt_bewohner: { type: 'number' }, sozialamt_wohngeld: { type: 'number' }, sozialamt_pflegewohngeld: { type: 'number' },
              sozialamt_uebergeleitet_rente: { type: 'number' }, sozialamt_sozialhilfe: { type: 'number' }, bemerkung: { type: 'string' },
            },
          },
        },
      },
    },
  });
  if (result.status !== 'success' || !result.output?.rows?.length) return { success: false, error: result.details || 'Keine Daten', created: 0, updated: 0 };

  const rows = result.output.rows;
  const existing = await base44.entities.BewohnerHeimkosten.filter({ einrichtung_id: einrichtungId, monat, jahr });
  const nameMatch = (name) => { const n = (name || '').toLowerCase().trim(); return existing.find(e => (e.bewohner_name || '').toLowerCase().trim() === n); };
  const toUpdate = [], toCreate = [];
  rows.forEach(raw => {
    const row = mapBewohnerRow(raw);
    if (!row.bewohner_name) return;
    const match = nameMatch(row.bewohner_name);
    if (match) {
      const bezahlt = (match.bezahlt_pflegekasse || 0) + (match.bezahlt_sozialamt || 0) + (match.bezahlt_bewohner || 0);
      const gesamt = parseFloat(row.betrag_gesamt) || 0;
      toUpdate.push({
        id: match.id, zimmer: row.zimmer || match.zimmer, pflegegrad: row.pflegegrad || match.pflegegrad,
        anteil_pflegekasse: parseFloat(row.anteil_pflegekasse) || 0, anteil_sozialamt: parseFloat(row.anteil_sozialamt) || 0,
        anteil_bewohner: parseFloat(row.anteil_bewohner) || 0, betrag_gesamt: gesamt,
        sozialamt_wohngeld: parseFloat(row.sozialamt_wohngeld) || 0, sozialamt_pflegewohngeld: parseFloat(row.sozialamt_pflegewohngeld) || 0,
        sozialamt_uebergeleitet_rente: parseFloat(row.sozialamt_uebergeleitet_rente) || 0, sozialamt_sozialhilfe: parseFloat(row.sozialamt_sozialhilfe) || 0,
        betrag_bezahlt: bezahlt, status: calcStatus(bezahlt, gesamt),
      });
    } else {
      const bezahlt = (parseFloat(row.bezahlt_pflegekasse) || 0) + (parseFloat(row.bezahlt_sozialamt) || 0) + (parseFloat(row.bezahlt_bewohner) || 0);
      toCreate.push({
        ...row, einrichtung_id: einrichtungId, monat, jahr, betrag_bezahlt: bezahlt,
        status: calcStatus(bezahlt, parseFloat(row.betrag_gesamt) || 0),
        anteil_pflegekasse: parseFloat(row.anteil_pflegekasse) || 0, anteil_sozialamt: parseFloat(row.anteil_sozialamt) || 0,
        anteil_bewohner: parseFloat(row.anteil_bewohner) || 0, betrag_gesamt: parseFloat(row.betrag_gesamt) || 0,
        bezahlt_pflegekasse: parseFloat(row.bezahlt_pflegekasse) || 0, bezahlt_sozialamt: parseFloat(row.bezahlt_sozialamt) || 0,
        bezahlt_bewohner: parseFloat(row.bezahlt_bewohner) || 0, sozialamt_wohngeld: parseFloat(row.sozialamt_wohngeld) || 0,
        sozialamt_pflegewohngeld: parseFloat(row.sozialamt_pflegewohngeld) || 0,
        sozialamt_uebergeleitet_rente: parseFloat(row.sozialamt_uebergeleitet_rente) || 0,
        sozialamt_sozialhilfe: parseFloat(row.sozialamt_sozialhilfe) || 0,
        pflegegrad: row.pflegegrad || 'PG3', zimmer: row.zimmer || '', bemerkung: row.bemerkung || '',
      });
    }
  });
  if (toCreate.length > 0) await base44.entities.BewohnerHeimkosten.bulkCreate(toCreate);
  if (toUpdate.length > 0) await base44.entities.BewohnerHeimkosten.bulkUpdate(toUpdate);
  return { success: true, created: toCreate.length, updated: toUpdate.length, detail: `Monat ${monat}/${jahr}` };
}

// === Kontoblatt Import → Heimkosten ===
export async function processKontoblatt(base44, einrichtungId, file_url) {
  const resp = await base44.functions.invoke('parseKontoblatt', { file_url });
  const result = resp.data;
  if (!result?.success) return { success: false, error: result?.error || 'Parse-Fehler', created: 0, updated: 0 };
  const accountName = result.accountName || 'Kontoblatt';
  let created = 0, updated = 0;
  for (const m of (result.months || [])) {
    const monatDate = `${m.monat}-01`;
    const existing = await base44.entities.Heimkosten.filter({ einrichtung_id: einrichtungId, monat: monatDate, kostenart: 'Sonstiges' });
    if (existing.length > 0) {
      await base44.entities.Heimkosten.update(existing[0].id, { gesamtbetrag: m.gesamtbetrag, bemerkung: `Kontoblatt: ${accountName} (${m.anzahl} Buchungen)` });
      updated++;
    } else {
      await base44.entities.Heimkosten.create({ einrichtung_id: einrichtungId, bereich: 'stationär', kostenart: 'Sonstiges', monat: monatDate, gesamtbetrag: m.gesamtbetrag, belegungstage: 0, bemerkung: `Kontoblatt: ${accountName} (${m.anzahl} Buchungen)` });
      created++;
    }
  }
  return { success: true, created, updated, detail: `${accountName}: ${result.months?.length || 0} Monate` };
}