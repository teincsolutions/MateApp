interface ReverseGeocodeCacheEntry {
  street: string;
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, ReverseGeocodeCacheEntry>();

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.street;
  }

  const baseUrl = process.env.EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL;
  if (!baseUrl) return null;

  try {
    const url = `${baseUrl}/api/v1/places/reverse-geocode?latitude=${latitude}&longitude=${longitude}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    const street = json?.data?.street;
    if (typeof street !== 'string') return null;
    cache.set(key, { street, timestamp: Date.now() });
    return street;
  } catch {
    return null;
  }
}
