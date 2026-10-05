import { motion } from 'framer-motion';
import {
  Compass,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { useMissionStore } from '../store/useMissionStore';
import { useThemeStore } from '../store/useThemeStore';
import { computePrognosisChain } from '../lib/prognosisEngine';

export default function Health() {
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

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
      <div className={`flex items-center justify-between flex-wrap gap-3 pb-2 border-b ${
        isLight ? 'border-[#e2ddd1]' : 'border-slate-800/80'
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isLight ? 'bg-purple-600' : 'bg-purple-400'}`} />
            <h1 className={`text-xl font-black tracking-tight uppercase ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
              Engine Health Prognosis &amp; RUL
            </h1>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md border font-bold ${
              isLight ? 'bg-[#f0ebd8] border-[#d8d1c2] text-purple-800' : 'bg-slate-900 border-slate-800 text-purple-400'
            }`}>
              PROGNOSTIC INTELLIGENCE LAYER
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
            Deterministic state extrapolation, wear progression forecasting, remaining useful life (RUL) margin, and operational risk mitigation.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            isLight ? 'bg-[#f0ebd8] border-[#d8d1c2] text-[#0c1117]' : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}>
            <span className={`text-[10px] uppercase font-sans font-bold ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Scenario:</span>
            <span className={`font-bold uppercase ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>{scenarioId}</span>
            <span className={isLight ? 'text-[#cbd5e1]' : 'text-slate-600'}>·</span>
            <span className={isLight ? 'text-[#475569]' : 'text-slate-400'}>t={currentTime.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* ─── The Explicit 6-Stage Operational Prognosis Chain Strip ──────── */}
      <div className={`p-4 rounded-2xl border shadow-xl space-y-3 ${
        isLight ? 'bg-white border-[#e2ddd1]' : 'bg-slate-950/90 border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            isLight ? 'text-amber-800' : 'text-amber-400'
          }`}>
            <Layers size={12} />
            The 6-Stage Operational Prognosis Chain
          </span>
          <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
            CURRENT STATE → TREND → PROJECTED STATE → RUL → CONSEQUENCE → ACTION
          </span>
        </div>

        {/* 6 Sequential Chain Nodes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* 1. CURRENT STATE */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-wider ${
              isLight ? 'text-teal-700' : 'text-cyan-400'
            }`}>
              <span>1. Current State</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-teal-600' : 'bg-cyan-400'}`} />
            </div>
            <div>
              <div className={`text-2xl font-black font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                {prog.currentState.healthIndex}%
              </div>
              <div className={`text-[10px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                Health Tier: <strong className={isLight ? 'text-[#0c1117]' : 'text-slate-200'}>{prog.currentState.riskTier}</strong>
              </div>
            </div>
            <div className={`text-[9px] font-mono pt-1.5 border-t truncate ${
              isLight ? 'border-[#e2ddd1] text-[#64748b]' : 'border-slate-800 text-slate-400'
            }`}>
              {prog.currentState.governingComponent}
            </div>
          </div>

          {/* 2. OBSERVED TREND */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-wider ${
              isLight ? 'text-amber-800' : 'text-amber-400'
            }`}>
              <span>2. Observed Trend</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-amber-600' : 'bg-amber-400'}`} />
            </div>
            <div>
              <div className={`text-xs font-black leading-snug ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                {prog.observedTrend.trendClassification.replaceAll('_', ' ')}
              </div>
              <div className={`text-[10px] font-mono mt-1 leading-tight ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                {prog.observedTrend.physicalVelocity}
              </div>
            </div>
            <div className={`text-[9px] pt-1.5 border-t truncate ${
              isLight ? 'border-[#e2ddd1] text-[#64748b]' : 'border-slate-800 text-slate-400'
            }`}>
              {prog.observedTrend.rateOfChangeText}
            </div>
          </div>

          {/* 3. PROJECTED STATE */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-wider ${
              isLight ? 'text-purple-700' : 'text-purple-400'
            }`}>
              <span>3. Projected State</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-purple-600' : 'bg-purple-400'}`} />
            </div>
            <div>
              <div className={`text-lg font-black font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                {prog.projectedState.criticalBoundaryHorizonMin !== null
                  ? `${prog.projectedState.criticalBoundaryHorizonMin} min`
                  : '> 60 min'}
              </div>
              <div className={`text-[10px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                {prog.projectedState.criticalBoundaryHorizonMin !== null
                  ? 'To Critical Boundary'
                  : 'Safe Projection Margin'}
              </div>
            </div>
            <div className={`text-[9px] font-mono pt-1.5 border-t ${
              isLight ? 'border-[#e2ddd1] text-[#64748b]' : 'border-slate-800 text-slate-400'
            }`}>
              +30m: {prog.projectedState.horizons[1].projectedHealth}% SOH
            </div>
          </div>

          {/* 4. RUL / DEGRADATION */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-wider ${
              isLight ? 'text-rose-700' : 'text-rose-400'
            }`}>
              <span>4. RUL Margin</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-rose-600' : 'bg-rose-400'}`} />
            </div>
            <div>
              <div className={`text-2xl font-black font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                {prog.rulMargin.q50Hours.toFixed(0)}{' '}
                <span className={`text-xs font-normal ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>HRS</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                Demand: {prog.rulMargin.missionDemandHours}h (Δ {prog.rulMargin.marginDeltaHours > 0 ? `+${prog.rulMargin.marginDeltaHours}` : prog.rulMargin.marginDeltaHours}h)
              </div>
            </div>
            <div className={`text-[9px] pt-1.5 border-t truncate ${
              isLight ? 'border-[#e2ddd1] text-[#64748b]' : 'border-slate-800 text-slate-400'
            }`}>
              Conservative Q05: {prog.rulMargin.q05Hours}h
            </div>
          </div>

          {/* 5. MISSION CONSEQUENCE */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-wider ${
              isLight ? 'text-amber-800' : 'text-amber-400'
            }`}>
              <span>5. Consequence</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-amber-600' : 'bg-amber-400'}`} />
            </div>
            <div>
              <div className={`text-2xl font-black font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                {prog.missionConsequence.survivalProbability}%
              </div>
              <div className={`text-[10px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                Mission Success Prob
              </div>
            </div>
            <div className={`text-[9px] pt-1.5 border-t truncate ${
              isLight ? 'border-[#e2ddd1] text-[#64748b]' : 'border-slate-800 text-slate-400'
            }`}>
              {prog.missionConsequence.operationalConsequence}
            </div>
          </div>

          {/* 6. OPERATIONAL ACTION */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-wider ${
              isLight ? 'text-emerald-700' : 'text-emerald-400'
            }`}>
              <span>6. Recommendation</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-emerald-600' : 'bg-emerald-400'}`} />
            </div>
            <div>
              <div className={`text-xs font-black leading-snug line-clamp-2 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                {prog.recommendation.actionTitle}
              </div>
              <div className={`text-[9px] mt-1 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                Advisory Guidance
              </div>
            </div>
            <div className={`text-[9px] pt-1.5 border-t truncate ${
              isLight ? 'border-[#e2ddd1] text-[#64748b]' : 'border-slate-800 text-slate-400'
            }`}>
              Crew / Operator Authority
            </div>
          </div>
        </div>
      </div>

      {/* ─── Detailed Stage Deep-Dives: Multi-Horizon Forecasting & RUL Bounds ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left (7 cols): Multi-Horizon Degradation Forecast Table & Bands */}
        <div className={`lg:col-span-7 p-5 rounded-2xl border shadow-xl space-y-4 ${
          isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-950/90 border-slate-800'
        }`}>
          <div className={`flex items-center justify-between pb-2 border-b ${
            isLight ? 'border-[#e2ddd1]' : 'border-slate-800'
          }`}>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                isLight ? 'text-purple-700' : 'text-purple-400'
              }`}>
                Stage 3: Multi-Horizon State Projection
              </span>
              <h3 className={`text-sm font-bold mt-0.5 ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                Projected Engine Internals at +15m, +30m, and +60m Forecast Horizons
              </h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              isLight ? 'bg-[#f0ebd8] border-[#d8d1c2] text-[#475569]' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              Deterministic Kalman Wear Extrapolation
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b font-sans text-[10px] font-bold uppercase ${
                  isLight ? 'border-[#e2ddd1] bg-[#f0ebd8] text-[#475569]' : 'border-slate-800 text-slate-400'
                }`}>
                  <th className="py-2.5 px-3">Horizon</th>
                  <th className="px-3">Projected SOH</th>
                  <th className="px-3">Est. CHT</th>
                  <th className="px-3">Est. Oil Pressure</th>
                  <th className="px-3">Risk Assessment</th>
                </tr>
              </thead>
              <tbody>
                <tr className={`border-b ${isLight ? 'border-[#e2ddd1] bg-[#faf7f2]' : 'border-slate-900 bg-slate-900/30'}`}>
                  <td className={`py-2.5 px-3 font-bold ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>Current (t=0m)</td>
                  <td className={`px-3 font-bold ${isLight ? 'text-teal-700' : 'text-cyan-400'}`}>{prog.currentState.healthIndex}%</td>
                  <td className={`px-3 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{prog.currentState.keyMetrics[0].value}°C</td>
                  <td className={`px-3 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{prog.currentState.keyMetrics[1].value} bar</td>
                  <td className={`px-3 uppercase font-sans font-bold text-[10px] ${isLight ? 'text-[#475569]' : 'text-slate-300'}`}>{prog.currentState.riskTier}</td>
                </tr>
                {prog.projectedState.horizons.map((h, i) => (
                  <tr key={i} className={`border-b transition-colors ${isLight ? 'border-[#e2ddd1] hover:bg-[#f3eee5]' : 'border-slate-900 hover:bg-slate-900/50'}`}>
                    <td className={`py-2.5 px-3 font-bold ${isLight ? 'text-[#0c1117]' : 'text-slate-300'}`}>+{h.horizonMinutes} minutes</td>
                    <td className={`px-3 font-bold ${
                      h.projectedHealth < 40
                        ? isLight ? 'text-rose-600' : 'text-rose-400'
                        : h.projectedHealth < 70
                        ? isLight ? 'text-amber-600' : 'text-amber-400'
                        : isLight ? 'text-emerald-600' : 'text-emerald-400'
                    }`}>
                      {h.projectedHealth}%
                    </td>
                    <td className={`px-3 ${isLight ? 'text-[#475569]' : 'text-slate-300'}`}>{h.projectedChtCelsius}°C</td>
                    <td className={`px-3 ${isLight ? 'text-[#475569]' : 'text-slate-300'}`}>{h.projectedOilPressureBar} bar</td>
                    <td className="px-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        h.projectedHealth < 40
                          ? isLight ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : h.projectedHealth < 70
                          ? isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {h.projectedRiskTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-900/70 border-slate-800 text-slate-300'
          }`}>
            <div className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>
              <Compass size={13} className={isLight ? 'text-[#d97706]' : 'text-amber-400'} />
              Credible Degradation Uncertainty Bounds:
            </div>
            <p className={`leading-relaxed font-mono text-[10px] ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
              {prog.projectedState.confidenceIntervalText}. Avoids unjustified artificial precision: failure probabilities model empirical Weibull hazard rates combined with live physics residual drag.
            </p>
          </div>
        </div>

        {/* Right (5 cols): RUL Margin vs Mission Demand */}
        <div className={`lg:col-span-5 p-5 rounded-2xl border shadow-xl space-y-4 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-950/90 border-slate-800'
        }`}>
          <div>
            <div className={`flex items-center justify-between pb-2 border-b ${
              isLight ? 'border-[#e2ddd1]' : 'border-slate-800'
            }`}>
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                isLight ? 'text-rose-700' : 'text-rose-400'
              }`}>
                Stage 4: RUL Margin Analysis
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                isLight ? 'bg-[#f0ebd8] border-[#d8d1c2] text-[#475569]' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                Demand: 2.0h
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900 border-slate-800'
              }`}>
                <div>
                  <div className={`text-[10px] font-bold uppercase ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>
                    Governing Component Driver
                  </div>
                  <div className={`text-sm font-black mt-0.5 ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                    {prog.rulMargin.failureDriver}
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono border ${
                  prog.rulMargin.marginStatus === 'NEGATIVE_DEFICIT'
                    ? isLight ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                    : prog.rulMargin.marginStatus === 'BUFFER_DEPLETED'
                    ? isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}>
                  {prog.rulMargin.marginStatus.replaceAll('_', ' ')}
                </div>
              </div>

              {/* Statistical Percentiles (5th, 50th, 95th) */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className={`p-3 rounded-xl border ${
                  isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <div className={`text-[9px] uppercase font-sans font-bold ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Conservative (Q05)</div>
                  <div className={`text-xl font-black mt-1 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{prog.rulMargin.q05Hours}h</div>
                  <div className={`text-[9px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Mission planning limit</div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  isLight ? 'bg-[#faf7f2] border-[#00A896] ring-1 ring-[#00A896]/40' : 'bg-slate-900/80 border-slate-800 ring-1 ring-amber-500/40'
                }`}>
                  <div className={`text-[9px] uppercase font-sans font-bold ${isLight ? 'text-[#008f80]' : 'text-amber-400'}`}>Expected (Q50)</div>
                  <div className={`text-xl font-black mt-1 ${isLight ? 'text-[#008f80]' : 'text-amber-400'}`}>{prog.rulMargin.q50Hours}h</div>
                  <div className={`text-[9px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Median expectation</div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <div className={`text-[9px] uppercase font-sans font-bold ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Optimistic (Q95)</div>
                  <div className={`text-xl font-black mt-1 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{prog.rulMargin.q95Hours}h</div>
                  <div className={`text-[9px] mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Upper boundary limit</div>
                </div>
              </div>

              {/* Operational Margin Comparison */}
              <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/60 border-slate-800'
              }`}>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-[#475569]' : 'text-slate-400'}>Required Patrol Endurance:</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{prog.rulMargin.missionDemandHours} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className={isLight ? 'text-[#475569]' : 'text-slate-400'}>Median Operational Buffer:</span>
                  <span className={`font-mono font-black ${
                    prog.rulMargin.marginDeltaHours > 0
                      ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                      : isLight ? 'text-rose-600' : 'text-rose-400'
                  }`}>
                    {prog.rulMargin.marginDeltaHours > 0 ? `+${prog.rulMargin.marginDeltaHours} hrs` : `${prog.rulMargin.marginDeltaHours} hrs`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action guidance callout */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
            isLight ? 'bg-[#f0ebd8] border-amber-300 text-[#0c1117]' : 'bg-slate-900 border-amber-500/40'
          }`}>
            <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
              isLight ? 'text-amber-800' : 'text-amber-400'
            }`}>
              <ShieldCheck size={13} /> Decision Guidance
            </div>
            <div className={`font-bold text-xs ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
              {prog.recommendation.detailedAction}
            </div>
            <div className={`text-[9px] font-mono mt-1 ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
              {prog.recommendation.authorityDeclaration}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
