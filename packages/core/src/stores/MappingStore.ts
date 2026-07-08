import { create } from 'zustand';
import { LatLng } from '../services/GeometryService';
import { TrackPoint } from '../types';

interface MappingState {
  currentLocation: LatLng | null;
  trackPoints: TrackPoint[];
  trackSequence: number;
  isRecording: boolean;
  setCurrentLocation: (location: LatLng | null) => void;
  addTrackPoint: (point: TrackPoint) => void;
  setTrackSequence: (seq: number) => void;
  setIsRecording: (recording: boolean) => void;
  reset: () => void;
}

export const useMappingStore = create<MappingState>((set) => ({
  currentLocation: null,
  trackPoints: [],
  trackSequence: 0,
  isRecording: false,
  setCurrentLocation: (location) => set({ currentLocation: location }),
  addTrackPoint: (point) => set((state) => ({ trackPoints: [...state.trackPoints, point] })),
  setTrackSequence: (seq) => set({ trackSequence: seq }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  reset: () => set({ currentLocation: null, trackPoints: [], trackSequence: 0, isRecording: false }),
}));
