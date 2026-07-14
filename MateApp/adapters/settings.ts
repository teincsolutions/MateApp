import * as FileSystem from 'expo-file-system/legacy';
import { useSettingsStore } from '@mateapp/core';

interface PersistedSettings {
  gpsInterval: number;
  minDistance: number;
}

export async function loadSettings(): Promise<void> {
  try {
    const path = FileSystem.documentDirectory + 'mateapp-settings.json';
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(path);
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
    const path = FileSystem.documentDirectory + 'mateapp-settings.json';
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
  } catch {
    // ignore — settings lost on next reload is acceptable
  }
}
