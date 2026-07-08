import type { IJourneyRepository, Journey } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class JourneyRepository implements IJourneyRepository {
  constructor(private db: Database.Database) {}

  async create(name: string, startAreaId?: string): Promise<Journey> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO journeys (id, name, start_area_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, startAreaId || null, 'draft', now, now);
    return this.db.prepare('SELECT * FROM journeys WHERE id = ?').get(id) as Journey;
  }

  async getById(id: string): Promise<Journey | null> {
    return (this.db.prepare('SELECT * FROM journeys WHERE id = ?').get(id) as Journey) || null;
  }

  async getAll(): Promise<Journey[]> {
    return this.db.prepare('SELECT * FROM journeys ORDER BY updated_at DESC').all() as Journey[];
  }

  async getByStatus(status: string): Promise<Journey[]> {
    return this.db.prepare('SELECT * FROM journeys WHERE status = ? ORDER BY updated_at DESC').all(status) as Journey[];
  }

  async updateStatus(id: string, status: string, endAreaId?: string): Promise<void> {
    const now = new Date().toISOString();
    if (endAreaId) {
      this.db.prepare('UPDATE journeys SET status = ?, end_area_id = ?, updated_at = ? WHERE id = ?').run(status, endAreaId, now, id);
    } else {
      this.db.prepare('UPDATE journeys SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    }
  }

  async updateName(id: string, name: string): Promise<void> {
    this.db.prepare('UPDATE journeys SET name = ?, updated_at = ? WHERE id = ?').run(name, new Date().toISOString(), id);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM area_fare_levels WHERE fare_level_id IN (SELECT id FROM fare_levels WHERE journey_id = ?)').run(id);
    this.db.prepare('DELETE FROM fare_levels WHERE journey_id = ?').run(id);
    this.db.prepare('DELETE FROM journey_fares WHERE journey_id = ?').run(id);
    this.db.prepare('DELETE FROM track_points WHERE journey_id = ?').run(id);
    this.db.prepare('DELETE FROM journey_areas WHERE journey_id = ?').run(id);
    this.db.prepare('DELETE FROM journeys WHERE id = ?').run(id);
  }
}
