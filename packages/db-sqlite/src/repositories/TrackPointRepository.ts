import type { ITrackPointRepository, TrackPoint } from '@mateapp/core';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export class TrackPointRepository implements ITrackPointRepository {
  async create(journeyId: string, journeyAreaId: string | null, sequence: number, latitude: number, longitude: number): Promise<TrackPoint> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO track_points (id, journey_id, journey_area_id, sequence, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, journeyId, journeyAreaId, sequence, latitude, longitude, now]
    );
    return (await db.getFirstAsync('SELECT * FROM track_points WHERE id = ?', [id])) as TrackPoint;
  }

  async getByJourney(journeyId: string): Promise<TrackPoint[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM track_points WHERE journey_id = ? ORDER BY sequence',
      [journeyId]
    )) as TrackPoint[];
  }

  async getMaxSequence(journeyId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync(
      'SELECT MAX(sequence) as max_seq FROM track_points WHERE journey_id = ?',
      [journeyId]
    ) as { max_seq: number | null } | null;
    return result?.max_seq ?? 0;
  }

  async deleteByJourney(journeyId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM track_points WHERE journey_id = ?', [journeyId]);
  }
}
