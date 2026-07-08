import type { IFareLevelRepository, FareLevel, AreaFareLevel } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class AreaFareLevelRepository implements IFareLevelRepository {
  constructor(private db: Database.Database) {}

  async create(journeyId: string, label: string, orderNo: number, amount: number): Promise<FareLevel> {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO fare_levels (id, journey_id, label, order_no, amount) VALUES (?, ?, ?, ?, ?)'
    ).run(id, journeyId, label, orderNo, amount);
    return this.db.prepare('SELECT * FROM fare_levels WHERE id = ?').get(id) as FareLevel;
  }

  async getByJourney(journeyId: string): Promise<FareLevel[]> {
    return this.db.prepare(
      'SELECT * FROM fare_levels WHERE journey_id = ? ORDER BY order_no'
    ).all(journeyId) as FareLevel[];
  }

  async getByArea(areaId: string): Promise<FareLevel[]> {
    return this.db.prepare(
      `SELECT fl.* FROM fare_levels fl
       JOIN area_fare_levels afl ON fl.id = afl.fare_level_id
       WHERE afl.area_id = ?
       ORDER BY fl.order_no`
    ).all(areaId) as FareLevel[];
  }

  async getByAreaStop(areaStopId: string): Promise<FareLevel | null> {
    const areaStop = this.db.prepare(
      'SELECT fare_level_id FROM area_stops WHERE id = ?'
    ).get(areaStopId) as { fare_level_id: string | null } | undefined;
    if (!areaStop || !areaStop.fare_level_id) return null;
    return (this.db.prepare(
      'SELECT * FROM fare_levels WHERE id = ?'
    ).get(areaStop.fare_level_id) as FareLevel) || null;
  }

  async updateAmount(id: string, amount: number): Promise<void> {
    this.db.prepare('UPDATE fare_levels SET amount = ? WHERE id = ?').run(amount, id);
  }

  async linkToArea(areaId: string, fareLevelId: string): Promise<AreaFareLevel> {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO area_fare_levels (id, area_id, fare_level_id) VALUES (?, ?, ?)'
    ).run(id, areaId, fareLevelId);
    return this.db.prepare('SELECT * FROM area_fare_levels WHERE id = ?').get(id) as AreaFareLevel;
  }

  async unlinkFromArea(areaId: string, fareLevelId: string): Promise<void> {
    this.db.prepare(
      'DELETE FROM area_fare_levels WHERE area_id = ? AND fare_level_id = ?'
    ).run(areaId, fareLevelId);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM area_fare_levels WHERE fare_level_id = ?').run(id);
    this.db.prepare('DELETE FROM fare_levels WHERE id = ?').run(id);
  }
}
