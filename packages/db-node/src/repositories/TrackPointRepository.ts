import type { ITrackPointRepository, TrackPoint } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class TrackPointRepository implements ITrackPointRepository {
  constructor(private db: Database.Database) {}

  async create(journeyId: string, journeyAreaId: string | null, sequence: number, latitude: number, longitude: number): Promise<TrackPoint> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO track_points (id, journey_id, journey_area_id, sequence, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, journeyId, journeyAreaId, sequence, latitude, longitude, now);
    return this.db.prepare('SELECT * FROM track_points WHERE id = ?').get(id) as TrackPoint;
  }

  async getByJourney(journeyId: string): Promise<TrackPoint[]> {
    return this.db.prepare(
      'SELECT * FROM track_points WHERE journey_id = ? ORDER BY sequence'
    ).all(journeyId) as TrackPoint[];
  }

  async getMaxSequence(journeyId: string): Promise<number> {
    const result = this.db.prepare(
      'SELECT MAX(sequence) as max_seq FROM track_points WHERE journey_id = ?'
    ).get(journeyId) as { max_seq: number | null } | undefined;
    return result?.max_seq ?? 0;
  }

  async deleteByJourney(journeyId: string): Promise<void> {
    this.db.prepare('DELETE FROM track_points WHERE journey_id = ?').run(journeyId);
  }
}
