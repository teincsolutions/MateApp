import { Paths, File, Directory, EncodingType } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import JSZip from 'jszip';
import {
  exportJourneyXlsx, exportMasterXlsx, exportJourneyCsvParts, exportMasterCsvParts, exportJourneyDb,
} from './index';
import { CsvPart } from '@mateapp/core';

export type ExportFormat = 'xlsx' | 'csv' | 'db';

function sqliteDir(): Directory {
  return new Directory(Paths.document, 'SQLite');
}

async function zipCsvParts(parts: CsvPart[], zipName: string): Promise<File> {
  const zip = new JSZip();
  for (const part of parts) {
    zip.file(part.name, part.content);
  }
  const blob = await zip.generateAsync({ type: 'uint8array' });
  const file = new File(Paths.cache, zipName);
  file.write(blob);
  return file;
}

export async function exportJourneyToFile(journeyIds: string[], format: ExportFormat = 'xlsx'): Promise<string | null> {
  if (format === 'db') {
    console.log('[exportJourneyToFile] Starting .db export for journeys:', journeyIds);
    const dbName = await exportJourneyDb(journeyIds);
    console.log('[exportJourneyToFile] DB created:', dbName);
    const src = new File(sqliteDir(), dbName);
    if (!src.exists) {
      const err = `Source DB file not found at ${src.uri}. Expo SQLite may store databases at a different location.`;
      console.error('[exportJourneyToFile]', err);
      throw new Error(err);
    }
    const dest = new File(Paths.cache, dbName.replace(/\.db$/, '-export.db'));
    try {
      src.copy(dest, { overwrite: true });
      console.log('[exportJourneyToFile] Copied to cache:', dest.uri);
    } catch (copyErr) {
      console.error('[exportJourneyToFile] Copy failed:', copyErr);
      throw new Error(`Failed to copy DB to cache: ${copyErr instanceof Error ? copyErr.message : copyErr}`);
    }
    const shareUri = dest.contentUri || dest.uri;
    console.log('[exportJourneyToFile] Sharing URI:', shareUri);
    await shareAsync(shareUri, { mimeType: 'application/octet-stream', dialogTitle: 'Export Journey' });
    return dest.uri;
  }
  const singleId = journeyIds[0];
  if (format === 'csv') {
    console.log('[exportJourneyToFile] Starting CSV export for journey:', singleId);
    const parts = await exportJourneyCsvParts(singleId);
    if (parts.length === 0) {
      console.warn('[exportJourneyToFile] No CSV parts returned');
      return null;
    }
    const nameLine = parts[0].content.split('\n')[1] || '';
    const journeyName = nameLine.split(',')[0]?.replace(/^"+|"+$/g, '').replace(/[^a-zA-Z0-9]/g, '_') || 'export';
    const zipName = `journey_${journeyName}.zip`;
    const file = await zipCsvParts(parts, zipName);
    console.log('[exportJourneyToFile] CSV zip created:', file.uri);
    const shareUri = file.contentUri || file.uri;
    await shareAsync(shareUri, { mimeType: 'application/zip', dialogTitle: 'Export Journey' });
    return file.uri;
  }
  console.log('[exportJourneyToFile] Starting XLSX export for journey:', singleId);
  const result = await exportJourneyXlsx(singleId);
  if (!result) {
    console.warn('[exportJourneyToFile] XLSX export returned null');
    return null;
  }
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  console.log('[exportJourneyToFile] XLSX file created:', file.uri);
  const shareUri = file.contentUri || file.uri;
  await shareAsync(shareUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}

export async function exportMasterToFile(format: ExportFormat = 'xlsx'): Promise<string | null> {
  console.log('[exportMasterToFile] Starting export, format:', format);
  if (format === 'db') {
    const src = new File(sqliteDir(), 'mateapp.db');
    if (!src.exists) {
      console.warn('[exportMasterToFile] mateapp.db not found at', src.uri);
      return null;
    }
    const dest = new File(Paths.cache, 'mateapp.db');
    try {
      src.copy(dest, { overwrite: true });
    } catch (copyErr) {
      console.error('[exportMasterToFile] Copy failed:', copyErr);
      throw new Error(`Failed to copy DB: ${copyErr instanceof Error ? copyErr.message : copyErr}`);
    }
    console.log('[exportMasterToFile] Copied to cache:', dest.uri);
    const shareUri = dest.contentUri || dest.uri;
    await shareAsync(shareUri, { mimeType: 'application/octet-stream', dialogTitle: 'Export All Data' });
    return dest.uri;
  }
  if (format === 'csv') {
    const parts = await exportMasterCsvParts();
    if (parts.length === 0) {
      console.warn('[exportMasterToFile] No CSV parts returned');
      return null;
    }
    const file = await zipCsvParts(parts, 'mateapp_master_export.zip');
    console.log('[exportMasterToFile] CSV zip created:', file.uri);
    const shareUri = file.contentUri || file.uri;
    await shareAsync(shareUri, { mimeType: 'application/zip', dialogTitle: 'Export All Data' });
    return file.uri;
  }
  console.log('[exportMasterToFile] Starting XLSX master export');
  const result = await exportMasterXlsx();
  if (!result) {
    console.warn('[exportMasterToFile] XLSX master export returned null');
    return null;
  }
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  console.log('[exportMasterToFile] XLSX file created:', file.uri);
  const shareUri = file.contentUri || file.uri;
  await shareAsync(shareUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}
