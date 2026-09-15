// Free, keyless place search via OpenStreetMap's Nominatim public API - no
// API key/billing account to wire up, which keeps this a self-contained
// reference app. Nominatim's usage policy asks for light, infrequent use
// from browser apps like this one; callers should debounce input (the
// MissionRoutePanel search box does) rather than firing on every keystroke.
export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

export async function searchPlace(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`place search failed: ${response.status}`);
  }
  const data = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) }));
}
