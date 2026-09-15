import { useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Locate, Maximize2, Navigation } from 'lucide-react';
import { intermediatePoint, initialBearingDeg, haversineDistanceKm, routeWaypoints, type LatLon } from '../../lib/geo';
import type { MissionRoute } from '../../types/mission';
import type { FlightSimulationStatus } from '../../types/contracts';

interface FlightMapProps {
  route: MissionRoute;
  simStatus: FlightSimulationStatus | null;
}

type MapStyle = 'street' | 'terrain' | 'satellite';

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

function badgeIcon(label: string, color: string, size = 26) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:800 ${size * 0.42}px 'Geist Variable',sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid #fff;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function uavIcon(headingDeg: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;transform:rotate(${headingDeg}deg);display:flex;align-items:center;justify-content:center;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));">
        <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="#4285F4" stroke="#0B3D91"/>
      </svg>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FollowController({ target, follow }: { target: LatLon; follow: boolean }) {
  const map = useMap();
  if (follow) {
    map.panTo([target.lat, target.lon], { animate: true, duration: 0.4 });
  }
  return null;
}

export default function FlightMap({ route, simStatus }: FlightMapProps) {
  const [style, setStyle] = useState<MapStyle>('street');
  const [follow, setFollow] = useState(true);

  const distanceKm = haversineDistanceKm(route.source, route.destination);
  const bearingDeg = initialBearingDeg(route.source, route.destination);
  const waypoints = useMemo(() => routeWaypoints(route.source, route.destination, 5), [route]);
  const smoothPath = useMemo(() => routeWaypoints(route.source, route.destination, 40), [route]);

  const progress = simStatus ? Math.min(Math.max(simStatus.progress_pct / 100, 0), 1) : 0;
  const uavPosition = intermediatePoint(route.source, route.destination, progress);
  const remainingKm = distanceKm * (1 - progress);

  // Derived, not measured: this project's physics model has no altitude/
  // airspeed/position state (see lib/geo.ts) - altitude follows a simple
  // planned climb/cruise/descent profile by phase name, and airspeed is the
  // route's average planning speed. Both are geometric/kinematic
  // derivations from the real route + the real simulator progress, not
  // fabricated sensor values.
  const phaseName = (simStatus?.phase_name ?? '').toLowerCase();
  const cruiseAltitudeFt = 8000;
  let altitudeFt = 0;
  if (phaseName.includes('climb')) altitudeFt = cruiseAltitudeFt * Math.min(progress * 4, 1);
  else if (phaseName.includes('descent') || phaseName.includes('return')) altitudeFt = cruiseAltitudeFt * Math.max(1 - progress * 4, 0);
  else if (simStatus?.running) altitudeFt = cruiseAltitudeFt;
  const airspeedKmh = simStatus?.running ? distanceKm / Math.max(simStatus.total_h, 1e-6) : 0;

  const center: [number, number] = [(route.source.lat + route.destination.lat) / 2, (route.source.lon + route.destination.lon) / 2];

  return (
    <div className="card p-0 overflow-hidden">
      <div className="relative" style={{ height: 520 }}>
        <MapContainer center={center} zoom={9} scrollWheelZoom className="w-full h-full z-0">
          <TileLayer url={TILE_LAYERS[style].url} attribution={TILE_LAYERS[style].attribution} />
          <Polyline positions={smoothPath.map((p) => [p.lat, p.lon])} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 8', opacity: 0.85 }} />
          <Marker position={[route.source.lat, route.source.lon]} icon={badgeIcon('S', '#10B981')} />
          <Marker position={[route.destination.lat, route.destination.lon]} icon={badgeIcon('D', '#F43F5E')} />
          {waypoints.slice(1, -1).map((wp, i) => (
            <Marker key={i} position={[wp.lat, wp.lon]} icon={badgeIcon(String(i + 1), '#4285F4', 22)} />
          ))}
          <Marker position={[uavPosition.lat, uavPosition.lon]} icon={uavIcon(bearingDeg)} />
          <FollowController target={uavPosition} follow={follow} />
        </MapContainer>

        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 px-3.5 py-2 shadow-xs max-w-[240px]">
          <div className="text-[9px] font-black uppercase tracking-wider text-orange-600 mb-0.5">Geographic Flight Map</div>
          <div className="text-[10px] text-slate-500">Real-World 2D Map · Geodesic Navigation · Virtual UAV</div>
        </div>

        <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
          {(['street', 'terrain', 'satellite'] as MapStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border capitalize shadow-xs ${
                style === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white/95 text-slate-600 border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setFollow((f) => !f)}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border shadow-xs flex items-center gap-1 ${
              follow ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/95 text-slate-600 border-gray-200'
            }`}
          >
            <Locate size={11} /> Follow: {follow ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="absolute bottom-3 right-3 z-[400] bg-slate-900/95 backdrop-blur-md rounded-xl px-4 py-3 text-white min-w-[190px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              Mission: {simStatus?.running ? 'Active' : 'Standby'}
            </span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${simStatus?.running ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/40 text-slate-300'}`}>
              {simStatus?.running ? 'LIVE' : 'PARKED'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <span className="text-slate-400">Altitude:</span>
            <span className="font-mono font-bold text-right">{altitudeFt.toFixed(0)} ft</span>
            <span className="text-slate-400">Airspeed:</span>
            <span className="font-mono font-bold text-right">{airspeedKmh.toFixed(0)} km/h</span>
            <span className="text-slate-400">Heading:</span>
            <span className="font-mono font-bold text-amber-400 text-right">{bearingDeg.toFixed(0)}°</span>
            <span className="text-slate-400">Rem. Dist:</span>
            <span className="font-mono font-bold text-right">{remainingKm.toFixed(1)} km</span>
            <span className="text-slate-400">Coords:</span>
            <span className="font-mono font-bold text-right">
              {uavPosition.lat.toFixed(3)}, {uavPosition.lon.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Navigation size={11} /> Altitude/airspeed are a planned profile derived from route + phase, not measured sensor data - this project's physics model tracks engine internals, not vehicle position.
        </span>
        <span className="flex items-center gap-1">
          <Maximize2 size={11} /> Leaflet · OpenStreetMap
        </span>
      </div>
    </div>
  );
}
