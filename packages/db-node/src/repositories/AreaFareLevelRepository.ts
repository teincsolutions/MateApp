import type { IAreaFareLevelRepository, AreaFareLevel } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

export class AreaFareLevelRepository implements IAreaFareLevelRepository {
  constructor(private db: Database.Database) {}

  async create(areaId: string, label: string, orderNo: number, amount: number): Promise<AreaFareLevel> {
    const id = uuidv4();
    this.db.prepare(
      'INSERT INTO area_fare_levels (id, area_id, label, order_no, amount) VALUES (?, ?, ?, ?, ?)'
    ).run(id, areaId, label, orderNo, amount);
    return this.db.prepare('SELECT * FROM area_fare_levels WHERE id = ?').get(id) as AreaFareLevel;
  }

  async getByArea(areaId: string): Promise<AreaFareLevel[]> {
    return this.db.prepare(
      'SELECT * FROM area_fare_levels WHERE area_id = ? ORDER BY order_no'
    ).all(areaId) as AreaFareLevel[];
  }

  async getByAreaStop(areaStopId: string): Promise<AreaFareLevel | null> {
    const areaStop = this.db.prepare(
      'SELECT fare_level_id FROM area_stops WHERE id = ?'
    ).get(areaStopId) as { fare_level_id: string | null } | undefined;
    if (!areaStop || !areaStop.fare_level_id) return null;
    return (this.db.prepare(
      'SELECT * FROM area_fare_levels WHERE id = ?'
    ).get(areaStop.fare_level_id) as AreaFareLevel) || null;
  }

  async updateAmount(id: string, amount: number): Promise<void> {
    this.db.prepare('UPDATE area_fare_levels SET amount = ? WHERE id = ?').run(amount, id);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM area_fare_levels WHERE id = ?').run(id);
  }
}
