import type { IJourneyFareRepository, JourneyFare } from '@mateapp/core';
import { getDatabase } from '../database';
import { uuidv4 } from '@mateapp/core';

export class JourneyFareRepository implements IJourneyFareRepository {
  async create(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, amount: number): Promise<JourneyFare> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO journey_fares (id, journey_id, from_journey_area_id, to_journey_area_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, journeyId, fromJourneyAreaId, toJourneyAreaId, amount, now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM journey_fares WHERE id = ?', [id])) as JourneyFare;
  }

  async getByJourney(journeyId: string): Promise<JourneyFare[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM journey_fares WHERE journey_id = ?',
      [journeyId]
    )) as JourneyFare[];
  }

  async getBetweenAreas(journeyId: string, fromAreaId: string, toAreaId: string): Promise<JourneyFare | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync(
      `SELECT jf.* FROM journey_fares jf
       INNER JOIN journey_areas ja_from ON jf.from_journey_area_id = ja_from.id
       INNER JOIN journey_areas ja_to ON jf.to_journey_area_id = ja_to.id
       WHERE jf.journey_id = ? AND ja_from.area_id = ? AND ja_to.area_id = ?`,
      [journeyId, fromAreaId, toAreaId]
    )) as JourneyFare | null;
  }

  async upsert(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, amount: number): Promise<JourneyFare> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync(
      'SELECT * FROM journey_fares WHERE journey_id = ? AND from_journey_area_id = ? AND to_journey_area_id = ?',
      [journeyId, fromJourneyAreaId, toJourneyAreaId]
    ) as JourneyFare | null;

    if (existing) {
      await db.runAsync(
        'UPDATE journey_fares SET amount = ?, updated_at = ? WHERE id = ?',
        [amount, new Date().toISOString(), existing.id]
      );
      return (await db.getFirstAsync('SELECT * FROM journey_fares WHERE id = ?', [existing.id])) as JourneyFare;
    }

    return this.create(journeyId, fromJourneyAreaId, toJourneyAreaId, amount);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM journey_fares WHERE id = ?', [id]);
  }
}
