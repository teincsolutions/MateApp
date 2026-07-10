interface ReverseGeocodeCacheEntry {
  street: string;
  timestamp: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

const reverseCache = new Map<string, ReverseGeocodeCacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export interface AutocompleteSuggestion {
  primaryText: string;
  secondaryText: string;
  formattedAddress: string;
  placeId: string;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = cacheKey(latitude, longitude);
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.street;
  }

  const baseUrl = process.env.EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL;
  if (!baseUrl) {
    console.warn('[ReverseGeocode] EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL is not set');
    return null;
  }

  try {
    const url = `${baseUrl}/api/v1/places/reverse-geocode?latitude=${latitude}&longitude=${longitude}`;
    console.log('[ReverseGeocode] Fetching:', url);
    const response = await fetch(url);
    console.log('[ReverseGeocode] Status:', response.status);
    if (!response.ok) {
      console.warn('[ReverseGeocode] Request failed:', response.status, response.statusText);
      return null;
    }
    const json = await response.json();
    console.log('[ReverseGeocode] Response:', JSON.stringify(json));
    const street = json?.data?.street;
    if (typeof street !== 'string') {
      console.warn('[ReverseGeocode] No street in response:', JSON.stringify(json));
      return null;
    }
    reverseCache.set(key, { street, timestamp: Date.now() });
    return street;
  } catch (err) {
    console.warn('[ReverseGeocode] Error:', err);
    return null;
  }
}

interface AutocompleteCacheEntry {
  suggestions: AutocompleteSuggestion[];
  timestamp: number;
}

const autocompleteCache = new Map<string, AutocompleteCacheEntry>();

export async function autocomplete(
  input: string,
  latitude: number,
  longitude: number,
): Promise<AutocompleteSuggestion[]> {
  if (input.length < 2) return [];

  const key = `${input.toLowerCase()},${cacheKey(latitude, longitude)}`;
  const cached = autocompleteCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.suggestions;
  }

  const baseUrl = process.env.EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL;
  if (!baseUrl) {
    console.warn('[Autocomplete] EXPO_PUBLIC_REVERSE_GEOCODE_BASE_URL is not set');
    return [];
  }

  try {
    const url = `${baseUrl}/api/v1/places/autocomplete?input=${encodeURIComponent(input)}&latitude=${latitude}&longitude=${longitude}`;
    console.log('[Autocomplete] Fetching:', url);
    const response = await fetch(url);
    console.log('[Autocomplete] Status:', response.status);
    if (!response.ok) {
      console.warn('[Autocomplete] Request failed:', response.status, response.statusText);
      return [];
    }
    const json = await response.json();
    console.log('[Autocomplete] Response items:', json?.data?.length);
    const suggestions: AutocompleteSuggestion[] = (json?.data || []).map((item: Record<string, unknown>) => ({
      primaryText: item.primary_text as string,
      secondaryText: item.secondary_text as string,
      formattedAddress: item.formatted_address as string,
      placeId: item.place_id as string,
    })).filter((s: AutocompleteSuggestion) => typeof s.primaryText === 'string');

    autocompleteCache.set(key, { suggestions, timestamp: Date.now() });
    return suggestions;
  } catch (err) {
    console.warn('[Autocomplete] Error:', err);
    return [];
  }
}
