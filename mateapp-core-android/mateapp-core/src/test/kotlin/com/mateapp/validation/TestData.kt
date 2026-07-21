package com.mateapp.validation

import android.database.sqlite.SQLiteDatabase

object TestData {

    fun createSchema(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS journeys (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, start_area_id TEXT, end_area_id TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS areas (
                id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, polygon TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS stops (
                id TEXT PRIMARY KEY, label TEXT NOT NULL, latitude REAL NOT NULL,
                longitude REAL NOT NULL, radius REAL NOT NULL DEFAULT 50, seq INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS fare_levels (
                id TEXT PRIMARY KEY,
                journey_id TEXT NOT NULL,
                label TEXT NOT NULL,
                order_no INTEGER NOT NULL DEFAULT 0,
                amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (journey_id) REFERENCES journeys(id)
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS area_fare_levels (
                id TEXT PRIMARY KEY,
                area_id TEXT NOT NULL,
                fare_level_id TEXT NOT NULL,
                FOREIGN KEY (area_id) REFERENCES areas(id),
                FOREIGN KEY (fare_level_id) REFERENCES fare_levels(id)
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS area_stops (
                id TEXT PRIMARY KEY, area_id TEXT NOT NULL, stop_id TEXT NOT NULL,
                fare_level_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (area_id) REFERENCES areas(id),
                FOREIGN KEY (stop_id) REFERENCES stops(id),
                FOREIGN KEY (fare_level_id) REFERENCES fare_levels(id)
            )
        """.trimIndent())
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS journey_areas (
                id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, area_id TEXT NOT NULL,
                sequence INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (journey_id) REFERENCES journeys(id),
                FOREIGN KEY (area_id) REFERENCES areas(id)
            )
        """.trimIndent())
        db.execSQL("""
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
            )
        """.trimIndent())
    }

    fun insertData(db: SQLiteDatabase) {
        // Journeys
        db.execSQL("INSERT INTO journeys (id, name, status) VALUES ('j1', 'Accra-Tema', 'completed')")
        db.execSQL("INSERT INTO journeys (id, name, status) VALUES ('j2', 'Kumasi Loop', 'draft')")

        // Areas
        val accraPolygon = """[{"latitude":5.53,"longitude":-0.25},{"latitude":5.53,"longitude":-0.15},{"latitude":5.60,"longitude":-0.15},{"latitude":5.60,"longitude":-0.25}]"""
        val temaPolygon = """[{"latitude":5.60,"longitude":-0.05},{"latitude":5.60,"longitude":0.02},{"latitude":5.65,"longitude":0.02},{"latitude":5.65,"longitude":-0.05}]"""
        db.execSQL("INSERT INTO areas (id, name, polygon) VALUES ('a1', 'Accra Central', '$accraPolygon')")
        db.execSQL("INSERT INTO areas (id, name, polygon) VALUES ('a2', 'Tema', '$temaPolygon')")
        db.execSQL("INSERT INTO areas (id, name, polygon) VALUES ('a3', 'Kumasi Central', NULL)")

        // Stops
        db.execSQL("INSERT INTO stops (id, label, latitude, longitude, radius, seq) VALUES ('s1', 'Circle', 5.5620, -0.2050, 50, 1)")
        db.execSQL("INSERT INTO stops (id, label, latitude, longitude, radius, seq) VALUES ('s2', 'Kwame Nkrumah Circle', 5.5630, -0.2040, 50, 2)")
        db.execSQL("INSERT INTO stops (id, label, latitude, longitude, radius, seq) VALUES ('s3', 'Tema Station', 5.6200, -0.0170, 50, 1)")
        db.execSQL("INSERT INTO stops (id, label, latitude, longitude, radius, seq) VALUES ('s4', 'Kejetia', 6.6800, -1.6200, 50, 1)")

        // Fare Levels
        db.execSQL("INSERT INTO fare_levels (id, journey_id, label, order_no, amount) VALUES ('fl1', 'j1', 'Standard', 1, 5.00)")
        db.execSQL("INSERT INTO fare_levels (id, journey_id, label, order_no, amount) VALUES ('fl2', 'j1', 'Premium', 2, 10.00)")
        db.execSQL("INSERT INTO fare_levels (id, journey_id, label, order_no, amount) VALUES ('fl3', 'j2', 'Basic', 1, 3.00)")

        // Area Fare Levels
        db.execSQL("INSERT INTO area_fare_levels (id, area_id, fare_level_id) VALUES ('afl1', 'a1', 'fl1')")
        db.execSQL("INSERT INTO area_fare_levels (id, area_id, fare_level_id) VALUES ('afl2', 'a2', 'fl2')")
        db.execSQL("INSERT INTO area_fare_levels (id, area_id, fare_level_id) VALUES ('afl3', 'a1', 'fl2')")

        // Area Stops
        db.execSQL("INSERT INTO area_stops (id, area_id, stop_id, fare_level_id) VALUES ('as1', 'a1', 's1', 'fl1')")
        db.execSQL("INSERT INTO area_stops (id, area_id, stop_id, fare_level_id) VALUES ('as2', 'a1', 's2', NULL)")
        db.execSQL("INSERT INTO area_stops (id, area_id, stop_id, fare_level_id) VALUES ('as3', 'a2', 's3', 'fl2')")
        db.execSQL("INSERT INTO area_stops (id, area_id, stop_id, fare_level_id) VALUES ('as4', 'a3', 's4', 'fl3')")

        // Journey Areas
        db.execSQL("INSERT INTO journey_areas (id, journey_id, area_id, sequence) VALUES ('ja1', 'j1', 'a1', 1)")
        db.execSQL("INSERT INTO journey_areas (id, journey_id, area_id, sequence) VALUES ('ja2', 'j1', 'a2', 2)")
        db.execSQL("INSERT INTO journey_areas (id, journey_id, area_id, sequence) VALUES ('ja3', 'j2', 'a3', 1)")

        // Journey Fares
        db.execSQL("INSERT INTO journey_fares (id, journey_id, from_journey_area_id, to_journey_area_id, fare_level_id) VALUES ('jf1', 'j1', 'ja1', 'ja2', 'fl1')")
    }
}
