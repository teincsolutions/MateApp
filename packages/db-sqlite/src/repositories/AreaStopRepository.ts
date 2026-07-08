import type { IAreaStopRepository, AreaStop } from '@mateapp/core';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export class AreaStopRepository implements IAreaStopRepository {
  async create(areaId: string, stopId: string, fareLevelId?: string): Promise<AreaStop> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO area_stops (id, area_id, stop_id, fare_level_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, areaId, stopId, fareLevelId || null, now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM area_stops WHERE id = ?', [id])) as AreaStop;
  }

  async getByArea(areaId: string): Promise<AreaStop[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM area_stops WHERE area_id = ?',
      [areaId]
    )) as AreaStop[];
  }

  async getByStop(stopId: string): Promise<AreaStop[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT * FROM area_stops WHERE stop_id = ?',
      [stopId]
    )) as AreaStop[];
  }

  async getByAreaAndStop(areaId: string, stopId: string): Promise<AreaStop | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync(
      'SELECT * FROM area_stops WHERE area_id = ? AND stop_id = ?',
      [areaId, stopId]
    )) as AreaStop | null;
  }

  async updateFareLevel(id: string, fareLevelId: string | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE area_stops SET fare_level_id = ?, updated_at = ? WHERE id = ?',
      [fareLevelId, new Date().toISOString(), id]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM area_stops WHERE id = ?', [id]);
  }
}
