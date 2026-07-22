package com.mateapp.validation

import org.json.JSONObject
import org.junit.Assume
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Headless CLI validation test.
 *
 * Reads system properties from the Gradle command line and prints
 * the validation result as JSON to stdout.
 *
 * Usage:
 *   ./gradlew :mateapp-core:testDebugUnitTest \\
 *     --tests "*ValidationCLITest" \\
 *     -DdbPath=/absolute/path/to/export.db \\
 *     -DpickupLat=6.7386 \\
 *     -DpickupLng=-1.5057 \\
 *     -DdestLat=6.6947 \\
 *     -DdestLng=-1.6156
 */
@RunWith(RobolectricTestRunner::class)
class ValidationCLITest {

    @Test
    fun run() {
        val dbPath = System.getProperty("dbPath")
        val pickupLat = System.getProperty("pickupLat")?.toDoubleOrNull()
        val pickupLng = System.getProperty("pickupLng")?.toDoubleOrNull()
        val destLat = System.getProperty("destLat")?.toDoubleOrNull()
        val destLng = System.getProperty("destLng")?.toDoubleOrNull()

        // Skip gracefully when not invoked with CLI properties
        Assume.assumeTrue("CLI properties not set — skipping ValidationCLITest", dbPath != null && pickupLat != null && pickupLng != null && destLat != null && destLng != null)

        val result = MateAppDatabase.validate(dbPath!!, pickupLat!!, pickupLng!!, destLat!!, destLng!!)

        val json = JSONObject().apply {
            put("status", result.status.name)
            put("fare", result.fare ?: JSONObject.NULL)
            put("fareType", result.fareType ?: JSONObject.NULL)
            put("journeyName", result.journeyName ?: JSONObject.NULL)
            put("pickupAreaName", result.pickupAreaName ?: JSONObject.NULL)
            put("pickupStopLabel", result.pickupStopLabel ?: JSONObject.NULL)
            put("destAreaName", result.destAreaName ?: JSONObject.NULL)
            put("destStopLabel", result.destStopLabel ?: JSONObject.NULL)
            put("estimatedPickup", result.estimatedPickup)
            put("estimatedDest", result.estimatedDest)
            put("message", result.message)
            put("dbPath", dbPath)
            put("pickupLat", pickupLat)
            put("pickupLng", pickupLng)
            put("destLat", destLat)
            put("destLng", destLng)
        }

        println("\n=== VALIDATION_RESULT ===")
        println(json.toString(2))
        println("=== END_VALIDATION_RESULT ===\n")
    }
}
