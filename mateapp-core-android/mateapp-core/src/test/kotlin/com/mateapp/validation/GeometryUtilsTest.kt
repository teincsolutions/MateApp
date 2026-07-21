package com.mateapp.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class GeometryUtilsTest {

    @Test
    fun `haversineDistance returns zero for same point`() {
        val dist = GeometryUtils.haversineDistance(5.55, -0.20, 5.55, -0.20)
        assertEquals(0.0, dist, 0.001)
    }

    @Test
    fun `haversineDistance returns correct distance between Accra and Tema`() {
        val dist = GeometryUtils.haversineDistance(5.5620, -0.2050, 5.6200, -0.0170)
        assertEquals(21300.0, dist, 500.0)
    }

    @Test
    fun `haversineDistance returns correct distance between Accra and Kumasi`() {
        val dist = GeometryUtils.haversineDistance(5.5620, -0.2050, 6.6800, -1.6200)
        assertEquals(202000.0, dist, 5000.0)
    }

    @Test
    fun `pointInPolygon returns true for point inside square`() {
        val polygon = listOf(
            LatLng(0.0, 0.0),
            LatLng(0.0, 10.0),
            LatLng(10.0, 10.0),
            LatLng(10.0, 0.0),
        )
        assertTrue(GeometryUtils.pointInPolygon(LatLng(5.0, 5.0), polygon))
    }

    @Test
    fun `pointInPolygon returns false for point outside square`() {
        val polygon = listOf(
            LatLng(0.0, 0.0),
            LatLng(0.0, 10.0),
            LatLng(10.0, 10.0),
            LatLng(10.0, 0.0),
        )
        assertFalse(GeometryUtils.pointInPolygon(LatLng(15.0, 15.0), polygon))
    }

    @Test
    fun `pointInPolygon returns false for empty polygon`() {
        assertFalse(GeometryUtils.pointInPolygon(LatLng(5.0, 5.0), emptyList()))
    }

    @Test
    fun `convexHull returns same points for triangle`() {
        val points = listOf(
            LatLng(0.0, 0.0),
            LatLng(10.0, 0.0),
            LatLng(5.0, 10.0),
        )
        val hull = GeometryUtils.convexHull(points)
        assertEquals(3, hull.size)
    }

    @Test
    fun `convexHull returns 4 points for rectangle`() {
        val points = listOf(
            LatLng(0.0, 0.0),
            LatLng(10.0, 0.0),
            LatLng(10.0, 10.0),
            LatLng(0.0, 10.0),
        )
        val hull = GeometryUtils.convexHull(points)
        assertEquals(4, hull.size)
    }

    @Test
    fun `convexHull excludes interior points`() {
        val points = listOf(
            LatLng(0.0, 0.0),
            LatLng(10.0, 0.0),
            LatLng(10.0, 10.0),
            LatLng(0.0, 10.0),
            LatLng(5.0, 5.0),
        )
        val hull = GeometryUtils.convexHull(points)
        assertEquals(4, hull.size)
        assertFalse(hull.any { it.latitude == 5.0 && it.longitude == 5.0 })
    }

    @Test
    fun `polygonFromJson parses valid JSON`() {
        val json = """[{"latitude":5.53,"longitude":-0.25},{"latitude":5.53,"longitude":-0.15}]"""
        val polygon = GeometryUtils.polygonFromJson(json)
        assertEquals(2, polygon.size)
        assertEquals(5.53, polygon[0].latitude, 0.001)
        assertEquals(-0.25, polygon[0].longitude, 0.001)
    }

    @Test
    fun `polygonFromJson returns empty for null`() {
        val polygon = GeometryUtils.polygonFromJson(null)
        assertTrue(polygon.isEmpty())
    }

    @Test
    fun `polygonFromJson returns empty for malformed JSON`() {
        val polygon = GeometryUtils.polygonFromJson("not json")
        assertTrue(polygon.isEmpty())
    }

    @Test
    fun `polygonFromStops delegates to convexHull`() {
        val stops = listOf(
            LatLng(0.0, 0.0),
            LatLng(10.0, 0.0),
            LatLng(10.0, 10.0),
            LatLng(0.0, 10.0),
        )
        val hull = GeometryUtils.polygonFromStops(stops)
        assertEquals(4, hull.size)
    }
}
