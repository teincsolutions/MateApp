import type { IStopRepository, Stop } from '@mateapp/core';
import type Database from 'better-sqlite3';
import { uuidv4 } from '@mateapp/core';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
  constructor(private db: Database.Database) {}

  async create(label: string, latitude: number, longitude: number, radius?: number): Promise<Stop> {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO stops (id, label, latitude, longitude, radius, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, label, latitude, longitude, radius ?? 50, now, now);
    return this.db.prepare('SELECT * FROM stops WHERE id = ?').get(id) as Stop;
  }

  async getById(id: string): Promise<Stop | null> {
    return (this.db.prepare('SELECT * FROM stops WHERE id = ?').get(id) as Stop) || null;
  }

  async getAll(): Promise<Stop[]> {
    return this.db.prepare('SELECT * FROM stops ORDER BY label').all() as Stop[];
  }

  async findByArea(areaId: string): Promise<Stop[]> {
    return this.db.prepare(
      'SELECT s.* FROM stops s INNER JOIN area_stops a_s ON s.id = a_s.stop_id WHERE a_s.area_id = ? ORDER BY s.label'
    ).all(areaId) as Stop[];
  }

  async findByRadius(latitude: number, longitude: number, radiusMeters: number): Promise<Stop[]> {
    const all = this.db.prepare('SELECT * FROM stops').all() as Stop[];
    return all.filter(
      (s) => haversineDistance(latitude, longitude, s.latitude, s.longitude) <= radiusMeters
    );
  }

  async findNearestStop(latitude: number, longitude: number): Promise<Stop | null> {
    const all = this.db.prepare('SELECT * FROM stops').all() as Stop[];
    if (all.length === 0) return null;
    return all.reduce((nearest, stop) => {
      const d = haversineDistance(latitude, longitude, stop.latitude, stop.longitude);
      const nearestD = haversineDistance(latitude, longitude, nearest.latitude, nearest.longitude);
      return d < nearestD ? stop : nearest;
    });
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM area_stops WHERE stop_id = ?').run(id);
    this.db.prepare('DELETE FROM stops WHERE id = ?').run(id);
  }
}
