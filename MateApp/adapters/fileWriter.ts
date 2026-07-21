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
    const dbName = await exportJourneyDb(journeyIds);
    const src = new File(sqliteDir(), dbName);
    const dest = new File(Paths.cache, dbName.replace(/\.db$/, '-export.db'));
    src.copy(dest, { overwrite: true });
    await shareAsync(dest.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Export Journey' });
    return dest.uri;
  }
  const singleId = journeyIds[0];
  if (format === 'csv') {
    const parts = await exportJourneyCsvParts(singleId);
    if (parts.length === 0) return null;
    const nameLine = parts[0].content.split('\n')[1] || '';
    const journeyName = nameLine.split(',')[0]?.replace(/^"+|"+$/g, '').replace(/[^a-zA-Z0-9]/g, '_') || 'export';
    const zipName = `journey_${journeyName}.zip`;
    const file = await zipCsvParts(parts, zipName);
    await shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Export Journey' });
    return file.uri;
  }
  const result = await exportJourneyXlsx(singleId);
  if (!result) return null;
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  await shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}

export async function exportMasterToFile(format: ExportFormat = 'xlsx'): Promise<string | null> {
  if (format === 'db') {
    const src = new File(sqliteDir(), 'mateapp.db');
    if (!src.exists) return null;
    const dest = new File(Paths.cache, 'mateapp.db');
    src.copy(dest, { overwrite: true });
    await shareAsync(dest.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Export All Data' });
    return dest.uri;
  }
  if (format === 'csv') {
    const parts = await exportMasterCsvParts();
    if (parts.length === 0) return null;
    const file = await zipCsvParts(parts, 'mateapp_master_export.zip');
    await shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Export All Data' });
    return file.uri;
  }
  const result = await exportMasterXlsx();
  if (!result) return null;
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  await shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}
