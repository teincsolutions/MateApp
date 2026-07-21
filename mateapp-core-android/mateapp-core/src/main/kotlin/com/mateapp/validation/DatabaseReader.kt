package com.mateapp.validation

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase

object DatabaseReader {

    private const val EARTH_RADIUS_KM = 6371.0

    fun findByRadius(db: SQLiteDatabase, lat: Double, lng: Double, radiusMeters: Double): List<StopRow> {
        val radiusDeg = radiusMeters / 111320.0
        val sql = """
            SELECT id, label, latitude, longitude, radius, seq
            FROM stops
            WHERE latitude BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
        """.trimIndent()
        val args = arrayOf(
            (lat - radiusDeg).toString(),
            (lat + radiusDeg).toString(),
            (lng - radiusDeg).toString(),
            (lng + radiusDeg).toString(),
        )
        val results = mutableListOf<StopRow>()
        db.rawQuery(sql, args).use { cursor ->
            while (cursor.moveToNext()) {
                val stop = cursor.toStopRow()
                val dist = GeometryUtils.haversineDistance(lat, lng, stop.latitude, stop.longitude)
                if (dist <= radiusMeters) {
                    results.add(stop)
                }
            }
        }
        return results
    }

    fun findNearestStop(db: SQLiteDatabase, lat: Double, lng: Double): StopRow? {
        val stepKm = listOf(1.0, 5.0, 25.0)
        for (km in stepKm) {
            val deg = km / 111.32
            val sql = """
                SELECT id, label, latitude, longitude, radius, seq
                FROM stops
                WHERE latitude BETWEEN ? AND ?
                  AND longitude BETWEEN ? AND ?
            """.trimIndent()
            val args = arrayOf(
                (lat - deg).toString(),
                (lat + deg).toString(),
                (lng - deg).toString(),
                (lng + deg).toString(),
            )
            val candidates = mutableListOf<Pair<Double, StopRow>>()
            db.rawQuery(sql, args).use { cursor ->
                while (cursor.moveToNext()) {
                    val stop = cursor.toStopRow()
                    val dist = GeometryUtils.haversineDistance(lat, lng, stop.latitude, stop.longitude)
                    if (dist <= km * 1000) {
                        candidates.add(dist to stop)
                    }
                }
            }
            if (candidates.isNotEmpty()) {
                candidates.minByOrNull { it.first }?.let { return it.second }
            }
        }
        return null
    }

    fun getStopById(db: SQLiteDatabase, stopId: String): StopRow? {
        val sql = "SELECT id, label, latitude, longitude, radius, seq FROM stops WHERE id = ?"
        db.rawQuery(sql, arrayOf(stopId)).use { cursor ->
            if (cursor.moveToFirst()) return cursor.toStopRow()
        }
        return null
    }

