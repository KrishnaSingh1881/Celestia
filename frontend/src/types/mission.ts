import type { LatLon } from '../lib/geo';

// Frontend-only concept: this project's physics model has no position/
// navigation state (see lib/geo.ts's header comment), so a "mission route"
// is purely a planning geometry layer - it decides the flight map's path
// and (via ratiosToPhases) a sensible default flight-profile duration, but
// the actual physics simulation only ever consumes throttle-by-phase, never
// a position.
export interface MissionRoute {
  sourceLabel: string;
  destLabel: string;
  source: LatLon;
  destination: LatLon;
}

export interface PresetRoute extends MissionRoute {
  name: string;
}

// A UAV in this engine's class (see simengine's Appendix A boxer-engine
// spec) cruises in the ballpark of 140-160 km/h - 150 km/h is used as a
// single, documented planning assumption to turn route distance into an
// estimated flight duration; it is not measured or backend-derived.
export const ASSUMED_CRUISE_SPEED_KMH = 150;

// Real, public coordinates - VIT-AP/Vijayawada Airport figures match the
// reference dashboard this feature was modeled on; the others are standard
// published airport reference points.
export const PRESET_ROUTES: PresetRoute[] = [
  {
    name: 'VIT-AP University → Vijayawada Airport (VGA)',
    sourceLabel: 'VIT-AP University',
    destLabel: 'Vijayawada Airport (VGA)',
    source: { lat: 16.4941, lon: 80.4982 },
    destination: { lat: 16.5304, lon: 80.7968 },
  },
  {
    name: 'Vijayawada (VGA) → Hyderabad (HYD)',
    sourceLabel: 'Vijayawada Airport (VGA)',
    destLabel: 'Rajiv Gandhi Intl Airport, Hyderabad (HYD)',
    source: { lat: 16.5304, lon: 80.7968 },
    destination: { lat: 17.2403, lon: 78.4294 },
  },
  {
    name: 'Hyderabad (HYD) → Bengaluru (BLR)',
    sourceLabel: 'Rajiv Gandhi Intl Airport, Hyderabad (HYD)',
    destLabel: 'Kempegowda Intl Airport, Bengaluru (BLR)',
    source: { lat: 17.2403, lon: 78.4294 },
    destination: { lat: 13.1986, lon: 77.7066 },
  },
  {
    name: 'Bengaluru (BLR) → Chennai (MAA)',
    sourceLabel: 'Kempegowda Intl Airport, Bengaluru (BLR)',
    destLabel: 'Chennai Intl Airport (MAA)',
    source: { lat: 13.1986, lon: 77.7066 },
    destination: { lat: 12.9941, lon: 80.1709 },
  },
];
