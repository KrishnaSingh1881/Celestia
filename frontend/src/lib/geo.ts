// Pure great-circle geometry helpers for the mission route planner and
// flight map. These are exact geodesic formulas (haversine distance,
// initial bearing, great-circle intermediate-point interpolation) - real
// math, not a simplified/flat-earth approximation - but they describe
// PLANNED geometry only. This project's physics model (simengine.twin.*)
// has no position/navigation state at all (it tracks engine-internal
// variables: RPM, temperatures, pressures), so nothing here is measured
// telemetry - it's derived from the route geometry and the flight
// simulator's real elapsed/total time, then presented as a predicted path.

const EARTH_RADIUS_KM = 6371.0;

export interface LatLon {
  lat: number;
  lon: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineDistanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/** Initial great-circle bearing from a to b, in degrees clockwise from north. */
export function initialBearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at fraction f (0-1) along the great circle from a to b (Ed
 * Williams' intermediate-point formula), used to place waypoints and the
 * live UAV marker along a route. */
export function intermediatePoint(a: LatLon, b: LatLon, f: number): LatLon {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLon2 = Math.sin(dLon / 2);
  const angularDist = 2 * Math.asin(Math.sqrt(sinDLat2 * sinDLat2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon2 * sinDLon2));
  if (angularDist === 0) return { ...a };

  const A = Math.sin((1 - f) * angularDist) / Math.sin(angularDist);
  const B = Math.sin(f * angularDist) / Math.sin(angularDist);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  const lat3 = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon3 = Math.atan2(y, x);
  return { lat: toDeg(lat3), lon: toDeg(lon3) };
}

export function routeWaypoints(a: LatLon, b: LatLon, count = 5): LatLon[] {
  return Array.from({ length: count }, (_, i) => intermediatePoint(a, b, count === 1 ? 0 : i / (count - 1)));
}
