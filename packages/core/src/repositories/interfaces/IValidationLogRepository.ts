import { ValidationLog } from '../../types';

export interface IValidationLogRepository {
  create(data: {
    pickup_lat: number;
    pickup_lng: number;
    dest_lat: number;
    dest_lng: number;
    pickup_stop_id: string | null;
    pickup_area_id: string | null;
    dest_stop_id: string | null;
    dest_area_id: string | null;
    journey_id: string | null;
    fare: number | null;
    fare_type: 'journey' | 'area' | null;
    status: 'success' | 'journey_not_found' | 'stop_not_found' | 'unknown';
    message: string;
    estimated_pickup: boolean;
    estimated_dest: boolean;
  }): Promise<ValidationLog>;
  getAll(): Promise<ValidationLog[]>;
  deleteAll(): Promise<void>;
}
