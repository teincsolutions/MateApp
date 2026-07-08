import { describe, it, expect } from 'vitest';
import { GeometryService, type LatLng } from '@mateapp/core';

describe('GeometryService', () => {
  describe('haversineDistance', () => {
    it('returns 0 for identical points', () => {
      const d = GeometryService.haversineDistance(0, 0, 0, 0);
      expect(d).toBe(0);
    });

    it('returns ~0 for very close points', () => {
      const d = GeometryService.haversineDistance(5.5490, -0.2010, 5.5490, -0.2010);
      expect(d).toBe(0);
    });

    it('computes 1 degree latitude as ~111.195 km', () => {
      const d = GeometryService.haversineDistance(0, 0, 1, 0);
      expect(d).toBeGreaterThan(111190);
      expect(d).toBeLessThan(111200);
    });

    it('computes 1 degree longitude at equator as ~111.195 km', () => {
      const d = GeometryService.haversineDistance(0, 0, 0, 1);
      expect(d).toBeGreaterThan(111190);
      expect(d).toBeLessThan(111200);
    });

    it('computes Kejetia Market(5.5490,-0.2010) to Kejetia Station(5.5495,-0.2005)', () => {
      const d = GeometryService.haversineDistance(5.5490, -0.2010, 5.5495, -0.2005);
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThan(150);
    });

    it('computes Kejetia(5.5490,-0.2010) to Suame(5.5750,-0.2120)', () => {
      const d = GeometryService.haversineDistance(5.5490, -0.2010, 5.5750, -0.2120);
      expect(d).toBeGreaterThan(2500);
      expect(d).toBeLessThan(3500);
    });
  });

  describe('pointInPolygon', () => {
    const triangle: LatLng[] = [
      { latitude: 0, longitude: 0 },
      { latitude: 5, longitude: 0 },
      { latitude: 2.5, longitude: 5 },
    ];

    it('returns false for empty polygon', () => {
      expect(GeometryService.pointInPolygon({ latitude: 0, longitude: 0 }, [])).toBe(false);
    });

    it('returns false for polygon with < 3 points', () => {
      expect(GeometryService.pointInPolygon(
        { latitude: 1, longitude: 1 },
        [{ latitude: 0, longitude: 0 }, { latitude: 5, longitude: 5 }],
      )).toBe(false);
    });

    it('returns true for point inside triangle', () => {
      const inside = GeometryService.pointInPolygon(
        { latitude: 2, longitude: 2 },
        triangle,
      );
      expect(inside).toBe(true);
    });

    it('returns false for point far outside triangle', () => {
      const outside = GeometryService.pointInPolygon(
        { latitude: 10, longitude: 10 },
        triangle,
      );
      expect(outside).toBe(false);
    });

    it('returns false for point near but outside triangle', () => {
      const outside = GeometryService.pointInPolygon(
        { latitude: 0, longitude: 5 },
        triangle,
      );
      expect(outside).toBe(false);
    });

    it('detects point on the right side of the ray', () => {
      const inside = GeometryService.pointInPolygon(
        { latitude: 1, longitude: 1 },
        triangle,
      );
      expect(inside).toBe(true);
    });
  });

  describe('convexHull', () => {
    it('returns empty array for empty input', () => {
      expect(GeometryService.convexHull([])).toEqual([]);
    });

    it('returns same point for single point', () => {
      const pts: LatLng[] = [{ latitude: 1, longitude: 2 }];
      expect(GeometryService.convexHull(pts)).toEqual(pts);
    });

    it('returns both points for two points', () => {
      const pts: LatLng[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 5, longitude: 5 },
      ];
      expect(GeometryService.convexHull(pts)).toEqual(pts);
    });

    it('returns triangle for three non-collinear points', () => {
      const pts: LatLng[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 5, longitude: 0 },
        { latitude: 2.5, longitude: 5 },
      ];
      const hull = GeometryService.convexHull(pts);
      expect(hull).toHaveLength(3);
    });

    it('finds hull for 5 collinear points and 1 outlier → triangle', () => {
      const pts: LatLng[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 2 },
        { latitude: 3, longitude: 3 },
        { latitude: 4, longitude: 4 },
        { latitude: 2, longitude: 4 },
      ];
      const hull = GeometryService.convexHull(pts);
      expect(hull.length).toBeGreaterThanOrEqual(3);
      expect(hull.length).toBeLessThanOrEqual(4);
      const outlier = hull.find((p) => p.latitude === 2 && p.longitude === 4);
      expect(outlier).toBeDefined();
    });

    it('finds hull for square points', () => {
      const pts: LatLng[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 5 },
        { latitude: 5, longitude: 5 },
        { latitude: 5, longitude: 0 },
      ];
      const hull = GeometryService.convexHull(pts);
      expect(hull).toHaveLength(4);
    });

    it('finds hull with interior point excluded', () => {
      const pts: LatLng[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 10, longitude: 0 },
        { latitude: 10, longitude: 10 },
        { latitude: 0, longitude: 10 },
        { latitude: 5, longitude: 5 },
      ];
      const hull = GeometryService.convexHull(pts);
      expect(hull).toHaveLength(4);
      const interior = hull.find((p) => p.latitude === 5 && p.longitude === 5);
      expect(interior).toBeUndefined();
    });
  });

  describe('polygonFromJson / polygonToJson round-trip', () => {
    it('serializes polygon to JSON and back', () => {
      const polygon: LatLng[] = [
        { latitude: 1.23, longitude: 4.56 },
        { latitude: 7.89, longitude: 0.12 },
        { latitude: 3.45, longitude: 6.78 },
      ];
      const json = GeometryService.polygonToJson(polygon);
      const parsed = GeometryService.polygonFromJson(json);
      expect(parsed).toEqual(polygon);
    });

    it('handles empty polygon', () => {
      const json = GeometryService.polygonToJson([]);
      const parsed = GeometryService.polygonFromJson(json);
      expect(parsed).toEqual([]);
    });

    it('handles single point polygon', () => {
      const polygon: LatLng[] = [{ latitude: 1, longitude: 2 }];
      const json = GeometryService.polygonToJson(polygon);
      const parsed = GeometryService.polygonFromJson(json);
      expect(parsed).toEqual(polygon);
    });

    it('handles double point polygon', () => {
      const polygon: LatLng[] = [
        { latitude: 1, longitude: 2 },
        { latitude: 3, longitude: 4 },
      ];
      const json = GeometryService.polygonToJson(polygon);
      const parsed = GeometryService.polygonFromJson(json);
      expect(parsed).toEqual(polygon);
    });

    it('returns empty array for invalid JSON', () => {
      const parsed = GeometryService.polygonFromJson('not valid json');
      expect(parsed).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      const parsed = GeometryService.polygonFromJson('');
      expect(parsed).toEqual([]);
    });
  });

  describe('polygonFromStops', () => {
    it('delegates to convexHull', () => {
      const stops: LatLng[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 5, longitude: 0 },
        { latitude: 2.5, longitude: 5 },
      ];
      const polygon = GeometryService.polygonFromStops(stops);
      expect(polygon).toEqual(GeometryService.convexHull(stops));
    });
  });
});
