import type { IFareLevelRepository, FareLevel, AreaFareLevel } from '@mateapp/core';
import { getDatabase } from '../database';
import { uuidv4 } from '@mateapp/core';

export class AreaFareLevelRepository implements IFareLevelRepository {
  async create(journeyId: string, label: string, orderNo: number, amount: number): Promise<FareLevel> {
    const db = await getDatabase();
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO fare_levels (id, journey_id, label, order_no, amount) VALUES (?, ?, ?, ?, ?)',
      [id, journeyId, label, orderNo, amount]
    );
    return (await db.getFirstAsync('SELECT * FROM fare_levels WHERE id = ?', [id])) as FareLevel;
  }

  async getByJourney(journeyId: string): Promise<FareLevel[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM fare_levels WHERE journey_id = ? ORDER BY order_no',
      [journeyId]
    )) as FareLevel[];
  }

  async getByArea(areaId: string): Promise<FareLevel[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      `SELECT fl.* FROM fare_levels fl
       JOIN area_fare_levels afl ON fl.id = afl.fare_level_id
       WHERE afl.area_id = ?
       ORDER BY fl.order_no`,
      [areaId]
    )) as FareLevel[];
  }

  async getByAreaStop(areaStopId: string): Promise<FareLevel | null> {
    const db = await getDatabase();
    const areaStop = await db.getFirstAsync(
      'SELECT fare_level_id FROM area_stops WHERE id = ?',
      [areaStopId]
    ) as { fare_level_id: string | null } | null;
    if (!areaStop || !areaStop.fare_level_id) return null;
    return (await db.getFirstAsync(
      'SELECT * FROM fare_levels WHERE id = ?',
      [areaStop.fare_level_id]
    )) as FareLevel | null;
  }

  async updateAmount(id: string, amount: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE fare_levels SET amount = ? WHERE id = ?',
      [amount, id]
    );
  }

  async linkToArea(areaId: string, fareLevelId: string): Promise<AreaFareLevel> {
    const db = await getDatabase();
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO area_fare_levels (id, area_id, fare_level_id) VALUES (?, ?, ?)',
      [id, areaId, fareLevelId]
    );
    return (await db.getFirstAsync('SELECT * FROM area_fare_levels WHERE id = ?', [id])) as AreaFareLevel;
  }

  async unlinkFromArea(areaId: string, fareLevelId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM area_fare_levels WHERE area_id = ? AND fare_level_id = ?',
      [areaId, fareLevelId]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM area_fare_levels WHERE fare_level_id = ?', [id]);
    await db.runAsync('DELETE FROM fare_levels WHERE id = ?', [id]);
  }
}
