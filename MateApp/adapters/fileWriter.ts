import { Paths, File, EncodingType } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { exportJourneyXlsx, exportMasterXlsx } from './index';

export async function exportJourneyToFile(journeyId: string): Promise<string | null> {
  const result = await exportJourneyXlsx(journeyId);
  if (!result) return null;
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  await shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}

export async function exportMasterToFile(): Promise<string | null> {
  const result = await exportMasterXlsx();
  if (!result) return null;
  const file = new File(Paths.cache, result.fileName);
  file.write(result.base64, { encoding: EncodingType.Base64 });
  await shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return file.uri;
}
