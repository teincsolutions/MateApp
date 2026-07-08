import type { IJourneyAreaRepository, JourneyArea } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class JourneyAreaRepository implements IJourneyAreaRepository {
  constructor(private db: Database.Database) {}

  async create(journeyId: string, areaId: string, sequence: number): Promise<JourneyArea> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO journey_areas (id, journey_id, area_id, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, journeyId, areaId, sequence, now, now);
    return this.db.prepare('SELECT * FROM journey_areas WHERE id = ?').get(id) as JourneyArea;
  }

  async getByJourney(journeyId: string): Promise<JourneyArea[]> {
    return this.db.prepare(
      'SELECT * FROM journey_areas WHERE journey_id = ? ORDER BY sequence'
    ).all(journeyId) as JourneyArea[];
  }

  async getById(id: string): Promise<JourneyArea | null> {
    return (this.db.prepare('SELECT * FROM journey_areas WHERE id = ?').get(id) as JourneyArea) || null;
  }

  async getMaxSequence(journeyId: string): Promise<number> {
    const result = this.db.prepare(
      'SELECT MAX(sequence) as max_seq FROM journey_areas WHERE journey_id = ?'
    ).get(journeyId) as { max_seq: number | null } | undefined;
    return result?.max_seq ?? 0;
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM journey_areas WHERE id = ?').run(id);
  }
}
