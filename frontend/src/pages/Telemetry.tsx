import { motion } from 'framer-motion';
import {
  Activity,
  Gauge,
  Thermometer,
  Droplets,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import { useMissionStore } from '../store/useMissionStore';
import AllChannelsChart from '../Components/charts/AllChannelsChart';

interface ChannelCardSpec {
  id: string;
  name: string;
  subsystem: string;
  icon: typeof Gauge;
  current: number;
  expected: number;
  unit: string;
  residual: number;
  zScore: number;
  status: 'nominal' | 'warning' | 'critical';
  isSensorFault?: boolean;
  minRange: number;
  maxRange: number;
}

export default function Telemetry() {
  const missionState = useMissionStore((s) => s.missionState);
  const currentTime = useMissionStore((s) => s.currentTime);
  const scenarioId = useMissionStore((s) => s.scenarioId);

  const ch = missionState.channels;
  const isSensorAnomalyScenario = scenarioId === 'sensor' && currentTime >= 40;

  const channelCards: ChannelCardSpec[] = [
    {
      id: 'rpm',
      name: 'Engine Speed',
      subsystem: 'Power Section',
      icon: Gauge,
      current: ch.rpm.current,
      expected: ch.rpm.expected,
      unit: 'RPM',
      residual: ch.rpm.residual,
      zScore: ch.rpm.zScore,
      status: ch.rpm.status,
      minRange: 1500,
      maxRange: 3200,
    },
    {
      id: 'cht',
      name: 'Cylinder Head Temp',
      subsystem: 'Thermodynamic Core',
      icon: Thermometer,
      current: ch.cht.current,
      expected: ch.cht.expected,
      unit: '°C',
      residual: ch.cht.residual,
      zScore: ch.cht.zScore,
      status: isSensorAnomalyScenario ? 'warning' : ch.cht.status,
      isSensorFault: isSensorAnomalyScenario,
      minRange: 60,
      maxRange: 180,
    },
    {
      id: 'oilPressure',
      name: 'Dry-Sump Oil Pressure',
      subsystem: 'Lubrication',
      icon: Droplets,
      current: ch.oilPressure.current,
      expected: ch.oilPressure.expected,
      unit: 'bar',
      residual: ch.oilPressure.residual,
      zScore: ch.oilPressure.zScore,
      status: ch.oilPressure.status,
      minRange: 0.5,
      maxRange: 6.0,
    },
    {
      id: 'coolantTemp',
      name: 'Coolant Temperature',
      subsystem: 'Cooling Loop',
      icon: Thermometer,
      current: ch.coolantTemp.current,
      expected: ch.coolantTemp.expected,
      unit: '°C',
      residual: ch.coolantTemp.residual,
      zScore: ch.coolantTemp.zScore,
      status: ch.coolantTemp.status,
      minRange: 50,
      maxRange: 135,
    },
    {
      id: 'oilTemp',
      name: 'Oil Sump Temperature',
      subsystem: 'Lubrication',
      icon: Thermometer,
      current: ch.oilTemp.current,
      expected: ch.oilTemp.expected,
      unit: '°C',
      residual: ch.oilTemp.residual,
      zScore: ch.oilTemp.zScore,
      status: ch.oilTemp.status,
      minRange: 50,
      maxRange: 145,
    },
    {
      id: 'map',
      name: 'Manifold Pressure (MAP)',
      subsystem: 'Induction System',
      icon: SlidersHorizontal,
      current: ch.map.current,
      expected: ch.map.expected,
      unit: 'kPa',
      residual: ch.map.residual,
      zScore: ch.map.zScore,
      status: ch.map.status,
      minRange: 50,
      maxRange: 120,
    },
    {
      id: 'egt',
      name: 'Exhaust Gas Temp (EGT)',
      subsystem: 'Exhaust Manifold',
      icon: Flame,
      current: ch.egt.current,
      expected: ch.egt.expected,
      unit: '°C',
      residual: ch.egt.residual,
      zScore: ch.egt.zScore,
      status: ch.egt.status,
      minRange: 500,
      maxRange: 920,
    },
    {
      id: 'vibration',
      name: 'Core Vibration (RMS)',
      subsystem: 'Structural Health',
      icon: Activity,
      current: ch.vibration.current,
      expected: ch.vibration.expected,
      unit: 'g',
      residual: ch.vibration.residual,
      zScore: ch.vibration.zScore,
      status: ch.vibration.status,
      minRange: 0.0,
      maxRange: 0.6,
    },
  ];

  const totalFlagged = channelCards.filter((c) => c.status !== 'nominal' || c.isSensorFault).length;
  const d2 = missionState.pipelineResult.residual.d2.toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-5 max-w-[1600px] mx-auto pb-12 select-none"
    >
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-black tracking-tight text-slate-100 uppercase">
              Live Engine Telemetry &amp; Residuals
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-cyan-400 font-bold">
              ENGINE DIGITAL TWIN
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-channel physical telemetry correlated with synthetic reference model residuals and statistical GLR anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Mission Time:</span>
            <span className="text-amber-400 font-bold">{currentTime.toFixed(1)}s</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 font-sans uppercase font-bold">{scenarioId}</span>
          </div>
        </div>
      </div>

      {/* ─── Metric Summary Strip ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Monitored Channels
          </div>
          <div className="text-2xl font-black font-mono text-slate-100 mt-1">8 Channels</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Continuous 50 Hz Pipeline</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Detection Discrepancies
          </div>
          <div
            className={`text-2xl font-black font-mono mt-1 ${
              totalFlagged > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
            }`}
          >
            {totalFlagged} Flags Tripped
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {totalFlagged > 0 ? 'Residual Threshold Exceeded' : 'All Channels Nominal (z < 2.0)'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Mahalanobis Distance (d²)
          </div>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">{d2}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Multivariate Covariance Metric</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Engine Health Index
          </div>
          <div
            className={`text-2xl font-black font-mono mt-1 ${
              missionState.healthIndex >= 80
                ? 'text-emerald-400'
                : missionState.healthIndex >= 50
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {missionState.healthIndex}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Tier: {missionState.pipelineResult.risk.tier}
          </div>
        </div>
      </div>

      {/* ─── 8-Channel Telemetry Grid ───────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Activity size={12} className="text-amber-400" />
            Engineering Channel State &amp; Deviation Indicators
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {channelCards.map((card) => {
            const Icon = card.icon;
            const rangePct = Math.min(
              100,
              Math.max(0, ((card.current - card.minRange) / (card.maxRange - card.minRange)) * 100),
            );

            return (
              <div
                key={card.id}
                className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between gap-3 shadow-md relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                      <Icon size={12} className="text-amber-400" />
                      {card.name}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        card.isSensorFault
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : card.status === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                          : card.status === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}
                    >
                      {card.isSensorFault ? 'SENSOR ANOMALY' : card.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-[9px] text-slate-400 font-mono">{card.subsystem}</div>

                  <div className="flex items-baseline gap-2 mt-2">
                    <span
                      className={`text-2xl font-black font-mono ${
                        card.isSensorFault
                          ? 'text-purple-300'
                          : card.status === 'critical'
                          ? 'text-rose-400'
                          : card.status === 'warning'
                          ? 'text-amber-400'
                          : 'text-slate-100'
                      }`}
                    >
                      {card.id === 'vibration' ? card.current.toFixed(2) : card.current.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{card.unit}</span>
                  </div>
                </div>

                {/* Range Bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        card.isSensorFault
                          ? 'bg-purple-400'
                          : card.status === 'critical'
                          ? 'bg-rose-400'
                          : card.status === 'warning'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${rangePct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>{card.minRange}</span>
                    <span>Expected: {card.expected} {card.unit}</span>
                    <span>{card.maxRange}</span>
                  </div>
                </div>

                {/* Deviation Metrics */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">
                    Residual: <strong className={card.residual !== 0 ? 'text-amber-400' : 'text-slate-300'}>
                      {card.residual > 0 ? `+${card.residual}` : card.residual}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Normalized: <strong className={Math.abs(card.zScore) >= 2.0 ? 'text-rose-400' : 'text-slate-300'}>
                      z={card.zScore > 0 ? `+${card.zScore}` : card.zScore}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Historical Normalized Chart ─────────────────────────────────── */}
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4">
        <AllChannelsChart />
      </div>

      {/* ─── Engineering Residuals Data Table ───────────────────────────── */}
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-100">
              Telemetry Channel Residual &amp; Anomaly Matrix
            </h3>
            <p className="text-[11px] text-slate-400">
              Model prediction comparison: raw residual r(t) = y(t) − y_hat(t) with 2σ advisory and 3.5σ alarm boundaries.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 px-2 py-1 rounded bg-slate-900 border border-slate-800">
            CUSUM / GLR Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] font-bold uppercase">
                <th className="py-2.5 px-3">Channel</th>
                <th className="px-3">Subsystem</th>
                <th className="px-3">Current y(t)</th>
                <th className="px-3">Reference ŷ(t)</th>
                <th className="px-3">Residual Δ</th>
                <th className="px-3">Normalized z</th>
                <th className="px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {channelCards.map((c) => (
                <tr key={c.id} className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors">
                  <td className="py-2 px-3 font-sans font-bold text-slate-200">{c.name}</td>
                  <td className="px-3 text-slate-400">{c.subsystem}</td>
                  <td className="px-3 font-bold text-slate-100">{c.id === 'vibration' ? c.current.toFixed(2) : c.current} {c.unit}</td>
                  <td className="px-3 text-slate-400">{c.expected} {c.unit}</td>
                  <td className={`px-3 font-bold ${c.residual !== 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {c.residual > 0 ? `+${c.residual}` : c.residual} {c.unit}
                  </td>
                  <td className={`px-3 font-bold ${Math.abs(c.zScore) >= 2.0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {c.zScore > 0 ? `+${c.zScore}` : c.zScore}
                  </td>
                  <td className="px-3">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        c.isSensorFault
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : c.status === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : c.status === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {c.isSensorFault ? 'SENSOR FAULT' : c.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
