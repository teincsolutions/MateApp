import type { IValidationLogRepository, ValidationLog } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export class ValidationLogRepository implements IValidationLogRepository {
  constructor(private db: Database.Database) {}

  async create(data: {
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
  }): Promise<ValidationLog> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO validation_logs (
        id, pickup_lat, pickup_lng, dest_lat, dest_lng,
        pickup_stop_id, pickup_area_id, dest_stop_id, dest_area_id,
        journey_id, fare, fare_type, status, message,
        estimated_pickup, estimated_dest, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.pickup_lat, data.pickup_lng, data.dest_lat, data.dest_lng,
      data.pickup_stop_id, data.pickup_area_id, data.dest_stop_id, data.dest_area_id,
      data.journey_id, data.fare, data.fare_type, data.status, data.message,
      data.estimated_pickup ? 1 : 0, data.estimated_dest ? 1 : 0, now
    );
    return this.db.prepare('SELECT * FROM validation_logs WHERE id = ?').get(id) as ValidationLog;
  }

  async getAll(): Promise<ValidationLog[]> {
    return this.db.prepare('SELECT * FROM validation_logs ORDER BY created_at DESC').all() as ValidationLog[];
  }

  async deleteAll(): Promise<void> {
    this.db.prepare('DELETE FROM validation_logs').run();
  }
}
