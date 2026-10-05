import { useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Locate, Maximize2, Navigation, Compass, Wind } from 'lucide-react';
import { intermediatePoint, initialBearingDeg, haversineDistanceKm, routeWaypoints, type LatLon } from '../../lib/geo';
import type { MissionRoute } from '../../types/mission';
import type { FlightSimulationStatus } from '../../types/contracts';
import { useMissionStore } from '../../store/useMissionStore';
import { useThemeStore } from '../../store/useThemeStore';

interface FlightMapProps {
  route?: MissionRoute;
  simStatus?: FlightSimulationStatus | null;
  height?: number | string;
  className?: string;
  showOverlay?: boolean;
}

type MapStyle = 'tactical' | 'satellite' | 'street' | 'terrain';

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  tactical: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
  },
};

function badgeIcon(label: string, color: string, size = 24) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#ffffff;display:flex;align-items:center;justify-content:center;font:800 ${size * 0.42}px 'Geist Mono Variable',monospace;box-shadow:0 0 10px rgba(0,0,0,0.6);border:1.5px solid rgba(255,255,255,0.85);">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function uavIcon(headingDeg: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;transform:rotate(${headingDeg}deg);display:flex;align-items:center;justify-content:center;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="filter:drop-shadow(0 0 8px rgba(245,158,11,0.75));">
        <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="#f59e0b" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="2.2" fill="#ffffff" />
      </svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function FollowController({ target, follow }: { target: LatLon; follow: boolean }) {
  const map = useMap();
  if (follow) {
    map.panTo([target.lat, target.lon], { animate: true, duration: 0.35 });
  }
  return null;
}

