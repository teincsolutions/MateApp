export type JourneyStatus = 'draft' | 'completed';

export interface Journey {
  id: string;
  name: string;
  start_area_id: string | null;
  end_area_id: string | null;
  status: JourneyStatus;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  name: string;
  polygon: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stop {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
  created_at: string;
  updated_at: string;
}

export interface FareLevel {
  id: string;
  journey_id: string;
  label: string;
  order_no: number;
  amount: number;
}

export interface AreaFareLevel {
  id: string;
  area_id: string;
  fare_level_id: string;
}

export interface AreaStop {
  id: string;
  area_id: string;
  stop_id: string;
  fare_level_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JourneyArea {
  id: string;
  journey_id: string;
  area_id: string;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export interface JourneyFare {
  id: string;
  journey_id: string;
  from_journey_area_id: string;
  to_journey_area_id: string;
  fare_level_id: string;
  created_at: string;
  updated_at: string;
}

export interface TrackPoint {
  id: string;
  journey_id: string;
  journey_area_id: string | null;
  sequence: number;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface ValidationLog {
  id: string;
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
  created_at: string;
}
