package com.mateapp.validation

import android.database.sqlite.SQLiteDatabase

object MateAppDatabase {

    private const val SCHEMA_VERSION_KEY = "schema_version"
    private const val SCHEMA_VERSION_CODE = 5

    /**
     * Opens a MateApp-exported .db file with read-only mode.
     * Caller must close with [close].
     */
    fun open(dbPath: String): SQLiteDatabase {
        val db = SQLiteDatabase.openDatabase(
            dbPath,
            null,
            SQLiteDatabase.OPEN_READONLY,
        )
        db.execSQL("PRAGMA foreign_keys = ON")
        return db
    }

    /**
     * Opens an exported journey .db file and runs full validation in one call.
     * Handles open/close lifecycle automatically.
     *
     * Usage:
     *   val result = MateAppDatabase.validate(
     *       dbPath = "/path/to/export-j123.db",
     *       pickupLat = 5.5620,
     *       pickupLng = -0.2050,
     *       destLat = 5.6200,
     *       destLng = -0.0170,
     *   )
     */
    fun validate(
        dbPath: String,
        pickupLat: Double,
        pickupLng: Double,
        destLat: Double,
        destLng: Double,
    ): ValidationResult {
        val db = open(dbPath)
        return try {
            ValidationEngine().validate(db, pickupLat, pickupLng, destLat, destLng)
        } finally {
            close(db)
        }
    }

    fun close(db: SQLiteDatabase) {
        if (db.isOpen) db.close()
    }

    fun getSchemaVersion(dbPath: String): Int {
        val db = open(dbPath)
        return try {
            val cursor = db.rawQuery(
                "SELECT value FROM _meta WHERE key = ?",
                arrayOf(SCHEMA_VERSION_KEY),
            )
            cursor.use {
                if (it.moveToFirst()) it.getInt(0) else 0
            }
        } catch (_: Exception) {
            0
        } finally {
            close(db)
        }
    }

    fun getSourceJourneyId(dbPath: String): String? {
        val db = open(dbPath)
        return try {
            val cursor = db.rawQuery(
                "SELECT value FROM _meta WHERE key = 'source_journey_id'",
                null,
            )
            cursor.use {
                if (it.moveToFirst()) it.getString(0) else null
            }
        } catch (_: Exception) {
            null
        } finally {
            close(db)
        }
    }
}
