package com.mateapp.validation

import android.database.sqlite.SQLiteDatabase

/**
 * MateApp validation client. Configure once with [Builder], then reuse for
 * multiple validations. Switch to a different exported .db at any time with
 * [useDatabase].
 *
 * Usage:
 *   val mateApp = MateAppDatabase.Builder()
 *       .dbPath("/path/to/export-journey.db")
 *       .build()
 *
 *   val result = mateApp.validate(5.5620, -0.2050, 5.6200, -0.0170)
 *   val another = mateApp.validate(5.55, -0.20, 5.65, -0.01)
 *
 *   mateApp.useDatabase("/path/to/new-export.db")
 *   val newResult = mateApp.validate(6.68, -1.62, 6.68, -1.62)
 */
class MateAppDatabase private constructor(
    private var currentDbPath: String?,
) {

    class Builder {
        private var dbPath: String? = null

        fun dbPath(path: String): Builder = apply { this.dbPath = path }

        fun build(): MateAppDatabase = MateAppDatabase(dbPath)
    }

    /** Switch to a different exported .db file. */
    fun useDatabase(dbPath: String) {
        this.currentDbPath = dbPath
    }

    /** The currently configured database path, or null if not set. */
    fun getDatabasePath(): String? = currentDbPath

    /**
     * Validate fare for the currently configured database.
     * Opens and closes the database automatically on each call.
     *
     * @throws IllegalStateException if no dbPath has been configured.
     */
    fun validate(
        pickupLat: Double,
        pickupLng: Double,
        destLat: Double,
        destLng: Double,
    ): ValidationResult {
        val path = currentDbPath
            ?: throw IllegalStateException("No database path configured. Call useDatabase() or use Builder.dbPath().")
        val db = openDb(path)
        return try {
            ValidationEngine().validate(db, pickupLat, pickupLng, destLat, destLng)
        } finally {
            closeDb(db)
        }
    }

    /**
     * Read the schema version from the _meta table.
     * @throws IllegalStateException if no dbPath has been configured.
     */
    fun getSchemaVersion(): Int {
        val path = currentDbPath
            ?: throw IllegalStateException("No database path configured.")
        val db = openDb(path)
        return try {
            val cursor = db.rawQuery(
                "SELECT value FROM _meta WHERE key = ?",
                arrayOf(SCHEMA_VERSION_KEY),
            )
            cursor.use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            }
        } catch (_: Exception) {
            0
        } finally {
            closeDb(db)
        }
    }

    /**
     * Read the source_journey_id from the _meta table.
     * Returns null if not present (e.g. full backup, not journey export).
     * @throws IllegalStateException if no dbPath has been configured.
     */
    /**
     * Read the source_journey_ids from the _meta table (plural, comma-separated).
     * Returns null if not present (e.g. single-journey export uses source_journey_id).
     * @throws IllegalStateException if no dbPath has been configured.
     */
    fun getSourceJourneyIds(): String? {
        val path = currentDbPath
            ?: throw IllegalStateException("No database path configured.")
        val db = openDb(path)
        return try {
            val cursor = db.rawQuery(
                "SELECT value FROM _meta WHERE key = ?",
                arrayOf(SOURCE_JOURNEY_IDS_KEY),
            )
            cursor.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        } catch (_: Exception) {
            null
        } finally {
            closeDb(db)
        }
    }

    fun getSourceJourneyId(): String? {
        val path = currentDbPath
            ?: throw IllegalStateException("No database path configured.")
        val db = openDb(path)
        return try {
            val cursor = db.rawQuery(
                "SELECT value FROM _meta WHERE key = ?",
                arrayOf(SOURCE_JOURNEY_KEY),
            )
            cursor.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        } catch (_: Exception) {
            null
        } finally {
            closeDb(db)
        }
    }

    // -- Static convenience methods (one-off usage) --

    companion object {
    private const val SCHEMA_VERSION_KEY = "schema_version"
    private const val SOURCE_JOURNEY_KEY = "source_journey_id"
    private const val SOURCE_JOURNEY_IDS_KEY = "source_journey_ids"

    /**
     * One-liner validation without creating a client.
         * Opens, validates, and closes the database in one call.
         *
         * Usage:
         *   val result = MateAppDatabase.validate(
         *       dbPath = "/path/to/db",
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
            val db = openDb(dbPath)
            return try {
                ValidationEngine().validate(db, pickupLat, pickupLng, destLat, destLng)
            } finally {
                closeDb(db)
            }
        }

        fun openDb(dbPath: String): SQLiteDatabase {
            val db = SQLiteDatabase.openDatabase(
                dbPath,
                null,
                SQLiteDatabase.OPEN_READONLY,
            )
            db.execSQL("PRAGMA foreign_keys = ON")
            return db
        }

        fun closeDb(db: SQLiteDatabase) {
            if (db.isOpen) db.close()
        }

        fun getSchemaVersion(dbPath: String): Int {
            val db = openDb(dbPath)
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
                closeDb(db)
            }
        }

        fun getSourceJourneyIds(dbPath: String): String? {
            val db = openDb(dbPath)
            return try {
                val cursor = db.rawQuery(
                    "SELECT value FROM _meta WHERE key = ?",
                    arrayOf(SOURCE_JOURNEY_IDS_KEY),
                )
                cursor.use { c ->
                    if (c.moveToFirst()) c.getString(0) else null
                }
            } catch (_: Exception) {
                null
            } finally {
                closeDb(db)
            }
        }

        fun getSourceJourneyId(dbPath: String): String? {
            val db = openDb(dbPath)
            return try {
                val cursor = db.rawQuery(
                    "SELECT value FROM _meta WHERE key = ?",
                    arrayOf(SOURCE_JOURNEY_KEY),
                )
                cursor.use {
                    if (it.moveToFirst()) it.getString(0) else null
                }
            } catch (_: Exception) {
                null
            } finally {
                closeDb(db)
            }
        }
    }
}
