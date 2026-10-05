import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Activity01Icon } from '@hugeicons/core-free-icons';
import type { DeterministicMissionState } from '../../lib/deterministicMission';
import { computePrognosisChain } from '../../lib/prognosisEngine';
import { useThemeStore } from '../../store/useThemeStore';

interface PersistentPrognosisStripProps {
  missionState: DeterministicMissionState;
}

export default function PersistentPrognosisStrip({ missionState }: PersistentPrognosisStripProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';
  const prog = computePrognosisChain(missionState);

  const getHealthBadge = (health: number) => {
    if (health < 40) {
      return isLight
        ? 'text-rose-700 bg-rose-50 border-rose-300'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
    if (health < 70) {
      return isLight
        ? 'text-amber-800 bg-amber-50 border-amber-300'
        : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    }
    return isLight
      ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'CRITICAL_DIVERGENCE':
        return { label: '↓ ACCELERATING DIVERGENCE', color: isLight ? 'text-rose-700' : 'text-rose-400' };
      case 'DEGRADING_ACCELERATED':
        return { label: '↓ RAPID DEGRADATION', color: isLight ? 'text-amber-800' : 'text-amber-400' };
      case 'STABLE':
      default:
        return { label: '→ STABLE EQUILIBRIUM', color: isLight ? 'text-emerald-700' : 'text-emerald-400' };
    }
  };

  const trendInfo = getTrendBadge(prog.observedTrend.trendClassification);

  return (
    <div className={`rounded-2xl border shadow-xl overflow-hidden transition-colors duration-200 ${
      isLight ? 'border-[#e2ddd1] bg-white text-[#0c1117] shadow-md' : 'border-slate-800 bg-[#080d16] text-slate-200 shadow-xl'
    }`}>
      {/* Compact Executive Prognosis Bar */}
      <div className={`p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b ${
        isLight ? 'border-[#e2ddd1] bg-[#f4efe6]/50' : 'border-slate-800/80 bg-slate-900/30'
      }`}>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
            isLight
              ? 'bg-purple-100 border-purple-300 text-purple-700'
              : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
          }`}>
            <HugeiconsIcon icon={Activity01Icon} size={16} />
          </div>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-wider ${
              isLight ? 'text-purple-700' : 'text-purple-400'
            }`}>
              Persistent Prognosis Engine
            </div>
            <div className={`text-xs font-bold ${
              isLight ? 'text-[#0c1117]' : 'text-slate-300'
            }`}>
              Forward Degradation &amp; RUL Horizon
            </div>
          </div>
        </div>

        {/* 5 Core Executive KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-1 max-w-4xl">
          {/* 1. Health Now */}
          <div className={`p-2 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Health Now</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-black font-mono px-1.5 py-0.2 rounded border ${getHealthBadge(prog.currentState.healthIndex)}`}>
                {prog.currentState.healthIndex}%
              </span>
              <span className={`text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{prog.currentState.riskTier}</span>
            </div>
          </div>

          {/* 2. Observed Trend */}
          <div className={`p-2 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Trend Rate</span>
            <div className={`text-xs font-black font-mono mt-1 ${trendInfo.color}`}>
              {trendInfo.label}
            </div>
          </div>

          {/* 3. Projected Horizon (+30m / +60m) */}
          <div className={`p-2 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Projected State</span>
            <div className={`text-xs font-bold font-mono mt-1 flex items-center gap-1.5 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>
              <span>+30m: <strong className={isLight ? 'text-amber-800' : 'text-amber-400'}>{prog.projectedState.horizons[1]?.projectedHealth}%</strong></span>
              <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>|</span>
              <span>+60m: <strong className={isLight ? 'text-rose-700' : 'text-rose-400'}>{prog.projectedState.horizons[2]?.projectedHealth}%</strong></span>
            </div>
          </div>

          {/* 4. RUL Median */}
          <div className={`p-2 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>RUL (Q50)</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-base font-black font-mono ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                {prog.rulMargin.q50Hours}h
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                isLight ? 'bg-[#eae4d7] text-[#0c1117]' : 'bg-slate-800 text-slate-300'
              }`}>
                Demand: 2.0h
              </span>
            </div>
          </div>

          {/* 5. Mission Consequence */}
          <div className={`p-2 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Consequence</span>
            <div className="mt-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                prog.missionConsequence.flightEnvelopeStatus === 'EMERGENCY_ABORT'
                  ? isLight ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                  : prog.missionConsequence.flightEnvelopeStatus === 'THROTTLE_DERATED'
                  ? isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {prog.missionConsequence.flightEnvelopeStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Expand / Details Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 border ${
            isLight
              ? 'text-[#0c1117] bg-[#eae4d7] hover:bg-[#ded7c8] border-[#d5cdbc]'
              : 'text-slate-300 bg-slate-800 hover:bg-slate-700 border-slate-700'
          }`}
        >
          {expanded ? 'Hide Multi-Horizon' : 'Expand Horizons ▼'}
        </button>
      </div>

      {/* Expandable Multi-Horizon Forecast & Demand Context */}
      {expanded && (
        <div className={`p-4 border-t space-y-3 ${
          isLight ? 'bg-[#f4efe6] border-[#e2ddd1]' : 'bg-slate-950/90 border-slate-800/80'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            {/* Multi-Horizon Degradation Table */}
            <div className={`md:col-span-8 p-3 rounded-xl border overflow-x-auto ${
              isLight ? 'bg-white border-[#e2ddd1]' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <span className={`text-[10px] font-black uppercase tracking-wider block mb-2 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Multi-Horizon Degradation Trajectory (Closed-Form Integration)
              </span>
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className={`text-[10px] uppercase border-b pb-1 ${
                    isLight ? 'text-slate-600 border-[#e2ddd1]' : 'text-slate-500 border-slate-800'
                  }`}>
                    <th className="pb-1.5 font-bold">Horizon</th>
                    <th className="pb-1.5 font-bold">Predicted Health</th>
                    <th className="pb-1.5 font-bold">Cylinder Head Temp</th>
                    <th className="pb-1.5 font-bold">Oil Gallery Pressure</th>
                    <th className="pb-1.5 font-bold">Risk Assessment</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-[#e2ddd1]' : 'divide-slate-800/60'}`}>
                  <tr className={isLight ? 'text-[#0c1117]' : 'text-slate-300'}>
                    <td className={`py-1.5 font-bold ${isLight ? 'text-[#00a896]' : 'text-cyan-400'}`}>Current (t=0)</td>
                    <td className="py-1.5 font-bold">{prog.currentState.healthIndex}%</td>
                    <td className="py-1.5">{missionState.channels.cht.current}°C</td>
                    <td className="py-1.5">{missionState.channels.oilPressure.current} bar</td>
                    <td className="py-1.5">
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        isLight ? 'bg-[#eae4d7] text-[#0c1117]' : 'bg-slate-800 text-slate-200'
                      }`}>
                        {prog.currentState.riskTier}
                      </span>
                    </td>
                  </tr>
                  {prog.projectedState.horizons.map((h) => (
                    <tr key={h.horizonMinutes} className={isLight ? 'text-[#0c1117]' : 'text-slate-300'}>
                      <td className={`py-1.5 font-bold ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>+{h.horizonMinutes} minutes</td>
                      <td className="py-1.5 font-bold">{h.projectedHealth}%</td>
                      <td className="py-1.5">{h.projectedChtCelsius}°C</td>
                      <td className="py-1.5">{h.projectedOilPressureBar} bar</td>
                      <td className="py-1.5">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                          h.projectedHealth < 40
                            ? isLight ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : h.projectedHealth < 70
                            ? isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {h.projectedRiskTier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Uncertainty Bounds & Decision Guidance */}
            <div className={`md:col-span-4 p-3 rounded-xl border space-y-2 ${
              isLight ? 'bg-white border-[#e2ddd1]' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider block mb-1 ${
                  isLight ? 'text-amber-800' : 'text-amber-400'
                }`}>
                  Empirical Uncertainty Bounds (Q05 / Q50 / Q95)
                </span>
                <p className={`text-[10px] font-mono leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {prog.projectedState.confidenceIntervalText}. Avoids false point precision; models Weibull wear hazard rate.
                </p>
              </div>

              <div className={`p-2.5 rounded-lg border text-xs ${
                isLight ? 'bg-[#faf7f2] border-amber-300' : 'bg-slate-950 border-amber-500/30'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wide block mb-0.5 ${
                  isLight ? 'text-amber-800' : 'text-amber-400'
                }`}>
                  Controller Decision Guidance:
                </span>
                <div className={`font-bold ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{prog.recommendation.detailedAction}</div>
                <div className={`text-[9px] font-mono mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>{prog.recommendation.authorityDeclaration}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