    fun getAreaStopsByStop(db: SQLiteDatabase, stopId: String): List<AreaStopRow> {
        val sql = """
            SELECT id, area_id, stop_id, fare_level_id
            FROM area_stops
            WHERE stop_id = ?
        """.trimIndent()
        val results = mutableListOf<AreaStopRow>()
        db.rawQuery(sql, arrayOf(stopId)).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(
                    AreaStopRow(
                        id = cursor.getString("id"),
                        areaId = cursor.getString("area_id"),
                        stopId = cursor.getString("stop_id"),
                        fareLevelId = cursor.getStringOrNull("fare_level_id"),
                    )
                )
            }
        }
        return results
    }

    fun getArea(db: SQLiteDatabase, areaId: String): AreaRow? {
        val sql = "SELECT id, name, polygon FROM areas WHERE id = ?"
        db.rawQuery(sql, arrayOf(areaId)).use { cursor ->
            if (cursor.moveToFirst()) {
                return AreaRow(
                    id = cursor.getString("id"),
                    name = cursor.getString("name"),
                    polygon = cursor.getStringOrNull("polygon"),
                )
            }
        }
        return null
    }

    fun getAllAreasWithPolygons(db: SQLiteDatabase): List<AreaRow> {
        val sql = "SELECT id, name, polygon FROM areas WHERE polygon IS NOT NULL"
        val results = mutableListOf<AreaRow>()
        db.rawQuery(sql, null).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(
                    AreaRow(
                        id = cursor.getString("id"),
                        name = cursor.getString("name"),
                        polygon = cursor.getString("polygon"),
                    )
                )
            }
        }
        return results
    }

    fun getAllJourneys(db: SQLiteDatabase): List<JourneyRow> {
        val sql = "SELECT id, name, status FROM journeys"
        val results = mutableListOf<JourneyRow>()
        db.rawQuery(sql, null).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(
                    JourneyRow(
                        id = cursor.getString("id"),
                        name = cursor.getString("name"),
                        status = cursor.getString("status"),
                    )
                )
            }
        }
        return results
    }

    fun getJourneyAreas(db: SQLiteDatabase, journeyId: String): List<JourneyAreaRow> {
        val sql = """
            SELECT id, journey_id, area_id, sequence
            FROM journey_areas
            WHERE journey_id = ?
            ORDER BY sequence
        """.trimIndent()
        val results = mutableListOf<JourneyAreaRow>()
        db.rawQuery(sql, arrayOf(journeyId)).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(
                    JourneyAreaRow(
                        id = cursor.getString("id"),
                        journeyId = cursor.getString("journey_id"),
                        areaId = cursor.getString("area_id"),
                        sequence = cursor.getInt("sequence"),
                    )
                )
            }
        }
        return results
    }

    fun getBetweenAreasFare(
        db: SQLiteDatabase,
        journeyId: String,
        fromAreaId: String,
        toAreaId: String,
    ): JourneyFareRow? {
        val sql = """
            SELECT jf.id, jf.journey_id, jf.from_journey_area_id, jf.to_journey_area_id, jf.fare_level_id
            FROM journey_fares jf
            JOIN journey_areas ja_from ON ja_from.id = jf.from_journey_area_id AND ja_from.area_id = ?
            JOIN journey_areas ja_to ON ja_to.id = jf.to_journey_area_id AND ja_to.area_id = ?
            WHERE jf.journey_id = ?
            LIMIT 1
        """.trimIndent()
        db.rawQuery(sql, arrayOf(fromAreaId, toAreaId, journeyId)).use { cursor ->
            if (cursor.moveToFirst()) {
                return JourneyFareRow(
                    id = cursor.getString("id"),
                    journeyId = cursor.getString("journey_id"),
                    fromJourneyAreaId = cursor.getString("from_journey_area_id"),
                    toJourneyAreaId = cursor.getString("to_journey_area_id"),
                    fareLevelId = cursor.getString("fare_level_id"),
                )
            }
        }
        return null
    }

    fun getFareLevelsByJourney(db: SQLiteDatabase, journeyId: String): List<FareLevelRow> {
        val sql = """
            SELECT id, journey_id, label, order_no, amount
            FROM fare_levels
            WHERE journey_id = ?
            ORDER BY amount ASC
        """.trimIndent()
        val results = mutableListOf<FareLevelRow>()
        db.rawQuery(sql, arrayOf(journeyId)).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(cursor.toFareLevelRow())
            }
        }
        return results
    }

    fun getFareLevelsByArea(db: SQLiteDatabase, areaId: String): List<FareLevelRow> {
        val sql = """
            SELECT fl.id, fl.journey_id, fl.label, fl.order_no, fl.amount
            FROM fare_levels fl
            JOIN area_fare_levels afl ON afl.fare_level_id = fl.id
            WHERE afl.area_id = ?
            ORDER BY fl.amount ASC
        """.trimIndent()
        val results = mutableListOf<FareLevelRow>()
        db.rawQuery(sql, arrayOf(areaId)).use { cursor ->
            while (cursor.moveToNext()) {
                results.add(cursor.toFareLevelRow())
            }
        }
        return results
    }

    private fun Cursor.getString(column: String): String =
        getString(getColumnIndexOrThrow(column))

    private fun Cursor.getStringOrNull(column: String): String? {
        val idx = getColumnIndex(column)
        return if (idx >= 0 && !isNull(idx)) getString(idx) else null
    }

    private fun Cursor.getInt(column: String): Int =
        getInt(getColumnIndexOrThrow(column))

    private fun Cursor.getDouble(column: String): Double =
        getDouble(getColumnIndexOrThrow(column))

    private fun Cursor.toStopRow(): StopRow = StopRow(
        id = getString("id"),
        label = getString("label"),
        latitude = getDouble("latitude"),
        longitude = getDouble("longitude"),
        radius = getDouble("radius"),
        seq = getInt("seq"),
    )

    private fun Cursor.toFareLevelRow(): FareLevelRow = FareLevelRow(
        id = getString("id"),
        journeyId = getString("journey_id"),
        label = getString("label"),
        orderNo = getInt("order_no"),
        amount = getDouble("amount"),
    )
}
