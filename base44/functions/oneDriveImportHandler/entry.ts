import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processMitarbeiter, processSachkosten, processFehlzeiten, processMediFoxAbrechnung, processBewohner, processBewohnerKosten, processKontoblatt } from '../../shared/oneDriveImporters.ts';

// SharePoint-Bibliothek "Noventus-Care > Dokumente"
const SHAREPOINT_DRIVE_ID = 'b!zTfOOa-n90-EXekCEVRwzy-rF8UAIbtKh8yR4Zb9OEL_1-Hi_g7PQbS5aZJMfSIK';
const ROOT_PATH = '/8. Holding Noventus-Care/2. 0 Dashboard Synchronisation';

const BEREICH_MAP = {
  'Export Bewohner mit Einstufungen': { fn: 'bewohner', processor: (b, eid, url, fn) => processBewohner(b, eid, url) },
  'Export Gehaltsbestandteile': { fn: 'mitarbeiter_datev', processor: (b, eid, url, fn) => processMitarbeiter(b, eid, url, 'datev', 'gehalt') },
  'Export SV-Anteile': { fn: 'mitarbeiter_datev', processor: (b, eid, url, fn) => processMitarbeiter(b, eid, url, 'datev', 'sv') },
  'Export Lebensmittel': { fn: 'sachkosten', processor: (b, eid, url, fn, folderName) => processSachkosten(b, eid, url, folderName) },
  'Export Pflegebedarf': { fn: 'sachkosten', processor: (b, eid, url, fn, folderName) => processSachkosten(b, eid, url, folderName) },
  'Export Wäscherei': { fn: 'sachkosten', processor: (b, eid, url, fn, folderName) => processSachkosten(b, eid, url, folderName) },
  'Export Fehlzeiten': { fn: 'fehlzeiten', processor: (b, eid, url, fn) => processFehlzeiten(b, eid, url) },
  'Export MediFox-Abrechnung': { fn: 'medifox_abrechnung', processor: (b, eid, url, fn) => processMediFoxAbrechnung(b, eid, url) },
  'Export Bewohner-Kosten': { fn: 'bewohner_kosten', processor: (b, eid, url, fn) => processBewohnerKosten(b, eid, url, fn) },
  'Export Kontoblatt': { fn: 'kontoblatt', processor: (b, eid, url, fn) => processKontoblatt(b, eid, url) },
  'Export Mitarbeiter MediFox': { fn: 'mitarbeiter_medifox', processor: (b, eid, url, fn) => {
    const n = (fn || '').toLowerCase();
    const profile = n.includes('ls') ? 'ls' : 'stammdaten';
    return processMitarbeiter(b, eid, url, 'medifox', profile);
  } },
};

function stripNumberPrefix(name) {
  return name.replace(/^\d+\s+/, '').trim();
}

// Prioritäts-Reihenfolge für MediFox-Mitarbeiterlisten innerhalb desselben Ordners.
// 1 = Basis (komprimiert), 2 = LS, 3 = SMA, 4 = Rest.
// So wird zuerst die komplette Stammdaten-Liste eingespielt; LS und SMA
// ergänzen nur die Mitarbeiter, die noch nicht vorhanden sind.
function mediFoxFilePriority(fileName) {
  const n = (fileName || '').toLowerCase();
  if (n.includes('komprimiert') || n.includes('mitarbeiterliste')) return 1;
  if (n.includes('ls')) return 2;
  if (n.includes('sma')) return 3;
  return 4;
}

