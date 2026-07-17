import type { IAreaRepository, Area } from '@mateapp/core';
import { getDatabase } from '../database';
import { uuidv4 } from '@mateapp/core';

export class AreaRepository implements IAreaRepository {
  async create(name: string): Promise<Area> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO areas (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, name, now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM areas WHERE id = ?', [id])) as Area;
  }

  async getById(id: string): Promise<Area | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync('SELECT * FROM areas WHERE id = ?', [id])) as Area | null;
  }

  async getAll(): Promise<Area[]> {
    const db = await getDatabase();
    return (await db.getAllAsync('SELECT * FROM areas ORDER BY name')) as Area[];
  }

  async getByName(name: string): Promise<Area | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync('SELECT * FROM areas WHERE name = ?', [name])) as Area | null;
  }

  async updatePolygon(id: string, polygon: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE areas SET polygon = ?, updated_at = ? WHERE id = ?',
      [polygon, new Date().toISOString(), id]
    );
  }

  async updateName(id: string, name: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE areas SET name = ?, updated_at = ? WHERE id = ?',
      [name, new Date().toISOString(), id]
    );
  }

  async getAllWithPolygons(): Promise<Area[]> {
    const db = await getDatabase();
    return (await db.getAllAsync('SELECT * FROM areas WHERE polygon IS NOT NULL ORDER BY name')) as Area[];
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();

    const journeyAreas = await db.getAllAsync(
      'SELECT id FROM journey_areas WHERE area_id = ?',
      [id],
    ) as { id: string }[];

    const jaIds = journeyAreas.map(ja => ja.id);

    if (jaIds.length > 0) {
      const placeholders = jaIds.map(() => '?').join(',');
      await db.runAsync(
        `DELETE FROM journey_fares WHERE from_journey_area_id IN (${placeholders})`,
        jaIds,
      );
      await db.runAsync(
        `DELETE FROM journey_fares WHERE to_journey_area_id IN (${placeholders})`,
        jaIds,
      );
      await db.runAsync(
        `DELETE FROM track_points WHERE journey_area_id IN (${placeholders})`,
        jaIds,
      );
    }

    await db.runAsync('DELETE FROM journey_areas WHERE area_id = ?', [id]);
    await db.runAsync('UPDATE journeys SET start_area_id = NULL WHERE start_area_id = ?', [id]);
    await db.runAsync('UPDATE journeys SET end_area_id = NULL WHERE end_area_id = ?', [id]);
    await db.runAsync('DELETE FROM area_fare_levels WHERE area_id = ?', [id]);
    await db.runAsync('DELETE FROM area_stops WHERE area_id = ?', [id]);
    await db.runAsync('DELETE FROM areas WHERE id = ?', [id]);
  }
}
