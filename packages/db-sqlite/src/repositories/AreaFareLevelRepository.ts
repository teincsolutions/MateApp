import type { IAreaFareLevelRepository, AreaFareLevel } from '@mateapp/core';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export class AreaFareLevelRepository implements IAreaFareLevelRepository {
  async create(areaId: string, label: string, orderNo: number, amount: number): Promise<AreaFareLevel> {
    const db = await getDatabase();
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO area_fare_levels (id, area_id, label, order_no, amount) VALUES (?, ?, ?, ?, ?)',
      [id, areaId, label, orderNo, amount]
    );
    return (await db.getFirstAsync('SELECT * FROM area_fare_levels WHERE id = ?', [id])) as AreaFareLevel;
  }

  async getByArea(areaId: string): Promise<AreaFareLevel[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM area_fare_levels WHERE area_id = ? ORDER BY order_no',
      [areaId]
    )) as AreaFareLevel[];
  }

  async getByAreaStop(areaStopId: string): Promise<AreaFareLevel | null> {
    const db = await getDatabase();
    const areaStop = await db.getFirstAsync(
      'SELECT fare_level_id FROM area_stops WHERE id = ?',
      [areaStopId]
    ) as { fare_level_id: string | null } | null;
    if (!areaStop || !areaStop.fare_level_id) return null;
    return (await db.getFirstAsync(
      'SELECT * FROM area_fare_levels WHERE id = ?',
      [areaStop.fare_level_id]
    )) as AreaFareLevel | null;
  }

  async updateAmount(id: string, amount: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE area_fare_levels SET amount = ? WHERE id = ?',
      [amount, id]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM area_fare_levels WHERE id = ?', [id]);
  }
}
