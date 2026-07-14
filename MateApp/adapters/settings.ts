import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '@mateapp/core';

const SETTINGS_KEY = 'mateapp-settings';

interface PersistedSettings {
  gpsInterval: number;
  minDistance: number;
}

export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
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
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // ignore — settings lost on next reload is acceptable
  }
}
