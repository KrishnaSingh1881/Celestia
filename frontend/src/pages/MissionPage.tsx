import { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Gauge,
  Thermometer,
  Droplets,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { useMissionStore } from '../store/useMissionStore';
import { SCENARIO_LIST } from '../types/scenarios';
import FlightMap from '../Components/simulation/FlightMap';

const EngineTwin3D = lazy(() => import('../Components/engine/EngineTwin3D'));

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MissionPage() {
  const scenarioId = useMissionStore((s) => s.scenarioId);
  const currentTime = useMissionStore((s) => s.currentTime);
  const totalDuration = useMissionStore((s) => s.totalDuration);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const playbackSpeed = useMissionStore((s) => s.playbackSpeed);
  const missionState = useMissionStore((s) => s.missionState);

  const setScenario = useMissionStore((s) => s.setScenario);
  const setTime = useMissionStore((s) => s.setTime);
  const stepTime = useMissionStore((s) => s.stepTime);
  const togglePlay = useMissionStore((s) => s.togglePlay);
  const setPlaybackSpeed = useMissionStore((s) => s.setPlaybackSpeed);

  const health = missionState.healthIndex;
  const alert = missionState.activeAlert;
  const ch = missionState.channels;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-4 max-w-[1600px] mx-auto pb-10"
    >
      {/* ─── Mission Screen Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-1 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h1 className="text-lg font-black tracking-tight text-slate-100 uppercase">
              Mission Control Workstation
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 font-bold border border-slate-700">
              ONE CONTINUOUS DETERMINISTIC MISSION
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized 2D tactical navigation, 3D modular engine twin, telemetry residuals, and causal health progression.
          </p>
        </div>

        {/* System Authority Status */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Authority:</span>
            <span className="text-[11px] font-bold text-slate-200">Crew / Advisory Only</span>
          </div>
        </div>
      </div>

      {/* ─── Scenario Selection Carousel / Strip ───────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers size={12} className="text-amber-400" />
            Deterministic Mission Scenarios
          </span>
          <span className="text-[10px] text-slate-400">
            Select scenario to reconfigure deterministic mission timeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {SCENARIO_LIST.map((sc) => {
            const isSelected = scenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setScenario(sc.id)}
                className={`text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-2 cursor-pointer shadow-sm relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500 ring-1 ring-amber-500/50 shadow-amber-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50 text-slate-300'
                }`}
              >
                {/* Active Indicator Top Stripe */}
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                )}

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        sc.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : sc.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {sc.id === 'cascade' ? 'DEFAULT · ' : ''}{sc.name}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-100 leading-snug">
                    {sc.tagline}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                  {sc.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Mission Timeline & Mini-Transport Bar ─────────────────────────── */}
      <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Transport Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => stepTime(-10)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Skip -10 seconds"
            >
              <RotateCcw size={13} /> -10s
            </button>

            <button
              onClick={togglePlay}
              className={`px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={() => stepTime(10)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Skip +10 seconds"
            >
              +10s <RotateCw size={13} />
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1" />

            {/* Playback speed buttons */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Time & Mission Status Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold flex items-center gap-2">
              <span className="text-slate-400 text-[10px] uppercase">Time:</span>
              <span className="text-slate-100">{formatSeconds(currentTime)}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{formatSeconds(totalDuration)}</span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Phase:</span>
              <span className="font-bold text-amber-400">{missionState.phase}</span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Engine Health:</span>
              <span
                className={`font-mono font-black ${
                  health >= 80 ? 'text-emerald-400' : health >= 50 ? 'text-amber-400' : 'text-rose-400 animate-pulse'
                }`}
              >
                {health}%
              </span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Risk Tier:</span>
              <span
                className={`font-bold ${
                  missionState.pipelineResult.risk.tier === 'Critical' || missionState.pipelineResult.risk.tier === 'Warning'
                    ? 'text-rose-400'
                    : missionState.pipelineResult.risk.tier === 'Caution' || missionState.pipelineResult.risk.tier === 'Advisory'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {missionState.pipelineResult.risk.tier}
              </span>
            </div>
          </div>
        </div>

        {/* Mission Timeline Scrubber */}
        <div className="space-y-1 pt-1">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.5}
            value={currentTime}
            onChange={(e) => setTime(Number(e.target.value))}
            aria-label="Mission Timeline Scrubber"
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-400 px-1">
            <span>00:00 (Takeoff / Climb Ingress)</span>
            <span>00:25 (Cruise Corridor Transition)</span>
            <span>01:35 (Descent / RTB Initiation)</span>
            <span>02:00 (Mission Complete)</span>
          </div>
        </div>
      </div>

      {/* ─── Main Balanced Operational Workspace: Map (48%) + 3D Twin (52%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: 2D Tactical Mission Map (~48% = 6 cols on lg) */}
        <div className="lg:col-span-6 flex flex-col">
          <FlightMap height={520} />
        </div>

        {/* Right: 3D Engine Digital Twin (~52% = 6 cols on lg) */}
        <div className="lg:col-span-6 flex flex-col">
          <Suspense
            fallback={
              <div className="w-full h-[520px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 text-sm font-mono">
                Initializing 3D Digital Twin Engine Model...
              </div>
            }
          >
            <EngineTwin3D />
          </Suspense>
        </div>
      </div>

      {/* ─── Live Engine Telemetry Section (Below Split) ───────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity size={12} className="text-cyan-400" />
            Live Engine Engineering Telemetry
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Sample rate: 50 Hz · Deterministic Model Output
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* 1. Engine RPM */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Gauge size={11} className="text-amber-400" /> RPM
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.rpm.flagged ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ch.rpm.status.toUpperCase()}
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-100">
              {ch.rpm.current.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>Ref: {ch.rpm.expected}</span>
              <span className={ch.rpm.residual !== 0 ? 'text-amber-400 font-bold' : ''}>
                Δ {ch.rpm.residual > 0 ? `+${ch.rpm.residual}` : ch.rpm.residual}
              </span>
            </div>
          </div>

          {/* 2. CHT */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Thermometer size={11} className="text-amber-400" /> CHT
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.cht.status === 'critical' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : ch.cht.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ch.cht.status.toUpperCase()}
              </span>
            </div>
            <div className={`text-lg font-black font-mono ${ch.cht.status === 'critical' ? 'text-rose-400' : ch.cht.status === 'warning' ? 'text-amber-400' : 'text-slate-100'}`}>
              {ch.cht.current}°C
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>z={ch.cht.zScore > 0 ? `+${ch.cht.zScore}` : ch.cht.zScore}</span>
              <span className={ch.cht.residual > 0 ? 'text-rose-400 font-bold' : ''}>
                Δ +{ch.cht.residual}°C
              </span>
            </div>
          </div>

          {/* 3. Oil Pressure */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Droplets size={11} className="text-emerald-400" /> OIL P
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.oilPressure.status === 'critical' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : ch.oilPressure.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ch.oilPressure.status.toUpperCase()}
              </span>
            </div>
            <div className={`text-lg font-black font-mono ${ch.oilPressure.status === 'critical' ? 'text-rose-400' : ch.oilPressure.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {ch.oilPressure.current} bar
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>Ref: {ch.oilPressure.expected}b</span>
              <span className={ch.oilPressure.residual < 0 ? 'text-rose-400 font-bold' : ''}>
                Δ {ch.oilPressure.residual}b
              </span>
            </div>
          </div>

          {/* 4. Coolant Temp */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Thermometer size={11} className="text-cyan-400" /> COOLANT
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.coolantTemp.status === 'critical' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : ch.coolantTemp.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ch.coolantTemp.status.toUpperCase()}
              </span>
            </div>
            <div className={`text-lg font-black font-mono ${ch.coolantTemp.status === 'critical' ? 'text-rose-400' : ch.coolantTemp.status === 'warning' ? 'text-amber-400' : 'text-cyan-300'}`}>
              {ch.coolantTemp.current}°C
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>z={ch.coolantTemp.zScore > 0 ? `+${ch.coolantTemp.zScore}` : ch.coolantTemp.zScore}</span>
              <span className={ch.coolantTemp.residual > 0 ? 'text-amber-400 font-bold' : ''}>
                Δ +{ch.coolantTemp.residual}°C
              </span>
            </div>
          </div>

          {/* 5. Oil Temp */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Thermometer size={11} className="text-amber-400" /> OIL TEMP
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.oilTemp.status === 'critical' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : ch.oilTemp.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ch.oilTemp.status.toUpperCase()}
              </span>
            </div>
            <div className={`text-lg font-black font-mono ${ch.oilTemp.status === 'critical' ? 'text-rose-400' : ch.oilTemp.status === 'warning' ? 'text-amber-400' : 'text-slate-100'}`}>
              {ch.oilTemp.current}°C
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>Ref: {ch.oilTemp.expected}°C</span>
              <span className={ch.oilTemp.residual > 0 ? 'text-amber-400 font-bold' : ''}>
                Δ +{ch.oilTemp.residual}°C
              </span>
            </div>
          </div>

          {/* 6. MAP */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <SlidersHorizontal size={11} className="text-slate-400" /> MAP
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                {ch.map.status.toUpperCase()}
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-100">
              {ch.map.current} kPa
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>Manifold</span>
              <span>Δ {ch.map.residual}</span>
            </div>
          </div>

          {/* 7. EGT */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Thermometer size={11} className="text-rose-400" /> EGT
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.egt.flagged ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                {ch.egt.status.toUpperCase()}
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-100">
              {ch.egt.current}°C
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>Ref: {ch.egt.expected}°C</span>
              <span className={ch.egt.residual > 0 ? 'text-rose-400 font-bold' : ''}>
                Δ +{ch.egt.residual}°C
              </span>
            </div>
          </div>

          {/* 8. Vibration */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="font-bold flex items-center gap-1">
                <Activity size={11} className="text-purple-400" /> VIBE
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${ch.vibration.status === 'critical' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : ch.vibration.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ch.vibration.status.toUpperCase()}
              </span>
            </div>
            <div className={`text-lg font-black font-mono ${ch.vibration.status === 'critical' ? 'text-rose-400' : ch.vibration.status === 'warning' ? 'text-amber-400' : 'text-slate-100'}`}>
              {ch.vibration.current.toFixed(2)} g
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1 flex justify-between">
              <span>z={ch.vibration.zScore > 0 ? `+${ch.vibration.zScore}` : ch.vibration.zScore}</span>
              <span className={ch.vibration.flagged ? 'text-rose-400 font-bold' : ''}>
                RMS Drag
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Event & Mission Consequence Console ────────────────────── */}
      <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              Live Mission Event Console
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-bold text-slate-200">
              {missionState.currentEvent}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span>Progress: {(missionState.progress * 100).toFixed(1)}%</span>
            <span>·</span>
            <span>RUL: <strong className="text-amber-400 font-bold">{missionState.pipelineResult.rul.q50_h} hrs</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active Diagnostic Alert Box */}
          <div
            className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
              alert.level === 'critical'
                ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                : alert.level === 'warning'
                ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                : alert.level === 'advisory'
                ? 'bg-blue-950/30 border-blue-800/80 text-blue-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                {alert.active ? <AlertTriangle size={12} /> : <ShieldCheck size={12} className="text-emerald-400" />}
                {alert.active ? `${alert.level.toUpperCase()} ALERT · ${alert.subsystem}` : 'HEALTH MONITOR'}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900/80 border border-slate-800">
                {alert.code}
              </span>
            </div>
            <div className="text-xs font-black text-slate-100">
              {alert.title}
            </div>
            <div className="text-[11px] text-slate-300 leading-snug">
              {alert.message}
            </div>
          </div>

          {/* Mission Consequence & Risk Assessment */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-1.5">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
              <span>Operational Consequence</span>
              <span className="text-slate-300 font-mono">
                Survival P: {(missionState.pipelineResult.risk.P_success * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-xs font-bold text-slate-200">
              {missionState.missionConsequence}
            </div>
            <div className="text-[10px] text-slate-400">
              Governing Degradation Driver:{' '}
              <strong className="text-slate-300">{missionState.pipelineResult.rul.driver}</strong>
            </div>
          </div>

          {/* Recommended Action & Decision Authority */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-1.5">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
              <span>Decision Guidance</span>
              <span className="text-emerald-400 font-mono">Advisory</span>
            </div>
            <div className="text-xs font-bold text-amber-300">
              {missionState.recommendedAction}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Authority remains with operator · No automated actuator override
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
