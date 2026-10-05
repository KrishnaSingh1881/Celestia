import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Activity01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  HelpCircleIcon,
  Layers01Icon,
  ShieldAlertIcon,
  Target02Icon,
} from '@hugeicons/core-free-icons';
import type {
  CausalNodeData,
  NodeCriticality,
  TraceMode,
} from '../../types/causalGraph';
import { REGION_CONFIG, getDiagnosticCandidates, getPropagationSteps, getReasoningTrace } from '../../lib/causalGraphData';
import type { DeterministicMissionState } from '../../lib/deterministicMission';
import { useThemeStore } from '../../store/useThemeStore';

interface DiagnosticDrawerProps {
  selectedNode: CausalNodeData | null;
  missionState: DeterministicMissionState;
  traceMode: TraceMode;
  onSetTraceMode: (mode: TraceMode) => void;
  onSelectNodeById: (nodeId: string) => void;
}

export default function DiagnosticDrawer({
  selectedNode,
  missionState,
  traceMode,
  onSetTraceMode,
  onSelectNodeById,
}: DiagnosticDrawerProps) {
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

  // Accordion active sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    node: true,
    diagnosis: true,
    propagation: true,
    impact: false,
    evidence: false,
    reasoning: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getCriticalityBadge = (crit: NodeCriticality) => {
    switch (crit) {
      case 'critical':
        return {
          label: 'CRITICAL',
          bg: isLight ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse',
        };
      case 'warning':
        return {
          label: 'WARNING',
          bg: isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        };
      case 'sensor_fault':
        return {
          label: 'SENSOR FAULT',
          bg: isLight ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
        };
      case 'nominal':
      default:
        return {
          label: 'NOMINAL',
          bg: isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
    }
  };

  if (!selectedNode) {
    return (
      <div className={`h-full rounded-2xl border p-6 flex flex-col items-center justify-center text-center text-xs transition-colors ${
        isLight ? 'border-[#e2ddd1] bg-[#faf7f2] text-slate-600' : 'border-slate-800 bg-slate-950/80 text-slate-400'
      }`}>
        <HugeiconsIcon icon={HelpCircleIcon} size={36} className={`mb-3 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
        <span className={`font-bold text-sm ${isLight ? 'text-[#0c1117]' : 'text-slate-300'}`}>No Graph Node Selected</span>
        <p className={`mt-1 max-w-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
          Click any component, sensor, or state in the causal network to inspect root-cause diagnosis, propagation vectors, and evidence.
        </p>
      </div>
    );
  }

  const crit = getCriticalityBadge(selectedNode.criticality);
  const regionCfg = REGION_CONFIG[selectedNode.region];
  const candidates = getDiagnosticCandidates(selectedNode, missionState);
  const propagationSteps = getPropagationSteps(selectedNode, missionState);
  const reasoningTrace = getReasoningTrace(missionState);

  return (
    <div className={`h-full flex flex-col rounded-2xl border shadow-xl overflow-hidden transition-colors ${
      isLight ? 'border-[#e2ddd1] bg-white text-[#0c1117]' : 'border-slate-800 bg-[#070b12] text-slate-200 shadow-2xl'
    }`}>
      {/* Drawer Header */}
      <div className={`p-3.5 border-b flex items-center justify-between ${
        isLight ? 'border-[#e2ddd1] bg-[#f4efe6]' : 'border-slate-800 bg-slate-900/80'
      }`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: regionCfg.color }} />
          <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-[#0c1117]' : 'text-slate-300'}`}>
            {regionCfg.label}
          </span>
          <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>/</span>
          <span className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{selectedNode.subType}</span>
        </div>

        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${crit.bg}`}>
          {crit.label}
        </span>
      </div>

      {/* Scrollable Accordion Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* 1. SELECTED NODE SUMMARY */}
        <div className={`rounded-xl border overflow-hidden ${
          isLight ? 'border-[#e2ddd1] bg-[#faf7f2]' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <button
            onClick={() => toggleSection('node')}
            className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
              isLight ? 'bg-white hover:bg-[#f4efe6]' : 'bg-slate-900/90 hover:bg-slate-800/80'
            }`}
          >
            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-[#0c1117]' : 'text-slate-200'
            }`}>
              <HugeiconsIcon icon={Target02Icon} size={14} className={isLight ? 'text-sky-600' : 'text-sky-400'} />
              Selected Node
            </span>
            <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {openSections.node ? '▲' : '▼'}
            </span>
          </button>

          {openSections.node && (
            <div className={`p-3 space-y-2.5 border-t text-xs ${
              isLight ? 'border-[#e2ddd1] bg-white' : 'border-slate-800/80 bg-transparent'
            }`}>
              <div>
                <h4 className={`text-sm font-black ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{selectedNode.label}</h4>
                <p className={`text-[11px] mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {selectedNode.functionDescription}
                </p>
              </div>

              {/* Health Progress Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                  <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Subsystem Health</span>
                  <span className="font-bold" style={{ color: selectedNode.health < 50 ? (isLight ? '#be123c' : '#f43f5e') : selectedNode.health < 80 ? (isLight ? '#b45309' : '#fbbf24') : (isLight ? '#047857' : '#34d399') }}>
                    {selectedNode.health}%
                  </span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${selectedNode.health}%`,
                      backgroundColor: selectedNode.health < 50 ? (isLight ? '#be123c' : '#f43f5e') : selectedNode.health < 80 ? (isLight ? '#b45309' : '#fbbf24') : (isLight ? '#047857' : '#34d399'),
                    }}
                  />
                </div>
              </div>

              {/* Dynamic State Text */}
              <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed font-sans ${
                isLight ? 'bg-[#faf7f2] border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-950/80 border-slate-800 text-slate-300'
              }`}>
                <span className={`text-[10px] font-bold block mb-0.5 uppercase tracking-wide ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                  Current Engine State:
                </span>
                {selectedNode.stateDescription}
              </div>

              {/* Tracing Controls */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onSetTraceMode(traceMode === 'upstream' ? 'none' : 'upstream')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    traceMode === 'upstream'
                      ? isLight ? 'bg-[#00a896] text-white border-[#00a896] font-black' : 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : isLight
                      ? 'bg-white text-[#00a896] border-[#00a896]/40 hover:bg-[#00a896]/10'
                      : 'bg-slate-950 text-cyan-400 border-cyan-500/30 hover:bg-cyan-950/40'
                  }`}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
                  Trace Upstream
                </button>
                <button
                  onClick={() => onSetTraceMode(traceMode === 'downstream' ? 'none' : 'downstream')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    traceMode === 'downstream'
                      ? isLight ? 'bg-amber-600 text-white border-amber-600 font-black' : 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : isLight
                      ? 'bg-white text-amber-800 border-amber-400/50 hover:bg-amber-50'
                      : 'bg-slate-950 text-amber-400 border-amber-500/30 hover:bg-amber-950/40'
                  }`}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                  Trace Downstream
                </button>
              </div>

              {/* Upstream & Downstream Dependency Chips */}
              {(selectedNode.upstreamDependencies.length > 0 || selectedNode.downstreamEffects.length > 0) && (
                <div className={`pt-2 border-t space-y-2 ${isLight ? 'border-[#e2ddd1]' : 'border-slate-800/80'}`}>
                  {selectedNode.upstreamDependencies.length > 0 && (
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-[#00a896]' : 'text-cyan-400'}`}>
                        Upstream Sources
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.upstreamDependencies.map((dep, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectNodeById(dep)}
                            className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                              isLight
                                ? 'bg-[#faf7f2] border-[#e2ddd1] text-[#00a896] hover:border-[#00a896]'
                                : 'bg-slate-950 border-cyan-500/30 text-cyan-300 hover:border-cyan-400'
                            }`}
                          >
                            {dep}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.downstreamEffects.length > 0 && (
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                        Downstream Consequents
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.downstreamEffects.map((eff, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectNodeById(eff)}
                            className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                              isLight
                                ? 'bg-[#faf7f2] border-[#e2ddd1] text-amber-800 hover:border-amber-500'
                                : 'bg-slate-950 border-amber-500/30 text-amber-300 hover:border-amber-400'
                            }`}
                          >
                            {eff}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. DIAGNOSIS (Root Cause Candidates & Confidence) */}
        <div className={`rounded-xl border overflow-hidden ${
          isLight ? 'border-[#e2ddd1] bg-[#faf7f2]' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <button
            onClick={() => toggleSection('diagnosis')}
            className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
              isLight ? 'bg-white hover:bg-[#f4efe6]' : 'bg-slate-900/90 hover:bg-slate-800/80'
            }`}
          >
            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-[#0c1117]' : 'text-slate-200'
            }`}>
              <HugeiconsIcon icon={ShieldAlertIcon} size={14} className={isLight ? 'text-rose-700' : 'text-rose-400'} />
              Diagnosis &amp; Root Cause
            </span>
            <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {openSections.diagnosis ? '▲' : '▼'}
            </span>
          </button>

          {openSections.diagnosis && (
            <div className={`p-3 space-y-2 border-t text-xs ${
              isLight ? 'border-[#e2ddd1] bg-white' : 'border-slate-800/80 bg-transparent'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Causal Hypotheses &amp; Posterior Belief
              </span>
              {candidates.map((cand) => (
                <div
                  key={cand.causeId}
                  className={`p-2.5 rounded-lg border space-y-1.5 ${
                    isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-950/90 border-slate-800/90'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{cand.name}</span>
                    <span className={`font-mono text-xs font-black ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                      {cand.confidencePercent}%
                    </span>
                  </div>
                  <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                    <div
                      className={`h-full ${isLight ? 'bg-amber-600' : 'bg-amber-400'}`}
                      style={{ width: `${cand.confidencePercent}%` }}
                    />
                  </div>
                  <ul className={`text-[10px] space-y-0.5 list-disc pl-3.5 pt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {cand.supportingEvidence.map((ev, idx) => (
                      <li key={idx} className={`leading-tight ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {ev}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. PROPAGATION (Downstream victims & time-to-impact) */}
        <div className={`rounded-xl border overflow-hidden ${
          isLight ? 'border-[#e2ddd1] bg-[#faf7f2]' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <button
            onClick={() => toggleSection('propagation')}
            className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
              isLight ? 'bg-white hover:bg-[#f4efe6]' : 'bg-slate-900/90 hover:bg-slate-800/80'
            }`}
          >
            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-[#0c1117]' : 'text-slate-200'
            }`}>
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className={isLight ? 'text-amber-800' : 'text-amber-400'} />
              Propagation Vector
            </span>
            <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {openSections.propagation ? '▲' : '▼'}
            </span>
          </button>

          {openSections.propagation && (
            <div className={`p-3 space-y-2 border-t text-xs ${
              isLight ? 'border-[#e2ddd1] bg-white' : 'border-slate-800/80 bg-transparent'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Next Affected Subsystems &amp; Failure Cascade
              </span>
              <div className="space-y-1.5">
                {propagationSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border flex items-start justify-between gap-2 ${
                      isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-950 border-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{idx + 1}.</span>
                        <span className={`font-bold text-xs ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{step.componentName}</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{step.mechanism}</p>
                    </div>

                    {step.timeToImpactSeconds != null && (
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-black whitespace-nowrap border ${
                        isLight ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        {step.timeToImpactSeconds <= 0 ? 'IMMINENT' : `T -${Math.round(step.timeToImpactSeconds)}s`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. IMPACT (Engine & Mission Risk) */}
        <div className={`rounded-xl border overflow-hidden ${
          isLight ? 'border-[#e2ddd1] bg-[#faf7f2]' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <button
            onClick={() => toggleSection('impact')}
            className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
              isLight ? 'bg-white hover:bg-[#f4efe6]' : 'bg-slate-900/90 hover:bg-slate-800/80'
            }`}
          >
            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-[#0c1117]' : 'text-slate-200'
            }`}>
              <HugeiconsIcon icon={Activity01Icon} size={14} className={isLight ? 'text-purple-700' : 'text-purple-400'} />
              Engine &amp; Mission Consequence
            </span>
            <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {openSections.impact ? '▲' : '▼'}
            </span>
          </button>

          {openSections.impact && (
            <div className={`p-3 space-y-2 border-t text-xs ${
              isLight ? 'border-[#e2ddd1] bg-white' : 'border-slate-800/80 bg-transparent'
            }`}>
              <div className={`p-2.5 rounded-lg border space-y-1 ${
                isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-950 border-slate-800'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                  Shaft Mechanical Impact
                </span>
                <p className={`text-[11px] ${isLight ? 'text-[#0c1117]' : 'text-slate-300'}`}>
                  {missionState.scenarioId === 'cascade' && missionState.timeSeconds >= 75
                    ? 'Parasitic boundary friction dissipating 18.5 kW into crankshaft bearings. Cruise RPM depressed to 4820 RPM.'
                    : 'Mechanical parasitic friction within normal 4-stroke operating boundaries (<2.5 kW).'}
                </p>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-1 ${
                isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-950 border-slate-800'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                  Flight Controller Directive
                </span>
                <p className={`text-[11px] font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-300'}`}>
                  {missionState.scenarioId === 'cascade' && missionState.timeSeconds >= 75
                    ? 'MANDATORY RTB: Execute immediate throttle derate to 65% and return vector to nearest alternate runway.'
                    : 'CONTINUE MISSION: Standard autopilot navigation profile maintainable.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5. EVIDENCE & REASONING TRACE */}
        <div className={`rounded-xl border overflow-hidden ${
          isLight ? 'border-[#e2ddd1] bg-[#faf7f2]' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <button
            onClick={() => toggleSection('reasoning')}
            className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
              isLight ? 'bg-white hover:bg-[#f4efe6]' : 'bg-slate-900/90 hover:bg-slate-800/80'
            }`}
          >
            <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-[#0c1117]' : 'text-slate-200'
            }`}>
              <HugeiconsIcon icon={Layers01Icon} size={14} className={isLight ? 'text-emerald-700' : 'text-emerald-400'} />
              Reasoning Trace (5-Stage)
            </span>
            <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {openSections.reasoning ? '▲' : '▼'}
            </span>
          </button>

          {openSections.reasoning && (
            <div className={`p-3 space-y-2 border-t text-xs ${
              isLight ? 'border-[#e2ddd1] bg-white' : 'border-slate-800/80 bg-transparent'
            }`}>
              {reasoningTrace.map((r, i) => (
                <div key={i} className={`p-2 rounded-lg border space-y-0.5 ${
                  isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-950 border-slate-800/70'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      {i + 1}. {r.phase}
                    </span>
                    <span className={`text-[9px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                      conf: {(r.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className={`text-[11px] font-semibold ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{r.summary}</p>
                  <p className={`text-[10px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{r.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
