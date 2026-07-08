import { create } from 'zustand';
import { Journey, Area } from '../types';

interface JourneyState {
  activeJourney: Journey | null;
  activeJourneyArea: { area: Area; journeyAreaId: string; sequence: number } | null;
  isTracking: boolean;
  setActiveJourney: (journey: Journey | null) => void;
  setActiveJourneyArea: (data: { area: Area; journeyAreaId: string; sequence: number } | null) => void;
  setIsTracking: (tracking: boolean) => void;
  reset: () => void;
}

export const useJourneyStore = create<JourneyState>((set) => ({
  activeJourney: null,
  activeJourneyArea: null,
  isTracking: false,
  setActiveJourney: (journey) => set({ activeJourney: journey }),
  setActiveJourneyArea: (data) => set({ activeJourneyArea: data }),
  setIsTracking: (tracking) => set({ isTracking: tracking }),
  reset: () => set({ activeJourney: null, activeJourneyArea: null, isTracking: false }),
}));
