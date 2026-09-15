import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Compass, MapPin, Navigation, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { haversineDistanceKm, initialBearingDeg } from '../../lib/geo';
import { searchPlace, type GeocodeResult } from '../../lib/geocoding';
import { ASSUMED_CRUISE_SPEED_KMH, PRESET_ROUTES, type MissionRoute } from '../../types/mission';
import type { FlightPhaseSpec } from '../../types/contracts';

interface MissionRoutePanelProps {
  route: MissionRoute;
  onRouteChange: (route: MissionRoute) => void;
  onApplyRoute: (phases: FlightPhaseSpec[], totalDurationH: number) => void;
  disabled?: boolean;
}

/** Standard Climb/Cruise/Descent split, scaled to the route's estimated
 * flight duration - the same ratio the built-in "Standard Patrol" flight
 * profile preset already uses, just parameterized by route distance
 * instead of a fixed duration. */
function phasesForDuration(totalDurationH: number): FlightPhaseSpec[] {
  return [
    { name: 'Climb', duration_h: Math.max(totalDurationH * 0.1, 0.02), throttle_pct: 100 },
    { name: 'Cruise', duration_h: Math.max(totalDurationH * 0.8, 0.02), throttle_pct: 65 },
    { name: 'Descent', duration_h: Math.max(totalDurationH * 0.1, 0.02), throttle_pct: 35 },
  ];
}

export default function MissionRoutePanel({ route, onRouteChange, onApplyRoute, disabled }: MissionRoutePanelProps) {
  const [presetIdx, setPresetIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await searchPlace(query));
      } catch (e) {
        setSearchError(String(e));
      } finally {
        setSearching(false);
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const distanceKm = haversineDistanceKm(route.source, route.destination);
  const bearingDeg = initialBearingDeg(route.source, route.destination);
  const flightTimeH = distanceKm / ASSUMED_CRUISE_SPEED_KMH;

  function pickPreset(idx: number) {
    setPresetIdx(idx);
    const preset = PRESET_ROUTES[idx];
    onRouteChange({ sourceLabel: preset.sourceLabel, destLabel: preset.destLabel, source: preset.source, destination: preset.destination });
    setApplied(false);
  }

  function pickSearchResult(result: GeocodeResult) {
    onRouteChange({ ...route, destLabel: result.label, destination: { lat: result.lat, lon: result.lon } });
    setResults([]);
    setQuery('');
    setApplied(false);
  }

  function handleApply() {
    onApplyRoute(phasesForDuration(flightTimeH), flightTimeH);
    setApplied(true);
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="section-title flex items-center gap-1.5">
          <Compass size={13} strokeWidth={2.4} />
          Mission Setup
        </span>
        <span className="badge-orange">Real-World Geodesic Planning</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        Route distance/bearing here are exact geodesic geometry, not simulated flight - the flight simulator only
        ever tracks throttle-by-phase, so this sets a suggested profile duration, never a position for the physics.
      </p>

      <div className="space-y-3">
        <div>
          <div className="label-xs mb-1">Preset Real-World Routes</div>
          <select
            value={presetIdx}
            disabled={disabled}
            onChange={(e) => pickPreset(Number(e.target.value))}
            className="w-full text-xs font-semibold text-slate-700 border border-gray-200 rounded-lg px-2.5 py-2 outline-none disabled:opacity-50"
          >
            {PRESET_ROUTES.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="label-xs mb-1">Search Destination (city / landmark)</div>
          <div className="relative flex items-center gap-2">
            <Search size={13} className="absolute left-2.5 text-slate-400" />
            <input
              value={query}
              disabled={disabled}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Visakhapatnam Airport, Amaravati..."
              className="flex-1 text-xs bg-slate-50 rounded-lg pl-7 pr-2.5 py-2 outline-none disabled:opacity-50"
            />
          </div>
          {searching && <div className="text-[10px] text-slate-400 mt-1">Searching...</div>}
          {searchError && <div className="text-[10px] text-rose-500 mt-1">{searchError}</div>}
          {results.length > 0 && (
            <ul className="mt-1.5 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {results.map((r) => (
                <li key={`${r.lat}-${r.lon}`}>
                  <button
                    onClick={() => pickSearchResult(r)}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] text-slate-600 hover:bg-orange-50 hover:text-orange-700 truncate"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <MapPin size={12} /> Source Location
            </span>
            <span className="text-[10px] font-mono text-emerald-700">
              {route.source.lat.toFixed(4)}°N, {route.source.lon.toFixed(4)}°E
            </span>
          </div>
          <div className="text-xs font-bold text-slate-700 mb-1.5">{route.sourceLabel}</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              disabled={disabled}
              value={route.source.lat}
              step={0.0001}
              onChange={(e) => onRouteChange({ ...route, source: { ...route.source, lat: Number(e.target.value) } })}
              className="text-[11px] font-mono bg-white rounded-md px-2 py-1 border border-emerald-100 outline-none disabled:opacity-50"
            />
            <input
              type="number"
              disabled={disabled}
              value={route.source.lon}
              step={0.0001}
              onChange={(e) => onRouteChange({ ...route, source: { ...route.source, lon: Number(e.target.value) } })}
              className="text-[11px] font-mono bg-white rounded-md px-2 py-1 border border-emerald-100 outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
              <MapPin size={12} /> Destination Location
            </span>
            <span className="text-[10px] font-mono text-rose-700">
              {route.destination.lat.toFixed(4)}°N, {route.destination.lon.toFixed(4)}°E
            </span>
          </div>
          <div className="text-xs font-bold text-slate-700 mb-1.5">{route.destLabel}</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              disabled={disabled}
              value={route.destination.lat}
              step={0.0001}
              onChange={(e) => onRouteChange({ ...route, destination: { ...route.destination, lat: Number(e.target.value) } })}
              className="text-[11px] font-mono bg-white rounded-md px-2 py-1 border border-rose-100 outline-none disabled:opacity-50"
            />
            <input
              type="number"
              disabled={disabled}
              value={route.destination.lon}
              step={0.0001}
              onChange={(e) => onRouteChange({ ...route, destination: { ...route.destination, lon: Number(e.target.value) } })}
              className="text-[11px] font-mono bg-white rounded-md px-2 py-1 border border-rose-100 outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="rounded-xl p-3.5" style={{ background: 'rgba(15,23,42,0.94)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Geodesic Route Summary</span>
            <span className={`text-[10px] font-black uppercase ${applied ? 'text-emerald-400' : 'text-amber-400'}`}>
              {applied ? 'Applied' : 'Pending'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Total Distance</div>
              <div className="text-lg font-black text-orange-400">{distanceKm.toFixed(1)} km</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Initial Bearing</div>
              <div className="text-lg font-black text-white flex items-center gap-1">
                <Navigation size={14} style={{ transform: `rotate(${bearingDeg}deg)` }} /> {bearingDeg.toFixed(0)}°
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Est. Flight Time</div>
              <div className="text-sm font-bold text-white">
                {Math.round(flightTimeH * 60)} min <span className="text-slate-400 font-normal">({flightTimeH.toFixed(2)} h)</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">Waypoints</div>
              <div className="text-sm font-bold text-emerald-400">5 Points</div>
            </div>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.99 }}>
          <Button onClick={handleApply} disabled={disabled} size="lg" className="w-full">
            <Navigation size={14} /> Apply Route to Flight Profile
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
