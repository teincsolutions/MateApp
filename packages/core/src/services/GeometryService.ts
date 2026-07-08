export interface LatLng {
  latitude: number;
  longitude: number;
}

export const GeometryService = {
  haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    const x = point.latitude;
    const y = point.longitude;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  },

  convexHull(points: LatLng[]): LatLng[] {
    if (points.length < 3) return points;
    const sorted = [...points].sort((a, b) => {
      if (a.latitude === b.latitude) return a.longitude - b.longitude;
      return a.latitude - b.latitude;
    });

    const cross = (o: LatLng, a: LatLng, b: LatLng): number => {
      return (a.latitude - o.latitude) * (b.longitude - o.longitude) -
             (a.longitude - o.longitude) * (b.latitude - o.latitude);
    };

    const lower: LatLng[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: LatLng[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();
    return [...lower, ...upper];
  },

  polygonFromStops(stops: LatLng[]): LatLng[] {
    return this.convexHull(stops);
  },

  polygonToJson(polygon: LatLng[]): string {
    return JSON.stringify(polygon);
  },

  polygonFromJson(json: string): LatLng[] {
    try {
      return JSON.parse(json) as LatLng[];
    } catch {
      return [];
    }
  },
};
