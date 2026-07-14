import { create } from 'zustand';

interface SettingsState {
  gpsInterval: number;
  minDistance: number;
  setGpsInterval: (interval: number) => void;
  setMinDistance: (distance: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gpsInterval: 5000,
  minDistance: 5,
  setGpsInterval: (interval) => set({ gpsInterval: interval }),
  setMinDistance: (distance) => set({ minDistance: distance }),
}));
