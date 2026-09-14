import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Plane, Plus, Trash2 } from 'lucide-react';
import { fetchFlightSimulationStatus, startFlightSimulation, stopFlightSimulation } from '../../lib/api';
import type { FaultMode, FlightPhaseSpec, FlightSimulationStatus, SeverityShape } from '../../types/contracts';
import { useEngineStore } from '../../store/useEngineStore';

interface Preset {
  name: string;
  phases: FlightPhaseSpec[];
}

const PRESETS: Preset[] = [
  {
    name: 'Standard Patrol',
    phases: [
      { name: 'Climb', duration_h: 0.05, throttle_pct: 100 },
      { name: 'Cruise', duration_h: 0.3, throttle_pct: 65 },
      { name: 'Descent', duration_h: 0.05, throttle_pct: 35 },
    ],
  },
  {
    name: 'High-Power Dash',
    phases: [
      { name: 'Climb', duration_h: 0.05, throttle_pct: 100 },
      { name: 'Dash', duration_h: 0.2, throttle_pct: 95 },
      { name: 'Return Cruise', duration_h: 0.2, throttle_pct: 60 },
    ],
  },
  {
    name: 'Long Endurance',
    phases: [
      { name: 'Climb', duration_h: 0.05, throttle_pct: 90 },
      { name: 'Loiter', duration_h: 0.6, throttle_pct: 45 },
      { name: 'Descent', duration_h: 0.05, throttle_pct: 30 },
    ],
  },
];

const SPEED_PRESETS = [
  { label: 'Slow', real_seconds_per_sim_hour: 180 },
  { label: 'Normal', real_seconds_per_sim_hour: 90 },
  { label: 'Fast', real_seconds_per_sim_hour: 30 },
];

const FAULT_OPTIONS: { mode: FaultMode; label: string; description: string }[] = [
  { mode: 'none', label: 'Healthy Flight', description: 'No fault injected - engine flies the profile normally.' },
  {
    mode: 'cooling_degradation',
    label: 'Cooling Degradation',
    description: 'Radiator/ram-air effectiveness falls - CHT and coolant temp rise.',
  },
  {
    mode: 'oil_pump_wear',
    label: 'Oil Pump Wear',
    description: 'Pump volumetric efficiency falls - oil pressure drops.',
  },
];