export default function FlightMap({
  route: propRoute,
  simStatus,
  height = 520,
  className = '',
  showOverlay = true,
}: FlightMapProps) {
  const [style, setStyle] = useState<MapStyle>('tactical');
  const [follow, setFollow] = useState(true);

  // Read from shared deterministic mission store
  const storeRoute = useMissionStore((s) => s.route);
  const missionState = useMissionStore((s) => s.missionState);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

  const route = propRoute ?? storeRoute;

  const distanceKm = haversineDistanceKm(route.source, route.destination);
  const bearingDeg = missionState ? missionState.headingDeg : initialBearingDeg(route.source, route.destination);
  const waypoints = useMemo(() => routeWaypoints(route.source, route.destination, 5), [route]);
  const smoothPath = useMemo(() => routeWaypoints(route.source, route.destination, 40), [route]);

  // Determine UAV position and flight kinematic state
  let uavPosition: LatLon;
  let altitudeFt: number;
  let airspeedKmh: number;
  let remainingKm: number;
  let phaseName: string;
  let ambientTempC: number;
  let ambientPressureHpa: number;

  if (simStatus) {
    const progress = Math.min(Math.max(simStatus.progress_pct / 100, 0), 1);
    uavPosition = intermediatePoint(route.source, route.destination, progress);
    remainingKm = distanceKm * (1 - progress);
    phaseName = simStatus.phase_name ?? 'Active';
    altitudeFt = simStatus.running ? 8000 : 0;
    airspeedKmh = simStatus.running ? 150 : 0;
    ambientTempC = 12.5;
    ambientPressureHpa = 750;
  } else {
    uavPosition = missionState.uavPosition;
    altitudeFt = missionState.altitudeFt;
    airspeedKmh = missionState.airspeedKmh;
    remainingKm = missionState.remainingDistanceKm;
    phaseName = missionState.phase;
    ambientTempC = missionState.environment.ambientTempC;
    ambientPressureHpa = missionState.environment.ambientPressureHpa;
  }

  const center: [number, number] = [
    (route.source.lat + route.destination.lat) / 2,
    (route.source.lon + route.destination.lon) / 2,
  ];

  return (
    <div
      className={`card p-0 overflow-hidden relative border transition-colors select-none ${
        isLight ? 'border-[#e2ddd1] bg-[#f4efe6]' : 'border-slate-800 bg-[#0b0f17]'
      } ${className}`}
      style={{ height }}
    >
      <MapContainer center={center} zoom={9} scrollWheelZoom className="w-full h-full z-0">
        <TileLayer url={TILE_LAYERS[style].url} attribution={TILE_LAYERS[style].attribution} />
        {/* Planned flight trajectory */}
        <Polyline
          positions={smoothPath.map((p) => [p.lat, p.lon])}
          pathOptions={{
            color: '#f59e0b',
            weight: 2.5,
            dashArray: '5 7',
            opacity: 0.85,
          }}
        />
        {/* Flown trajectory trace */}
        <Polyline
          positions={[
            [route.source.lat, route.source.lon],
            [uavPosition.lat, uavPosition.lon],
          ]}
          pathOptions={{
            color: '#10b981',
            weight: 3.5,
            opacity: 0.9,
          }}
        />
        <Marker position={[route.source.lat, route.source.lon]} icon={badgeIcon('S', '#10b981')} />
        <Marker position={[route.destination.lat, route.destination.lon]} icon={badgeIcon('D', '#ef4444')} />
        {waypoints.slice(1, -1).map((wp, i) => (
          <Marker key={i} position={[wp.lat, wp.lon]} icon={badgeIcon(String(i + 1), '#0284c7', 20)} />
        ))}
        <Marker position={[uavPosition.lat, uavPosition.lon]} icon={uavIcon(bearingDeg)} />
        <FollowController target={uavPosition} follow={follow} />
      </MapContainer>

      {showOverlay && (
        <>
          {/* Tactical Header Badge */}
          <div className={`absolute top-3 left-3 z-[400] backdrop-blur-md rounded-xl border px-3.5 py-2 shadow-lg max-w-[280px] transition-colors ${
            isLight
              ? 'bg-white/95 border-[#e2ddd1] text-[#0c1117]'
              : 'bg-slate-950/85 border-slate-800/90 text-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                2D Tactical Mission Map
              </span>
            </div>
            <div className={`text-[11px] font-bold truncate ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>
              {route.sourceLabel.split(' ')[0]} → {route.destLabel.split(' ')[0]}
            </div>
            <div className={`text-[10px] font-mono mt-0.5 flex items-center gap-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <span>Phase: <strong className={isLight ? 'text-emerald-800' : 'text-emerald-400'}>{phaseName}</strong></span>
              <span>·</span>
              <span>{distanceKm.toFixed(0)} km</span>
            </div>
          </div>

          {/* Map Layer Controls */}
          <div className={`absolute top-3 right-3 z-[400] flex items-center gap-1.5 backdrop-blur-md p-1 rounded-xl border shadow-lg transition-colors ${
            isLight ? 'bg-white/95 border-[#e2ddd1]' : 'bg-slate-950/85 border-slate-800/90'
          }`}>
            {(['tactical', 'satellite', 'street', 'terrain'] as MapStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg capitalize transition-colors ${
                  style === s
                    ? isLight ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-500 text-slate-950 shadow-xs'
                    : isLight ? 'text-slate-600 hover:text-[#0c1117]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
            <div className={`w-[1px] h-4 mx-0.5 ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`} />
            <button
              onClick={() => setFollow((f) => !f)}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                follow
                  ? isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : isLight ? 'text-slate-600 hover:text-[#0c1117]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Locate size={11} /> {follow ? 'LOCK' : 'FREE'}
            </button>
          </div>

          {/* Live Flight HUD Pill */}
          <div className={`absolute bottom-3 right-3 z-[400] backdrop-blur-md rounded-xl p-3 border min-w-[210px] shadow-2xl transition-colors ${
            isLight
              ? 'bg-white/95 border-[#e2ddd1] text-[#0c1117]'
              : 'bg-slate-950/90 border-slate-800/90 text-slate-200'
          }`}>
            <div className={`flex items-center justify-between pb-1.5 mb-2 border-b ${isLight ? 'border-[#e2ddd1]' : 'border-slate-800'}`}>
              <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                <Compass size={11} className={isLight ? 'text-amber-800' : 'text-amber-400'} />
                Kinematics &amp; Environment
              </span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  isPlaying
                    ? isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-400'
                    : isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {isPlaying ? 'TRACKING' : 'PAUSED'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Altitude:</span>
              <span className={`font-mono font-bold text-right ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{altitudeFt.toLocaleString()} ft</span>

              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Airspeed:</span>
              <span className={`font-mono font-bold text-right ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{airspeedKmh} km/h</span>

              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Heading:</span>
              <span className={`font-mono font-bold text-right ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>{bearingDeg.toFixed(0)}°</span>

              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Remaining:</span>
              <span className={`font-mono font-bold text-right ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{remainingKm.toFixed(1)} km</span>

              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Amb Temp:</span>
              <span className={`font-mono font-bold text-right ${isLight ? 'text-[#00a896]' : 'text-cyan-300'}`}>{ambientTempC}°C</span>

              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Amb Press:</span>
              <span className={`font-mono font-bold text-right ${isLight ? 'text-[#00a896]' : 'text-cyan-300'}`}>{ambientPressureHpa} hPa</span>

              <span className={`font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Coordinates:</span>
              <span className={`font-mono text-[9px] text-right col-span-2 mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {uavPosition.lat.toFixed(4)}°N, {uavPosition.lon.toFixed(4)}°E
              </span>
            </div>
          </div>
        </>
      )}

      {/* Bottom status bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-[300] flex items-center justify-between px-3 py-1 border-t text-[9px] font-mono transition-colors ${
        isLight ? 'bg-white/95 border-[#e2ddd1] text-slate-600' : 'bg-slate-950/95 border-slate-800/80 text-slate-400'
      }`}>
        <span className="flex items-center gap-1.5">
          <Navigation size={10} className={isLight ? 'text-amber-800' : 'text-amber-400'} /> Great-Circle Geodesic Flight Route · WGS-84 Interpolation
        </span>
        <span className="flex items-center gap-2">
          <span className={`flex items-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <Wind size={10} className={isLight ? 'text-[#00a896]' : 'text-cyan-400'} /> Wind: 14 kts @ 245°
          </span>
          <span className={isLight ? 'text-slate-300' : 'text-slate-600'}>|</span>
          <span className="flex items-center gap-1">
            <Maximize2 size={10} /> Leaflet Tactical
          </span>
        </span>
      </div>
    </div>
  );
}
