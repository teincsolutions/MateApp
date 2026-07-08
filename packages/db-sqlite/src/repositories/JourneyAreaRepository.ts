import type { IJourneyAreaRepository, JourneyArea } from '@mateapp/core';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export class JourneyAreaRepository implements IJourneyAreaRepository {
  async create(journeyId: string, areaId: string, sequence: number): Promise<JourneyArea> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO journey_areas (id, journey_id, area_id, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, journeyId, areaId, sequence, now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM journey_areas WHERE id = ?', [id])) as JourneyArea;
  }

  async getByJourney(journeyId: string): Promise<JourneyArea[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM journey_areas WHERE journey_id = ? ORDER BY sequence',
      [journeyId]
    )) as JourneyArea[];
  }

  async getById(id: string): Promise<JourneyArea | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync('SELECT * FROM journey_areas WHERE id = ?', [id])) as JourneyArea | null;
  }

  async getMaxSequence(journeyId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync(
      'SELECT MAX(sequence) as max_seq FROM journey_areas WHERE journey_id = ?',
      [journeyId]
    ) as { max_seq: number | null } | null;
    return result?.max_seq ?? 0;
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM journey_areas WHERE id = ?', [id]);
  }
}
