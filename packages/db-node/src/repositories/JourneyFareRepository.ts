import type { IJourneyFareRepository, JourneyFare } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export class JourneyFareRepository implements IJourneyFareRepository {
  constructor(private db: Database.Database) {}

  async create(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, amount: number): Promise<JourneyFare> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO journey_fares (id, journey_id, from_journey_area_id, to_journey_area_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, journeyId, fromJourneyAreaId, toJourneyAreaId, amount, now, now);
    return this.db.prepare('SELECT * FROM journey_fares WHERE id = ?').get(id) as JourneyFare;
  }

  async getByJourney(journeyId: string): Promise<JourneyFare[]> {
    return this.db.prepare(
      'SELECT * FROM journey_fares WHERE journey_id = ?'
    ).all(journeyId) as JourneyFare[];
  }

  async getBetweenAreas(journeyId: string, fromAreaId: string, toAreaId: string): Promise<JourneyFare | null> {
    return (this.db.prepare(
      `SELECT jf.* FROM journey_fares jf
       INNER JOIN journey_areas ja_from ON jf.from_journey_area_id = ja_from.id
       INNER JOIN journey_areas ja_to ON jf.to_journey_area_id = ja_to.id
       WHERE jf.journey_id = ? AND ja_from.area_id = ? AND ja_to.area_id = ?`
    ).get(journeyId, fromAreaId, toAreaId) as JourneyFare) || null;
  }

  async upsert(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, amount: number): Promise<JourneyFare> {
    const existing = this.db.prepare(
      'SELECT * FROM journey_fares WHERE journey_id = ? AND from_journey_area_id = ? AND to_journey_area_id = ?'
    ).get(journeyId, fromJourneyAreaId, toJourneyAreaId) as JourneyFare | undefined;

    if (existing) {
      this.db.prepare(
        'UPDATE journey_fares SET amount = ?, updated_at = ? WHERE id = ?'
      ).run(amount, new Date().toISOString(), existing.id);
      return this.db.prepare('SELECT * FROM journey_fares WHERE id = ?').get(existing.id) as JourneyFare;
    }

    return this.create(journeyId, fromJourneyAreaId, toJourneyAreaId, amount);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM journey_fares WHERE id = ?').run(id);
  }
}
