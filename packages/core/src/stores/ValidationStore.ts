import { create } from 'zustand';
import { ValidationResult } from '../services/ValidationService';

interface ValidationState {
  pickupLat: string;
  pickupLng: string;
  destLat: string;
  destLng: string;
  result: ValidationResult | null;
  loading: boolean;
  setPickupLat: (val: string) => void;
  setPickupLng: (val: string) => void;
  setDestLat: (val: string) => void;
  setDestLng: (val: string) => void;
  setResult: (result: ValidationResult | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  pickupLat: '',
  pickupLng: '',
  destLat: '',
  destLng: '',
  result: null,
  loading: false,
  setPickupLat: (val) => set({ pickupLat: val }),
  setPickupLng: (val) => set({ pickupLng: val }),
  setDestLat: (val) => set({ destLat: val }),
  setDestLng: (val) => set({ destLng: val }),
  setResult: (result) => set({ result }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ pickupLat: '', pickupLng: '', destLat: '', destLng: '', result: null, loading: false }),
}));
