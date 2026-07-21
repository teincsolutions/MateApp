package com.mateapp.validation

import android.database.sqlite.SQLiteDatabase

class ValidationEngine {

    fun validate(
        db: SQLiteDatabase,
        pickupLat: Double,
        pickupLng: Double,
        destLat: Double,
        destLng: Double,
    ): ValidationResult {
        val result = ValidationResult()

        val pickupStop = resolveStop(db, pickupLat, pickupLng)
        val pickupEstimated = pickupStop.second
        result.pickupStopLabel = pickupStop.first?.label
        result.estimatedPickup = pickupEstimated

        val destStop = resolveStop(db, destLat, destLng)
        val destEstimated = destStop.second
        result.destStopLabel = destStop.first?.label
        result.estimatedDest = destEstimated

        val pickupArea = resolveArea(db, pickupStop.first)
            ?: resolveAreaByPoint(db, pickupLat, pickupLng)
        result.pickupAreaName = pickupArea?.name

        val destArea = resolveArea(db, destStop.first)
            ?: resolveAreaByPoint(db, destLat, destLng)
        result.destAreaName = destArea?.name

        if (pickupStop.first == null && destStop.first == null) {
            return result.copy(
                status = ValidationStatus.STOP_NOT_FOUND,
                message = "No stops found near pickup or destination",
            )
        }

        if (pickupArea == null || destArea == null) {
            return result.copy(
                status = ValidationStatus.STOP_NOT_FOUND,
                message = "Could not determine pickup or destination area",
            )
        }

        val journey = findJourney(db, pickupArea.id, destArea.id)
        if (journey == null) {
            return result.copy(
                status = ValidationStatus.JOURNEY_NOT_FOUND,
                message = "Journey not found",
            )
        }
        result.journeyName = journey.name

        val (fare, fareType) = calculateFare(
            db = db,
            journey = journey,
            pickupArea = pickupArea,
            destArea = destArea,
            pickupStop = pickupStop.first,
            destStop = destStop.first,
        )
        result.fare = fare
        result.fareType = fareType
        result.status = ValidationStatus.SUCCESS
        result.message = if (fare != null) "Fare: GHS ${"%.2f".format(fare)}" else "Fare not configured"

        return result
    }

    private fun resolveStop(db: SQLiteDatabase, lat: Double, lng: Double): Pair<StopRow?, Boolean> {
        val exact = DatabaseReader.findByRadius(db, lat, lng, 50.0)
        if (exact.isNotEmpty()) return exact.first() to false
        val nearest = DatabaseReader.findNearestStop(db, lat, lng)
        return nearest to (nearest != null)
    }

    private fun resolveArea(db: SQLiteDatabase, stop: StopRow?): AreaRow? {
        if (stop == null) return null
        val areaStops = DatabaseReader.getAreaStopsByStop(db, stop.id)
        if (areaStops.isEmpty()) return null
        return DatabaseReader.getArea(db, areaStops.first().areaId)
    }

    private fun resolveAreaByPoint(db: SQLiteDatabase, lat: Double, lng: Double): AreaRow? {
        val point = LatLng(lat, lng)
        val areas = DatabaseReader.getAllAreasWithPolygons(db)
        for (area in areas) {
            val polygon = GeometryUtils.polygonFromJson(area.polygon)
            if (polygon.isNotEmpty() && GeometryUtils.pointInPolygon(point, polygon)) {
                return area
            }
        }
        return null
    }

    private fun findJourney(db: SQLiteDatabase, pickupAreaId: String, destAreaId: String): JourneyRow? {
        val journeys = DatabaseReader.getAllJourneys(db)
        for (journey in journeys) {
            val journeyAreas = DatabaseReader.getJourneyAreas(db, journey.id)
            val areaIds = journeyAreas.map { it.areaId }
            if (areaIds.contains(pickupAreaId) && areaIds.contains(destAreaId)) {
                return journey
            }
        }
        return null
    }

