import { Paths, File } from 'expo-file-system';
import { useSettingsStore } from '@mateapp/core';

const settingsFile = new File(Paths.document, 'mateapp-settings.json');

interface PersistedSettings {
  gpsInterval: number;
  minDistance: number;
}

export async function loadSettings(): Promise<void> {
  try {
    if (!settingsFile.exists) return;
    const raw = await settingsFile.text();
    const data: PersistedSettings = JSON.parse(raw);
    useSettingsStore.setState({
      gpsInterval: data.gpsInterval ?? 5000,
      minDistance: data.minDistance ?? 5,
    });
  } catch {
    // ignore — use defaults
  }
}

export async function saveSettings(
  gpsInterval: number,
  minDistance: number,
): Promise<void> {
  try {
    const data: PersistedSettings = { gpsInterval, minDistance };
    settingsFile.write(JSON.stringify(data));
  } catch {
    // ignore — settings lost on next reload is acceptable
  }
}
