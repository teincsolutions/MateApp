package com.mateapp.validation

import kotlin.math.*

object GeometryUtils {

    private const val EARTH_RADIUS = 6371000.0

    fun haversineDistance(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLng / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return EARTH_RADIUS * c
    }

    fun pointInPolygon(point: LatLng, polygon: List<LatLng>): Boolean {
        if (polygon.size < 3) return false
        var inside = false
        val x = point.latitude
        val y = point.longitude
        var j = polygon.size - 1
        for (i in polygon.indices) {
            val xi = polygon[i].latitude
            val yi = polygon[i].longitude
            val xj = polygon[j].latitude
            val yj = polygon[j].longitude
            if ((yi > y) != (yj > y) &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
            ) {
                inside = !inside
            }
            j = i
        }
        return inside
    }

    fun convexHull(points: List<LatLng>): List<LatLng> {
        if (points.size < 3) return points
        val sorted = points.sortedWith(compareBy({ it.latitude }, { it.longitude }))

        fun cross(o: LatLng, a: LatLng, b: LatLng): Double {
            return (a.latitude - o.latitude) * (b.longitude - o.longitude) -
                    (a.longitude - o.longitude) * (b.latitude - o.latitude)
        }

        val lower = mutableListOf<LatLng>()
        for (p in sorted) {
            while (lower.size >= 2 &&
                cross(lower[lower.size - 2], lower[lower.size - 1], p) <= 0.0
            ) {
                lower.removeAt(lower.size - 1)
            }
            lower.add(p)
        }

        val upper = mutableListOf<LatLng>()
        for (i in sorted.indices.reversed()) {
            val p = sorted[i]
            while (upper.size >= 2 &&
                cross(upper[upper.size - 2], upper[upper.size - 1], p) <= 0.0
            ) {
                upper.removeAt(upper.size - 1)
            }
            upper.add(p)
        }

        lower.removeAt(lower.size - 1)
        upper.removeAt(upper.size - 1)
        return lower + upper
    }

    fun polygonFromStops(stops: List<LatLng>): List<LatLng> = convexHull(stops)

    fun polygonFromJson(json: String?): List<LatLng> {
        if (json == null) return emptyList()
        return try {
            val trimmed = json.trim()
            if (trimmed.startsWith("[")) {
                val raw = trimmed
                    .removeSurrounding("[", "]")
                    .split("},{")
                    .map { it.removeSurrounding("{", "}") }
                raw.map { entry ->
                    val parts = entry.split(",").associate {
                        val kv = it.split(":")
                        kv[0].trim().removeSurrounding("\"") to kv[1].trim()
                    }
                    LatLng(
                        latitude = parts["latitude"]?.toDoubleOrNull() ?: 0.0,
                        longitude = parts["longitude"]?.toDoubleOrNull() ?: 0.0,
                    )
                }
            } else {
                emptyList()
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
}