    private fun calculateFare(
        db: SQLiteDatabase,
        journey: JourneyRow,
        pickupArea: AreaRow,
        destArea: AreaRow,
        pickupStop: StopRow?,
        destStop: StopRow?,
    ): Pair<Double?, String?> {
        if (pickupArea.id == destArea.id) {
            val intra = getIntraAreaFare(db, pickupArea.id, pickupStop, destStop)
            return intra to "area"
        }
        val inter = getInterAreaFare(db, journey.id, pickupArea.id, destArea.id)
        return inter to "journey"
    }

    private fun getInterAreaFare(
        db: SQLiteDatabase,
        journeyId: String,
        pickupAreaId: String,
        destAreaId: String,
    ): Double? {
        val fare = DatabaseReader.getBetweenAreasFare(db, journeyId, pickupAreaId, destAreaId)
        if (fare != null) {
            val levels = DatabaseReader.getFareLevelsByJourney(db, journeyId)
            val matched = levels.find { it.id == fare.fareLevelId }
            if (matched != null) return matched.amount
        }
        val opposite = DatabaseReader.getBetweenAreasFare(db, journeyId, destAreaId, pickupAreaId)
        if (opposite != null) {
            val levels = DatabaseReader.getFareLevelsByJourney(db, journeyId)
            val matched = levels.find { it.id == opposite.fareLevelId }
            if (matched != null) return matched.amount
        }
        return null
    }

    private fun getIntraAreaFare(
        db: SQLiteDatabase,
        areaId: String,
        pickupStop: StopRow?,
        destStop: StopRow?,
    ): Double? {
        if (pickupStop == null || destStop == null) return null
        val areaStops = DatabaseReader.getAreaStopsByStop(db, pickupStop.id) +
                DatabaseReader.getAreaStopsByStop(db, destStop.id)
        val uniqueAreaStops = areaStops.filter { it.areaId == areaId }.distinctBy { it.stopId }
        if (uniqueAreaStops.isEmpty()) return null

        val stopIds = uniqueAreaStops.map { it.stopId }.toSet()
        val stops = mutableMapOf<String, StopRow>()
        for (sid in stopIds) {
            val s = DatabaseReader.getStopById(db, sid)
            if (s != null) stops[s.id] = s
        }
        if (stops.isEmpty()) return null

        val sortedStops = stops.values.sortedBy { it.latitude }
        val a1 = sortedStops.first()

        val tripDist = GeometryUtils.haversineDistance(
            pickupStop.latitude, pickupStop.longitude,
            destStop.latitude, destStop.longitude,
        )

        val flStopDist = mutableMapOf<String, Double>()
        for (areaStop in uniqueAreaStops) {
            if (areaStop.fareLevelId == null) continue
            val stop = stops[areaStop.stopId] ?: continue
            val dist = GeometryUtils.haversineDistance(
                a1.latitude, a1.longitude,
                stop.latitude, stop.longitude,
            )
            val current = flStopDist[areaStop.fareLevelId]
            if (current == null || dist < current) {
                flStopDist[areaStop.fareLevelId] = dist
            }
        }

        var bestFlId: String? = null
        var bestDiff = Double.MAX_VALUE
        for ((flId, refDist) in flStopDist) {
            val diff = kotlin.math.abs(tripDist - refDist)
            if (diff < bestDiff) {
                bestDiff = diff
                bestFlId = flId
            }
        }

        if (bestFlId == null) return null

        val areaLevels = DatabaseReader.getFareLevelsByArea(db, areaId)
        val matched = areaLevels.find { it.id == bestFlId }
        return matched?.amount
    }

    private fun ValidationResult.copy(
        status: ValidationStatus = this.status,
        message: String = this.message,
    ): ValidationResult = ValidationResult(
        journeyName = this.journeyName,
        pickupAreaName = this.pickupAreaName,
        pickupStopLabel = this.pickupStopLabel,
        destAreaName = this.destAreaName,
        destStopLabel = this.destStopLabel,
        fare = this.fare,
        fareType = this.fareType,
        estimatedPickup = this.estimatedPickup,
        estimatedDest = this.estimatedDest,
        status = status,
        message = message,
    )
}
