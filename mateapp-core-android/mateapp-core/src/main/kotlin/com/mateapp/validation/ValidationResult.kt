package com.mateapp.validation

data class ValidationResult(
    val journeyName: String? = null,
    val pickupAreaName: String? = null,
    val pickupStopLabel: String? = null,
    val destAreaName: String? = null,
    val destStopLabel: String? = null,
    val fare: Double? = null,
    val fareType: String? = null,
    val estimatedPickup: Boolean = false,
    val estimatedDest: Boolean = false,
    val status: ValidationStatus = ValidationStatus.UNKNOWN,
    val message: String = "",
)

enum class ValidationStatus {
    SUCCESS,
    JOURNEY_NOT_FOUND,
    STOP_NOT_FOUND,
    UNKNOWN,
}

data class StopRow(
    val id: String,
    val label: String,
    val latitude: Double,
    val longitude: Double,
    val radius: Double,
    val seq: Int,
)

data class AreaRow(
    val id: String,
    val name: String,
    val polygon: String?,
)

data class FareLevelRow(
    val id: String,
    val journeyId: String,
    val label: String,
    val orderNo: Int,
    val amount: Double,
)

data class AreaStopRow(
    val id: String,
    val areaId: String,
    val stopId: String,
    val fareLevelId: String?,
)

data class JourneyRow(
    val id: String,
    val name: String,
    val status: String,
)

data class JourneyAreaRow(
    val id: String,
    val journeyId: String,
    val areaId: String,
    val sequence: Int,
)

data class JourneyFareRow(
    val id: String,
    val journeyId: String,
    val fromJourneyAreaId: String,
    val toJourneyAreaId: String,
    val fareLevelId: String,
)

data class LatLng(
    val latitude: Double,
    val longitude: Double,
)
