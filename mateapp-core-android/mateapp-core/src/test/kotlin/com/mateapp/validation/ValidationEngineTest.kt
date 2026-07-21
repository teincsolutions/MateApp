package com.mateapp.validation

import android.database.sqlite.SQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ValidationEngineTest {

    private lateinit var db: SQLiteDatabase
    private lateinit var engine: ValidationEngine

    @Before
    fun setUp() {
        db = SQLiteDatabase.create(null)
        TestData.createSchema(db)
        TestData.insertData(db)
        engine = ValidationEngine()
    }

    @Test
    fun `validate returns success with fare for inter-area journey`() {
        // Circle (a1) → Tema Station (a2)
        val result = engine.validate(db, 5.5620, -0.2050, 5.6200, -0.0170)
        assertEquals(ValidationStatus.SUCCESS, result.status)
        assertEquals("Accra-Tema", result.journeyName)
        assertEquals("Accra Central", result.pickupAreaName)
        assertEquals("Tema", result.destAreaName)
        assertEquals("Circle", result.pickupStopLabel)
        assertEquals("Tema Station", result.destStopLabel)
        assertNotNull(result.fare)
        assertEquals("journey", result.fareType)
    }

    @Test
    fun `validate returns success with fare for intra-area journey`() {
        // Circle (a1) → Kwame Nkrumah Circle (a1) — same area, intra-area fare
        val result = engine.validate(db, 5.5620, -0.2050, 5.5630, -0.2040)
        assertEquals(ValidationStatus.SUCCESS, result.status)
        assertEquals("Accra Central", result.pickupAreaName)
        assertEquals("Accra Central", result.destAreaName)
        assertNotNull(result.fare)
        assertEquals("area", result.fareType)
    }

    @Test
    fun `validate returns stop_not_found when no stops near either point`() {
        val result = engine.validate(db, 10.0, 10.0, 11.0, 11.0)
        assertEquals(ValidationStatus.STOP_NOT_FOUND, result.status)
        assertTrue(result.message.contains("No stops found"))
    }

    @Test
    fun `validate returns journey_not_found when areas not in same journey`() {
        // Kejetia (a3) is in j2, Circle (a1) is in j1 — no common journey
        val result = engine.validate(db, 6.6800, -1.6200, 5.5620, -0.2050)
        assertEquals(ValidationStatus.JOURNEY_NOT_FOUND, result.status)
        assertTrue(result.message.contains("Journey not found"))
    }

    @Test
    fun `validate finds stop within 50m radius without estimation`() {
        // Circle is at (5.5620, -0.2050) — query at same coords
        val result = engine.validate(db, 5.5620, -0.2050, 5.6200, -0.0170)
        assertEquals(ValidationStatus.SUCCESS, result.status)
        assertFalse(result.estimatedPickup)
        assertFalse(result.estimatedDest)
    }

    @Test
    fun `validate estimates stops when outside 50m radius`() {
        // Slightly offset from Circle but within 1km
        val result = engine.validate(db, 5.5635, -0.2045, 5.6200, -0.0170)
        assertEquals(ValidationStatus.SUCCESS, result.status)
        assertTrue(result.estimatedPickup)
        assertFalse(result.estimatedDest)
    }

    @Test
    fun `validate finds area by polygon when stop has no area`() {
        // Create a stop with no area_stops link inside the Accra Central polygon
        val result = engine.validate(db, 5.55, -0.20, 5.6200, -0.0170)
        assertEquals(ValidationStatus.SUCCESS, result.status)
        assertEquals("Accra Central", result.pickupAreaName)
    }

    @Test
    fun `validate uses destination area polygon when stop has no area link`() {
        // Drop s3 from area_stops for this test scenario
        db.execSQL("DELETE FROM area_stops WHERE id = 'as3'")
        // s3 still has no area_stops, but coords are inside Tema polygon
        val result = engine.validate(db, 5.5620, -0.2050, 5.62, -0.02)
        assertEquals(ValidationStatus.SUCCESS, result.status)
        assertEquals("Tema", result.destAreaName)
    }
}
