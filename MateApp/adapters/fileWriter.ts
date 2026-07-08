import { Paths, File, EncodingType } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { exportJourneyXlsx, exportMasterXlsx, exportJourneyCsv, exportMasterCsv } from './index';

export async function exportJourneyToFile(journeyId: string, format: 'xlsx' | 'csv' = 'xlsx'): Promise<string | null> {
  if (format === 'csv') {
    const result = await exportJourneyCsv(journeyId);
    if (!result) return null;
    const file = new File(Paths.cache, result.fileName);
    file.write(result.content);
    await shareAsync(file.uri, { mimeType: 'text/csv' });
    return file.uri;
  }
  const result = await exportJourneyXlsx(journeyId);
  if (!result) return null;
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  await shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}

export async function exportMasterToFile(format: 'xlsx' | 'csv' = 'xlsx'): Promise<string | null> {
  if (format === 'csv') {
    const result = await exportMasterCsv();
    if (!result) return null;
    const file = new File(Paths.cache, result.fileName);
    file.write(result.content);
    await shareAsync(file.uri, { mimeType: 'text/csv' });
    return file.uri;
  }
  const result = await exportMasterXlsx();
  if (!result) return null;
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  await shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}
