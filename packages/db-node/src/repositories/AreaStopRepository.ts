import type { IAreaStopRepository, AreaStop } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class AreaStopRepository implements IAreaStopRepository {
  constructor(private db: Database.Database) {}

  async create(areaId: string, stopId: string, fareLevelId?: string): Promise<AreaStop> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO area_stops (id, area_id, stop_id, fare_level_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, areaId, stopId, fareLevelId || null, now, now);
    return this.db.prepare('SELECT * FROM area_stops WHERE id = ?').get(id) as AreaStop;
  }

  async getByArea(areaId: string): Promise<AreaStop[]> {
    return this.db.prepare('SELECT * FROM area_stops WHERE area_id = ?').all(areaId) as AreaStop[];
  }

  async getByStop(stopId: string): Promise<AreaStop[]> {
    return this.db.prepare('SELECT * FROM area_stops WHERE stop_id = ?').all(stopId) as AreaStop[];
  }

  async getByAreaAndStop(areaId: string, stopId: string): Promise<AreaStop | null> {
    return (this.db.prepare(
      'SELECT * FROM area_stops WHERE area_id = ? AND stop_id = ?'
    ).get(areaId, stopId) as AreaStop) || null;
  }

  async updateFareLevel(id: string, fareLevelId: string | null): Promise<void> {
    this.db.prepare(
      'UPDATE area_stops SET fare_level_id = ?, updated_at = ? WHERE id = ?'
    ).run(fareLevelId, new Date().toISOString(), id);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM area_stops WHERE id = ?').run(id);
  }
}
