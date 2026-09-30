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
        return { label: 'CRITICAL', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' };
      case 'warning':
        return { label: 'WARNING', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
      case 'sensor_fault':
        return { label: 'SENSOR FAULT', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' };
      case 'nominal':
      default:
        return { label: 'NOMINAL', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    }
  };

  if (!selectedNode) {
    return (
      <div className="h-full rounded-2xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
        <HugeiconsIcon icon={HelpCircleIcon} size={36} className="text-slate-600 mb-3" />
        <span className="font-bold text-slate-300 text-sm">No Graph Node Selected</span>
        <p className="mt-1 text-slate-500 max-w-xs leading-relaxed">
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
    <div className="h-full flex flex-col rounded-2xl border border-slate-800 bg-[#070b12] shadow-2xl overflow-hidden text-slate-200">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: regionCfg.color }} />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
            {regionCfg.label}
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-[10px] font-mono text-slate-400">{selectedNode.subType}</span>
        </div>

        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${crit.bg}`}>
          {crit.label}
        </span>
      </div>

      {/* Scrollable Accordion Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* 1. SELECTED NODE SUMMARY */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <button
            onClick={() => toggleSection('node')}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/90 text-left hover:bg-slate-800/80 transition-colors"
          >
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <HugeiconsIcon icon={Target02Icon} size={14} className="text-sky-400" />
              Selected Node
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {openSections.node ? '▲' : '▼'}
            </span>
          </button>

          {openSections.node && (
            <div className="p-3 space-y-2.5 border-t border-slate-800/80 text-xs">
              <div>
                <h4 className="text-sm font-black text-slate-100">{selectedNode.label}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {selectedNode.functionDescription}
                </p>
              </div>

              {/* Health Progress Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                  <span className="text-slate-400">Subsystem Health</span>
                  <span className="font-bold" style={{ color: selectedNode.health < 50 ? '#f43f5e' : selectedNode.health < 80 ? '#fbbf24' : '#34d399' }}>
                    {selectedNode.health}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${selectedNode.health}%`,
                      backgroundColor: selectedNode.health < 50 ? '#f43f5e' : selectedNode.health < 80 ? '#fbbf24' : '#34d399',
                    }}
                  />
                </div>
              </div>

              {/* Dynamic State Text */}
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 leading-relaxed font-sans">
                <span className="text-[10px] font-bold text-amber-400 block mb-0.5 uppercase tracking-wide">
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
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
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
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-slate-950 text-amber-400 border-amber-500/30 hover:bg-amber-950/40'
                  }`}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                  Trace Downstream
                </button>
              </div>

              {/* Upstream & Downstream Dependency Chips */}
              {(selectedNode.upstreamDependencies.length > 0 || selectedNode.downstreamEffects.length > 0) && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  {selectedNode.upstreamDependencies.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                        Upstream Sources
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.upstreamDependencies.map((dep, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectNodeById(dep)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 transition-colors"
                          >
                            {dep}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.downstreamEffects.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                        Downstream Consequents
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.downstreamEffects.map((eff, idx) => (
                          <button
                            key={idx}
                            onClick={() => onSelectNodeById(eff)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-amber-500/30 text-amber-300 hover:border-amber-400 transition-colors"
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <button
            onClick={() => toggleSection('diagnosis')}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/90 text-left hover:bg-slate-800/80 transition-colors"
          >
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <HugeiconsIcon icon={ShieldAlertIcon} size={14} className="text-rose-400" />
              Diagnosis &amp; Root Cause
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {openSections.diagnosis ? '▲' : '▼'}
            </span>
          </button>

          {openSections.diagnosis && (
            <div className="p-3 space-y-2 border-t border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Causal Hypotheses &amp; Posterior Belief
              </span>
              {candidates.map((cand) => (
                <div
                  key={cand.causeId}
                  className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-xs">{cand.name}</span>
                    <span className="font-mono text-xs font-black text-amber-400">
                      {cand.confidencePercent}%
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${cand.confidencePercent}%` }}
                    />
                  </div>
                  <ul className="text-[10px] text-slate-400 space-y-0.5 list-disc pl-3.5 pt-0.5">
                    {cand.supportingEvidence.map((ev, idx) => (
                      <li key={idx} className="leading-tight text-slate-300">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <button
            onClick={() => toggleSection('propagation')}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/90 text-left hover:bg-slate-800/80 transition-colors"
          >
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-amber-400" />
              Propagation Vector
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {openSections.propagation ? '▲' : '▼'}
            </span>
          </button>

          {openSections.propagation && (
            <div className="p-3 space-y-2 border-t border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Next Affected Subsystems &amp; Failure Cascade
              </span>
              <div className="space-y-1.5">
                {propagationSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-500">{idx + 1}.</span>
                        <span className="font-bold text-slate-200 text-xs">{step.componentName}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{step.mechanism}</p>
                    </div>

                    {step.timeToImpactSeconds != null && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded font-black whitespace-nowrap bg-rose-500/20 text-rose-400 border border-rose-500/30">
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <button
            onClick={() => toggleSection('impact')}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/90 text-left hover:bg-slate-800/80 transition-colors"
          >
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <HugeiconsIcon icon={Activity01Icon} size={14} className="text-purple-400" />
              Engine &amp; Mission Consequence
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {openSections.impact ? '▲' : '▼'}
            </span>
          </button>

          {openSections.impact && (
            <div className="p-3 space-y-2 border-t border-slate-800/80 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Shaft Mechanical Impact
                </span>
                <p className="text-[11px] text-slate-300">
                  {missionState.scenarioId === 'cascade' && missionState.timeSeconds >= 75
                    ? 'Parasitic boundary friction dissipating 18.5 kW into crankshaft bearings. Cruise RPM depressed to 4820 RPM.'
                    : 'Mechanical parasitic friction within normal 4-stroke operating boundaries (<2.5 kW).'}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                  Flight Controller Directive
                </span>
                <p className="text-[11px] text-slate-300 font-mono">
                  {missionState.scenarioId === 'cascade' && missionState.timeSeconds >= 75
                    ? 'MANDATORY RTB: Execute immediate throttle derate to 65% and return vector to nearest alternate runway.'
                    : 'CONTINUE MISSION: Standard autopilot navigation profile maintainable.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5. EVIDENCE & REASONING TRACE */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <button
            onClick={() => toggleSection('reasoning')}
            className="w-full px-3 py-2 flex items-center justify-between bg-slate-900/90 text-left hover:bg-slate-800/80 transition-colors"
          >
            <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <HugeiconsIcon icon={Layers01Icon} size={14} className="text-emerald-400" />
              Reasoning Trace (5-Stage)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {openSections.reasoning ? '▲' : '▼'}
            </span>
          </button>

          {openSections.reasoning && (
            <div className="p-3 space-y-2 border-t border-slate-800/80 text-xs">
              {reasoningTrace.map((r, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800/70 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400">
                      {i + 1}. {r.phase}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      conf: {(r.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-200">{r.summary}</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{r.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
