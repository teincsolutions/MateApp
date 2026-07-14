import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'mateapp-settings' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface SettingsState {
  gpsInterval: number;
  minDistance: number;
  setGpsInterval: (interval: number) => void;
  setMinDistance: (distance: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      gpsInterval: 5000,
      minDistance: 5,
      setGpsInterval: (interval) => set({ gpsInterval: interval }),
      setMinDistance: (distance) => set({ minDistance: distance }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
