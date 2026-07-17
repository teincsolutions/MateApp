import type { IAreaRepository, Area } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class AreaRepository implements IAreaRepository {
  constructor(private db: Database.Database) {}

  async create(name: string): Promise<Area> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO areas (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(id, name, now, now);
    return this.db.prepare('SELECT * FROM areas WHERE id = ?').get(id) as Area;
  }

  async getById(id: string): Promise<Area | null> {
    return (this.db.prepare('SELECT * FROM areas WHERE id = ?').get(id) as Area) || null;
  }

  async getAll(): Promise<Area[]> {
    return this.db.prepare('SELECT * FROM areas ORDER BY name').all() as Area[];
  }

  async getByName(name: string): Promise<Area | null> {
    return (this.db.prepare('SELECT * FROM areas WHERE name = ?').get(name) as Area) || null;
  }

  async updatePolygon(id: string, polygon: string): Promise<void> {
    this.db.prepare(
      'UPDATE areas SET polygon = ?, updated_at = ? WHERE id = ?'
    ).run(polygon, new Date().toISOString(), id);
  }

  async updateName(id: string, name: string): Promise<void> {
    this.db.prepare(
      'UPDATE areas SET name = ?, updated_at = ? WHERE id = ?'
    ).run(name, new Date().toISOString(), id);
  }

  async getAllWithPolygons(): Promise<Area[]> {
    return this.db.prepare('SELECT * FROM areas WHERE polygon IS NOT NULL ORDER BY name').all() as Area[];
  }

  async delete(id: string): Promise<void> {
    const journeyAreas = this.db.prepare(
      'SELECT id FROM journey_areas WHERE area_id = ?'
    ).all(id) as { id: string }[];

    if (journeyAreas.length > 0) {
      const placeholders = journeyAreas.map(() => '?').join(',');
      const jaIds = journeyAreas.map(ja => ja.id);
      this.db.prepare(
        `DELETE FROM journey_fares WHERE from_journey_area_id IN (${placeholders})`
      ).run(...jaIds);
      this.db.prepare(
        `DELETE FROM journey_fares WHERE to_journey_area_id IN (${placeholders})`
      ).run(...jaIds);
      this.db.prepare(
        `DELETE FROM track_points WHERE journey_area_id IN (${placeholders})`
      ).run(...jaIds);
    }

    this.db.prepare('DELETE FROM journey_areas WHERE area_id = ?').run(id);
    this.db.prepare('UPDATE journeys SET start_area_id = NULL WHERE start_area_id = ?').run(id);
    this.db.prepare('UPDATE journeys SET end_area_id = NULL WHERE end_area_id = ?').run(id);
    this.db.prepare('DELETE FROM area_fare_levels WHERE area_id = ?').run(id);
    this.db.prepare('DELETE FROM area_stops WHERE area_id = ?').run(id);
    this.db.prepare('DELETE FROM areas WHERE id = ?').run(id);
  }
}