function formatHours(h: number): string {
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

export default function FlightSimulationPanel() {
  const [phases, setPhases] = useState<FlightPhaseSpec[]>(PRESETS[0].phases);
  const [faultMode, setFaultMode] = useState<FaultMode>('none');
  const [onsetFrac, setOnsetFrac] = useState(0.3);
  const [endSeverity, setEndSeverity] = useState(0.5);
  const [shape, setShape] = useState<SeverityShape>('linear');
  const [speedIdx, setSpeedIdx] = useState(1);
  const [status, setStatus] = useState<FlightSimulationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const diagnosis = useEngineStore((s) => s.diagnosis);
  const risk = useEngineStore((s) => s.risk);
  const prediction = useEngineStore((s) => s.prediction);
  const connected = useEngineStore((s) => s.connected);

  useEffect(() => {
    fetchFlightSimulationStatus()
      .then((s) => {
        setStatus(s);
        if (s.running) startPolling();
      })
      .catch(() => undefined);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await fetchFlightSimulationStatus();
        setStatus(s);
        if (!s.running) stopPolling();
      } catch {
        stopPolling();
      }
    }, 800);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function updatePhase(index: number, patch: Partial<FlightPhaseSpec>) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPhase() {
    setPhases((prev) => [...prev, { name: `Phase ${prev.length + 1}`, duration_h: 0.1, throttle_pct: 50 }]);
  }

  function removePhase(index: number) {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const s = await startFlightSimulation(
        phases,
        { mode: faultMode, onset_frac: onsetFrac, end_severity: endSeverity, shape },
        SPEED_PRESETS[speedIdx].real_seconds_per_sim_hour,
      );
      setStatus(s);
      startPolling();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      const s = await stopFlightSimulation();
      setStatus(s);
      stopPolling();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const running = status?.running ?? false;
  const totalDurationH = phases.reduce((acc, p) => acc + p.duration_h, 0);
  const topCause = diagnosis?.hypotheses[0];
  const rpm = connected && prediction ? Math.round((prediction.x_hat.omega_engine_rad_s ?? 0) * 60 / (2 * Math.PI)) : 0;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <span className="section-title flex items-center gap-1.5">
            <Plane size={13} strokeWidth={2.4} />
            Flight Profile
          </span>
          <div className="flex gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                disabled={running}
                onClick={() => setPhases(preset.phases)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-slate-500 hover:border-orange-300 hover:text-orange-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {phases.map((phase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2"
              >
                <input
                  value={phase.name}
                  disabled={running}
                  onChange={(e) => updatePhase(i, { name: e.target.value })}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none flex-1 min-w-0 disabled:opacity-50"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0.02}
                    step={0.05}
                    disabled={running}
                    value={phase.duration_h}
                    onChange={(e) => updatePhase(i, { duration_h: Number(e.target.value) })}
                    className="w-16 text-xs font-mono text-right bg-slate-50 rounded-md px-1.5 py-0.5 outline-none disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-400">h</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 w-28">
                  <input
                    type="range"
                    min={10}
                    max={100}
                    disabled={running}
                    value={phase.throttle_pct}
                    onChange={(e) => updatePhase(i, { throttle_pct: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{phase.throttle_pct}%</span>
                </div>
                <button
                  onClick={() => removePhase(i)}
                  disabled={running}
                  className="text-slate-300 hover:text-rose-500 shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            onClick={addPhase}
            disabled={running}
            className="btn-ghost w-full justify-center text-xs py-1.5 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus size={13} /> Add phase
          </button>
        </div>

        <div className="mt-3 text-[11px] text-slate-400">
          Total scripted duration: <span className="font-mono font-bold text-slate-600">{formatHours(totalDurationH)}</span>
        </div>
      </div>

      <div className="card">
        <span className="section-title">Fault Injection</span>
        <p className="text-[11px] text-slate-400 mt-1 mb-3">
          Only these two modes drive a verified real physics response in the twin - every other listed fault mode in
          this project's library lacks a confirmed theta hook today, so they are not offered here as scripted options.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FAULT_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              disabled={running}
              onClick={() => setFaultMode(opt.mode)}
              className={`text-left rounded-xl border px-3 py-2 transition-all disabled:opacity-40 disabled:pointer-events-none ${
                faultMode === opt.mode ? 'border-orange-300 bg-orange-50/60' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-xs font-black ${faultMode === opt.mode ? 'text-orange-600' : 'text-slate-700'}`}>{opt.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{opt.description}</div>
            </button>
          ))}
        </div>

        {faultMode !== 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="label-xs">Onset</span>
                <span className="text-[10px] font-mono text-slate-500">{(onsetFrac * 100).toFixed(0)}% into flight</span>
              </div>
              <input type="range" min={0} max={0.9} step={0.05} disabled={running} value={onsetFrac} onChange={(e) => setOnsetFrac(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="label-xs">End Severity</span>
                <span className="text-[10px] font-mono text-slate-500">{(endSeverity * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0.1} max={0.85} step={0.05} disabled={running} value={endSeverity} onChange={(e) => setEndSeverity(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="label-xs mb-1">Ramp Shape</div>
              <div className="flex gap-1">
                {(['linear', 'exponential', 'step'] as SeverityShape[]).map((s) => (
                  <button
                    key={s}
                    disabled={running}
                    onClick={() => setShape(s)}
                    className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border capitalize disabled:opacity-40 disabled:pointer-events-none ${
                      shape === s ? 'border-orange-300 bg-orange-50/60 text-orange-600' : 'border-gray-200 text-slate-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">Playback Speed</span>
          <div className="flex gap-1.5">
            {SPEED_PRESETS.map((sp, i) => (
              <button
                key={sp.label}
                disabled={running}
                onClick={() => setSpeedIdx(i)}
                className={`text-[10px] font-bold px-3 py-1 rounded-lg border disabled:opacity-40 disabled:pointer-events-none ${
                  speedIdx === i ? 'border-orange-300 bg-orange-50/60 text-orange-600' : 'border-gray-200 text-slate-500'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {!running ? (
            <button onClick={handleStart} disabled={busy || phases.length === 0} className="btn-orange flex-1 justify-center disabled:opacity-50">
              <Plane size={14} /> Start Flight Simulation
            </button>
          ) : (
            <button onClick={handleStop} disabled={busy} className="btn-ghost flex-1 justify-center disabled:opacity-50">
              <Pause size={14} /> Stop Simulation
            </button>
          )}
        </div>
        {error && <div className="text-xs text-rose-500 mt-2">{error}</div>}
      </div>

      <AnimatePresence>
        {status && (running || status.progress_pct > 0) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="section-title">
                {running ? 'In Progress' : 'Last Run'} · {status.phase_name ?? '—'}
              </span>
              <span className={running ? 'dot-warning' : 'dot-healthy'} />
            </div>
            <div className="progress-orange">
              <motion.div
                className="progress-orange-fill"
                animate={{ width: `${Math.min(status.progress_pct, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
              <span>
                {formatHours(status.elapsed_h)} / {formatHours(status.total_h)}
              </span>
              <span>phase {status.phase_index + 1} / {status.phase_count}</span>
              {status.fault_mode !== 'none' && (
                <span className="font-mono text-amber-600">fault severity {(status.fault_severity * 100).toFixed(0)}%</span>
              )}
            </div>
            {status.error && <div className="text-xs text-rose-500 mt-2">{status.error}</div>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
              <div>
                <div className="label-xs">Engine</div>
                <div className="kpi-value-dark text-lg">{connected ? rpm.toLocaleString() : '--'} <span className="text-xs font-semibold text-slate-400">RPM</span></div>
              </div>
              <div>
                <div className="label-xs">Health Index</div>
                <div className="kpi-value-dark text-lg">{risk ? risk.health_index.toFixed(0) : '--'}</div>
              </div>
              <div>
                <div className="label-xs">Top Diagnosis</div>
                <div className="text-sm font-black text-slate-800 capitalize truncate">{topCause && topCause.probability > 0.5 ? topCause.cause.replaceAll('_', ' ') : 'healthy'}</div>
              </div>
              <div>
                <div className="label-xs">Mission Tier</div>
                <div className="text-sm font-black text-slate-800">{risk?.tier ?? '--'}</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              This drives the same live telemetry pipeline as a real feed - watch it reflected on Dashboard, Sensors, and Virtual Twin too.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
