import type { IStopRepository, Stop } from '@mateapp/core';
import { getDatabase } from '../database';
import { uuidv4 } from '@mateapp/core';

const METERS_PER_DEG_LAT = 111195;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

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
  async create(label: string, latitude: number, longitude: number, radius?: number, seq?: number): Promise<Stop> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO stops (id, label, latitude, longitude, radius, seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, label, latitude, longitude, radius ?? 50, seq ?? 0, now, now]
    );
    return (await db.getFirstAsync('SELECT * FROM stops WHERE id = ?', [id])) as Stop;
  }

  async getById(id: string): Promise<Stop | null> {
    const db = await getDatabase();
    return (await db.getFirstAsync('SELECT * FROM stops WHERE id = ?', [id])) as Stop | null;
  }

  async getAll(): Promise<Stop[]> {
    const db = await getDatabase();
    return (await db.getAllAsync('SELECT * FROM stops ORDER BY seq, label')) as Stop[];
  }

  async findByArea(areaId: string): Promise<Stop[]> {
    const db = await getDatabase();
    return (await db.getAllAsync(
      'SELECT s.* FROM stops s INNER JOIN area_stops a_s ON s.id = a_s.stop_id WHERE a_s.area_id = ? ORDER BY s.seq, s.label',
      [areaId]
    )) as Stop[];
  }

  async findByRadius(latitude: number, longitude: number, radiusMeters: number): Promise<Stop[]> {
    const db = await getDatabase();
    const dLat = radiusMeters / METERS_PER_DEG_LAT;
    const dLng = radiusMeters / metersPerDegLng(latitude);
    const latMin = latitude - dLat;
    const latMax = latitude + dLat;
    const lngMin = longitude - dLng;
    const lngMax = longitude + dLng;

    const candidates = (await db.getAllAsync(
      `SELECT * FROM stops
       WHERE latitude BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?
       ORDER BY latitude, longitude`,
      [latMin, latMax, lngMin, lngMax]
    )) as Stop[];

    return candidates
      .filter((s) => haversineDistance(latitude, longitude, s.latitude, s.longitude) <= Math.max(radiusMeters, s.radius))
      .sort((a, b) =>
        haversineDistance(latitude, longitude, a.latitude, a.longitude) -
        haversineDistance(latitude, longitude, b.latitude, b.longitude)
      );
  }

  async findNearestStop(latitude: number, longitude: number): Promise<Stop | null> {
    for (const radius of [1000, 5000, 25000]) {
      const stops = await this.findByRadius(latitude, longitude, radius);
      if (stops.length > 0) return stops[0];
    }
    return null;
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM area_stops WHERE stop_id = ?', [id]);
    await db.runAsync('DELETE FROM stops WHERE id = ?', [id]);
  }
}
