import type { IJourneyFareRepository, JourneyFare } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class JourneyFareRepository implements IJourneyFareRepository {
  constructor(private db: Database.Database) {}

  async create(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, fareLevelId: string): Promise<JourneyFare> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO journey_fares (id, journey_id, from_journey_area_id, to_journey_area_id, fare_level_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, journeyId, fromJourneyAreaId, toJourneyAreaId, fareLevelId, now, now);
    return this.db.prepare('SELECT * FROM journey_fares WHERE id = ?').get(id) as JourneyFare;
  }

  async getByJourney(journeyId: string): Promise<JourneyFare[]> {
    return this.db.prepare('SELECT * FROM journey_fares WHERE journey_id = ?').all(journeyId) as JourneyFare[];
  }

  async getBetweenAreas(journeyId: string, fromAreaId: string, toAreaId: string): Promise<JourneyFare | null> {
    const row = this.db.prepare(
      `SELECT jf.* FROM journey_fares jf
       INNER JOIN journey_areas ja_from ON jf.from_journey_area_id = ja_from.id
       INNER JOIN journey_areas ja_to ON jf.to_journey_area_id = ja_to.id
       WHERE jf.journey_id = ? AND ja_from.area_id = ? AND ja_to.area_id = ? AND ja_from.sequence < ja_to.sequence`
    ).get(journeyId, fromAreaId, toAreaId) as JourneyFare | undefined;
    return row || null;
  }

  async upsert(journeyId: string, fromJourneyAreaId: string, toJourneyAreaId: string, fareLevelId: string): Promise<JourneyFare> {
    const existing = this.db.prepare(
      'SELECT * FROM journey_fares WHERE journey_id = ? AND from_journey_area_id = ? AND to_journey_area_id = ?'
    ).get(journeyId, fromJourneyAreaId, toJourneyAreaId) as JourneyFare | undefined;
    if (existing) {
      this.db.prepare('UPDATE journey_fares SET fare_level_id = ?, updated_at = ? WHERE id = ?').run(fareLevelId, new Date().toISOString(), existing.id);
      return { ...existing, fare_level_id: fareLevelId };
    }
    return this.create(journeyId, fromJourneyAreaId, toJourneyAreaId, fareLevelId);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM journey_fares WHERE id = ?').run(id);
  }
}
