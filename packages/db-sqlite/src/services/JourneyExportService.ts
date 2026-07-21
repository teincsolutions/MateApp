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
    journeyIds: string[],
  ): Promise<string> {
    if (journeyIds.length === 0) throw new Error('No journeys selected');

    const label = journeyIds.length === 1 ? `export-${journeyIds[0]}.db` : `export-${journeyIds.length}-journeys.db`;

    // Fetch all journeys
    const jh = journeyIds.map(() => '?').join(',');
    const journeys = (await sourceDb.getAllAsync(
      `SELECT * FROM journeys WHERE id IN (${jh})`,
      journeyIds,
    )) as Record<string, any>[];
    if (journeys.length === 0) throw new Error('No journeys found');

    // Fetch all journey_areas for selected journeys
    const allJourneyAreas = (await sourceDb.getAllAsync(
      `SELECT * FROM journey_areas WHERE journey_id IN (${jh}) ORDER BY journey_id, sequence`,
      journeyIds,
    )) as Record<string, any>[];

    // Collect unique area IDs
    const areaIds = [...new Set(allJourneyAreas.map((ja) => ja.area_id))];

    const aph = areaIds.map(() => '?').join(',');

    // Fetch all referenced data
    const [areas, fareLevels, areaFareLevels, areaStops, allJourneyFares, allTrackPoints] =
      await Promise.all([
        areaIds.length > 0
          ? sourceDb.getAllAsync(`SELECT * FROM areas WHERE id IN (${aph})`, areaIds) as Promise<Record<string, any>[]>
          : Promise.resolve([] as Record<string, any>[]),
        sourceDb.getAllAsync(
          `SELECT * FROM fare_levels WHERE journey_id IN (${jh})`, journeyIds,
        ) as Promise<Record<string, any>[]>,
        areaIds.length > 0
          ? sourceDb.getAllAsync(`SELECT * FROM area_fare_levels WHERE area_id IN (${aph})`, areaIds) as Promise<Record<string, any>[]>
          : Promise.resolve([] as Record<string, any>[]),
        areaIds.length > 0
          ? sourceDb.getAllAsync(`SELECT * FROM area_stops WHERE area_id IN (${aph})`, areaIds) as Promise<Record<string, any>[]>
          : Promise.resolve([] as Record<string, any>[]),
        sourceDb.getAllAsync(
          `SELECT * FROM journey_fares WHERE journey_id IN (${jh})`, journeyIds,
        ) as Promise<Record<string, any>[]>,
        sourceDb.getAllAsync(
          `SELECT * FROM track_points WHERE journey_id IN (${jh}) ORDER BY sequence`, journeyIds,
        ) as Promise<Record<string, any>[]>,
      ]);

    // Collect unique stop IDs
    const stopIds = [...new Set(areaStops.map((s) => s.stop_id))];
    let stops: Record<string, any>[] = [];
    if (stopIds.length > 0) {
      const sph = stopIds.map(() => '?').join(',');
      stops = (await sourceDb.getAllAsync(
        `SELECT * FROM stops WHERE id IN (${sph})`, stopIds,
      )) as Record<string, any>[];
    }

    // Build export database
    const exportDb = await SQLite.openDatabaseAsync(label);
    await exportDb.execAsync('PRAGMA foreign_keys = OFF;');
    const stmts = SCHEMA_SQL.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of stmts) {
      try { await exportDb.execAsync(stmt + ';'); } catch { /* table may exist */ }
    }

    // Metadata
    await exportDb.runAsync(
      "INSERT INTO _meta (key, value) VALUES ('source_journey_ids', ?)",
      [journeyIds.join(',')],
    );
    await exportDb.runAsync(
      "INSERT INTO _meta (key, value) VALUES ('exported_at', ?)",
      [new Date().toISOString()],
    );

    // Insert rows (ignore duplicate PK conflicts from shared areas/stops)
    const insertIgnore = (table: string, cols: string, vals: any[]) => {
      const ph = vals.map(() => '?').join(',');
      return exportDb.runAsync(
        `INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${ph})`, vals,
      );
    };

    for (const row of journeys) {
      await insertIgnore('journeys', 'id,name,start_area_id,end_area_id,status,created_at,updated_at', [
        row.id, row.name, row.start_area_id, row.end_area_id, row.status, row.created_at, row.updated_at,
      ]);
    }
    for (const row of areas) {
      await insertIgnore('areas', 'id,name,polygon,created_at,updated_at', [
        row.id, row.name, row.polygon, row.created_at, row.updated_at,
      ]);
    }
    for (const row of stops) {
      await insertIgnore('stops', 'id,label,latitude,longitude,radius,seq,created_at,updated_at', [
        row.id, row.label, row.latitude, row.longitude, row.radius, row.seq, row.created_at, row.updated_at,
      ]);
    }
    for (const row of fareLevels) {
      await insertIgnore('fare_levels', 'id,journey_id,label,order_no,amount', [
        row.id, row.journey_id, row.label, row.order_no, row.amount,
      ]);
    }
    for (const row of areaFareLevels) {
      await insertIgnore('area_fare_levels', 'id,area_id,fare_level_id', [
        row.id, row.area_id, row.fare_level_id,
      ]);
    }
    for (const row of areaStops) {
      await insertIgnore('area_stops', 'id,area_id,stop_id,fare_level_id,created_at,updated_at', [
        row.id, row.area_id, row.stop_id, row.fare_level_id, row.created_at, row.updated_at,
      ]);
    }
    for (const row of allJourneyAreas) {
      await insertIgnore('journey_areas', 'id,journey_id,area_id,sequence,created_at,updated_at', [
        row.id, row.journey_id, row.area_id, row.sequence, row.created_at, row.updated_at,
      ]);
    }
    for (const row of allJourneyFares) {
      await insertIgnore('journey_fares', 'id,journey_id,from_journey_area_id,to_journey_area_id,fare_level_id,created_at,updated_at', [
        row.id, row.journey_id, row.from_journey_area_id, row.to_journey_area_id, row.fare_level_id, row.created_at, row.updated_at,
      ]);
    }
    for (const row of allTrackPoints) {
      await insertIgnore('track_points', 'id,journey_id,journey_area_id,sequence,latitude,longitude,created_at', [
        row.id, row.journey_id, row.journey_area_id, row.sequence, row.latitude, row.longitude, row.created_at,
      ]);
    }

    await exportDb.closeAsync();
    return label;
  }
}
