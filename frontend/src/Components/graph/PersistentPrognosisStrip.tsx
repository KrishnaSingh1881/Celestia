import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Activity01Icon } from '@hugeicons/core-free-icons';
import type { DeterministicMissionState } from '../../lib/deterministicMission';
import { computePrognosisChain } from '../../lib/prognosisEngine';

interface PersistentPrognosisStripProps {
  missionState: DeterministicMissionState;
}

export default function PersistentPrognosisStrip({ missionState }: PersistentPrognosisStripProps) {
  const [expanded, setExpanded] = useState(false);
  const prog = computePrognosisChain(missionState);

  const getHealthBadge = (health: number) => {
    if (health < 40) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (health < 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'CRITICAL_DIVERGENCE':
        return { label: '↓ ACCELERATING DIVERGENCE', color: 'text-rose-400' };
      case 'DEGRADING_ACCELERATED':
        return { label: '↓ RAPID DEGRADATION', color: 'text-amber-400' };
      case 'STABLE':
      default:
        return { label: '→ STABLE EQUILIBRIUM', color: 'text-emerald-400' };
    }
  };

  const trendInfo = getTrendBadge(prog.observedTrend.trendClassification);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#080d16] shadow-xl overflow-hidden text-slate-200">
      {/* Compact Executive Prognosis Bar */}
      <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <HugeiconsIcon icon={Activity01Icon} size={16} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
              Persistent Prognosis Engine
            </div>
            <div className="text-xs font-bold text-slate-300">
              Forward Degradation &amp; RUL Horizon
            </div>
          </div>
        </div>

        {/* 5 Core Executive KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-1 max-w-4xl">
          {/* 1. Health Now */}
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Health Now</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-black font-mono px-1.5 py-0.2 rounded border ${getHealthBadge(prog.currentState.healthIndex)}`}>
                {prog.currentState.healthIndex}%
              </span>
              <span className="text-[10px] text-slate-400 font-bold">{prog.currentState.riskTier}</span>
            </div>
          </div>

          {/* 2. Observed Trend */}
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Trend Rate</span>
            <div className={`text-xs font-black font-mono mt-1 ${trendInfo.color}`}>
              {trendInfo.label}
            </div>
          </div>

          {/* 3. Projected Horizon (+30m / +60m) */}
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Projected State</span>
            <div className="text-xs font-bold font-mono text-slate-200 mt-1 flex items-center gap-1.5">
              <span>+30m: <strong className="text-amber-400">{prog.projectedState.horizons[1]?.projectedHealth}%</strong></span>
              <span className="text-slate-600">|</span>
              <span>+60m: <strong className="text-rose-400">{prog.projectedState.horizons[2]?.projectedHealth}%</strong></span>
            </div>
          </div>

          {/* 4. RUL Median */}
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">RUL (Q50)</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-base font-black font-mono text-amber-400">
                {prog.rulMargin.q50Hours}h
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                Demand: 2.0h
              </span>
            </div>
          </div>

          {/* 5. Mission Consequence */}
          <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Consequence</span>
            <div className="mt-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${prog.missionConsequence.flightEnvelopeStatus === 'EMERGENCY_ABORT' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' : prog.missionConsequence.flightEnvelopeStatus === 'THROTTLE_DERATED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                {prog.missionConsequence.flightEnvelopeStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Expand / Details Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shrink-0"
        >
          {expanded ? 'Hide Multi-Horizon' : 'Expand Horizons ▼'}
        </button>
      </div>

      {/* Expandable Multi-Horizon Forecast & Demand Context */}
      {expanded && (
        <div className="p-4 bg-slate-950/90 border-t border-slate-800/80 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Multi-Horizon Degradation Table */}
            <div className="md:col-span-8 p-3 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                Multi-Horizon Degradation Trajectory (Closed-Form Integration)
              </span>
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-800 pb-1">
                    <th className="pb-1.5 font-bold">Horizon</th>
                    <th className="pb-1.5 font-bold">Predicted Health</th>
                    <th className="pb-1.5 font-bold">Cylinder Head Temp</th>
                    <th className="pb-1.5 font-bold">Oil Gallery Pressure</th>
                    <th className="pb-1.5 font-bold">Risk Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="text-slate-300">
                    <td className="py-1.5 font-bold text-cyan-400">Current (t=0)</td>
                    <td className="py-1.5 font-bold">{prog.currentState.healthIndex}%</td>
                    <td className="py-1.5">{missionState.channels.cht.current}°C</td>
                    <td className="py-1.5">{missionState.channels.oilPressure.current} bar</td>
                    <td className="py-1.5">
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-slate-800 text-slate-200">
                        {prog.currentState.riskTier}
                      </span>
                    </td>
                  </tr>
                  {prog.projectedState.horizons.map((h) => (
                    <tr key={h.horizonMinutes} className="text-slate-300">
                      <td className="py-1.5 font-bold text-amber-400">+{h.horizonMinutes} minutes</td>
                      <td className="py-1.5 font-bold">{h.projectedHealth}%</td>
                      <td className="py-1.5">{h.projectedChtCelsius}°C</td>
                      <td className="py-1.5">{h.projectedOilPressureBar} bar</td>
                      <td className="py-1.5">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${h.projectedHealth < 40 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : h.projectedHealth < 70 ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                          {h.projectedRiskTier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Uncertainty Bounds & Decision Guidance */}
            <div className="md:col-span-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-1">
                  Empirical Uncertainty Bounds (Q05 / Q50 / Q95)
                </span>
                <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                  {prog.projectedState.confidenceIntervalText}. Avoids false point precision; models Weibull wear hazard rate.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 text-xs">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide block mb-0.5">
                  Controller Decision Guidance:
                </span>
                <div className="font-bold text-slate-100">{prog.recommendation.detailedAction}</div>
                <div className="text-[9px] text-slate-500 font-mono mt-0.5">{prog.recommendation.authorityDeclaration}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
