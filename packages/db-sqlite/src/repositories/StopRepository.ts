import type { IStopRepository, Stop } from '@mateapp/core';
import { getDatabase } from '../database';
import { uuidv4 } from '@mateapp/core';

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class StopRepository implements IStopRepository {
  async create(label: string, latitude: number, longitude: number, radius?: number): Promise<Stop> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO stops (id, label, latitude, longitude, radius, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, label, latitude, longitude, radius ?? 50, now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM stops WHERE id = ?', [id])) as Stop;
  }

  async getById(id: string): Promise<Stop | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync('SELECT * FROM stops WHERE id = ?', [id])) as Stop | null;
  }

  async getAll(): Promise<Stop[]> {
    const db = await getDatabase();
    return (await db.getAllAsync('SELECT * FROM stops ORDER BY label')) as Stop[];
  }

  async findByArea(areaId: string): Promise<Stop[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT s.* FROM stops s INNER JOIN area_stops a_s ON s.id = a_s.stop_id WHERE a_s.area_id = ? ORDER BY s.label',
      [areaId]
    )) as Stop[];
  }

  async findByRadius(latitude: number, longitude: number, radiusMeters: number): Promise<Stop[]> {
    const db = await getDatabase();
    const all = (await db.getAllAsync('SELECT * FROM stops')) as Stop[];
    return all.filter(
      (s) => haversineDistance(latitude, longitude, s.latitude, s.longitude) <= radiusMeters
    );
  }

  async findNearestStop(latitude: number, longitude: number): Promise<Stop | null> {
    const db = await getDatabase();
    const all = (await db.getAllAsync('SELECT * FROM stops')) as Stop[];
    if (all.length === 0) return null;
    return all.reduce((nearest, stop) => {
      const d = haversineDistance(latitude, longitude, stop.latitude, stop.longitude);
      const nearestD = haversineDistance(latitude, longitude, nearest.latitude, nearest.longitude);
      return d < nearestD ? stop : nearest;
    });
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM area_stops WHERE stop_id = ?', [id]);
    await db.runAsync('DELETE FROM stops WHERE id = ?', [id]);
  }
}
