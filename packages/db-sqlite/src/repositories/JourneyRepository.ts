import type { IJourneyRepository, Journey } from '@mateapp/core';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export class JourneyRepository implements IJourneyRepository {
  async create(name: string, startAreaId?: string): Promise<Journey> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO journeys (id, name, start_area_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, startAreaId || null, 'draft', now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM journeys WHERE id = ?', [id])) as Journey;
  }

  async getById(id: string): Promise<Journey | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync('SELECT * FROM journeys WHERE id = ?', [id])) as Journey | null;
  }

  async getAll(): Promise<Journey[]> {
    const db = await getDatabase();
    return (await db.getAllAsync('SELECT * FROM journeys ORDER BY updated_at DESC')) as Journey[];
  }

  async getByStatus(status: string): Promise<Journey[]> {
    const db = await getDatabase();
    return (await db.getAllAsync('SELECT * FROM journeys WHERE status = ? ORDER BY updated_at DESC', [status])) as Journey[];
  }

  async updateStatus(id: string, status: string, endAreaId?: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    if (endAreaId) {
      await db.runAsync('UPDATE journeys SET status = ?, end_area_id = ?, updated_at = ? WHERE id = ?', [status, endAreaId, now, id]);
    } else {
      await db.runAsync('UPDATE journeys SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
    }
  }

  async updateName(id: string, name: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE journeys SET name = ?, updated_at = ? WHERE id = ?', [name, new Date().toISOString(), id]);
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM journey_fares WHERE journey_id = ?', [id]);
    await db.runAsync('DELETE FROM track_points WHERE journey_id = ?', [id]);
    await db.runAsync('DELETE FROM journey_areas WHERE journey_id = ?', [id]);
    await db.runAsync('DELETE FROM journeys WHERE id = ?', [id]);
  }
}
