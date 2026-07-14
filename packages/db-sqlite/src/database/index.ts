import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('mateapp.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

const SCHEMA_VERSION = 5;

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '0');
  `);

  const row = await database.getFirstAsync(
    "SELECT value FROM _meta WHERE key = 'schema_version'"
  ) as { value: string } | null;

  const currentVersion = parseInt(row?.value || '0', 10);

  if (currentVersion >= SCHEMA_VERSION) return;

  await database.execAsync(`
    DROP TABLE IF EXISTS validation_logs;
    DROP TABLE IF EXISTS track_points;
    DROP TABLE IF EXISTS journey_fares;
    DROP TABLE IF EXISTS journey_areas;
    DROP TABLE IF EXISTS area_stops;
    DROP TABLE IF EXISTS area_fare_levels;
    DROP TABLE IF EXISTS fare_levels;
    DROP TABLE IF EXISTS stops;
    DROP TABLE IF EXISTS areas;
    DROP TABLE IF EXISTS journeys;

    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, start_area_id TEXT, end_area_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (start_area_id) REFERENCES areas(id),
      FOREIGN KEY (end_area_id) REFERENCES areas(id)
    );
    CREATE INDEX IF NOT EXISTS idx_journeys_name ON journeys(name);
    CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status);

    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, polygon TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_areas_name ON areas(name);

    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, latitude REAL NOT NULL,
      longitude REAL NOT NULL, radius REAL NOT NULL DEFAULT 50, seq INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stops_lat ON stops(latitude);
    CREATE INDEX IF NOT EXISTS idx_stops_lng ON stops(longitude);
    CREATE INDEX IF NOT EXISTS idx_stops_seq ON stops(seq);

    CREATE TABLE IF NOT EXISTS fare_levels (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL,
      label TEXT NOT NULL,
      order_no INTEGER NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (journey_id) REFERENCES journeys(id)
    );
    CREATE INDEX IF NOT EXISTS idx_fare_levels_journey ON fare_levels(journey_id, order_no);

    CREATE TABLE IF NOT EXISTS area_fare_levels (
      id TEXT PRIMARY KEY,
      area_id TEXT NOT NULL,
      fare_level_id TEXT NOT NULL,
      FOREIGN KEY (area_id) REFERENCES areas(id),
      FOREIGN KEY (fare_level_id) REFERENCES fare_levels(id)
    );
    CREATE INDEX IF NOT EXISTS idx_area_fare_levels_area ON area_fare_levels(area_id);
    CREATE INDEX IF NOT EXISTS idx_area_fare_levels_level ON area_fare_levels(fare_level_id);

    CREATE TABLE IF NOT EXISTS area_stops (
      id TEXT PRIMARY KEY, area_id TEXT NOT NULL, stop_id TEXT NOT NULL,
      fare_level_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (area_id) REFERENCES areas(id),
      FOREIGN KEY (stop_id) REFERENCES stops(id),
      FOREIGN KEY (fare_level_id) REFERENCES fare_levels(id)
    );
    CREATE INDEX IF NOT EXISTS idx_area_stops_area ON area_stops(area_id, stop_id);
    CREATE INDEX IF NOT EXISTS idx_area_stops_stop ON area_stops(stop_id);

    CREATE TABLE IF NOT EXISTS journey_areas (
      id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, area_id TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (journey_id) REFERENCES journeys(id),
      FOREIGN KEY (area_id) REFERENCES areas(id)
    );
    CREATE INDEX IF NOT EXISTS idx_journey_areas ON journey_areas(journey_id, sequence);

    CREATE TABLE IF NOT EXISTS journey_fares (
      id TEXT PRIMARY KEY, journey_id TEXT NOT NULL,
      from_journey_area_id TEXT NOT NULL, to_journey_area_id TEXT NOT NULL,
      fare_level_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (journey_id) REFERENCES journeys(id),
      FOREIGN KEY (from_journey_area_id) REFERENCES journey_areas(id),
      FOREIGN KEY (to_journey_area_id) REFERENCES journey_areas(id),
      FOREIGN KEY (fare_level_id) REFERENCES fare_levels(id)
    );
    CREATE INDEX IF NOT EXISTS idx_journey_fares ON journey_fares(journey_id, from_journey_area_id, to_journey_area_id);

    CREATE TABLE IF NOT EXISTS track_points (
      id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, journey_area_id TEXT,
      sequence INTEGER NOT NULL DEFAULT 0,
      latitude REAL NOT NULL, longitude REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (journey_id) REFERENCES journeys(id),
      FOREIGN KEY (journey_area_id) REFERENCES journey_areas(id)
    );
    CREATE INDEX IF NOT EXISTS idx_track_points ON track_points(journey_id, sequence);

    CREATE TABLE IF NOT EXISTS validation_logs (
      id TEXT PRIMARY KEY, pickup_lat REAL NOT NULL, pickup_lng REAL NOT NULL,
      dest_lat REAL NOT NULL, dest_lng REAL NOT NULL,
      pickup_stop_id TEXT, pickup_area_id TEXT, dest_stop_id TEXT, dest_area_id TEXT,
      journey_id TEXT, fare REAL, fare_type TEXT,
      status TEXT NOT NULL DEFAULT 'unknown', message TEXT NOT NULL DEFAULT '',
      estimated_pickup INTEGER NOT NULL DEFAULT 0,
      estimated_dest INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_validation_logs ON validation_logs(created_at);
  `);

  await database.runAsync(
    "UPDATE _meta SET value = ? WHERE key = 'schema_version'",
    [String(SCHEMA_VERSION)]
  );
}

export async function closeDatabase(): Promise<void> {
  if (db) { await db.closeAsync(); db = null; }
}
