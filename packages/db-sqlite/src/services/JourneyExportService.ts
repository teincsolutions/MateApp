import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);
  INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '5');

  CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, start_area_id TEXT, end_area_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, polygon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS stops (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, latitude REAL NOT NULL,
    longitude REAL NOT NULL, radius REAL NOT NULL DEFAULT 50, seq INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS fare_levels (
    id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, label TEXT NOT NULL,
    order_no INTEGER NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS area_fare_levels (
    id TEXT PRIMARY KEY, area_id TEXT NOT NULL, fare_level_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS area_stops (
    id TEXT PRIMARY KEY, area_id TEXT NOT NULL, stop_id TEXT NOT NULL,
    fare_level_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS journey_areas (
    id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, area_id TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS journey_fares (
    id TEXT PRIMARY KEY, journey_id TEXT NOT NULL,
    from_journey_area_id TEXT NOT NULL, to_journey_area_id TEXT NOT NULL,
    fare_level_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS track_points (
    id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, journey_area_id TEXT,
    sequence INTEGER NOT NULL DEFAULT 0,
    latitude REAL NOT NULL, longitude REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

export class JourneyExportService {
  async exportJourneyDb(
    sourceDb: SQLiteDatabase,
    journeyId: string,
  ): Promise<string> {
    const exportName = `export-${journeyId}.db`;

    // Fetch journey data
    const journey = (await sourceDb.getFirstAsync(
      'SELECT * FROM journeys WHERE id = ?',
      [journeyId],
    )) as Record<string, any> | null;
    if (!journey) throw new Error(`Journey ${journeyId} not found`);

    const journeyAreas = (await sourceDb.getAllAsync(
      'SELECT * FROM journey_areas WHERE journey_id = ? ORDER BY sequence',
      [journeyId],
    )) as Record<string, any>[];

    const areaIds = journeyAreas.map((ja) => ja.area_id);
    if (areaIds.length === 0) throw new Error('Journey has no areas');

    const ph = areaIds.map(() => '?').join(',');
    const areas = (await sourceDb.getAllAsync(
      `SELECT * FROM areas WHERE id IN (${ph})`,
      areaIds,
    )) as Record<string, any>[];

    const stopIdRows = (await sourceDb.getAllAsync(
      `SELECT DISTINCT stop_id FROM area_stops WHERE area_id IN (${ph})`,
      areaIds,
    )) as Record<string, any>[];
    const stopIds = stopIdRows.map((r) => r.stop_id);

    let stops: Record<string, any>[] = [];
    if (stopIds.length > 0) {
      const sph = stopIds.map(() => '?').join(',');
      stops = (await sourceDb.getAllAsync(
        `SELECT * FROM stops WHERE id IN (${sph})`,
        stopIds,
      )) as Record<string, any>[];
    }

    const fareLevels = (await sourceDb.getAllAsync(
      'SELECT * FROM fare_levels WHERE journey_id = ?',
      [journeyId],
    )) as Record<string, any>[];

    const areaFareLevels = (await sourceDb.getAllAsync(
      `SELECT * FROM area_fare_levels WHERE area_id IN (${ph})`,
      areaIds,
    )) as Record<string, any>[];

    const areaStops = (await sourceDb.getAllAsync(
      `SELECT * FROM area_stops WHERE area_id IN (${ph})`,
      areaIds,
    )) as Record<string, any>[];

    const journeyFares = (await sourceDb.getAllAsync(
      'SELECT * FROM journey_fares WHERE journey_id = ?',
      [journeyId],
    )) as Record<string, any>[];

    const trackPoints = (await sourceDb.getAllAsync(
      'SELECT * FROM track_points WHERE journey_id = ? ORDER BY sequence',
      [journeyId],
    )) as Record<string, any>[];

    // Build export database
    const exportDb = await SQLite.openDatabaseAsync(exportName);
    await exportDb.execAsync('PRAGMA foreign_keys = OFF;');
    const stmts = SCHEMA_SQL.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of stmts) {
      try {
        await exportDb.execAsync(stmt + ';');
      } catch {
        // table may already exist from migration
      }
    }

    await exportDb.runAsync(
      "INSERT INTO _meta (key, value) VALUES ('source_journey_id', ?)",
      [journeyId],
    );
    await exportDb.runAsync(
      "INSERT INTO _meta (key, value) VALUES ('exported_at', ?)",
      [new Date().toISOString()],
    );

    const insertJourney = await exportDb.prepareAsync(
      'INSERT INTO journeys (id, name, start_area_id, end_area_id, status, created_at, updated_at) VALUES ($id, $name, $startAreaId, $endAreaId, $status, $createdAt, $updatedAt)',
    );
    await insertJourney.executeAsync({
      $id: journey.id,
      $name: journey.name,
      $startAreaId: journey.start_area_id,
      $endAreaId: journey.end_area_id,
      $status: journey.status,
      $createdAt: journey.created_at,
      $updatedAt: journey.updated_at,
    });
    await insertJourney.finalizeAsync();

    for (const row of areas) {
      await exportDb.runAsync(
        'INSERT INTO areas (id, name, polygon, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.name, row.polygon, row.created_at, row.updated_at],
      );
    }
    for (const row of stops) {
      await exportDb.runAsync(
        'INSERT INTO stops (id, label, latitude, longitude, radius, seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.label,
          row.latitude,
          row.longitude,
          row.radius,
          row.seq,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of fareLevels) {
      await exportDb.runAsync(
        'INSERT INTO fare_levels (id, journey_id, label, order_no, amount) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.journey_id, row.label, row.order_no, row.amount],
      );
    }
    for (const row of areaFareLevels) {
      await exportDb.runAsync(
        'INSERT INTO area_fare_levels (id, area_id, fare_level_id) VALUES (?, ?, ?)',
        [row.id, row.area_id, row.fare_level_id],
      );
    }
    for (const row of areaStops) {
      await exportDb.runAsync(
        'INSERT INTO area_stops (id, area_id, stop_id, fare_level_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.area_id,
          row.stop_id,
          row.fare_level_id,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of journeyAreas) {
      await exportDb.runAsync(
        'INSERT INTO journey_areas (id, journey_id, area_id, sequence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.journey_id,
          row.area_id,
          row.sequence,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of journeyFares) {
      await exportDb.runAsync(
        'INSERT INTO journey_fares (id, journey_id, from_journey_area_id, to_journey_area_id, fare_level_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.journey_id,
          row.from_journey_area_id,
          row.to_journey_area_id,
          row.fare_level_id,
          row.created_at,
          row.updated_at,
        ],
      );
    }
    for (const row of trackPoints) {
      await exportDb.runAsync(
        'INSERT INTO track_points (id, journey_id, journey_area_id, sequence, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          row.id,
          row.journey_id,
          row.journey_area_id,
          row.sequence,
          row.latitude,
          row.longitude,
          row.created_at,
        ],
      );
    }

    await exportDb.closeAsync();
    return exportName;
  }
}
