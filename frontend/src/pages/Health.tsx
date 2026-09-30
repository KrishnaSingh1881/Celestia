import { motion } from 'framer-motion';
import {
  Compass,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { useMissionStore } from '../store/useMissionStore';
import { computePrognosisChain } from '../lib/prognosisEngine';

export default function Health() {
  const missionState = useMissionStore((s) => s.missionState);
  const currentTime = useMissionStore((s) => s.currentTime);
  const scenarioId = useMissionStore((s) => s.scenarioId);

  const prog = computePrognosisChain(missionState);

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
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
            <h1 className="text-xl font-black tracking-tight text-slate-100 uppercase">
              Engine Health Prognosis &amp; RUL
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-purple-400 font-bold">
              PROGNOSTIC INTELLIGENCE LAYER
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic state extrapolation, wear progression forecasting, remaining useful life (RUL) margin, and operational risk mitigation.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Scenario:</span>
            <span className="text-amber-400 font-bold uppercase">{scenarioId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">t={currentTime.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* ─── The Explicit 6-Stage Operational Prognosis Chain Strip ──────── */}
      <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Layers size={12} />
            The 6-Stage Operational Prognosis Chain
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            CURRENT STATE → TREND → PROJECTED STATE → RUL → CONSEQUENCE → ACTION
          </span>
        </div>

        {/* 6 Sequential Chain Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* 1. CURRENT STATE */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-cyan-400">
              <span>1. Current State</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {prog.currentState.healthIndex}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Health Tier: <strong className="text-slate-200">{prog.currentState.riskTier}</strong>
              </div>
            </div>
            <div className="text-[9px] text-slate-400 font-mono pt-1.5 border-t border-slate-800 truncate">
              {prog.currentState.governingComponent}
            </div>
          </div>

          {/* 2. OBSERVED TREND */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-400">
              <span>2. Observed Trend</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-300 leading-snug">
                {prog.observedTrend.trendClassification.replaceAll('_', ' ')}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 leading-tight">
                {prog.observedTrend.physicalVelocity}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800 truncate">
              {prog.observedTrend.rateOfChangeText}
            </div>
          </div>

          {/* 3. PROJECTED STATE */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-purple-400">
              <span>3. Projected State</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            </div>
            <div>
              <div className="text-lg font-black font-mono text-slate-100">
                {prog.projectedState.criticalBoundaryHorizonMin !== null
                  ? `${prog.projectedState.criticalBoundaryHorizonMin} min`
                  : '> 60 min'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {prog.projectedState.criticalBoundaryHorizonMin !== null
                  ? 'To Critical Boundary'
                  : 'Safe Projection Margin'}
              </div>
            </div>
            <div className="text-[9px] text-slate-400 font-mono pt-1.5 border-t border-slate-800">
              +30m: {prog.projectedState.horizons[1].projectedHealth}% SOH
            </div>
          </div>

          {/* 4. RUL / DEGRADATION */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-rose-400">
              <span>4. RUL Margin</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {prog.rulMargin.q50Hours.toFixed(0)}{' '}
                <span className="text-xs font-normal text-slate-400">HRS</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Demand: {prog.rulMargin.missionDemandHours}h (Δ {prog.rulMargin.marginDeltaHours > 0 ? `+${prog.rulMargin.marginDeltaHours}` : prog.rulMargin.marginDeltaHours}h)
              </div>
            </div>
            <div className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800 truncate">
              Conservative Q05: {prog.rulMargin.q05Hours}h
            </div>
          </div>

          {/* 5. MISSION CONSEQUENCE */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-400">
              <span>5. Consequence</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-slate-100">
                {prog.missionConsequence.survivalProbability}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Mission Success Prob
              </div>
            </div>
            <div className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800 truncate">
              {prog.missionConsequence.operationalConsequence}
            </div>
          </div>

          {/* 6. OPERATIONAL ACTION */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-emerald-400">
              <span>6. Recommendation</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-300 leading-snug line-clamp-2">
                {prog.recommendation.actionTitle}
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                Advisory Guidance
              </div>
            </div>
            <div className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800 truncate">
              Crew / Operator Authority
            </div>
          </div>
        </div>
      </div>

      {/* ─── Detailed Stage Deep-Dives: Multi-Horizon Forecasting & RUL Bounds ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left (7 cols): Multi-Horizon Degradation Forecast Table & Bands */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                Stage 3: Multi-Horizon State Projection
              </span>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                Projected Engine Internals at +15m, +30m, and +60m Forecast Horizons
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              Deterministic Kalman Wear Extrapolation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] font-bold uppercase">
                  <th className="py-2.5 px-3">Horizon</th>
                  <th className="px-3">Projected SOH</th>
                  <th className="px-3">Est. CHT</th>
                  <th className="px-3">Est. Oil Pressure</th>
                  <th className="px-3">Risk Assessment</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-900 bg-slate-900/30">
                  <td className="py-2.5 px-3 font-bold text-slate-200">Current (t=0m)</td>
                  <td className="px-3 font-bold text-cyan-400">{prog.currentState.healthIndex}%</td>
                  <td className="px-3 text-slate-200">{prog.currentState.keyMetrics[0].value}°C</td>
                  <td className="px-3 text-slate-200">{prog.currentState.keyMetrics[1].value} bar</td>
                  <td className="px-3 text-slate-300 uppercase font-sans font-bold text-[10px]">{prog.currentState.riskTier}</td>
                </tr>
                {prog.projectedState.horizons.map((h, i) => (
                  <tr key={i} className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-300">+{h.horizonMinutes} minutes</td>
                    <td className={`px-3 font-bold ${h.projectedHealth < 40 ? 'text-rose-400' : h.projectedHealth < 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {h.projectedHealth}%
                    </td>
                    <td className="px-3 text-slate-300">{h.projectedChtCelsius}°C</td>
                    <td className="px-3 text-slate-300">{h.projectedOilPressureBar} bar</td>
                    <td className="px-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${h.projectedHealth < 40 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : h.projectedHealth < 70 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                        {h.projectedRiskTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300 space-y-1">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Compass size={13} className="text-amber-400" />
              Credible Degradation Uncertainty Bounds:
            </div>
            <p className="text-slate-400 leading-relaxed font-mono text-[10px]">
              {prog.projectedState.confidenceIntervalText}. Avoids unjustified artificial precision: failure probabilities model empirical Weibull hazard rates combined with live physics residual drag.
            </p>
          </div>
        </div>

        {/* Right (5 cols): RUL Margin vs Mission Demand */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                Stage 4: RUL Margin Analysis
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                Demand: 2.0h
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    Governing Component Driver
                  </div>
                  <div className="text-sm font-black text-slate-100 mt-0.5">
                    {prog.rulMargin.failureDriver}
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono border ${prog.rulMargin.marginStatus === 'NEGATIVE_DEFICIT' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' : prog.rulMargin.marginStatus === 'BUFFER_DEPLETED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}>
                  {prog.rulMargin.marginStatus.replaceAll('_', ' ')}
                </div>
              </div>

              {/* Statistical Percentiles (5th, 50th, 95th) */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[9px] uppercase font-sans font-bold text-slate-400">Conservative (Q05)</div>
                  <div className="text-xl font-black text-slate-200 mt-1">{prog.rulMargin.q05Hours}h</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Mission planning limit</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 ring-1 ring-amber-500/40">
                  <div className="text-[9px] uppercase font-sans font-bold text-amber-400">Expected (Q50)</div>
                  <div className="text-xl font-black text-amber-400 mt-1">{prog.rulMargin.q50Hours}h</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Median expectation</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[9px] uppercase font-sans font-bold text-slate-400">Optimistic (Q95)</div>
                  <div className="text-xl font-black text-slate-200 mt-1">{prog.rulMargin.q95Hours}h</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Upper boundary limit</div>
                </div>
              </div>

              {/* Operational Margin Comparison */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Required Patrol Endurance:</span>
                  <span className="font-mono font-bold text-slate-200">{prog.rulMargin.missionDemandHours} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Median Operational Buffer:</span>
                  <span className={`font-mono font-black ${prog.rulMargin.marginDeltaHours > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {prog.rulMargin.marginDeltaHours > 0 ? `+${prog.rulMargin.marginDeltaHours} hrs` : `${prog.rulMargin.marginDeltaHours} hrs`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action guidance callout */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-wider">
              <ShieldCheck size={13} /> Decision Guidance
            </div>
            <div className="font-bold text-slate-100 text-xs">
              {prog.recommendation.detailedAction}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-1">
              {prog.recommendation.authorityDeclaration}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