function sortMediFoxFiles(files) {
  return [...files].sort((a, b) => {
    const pa = mediFoxFilePriority(a.name);
    const pb = mediFoxFilePriority(b.name);
    if (pa !== pb) return pa - pb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

async function graphRequest(accessToken, path) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('one_drive');
    const driveId = SHAREPOINT_DRIVE_ID;

    // 1. Root-Ordner "2. 0 Dashboard Synchronisation" über Pfad auflösen
    const rootRes = await graphRequest(accessToken, `/drives/${driveId}/root:${ROOT_PATH}:/children?$top=50`);
    const einrFolders = (rootRes.value || []).filter(i => i.folder);

    // 2. Alle Einrichtungen aus der DB laden
    const allEinrichtungen = await base44.asServiceRole.entities.Einrichtung.filter({});
    const results = [];

    for (const einrFolder of einrFolders) {
      const einrichtungName = stripNumberPrefix(einrFolder.name);
      const einrichtung = allEinrichtungen.find(e => {
        const eName = (e.name || '').toLowerCase().trim();
        const fName = einrichtungName.toLowerCase().trim();
        return eName === fName || eName.includes(fName) || fName.includes(eName);
      });

      if (!einrichtung) {
        results.push({ folder: einrFolder.name, status: 'skipped', reason: 'Einrichtung nicht gefunden' });
        continue;
      }

      // 3. "Export ..." Unterordner auflisten
      const subRes = await graphRequest(accessToken, `/drives/${driveId}/items/${einrFolder.id}/children?$top=50`);
      const subFolders = (subRes.value || []).filter(i => i.folder);

      for (const subFolder of subFolders) {
        const bereichConfig = BEREICH_MAP[subFolder.name];
        if (!bereichConfig) continue;

        // 4. Dateien im Export-Ordner auflisten
        const filesRes = await graphRequest(accessToken, `/drives/${driveId}/items/${subFolder.id}/children?$top=50`);
        let files = (filesRes.value || []).filter(i => i.file);
        // MediFox-Mitarbeiterlisten nach Priorität sortieren (komprimiert → LS → SMA)
        if (bereichConfig.fn === 'mitarbeiter_medifox') {
          files = sortMediFoxFiles(files);
          // SMA-Listen werden ignoriert
          files = files.filter(f => !(f.name || '').toLowerCase().includes('sma'));
        }

        for (const file of files) {
          const itemId = file.id;
          const lastMod = file.lastModifiedDateTime || '';

          // 5. Deduplikation: bereits erfolgreich mit gleicher Modified-Zeit verarbeitet?
          // Suche nach Dateiname + Einrichtung + Bereich (stabiler als item_id, die sich beim Ersetzen ändert)
          const existingLogs = await base44.asServiceRole.entities.OneDriveImportLog.filter({ dateiname: file.name, einrichtung_id: einrichtung.id, bereich: bereichConfig.fn });
          const alreadyProcessed = existingLogs.some(l => l.status === 'erfolg' && l.one_drive_modified === lastMod);
          if (alreadyProcessed) { results.push({ fileName: file.name, status: 'skipped' }); continue; }

          // 6. Datei herunterladen
          let file_url = file['@microsoft.graph.downloadUrl'];
          if (!file_url) {
            const downloadResp = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const buf = await downloadResp.arrayBuffer();
            const blob = new Blob([buf], { type: file.file?.mimeType || 'application/octet-stream' });
            const upload = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
            file_url = upload.file_url;
          }

          // 7. Import verarbeiten
          let result;
          try {
            result = await bereichConfig.processor(base44.asServiceRole, einrichtung.id, file_url, file.name, subFolder.name);
          } catch (err) {
            result = { success: false, error: err.message, created: 0, updated: 0 };
          }

          await base44.asServiceRole.entities.OneDriveImportLog.create({
            dateiname: file.name, importdatum: new Date().toISOString().split('T')[0],
            bereich: bereichConfig.fn, einrichtung_id: einrichtung.id, einrichtung_name: einrichtung.name,
            status: result.success ? 'erfolg' : 'fehler',
            detail: result.success ? (result.detail || `${result.created || 0} neu, ${result.updated || 0} aktualisiert`) : result.error,
            anzahl_neu: result.created || 0, anzahl_aktualisiert: result.updated || 0,
            one_drive_item_id: itemId, one_drive_modified: lastMod,
          });
          results.push({ fileName: file.name, einrichtung: einrichtung.name, bereich: subFolder.name, ...result });
        }
      }
    }

    return Response.json({ success: true, scanned: einrFolders.length, processed: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});