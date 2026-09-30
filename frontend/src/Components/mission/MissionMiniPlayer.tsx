import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Compass,
  AlertTriangle,
  Gauge,
  Thermometer,
  Droplets,
} from 'lucide-react';
import { useMissionStore } from '../../store/useMissionStore';

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MissionMiniPlayer() {
  const [collapsed, setCollapsed] = useState(false);

  const scenarioId = useMissionStore((s) => s.scenarioId);
  const currentTime = useMissionStore((s) => s.currentTime);
  const totalDuration = useMissionStore((s) => s.totalDuration);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const missionState = useMissionStore((s) => s.missionState);
  const route = useMissionStore((s) => s.route);

  const togglePlay = useMissionStore((s) => s.togglePlay);
  const stepTime = useMissionStore((s) => s.stepTime);
  const setTime = useMissionStore((s) => s.setTime);

  const progress = missionState.progress;
  const health = missionState.healthIndex;

  // Mini Tactical Map SVG coordinates
  // Source on left (20, 35), Destination on right (180, 25)
  const mapWidth = 200;
  const mapHeight = 60;
  const startX = 20;
  const startY = 40;
  const endX = 180;
  const endY = 20;
  const uavX = startX + (endX - startX) * progress;
  const uavY = startY + (endY - startY) * progress;

  return (
    <motion.aside
      drag
      dragMomentum={false}
      initial={{ x: 20, y: 80 }}
      aria-label="Mission Mini-Player"
      className="fixed z-50 w-80 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl text-slate-100 overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Draggable Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-slate-500" />
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            Mission Mini-Player
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
            {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
          </span>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={collapsed ? 'Expand Mini-Player' : 'Collapse Mini-Player'}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3.5 space-y-3">
          {/* Compact 2D Tactical Map View */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 p-2">
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mb-1">
              <span className="flex items-center gap-1 text-slate-300">
                <Compass size={10} className="text-amber-400" />
                {route.sourceLabel.split(' ')[0]} → {route.destLabel.split(' ')[0]}
              </span>
              <span className="text-amber-400 font-bold">{missionState.headingDeg.toFixed(0)}°</span>
            </div>

            {/* SVG Tactical Vector Flight Route */}
            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-12">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset={`${progress * 100}%`} stopColor="#10b981" />
                  <stop offset={`${progress * 100}%`} stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Waypoints line */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="url(#routeGradient)"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />

              {/* Flown trajectory trace */}
              <line
                x1={startX}
                y1={startY}
                x2={uavX}
                y2={uavY}
                stroke="#10b981"
                strokeWidth="3"
              />

              {/* Source marker */}
              <circle cx={startX} cy={startY} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
              {/* Destination marker */}
              <circle cx={endX} cy={endY} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />

              {/* UAV pulse & icon */}
              <circle cx={uavX} cy={uavY} r="7" fill="#f59e0b" opacity="0.3" className="animate-ping" />
              <circle cx={uavX} cy={uavY} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
            </svg>

            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-1">
              <span>Alt: <strong className="text-slate-200">{missionState.altitudeFt.toLocaleString()} ft</strong></span>
              <span>Speed: <strong className="text-slate-200">{missionState.airspeedKmh} km/h</strong></span>
              <span>Rem: <strong className="text-slate-200">{missionState.remainingDistanceKm.toFixed(1)} km</strong></span>
            </div>
          </div>

          {/* Mission Phase & Engine Health Summary */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[9px] uppercase font-bold text-slate-400">Phase:</span>
              <span className="font-bold text-slate-100 text-[11px]">{missionState.phase}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[9px] uppercase font-bold text-slate-400">Health:</span>
              <span
                className={`font-black font-mono text-[11px] ${
                  health >= 80 ? 'text-emerald-400' : health >= 50 ? 'text-amber-400' : 'text-rose-400 animate-pulse'
                }`}
              >
                {health}%
              </span>
            </div>
          </div>

          {/* Key Telemetry Readings */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold mb-0.5">
                <Gauge size={10} className="text-amber-400" /> RPM
              </div>
              <div className="text-xs font-black font-mono text-slate-100 truncate">
                {typeof missionState.rpm === 'number' ? Math.round(missionState.rpm) : missionState.rpm}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold mb-0.5">
                <Thermometer size={10} className="text-amber-400" /> CHT
              </div>
              <div
                className={`text-xs font-black font-mono truncate ${
                  missionState.chtCelsius >= 142
                    ? 'text-rose-400 animate-pulse'
                    : missionState.chtCelsius >= 128
                    ? 'text-amber-400'
                    : 'text-slate-100'
                }`}
              >
                {typeof missionState.chtCelsius === 'number' ? missionState.chtCelsius.toFixed(1) : missionState.chtCelsius}°C
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold mb-0.5">
                <Droplets size={10} className="text-emerald-400" /> Oil P
              </div>
              <div
                className={`text-xs font-black font-mono truncate ${
                  missionState.oilPressureBar < 2.0
                    ? 'text-rose-400 animate-pulse'
                    : missionState.oilPressureBar < 2.8
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {typeof missionState.oilPressureBar === 'number' ? missionState.oilPressureBar.toFixed(2) : missionState.oilPressureBar} bar
              </div>
            </div>
          </div>

          {/* Active Alert Banner if triggered */}
          {missionState.activeAlert.active && (
            <div
              className={`p-2 rounded-xl border text-[10px] flex items-start gap-1.5 ${
                missionState.activeAlert.level === 'critical'
                  ? 'bg-rose-950/50 border-rose-800 text-rose-200'
                  : 'bg-amber-950/50 border-amber-800 text-amber-200'
              }`}
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <div className="leading-tight">
                <span className="font-bold">{missionState.activeAlert.title}:</span>{' '}
                <span className="text-slate-300">{missionState.activeAlert.message}</span>
              </div>
            </div>
          )}

          {/* Timeline Scrubber */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-0.5">
              <span>{formatSeconds(currentTime)}</span>
              <span className="text-[8px] font-sans font-bold uppercase text-slate-400">
                {scenarioId.toUpperCase()} SCENARIO
              </span>
              <span>{formatSeconds(totalDuration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.5}
              value={currentTime}
              onChange={(e) => setTime(Number(e.target.value))}
              aria-label="Mission Scrubber"
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Timeline Transport Buttons: -10s, Play/Pause, +10s */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => stepTime(-10)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-[10px] font-bold flex items-center gap-1 transition-colors"
              title="Skip back 10 seconds"
            >
              <RotateCcw size={11} /> -10s
            </button>

            <button
              onClick={togglePlay}
              className={`px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
              title={isPlaying ? 'Pause Mission' : 'Play Mission'}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={() => stepTime(10)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-[10px] font-bold flex items-center gap-1 transition-colors"
              title="Skip forward 10 seconds"
            >
              +10s <RotateCw size={11} />
            </button>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
