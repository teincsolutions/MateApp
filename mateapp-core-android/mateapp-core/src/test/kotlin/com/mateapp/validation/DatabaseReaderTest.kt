package com.mateapp.validation

import android.database.sqlite.SQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class DatabaseReaderTest {

    private lateinit var db: SQLiteDatabase

    @Before
    fun setUp() {
        db = SQLiteDatabase.create(null)
        TestData.createSchema(db)
        TestData.insertData(db)
    }

    @Test
    fun `findByRadius returns stops within radius`() {
        val stops = DatabaseReader.findByRadius(db, 5.5620, -0.2050, 100.0)
        assertEquals(1, stops.size)
        assertEquals("s1", stops[0].id)
    }

    @Test
    fun `findByRadius returns multiple stops when within range`() {
        val stops = DatabaseReader.findByRadius(db, 5.5625, -0.2045, 200.0)
        assertEquals(2, stops.size)
    }

    @Test
    fun `findByRadius returns empty for far point`() {
        val stops = DatabaseReader.findByRadius(db, 6.0, -1.0, 50.0)
        assertTrue(stops.isEmpty())
    }

    @Test
    fun `findNearestStop returns closest stop`() {
        val stop = DatabaseReader.findNearestStop(db, 5.5620, -0.2050)
        assertNotNull(stop)
        assertEquals("s1", stop!!.id)
    }

    @Test
    fun `findNearestStop returns null when no stops within 25km`() {
        val stop = DatabaseReader.findNearestStop(db, 10.0, 10.0)
        assertNull(stop)
    }

    @Test
    fun `findNearestStop returns closest stop from multiple candidates`() {
        val stop = DatabaseReader.findNearestStop(db, 5.5630, -0.2040)
        assertNotNull(stop)
        assertEquals("s2", stop!!.id)
    }

    @Test
    fun `getStopById returns correct stop`() {
        val stop = DatabaseReader.getStopById(db, "s1")
        assertNotNull(stop)
        assertEquals("s1", stop!!.id)
        assertEquals("Circle", stop.label)
        assertEquals(5.5620, stop.latitude, 0.0001)
    }

    @Test
    fun `getStopById returns null for unknown id`() {
        val stop = DatabaseReader.getStopById(db, "nonexistent")
        assertNull(stop)
    }

    @Test
    fun `getAreaStopsByStop returns area stops for stop`() {
        val areaStops = DatabaseReader.getAreaStopsByStop(db, "s1")
        assertEquals(1, areaStops.size)
        assertEquals("a1", areaStops[0].areaId)
    }

    @Test
    fun `getAreaStopsByStop returns empty for stop with no area`() {
        val areaStops = DatabaseReader.getAreaStopsByStop(db, "nonexistent")
        assertTrue(areaStops.isEmpty())
    }

    @Test
    fun `getArea returns correct area`() {
        val area = DatabaseReader.getArea(db, "a1")
        assertNotNull(area)
        assertEquals("Accra Central", area!!.name)
    }

    @Test
    fun `getArea returns null for unknown id`() {
        val area = DatabaseReader.getArea(db, "nonexistent")
        assertNull(area)
    }

    @Test
    fun `getAllAreasWithPolygons returns only areas with polygons`() {
        val areas = DatabaseReader.getAllAreasWithPolygons(db)
        assertEquals(2, areas.size)
        assertTrue(areas.all { it.polygon != null })
    }

    @Test
    fun `getAllJourneys returns all journeys`() {
        val journeys = DatabaseReader.getAllJourneys(db)
        assertEquals(2, journeys.size)
    }

    @Test
    fun `getJourneyAreas returns areas ordered by sequence`() {
        val areas = DatabaseReader.getJourneyAreas(db, "j1")
        assertEquals(2, areas.size)
        assertEquals("a1", areas[0].areaId)
        assertEquals("a2", areas[1].areaId)
    }

    @Test
    fun `getJourneyAreas returns empty for unknown journey`() {
        val areas = DatabaseReader.getJourneyAreas(db, "nonexistent")
        assertTrue(areas.isEmpty())
    }

    @Test
    fun `getBetweenAreasFare returns correct fare`() {
        val fare = DatabaseReader.getBetweenAreasFare(db, "j1", "a1", "a2")
        assertNotNull(fare)
        assertEquals("fl1", fare!!.fareLevelId)
    }

    @Test
    fun `getBetweenAreasFare returns null for reverse direction when not set`() {
        val fare = DatabaseReader.getBetweenAreasFare(db, "j1", "a2", "a1")
        assertNull(fare)
    }

    @Test
    fun `getBetweenAreasFare returns null for unknown areas`() {
        val fare = DatabaseReader.getBetweenAreasFare(db, "j1", "nonexistent", "a2")
        assertNull(fare)
    }

    @Test
    fun `getFareLevelsByJourney returns fare levels sorted by amount`() {
        val levels = DatabaseReader.getFareLevelsByJourney(db, "j1")
        assertEquals(2, levels.size)
        assertEquals(5.00, levels[0].amount, 0.001)
        assertEquals(10.00, levels[1].amount, 0.001)
    }

    @Test
    fun `getFareLevelsByJourney returns empty for unknown journey`() {
        val levels = DatabaseReader.getFareLevelsByJourney(db, "nonexistent")
        assertTrue(levels.isEmpty())
    }

    @Test
    fun `getFareLevelsByArea returns fare levels linked to area`() {
        val levels = DatabaseReader.getFareLevelsByArea(db, "a1")
        assertEquals(2, levels.size)
    }

    @Test
    fun `getFareLevelsByArea returns empty for area with no fare levels`() {
        val levels = DatabaseReader.getFareLevelsByArea(db, "nonexistent")
        assertTrue(levels.isEmpty())
    }
}
