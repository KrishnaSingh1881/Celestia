import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  ClipboardListIcon,
  Compass01Icon,
  CubeIcon,
  Navigation03Icon,
  RefreshIcon,
  ToolsIcon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons';
import { useMissionStore } from '../store/useMissionStore';
import { getActionsForScenario } from '../lib/maintenanceActions';
import { buildCausalTopology } from '../lib/causalGraphData';
import type { MaintenanceActionOption } from '../types/maintenance';
import CausalGraph from '../Components/graph/CausalGraph';
import AffectedComponents from '../Components/graph/AffectedComponents';
import PersistentPrognosisStrip from '../Components/graph/PersistentPrognosisStrip';
import type { AnalysisMode, FilterMode, OverlaySettings, TraceMode } from '../types/causalGraph';

export default function MaintenancePage() {
  const navigate = useNavigate();

  const missionState = useMissionStore((s) => s.missionState);
  const appliedInterventions = useMissionStore((s) => s.appliedInterventions);
  const applyMaintenanceAction = useMissionStore((s) => s.applyMaintenanceAction);
  const resetInterventions = useMissionStore((s) => s.resetInterventions);

  const { scenarioId, healthIndex, subsystemHealth, activeAlert } = missionState;

  const hasInterventions = appliedInterventions.length > 0;
  const latestRecord = hasInterventions ? appliedInterventions[appliedInterventions.length - 1] : null;

  const toggleOverlay = (key: keyof OverlaySettings) => {
    setOverlaySettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ONE LIVE MAINTENANCE-AWARE CAUSAL GRAPH DATA
  const liveGraphData = useMemo(() => {
    if (!hasInterventions) {
      return buildCausalTopology(missionState, [], true);
    }
    return buildCausalTopology(missionState, appliedInterventions, false);
  }, [missionState, appliedInterventions, hasInterventions]);

  // Available deterministic actions for the current scenario
  const availableActions = useMemo(() => getActionsForScenario(scenarioId), [scenarioId]);
  const [selectedActionId, setSelectedActionId] = useState<string>(availableActions[0]?.id ?? '');

  const selectedAction = useMemo(() => {
    return availableActions.find((a) => a.id === selectedActionId) ?? availableActions[0];
  }, [availableActions, selectedActionId]);

  // Predicted Component-Level Health Map for the selected maintenance procedure
  const predictedHealthMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (!selectedAction) return map;
    const effect = selectedAction.reconciliationEffect;

    liveGraphData.nodes.forEach((node) => {
      if (node.id === selectedAction.targetComponentId || effect.resolvedNodeIds.includes(node.id)) {
        if (node.id === 'comp_cooling') {
          map[node.id] = Math.min(100, Math.max(94, node.health + (effect.subsystemHealthDelta?.cooling ?? 50)));
        } else if (node.id === 'comp_cylinder') {
          map[node.id] = Math.min(100, Math.max(92, node.health + (effect.subsystemHealthDelta?.cylinderCore ?? 35)));
        } else if (node.id === 'comp_lubrication') {
          map[node.id] = Math.min(100, Math.max(90, node.health + (effect.subsystemHealthDelta?.lubrication ?? 45)));
        } else {
          map[node.id] = Math.min(100, Math.max(95, node.health + 45));
        }
      } else if (effect.reducedNodeIds.includes(node.id)) {
        map[node.id] = Math.min(94, Math.max(85, node.health + 25));
      }
    });
    return map;
  }, [selectedAction, liveGraphData.nodes]);

  // Related Components & Causal Corridor for the active maintenance action
  const maintenanceRelatedIds = useMemo<string[]>(() => {
    if (!selectedAction) return [];
    const set = new Set<string>();
    set.add(selectedAction.targetComponentId);
    selectedAction.reconciliationEffect.resolvedNodeIds.forEach((id) => set.add(id));
    selectedAction.reconciliationEffect.reducedNodeIds.forEach((id) => set.add(id));
    liveGraphData.edges.forEach((e) => {
      if (e.source === selectedAction.targetComponentId || e.target === selectedAction.targetComponentId) {
        set.add(e.source);
        set.add(e.target);
      }
    });
    return Array.from(set);
  }, [selectedAction, liveGraphData.edges]);

  // Graph interactivity state — default to the target subassembly of the active procedure
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    availableActions[0]?.targetComponentId ?? 'comp_cooling'
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [traceMode, setTraceMode] = useState<TraceMode>('none');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('graph');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    showAttention: true,
    showEdgeWeights: false,
    showCriticality: true,
    showRelationshipTypes: false,
  });

  // Deterministic Reconciliation Progress Animation State
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciliationProgress, setReconciliationProgress] = useState(0);
  const [reconciliationStep, setReconciliationStep] = useState('');

  // Synchronized Selection Handlers
  const handleSelectAction = (action: MaintenanceActionOption) => {
    if (isReconciling || hasInterventions) return;
    setSelectedActionId(action.id);
    setSelectedNodeId(action.targetComponentId);
  };

  const handleSelectComponent = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (!nodeId) return;
    const matchingAction = availableActions.find(
      (a) =>
        a.targetComponentId === nodeId ||
        a.reconciliationEffect.resolvedNodeIds.includes(nodeId) ||
        a.reconciliationEffect.reducedNodeIds.includes(nodeId)
    );
    if (matchingAction && !isReconciling && !hasInterventions) {
      setSelectedActionId(matchingAction.id);
    }
  };

  // Deterministic timed reconciliation sequence
  const handleApplyAction = (action: MaintenanceActionOption) => {
    if (isReconciling || hasInterventions) return;

    setIsReconciling(true);
    setReconciliationProgress(0);
    setReconciliationStep('Initiating ground repair protocol...');

    const steps = [
      { progress: 22, step: 'Isolating physical coolant loop & clearing cowl airflow restriction...' },
      { progress: 48, step: 'Purging radiator core & restoring closed-form thermal convective boundary...' },
      { progress: 74, step: 'Flushing dry-sump oil matrix & verifying hydrodynamic film pressure (4.5 bar)...' },
      { progress: 92, step: 'Recalibrating RTD probe & CHT analytical parity space residuals...' },
      { progress: 100, step: 'Reconciling Causal Graph Bayesian belief & updating Digital Twin...' },
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < steps.length) {
        setReconciliationProgress(steps[currentIdx].progress);
        setReconciliationStep(steps[currentIdx].step);
        currentIdx++;
      } else {
        clearInterval(interval);
        applyMaintenanceAction(action);
        setIsReconciling(false);
      }
    }, 280);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-4 pb-24 select-none"
    >
      {/* 1. Header & Grounded Workstation Context */}
      <div className="rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <HugeiconsIcon icon={ClipboardListIcon} size={18} className="text-amber-400" />
              Celestia / Maintenance & Reconciliation Workstation
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Ground Station Engineering Dock
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap font-mono text-xs">
            {/* Grounded Aircraft Status */}
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-bold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${hasInterventions ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              AIRCRAFT STATUS: <strong className={hasInterventions ? 'text-emerald-400' : 'text-amber-400'}>{hasInterventions ? 'READY' : 'GROUNDED'}</strong>
            </span>

            {/* Maintenance Window / Status */}
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              {hasInterventions ? 'MAINTENANCE STATUS:' : 'MAINTENANCE WINDOW:'}{' '}
              <strong className={hasInterventions ? 'text-emerald-400' : 'text-cyan-400'}>
                {hasInterventions ? 'COMPLETE' : 'ACTIVE'}
              </strong>
            </span>

            {/* Digital Twin State */}
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              TWIN STATE: <strong className={hasInterventions ? 'text-emerald-400' : 'text-rose-400'}>{hasInterventions ? 'RECONCILED' : 'DEGRADED'}</strong>
            </span>
          </div>
        </div>

        {/* Global Controls & Return to Mission Action */}
        <div className="flex items-center gap-2 font-mono text-xs self-start md:self-auto flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
            Scenario: <strong className="text-amber-400 capitalize">{scenarioId}</strong>
          </span>

          {hasInterventions && (
            <>
              <button
                onClick={() => navigate('/mission')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wide transition-all shadow-md hover:shadow-emerald-500/20"
                title="Return to primary mission flight screen with reconciled digital twin state"
              >
                <HugeiconsIcon icon={Navigation03Icon} size={14} strokeWidth={2.4} />
                <span>Return to Mission</span>
              </button>

              <button
                onClick={resetInterventions}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 transition-colors font-bold text-xs"
                title="Reset digital twin state back to scenario failure baseline"
              >
                <HugeiconsIcon icon={RefreshIcon} size={12} />
                Reset Baseline
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. All Major Component & Engine Health Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Overall Health Gauge */}
        <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
              Engine Health
            </span>
            <span className={`font-mono text-xs font-black ${healthIndex < 50 ? 'text-rose-400' : healthIndex < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {healthIndex}%
            </span>
          </div>
          <div className="my-2.5 w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                healthIndex < 50
                  ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                  : healthIndex < 80
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              }`}
              style={{ width: `${healthIndex}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Critical &lt;50%</span>
            <span className={healthIndex >= 80 ? 'text-emerald-400 font-bold' : ''}>
              {healthIndex >= 80 ? '✓ NOMINAL' : 'DEGRADED'}
            </span>
          </div>
        </div>

        {/* Cooling System Health */}
        <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
              Cooling Loop
            </span>
            <span className={`font-mono text-xs font-black ${subsystemHealth.cooling < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {subsystemHealth.cooling}%
            </span>
          </div>
          <div className="my-2.5 w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                subsystemHealth.cooling < 60
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${subsystemHealth.cooling}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Airflow/Core</span>
            <span className={`font-bold ${subsystemHealth.cooling < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {subsystemHealth.cooling < 60 ? 'CRITICAL' : 'RESTORED'}
            </span>
          </span>
        </div>

        {/* Cylinder Core Health */}
        <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
              Cylinders Core
            </span>
            <span className={`font-mono text-xs font-black ${subsystemHealth.cylinderCore < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {subsystemHealth.cylinderCore}%
            </span>
          </div>
          <div className="my-2.5 w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                subsystemHealth.cylinderCore < 60
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${subsystemHealth.cylinderCore}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Thermal Head</span>
            <span className={`font-bold ${subsystemHealth.cylinderCore < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {subsystemHealth.cylinderCore < 60 ? 'CRITICAL' : 'RESTORED'}
            </span>
          </span>
        </div>

        {/* Lubrication Health */}
        <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
              Lubrication
            </span>
            <span className={`font-mono text-xs font-black ${subsystemHealth.lubrication < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {subsystemHealth.lubrication}%
            </span>
          </div>
          <div className="my-2.5 w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                subsystemHealth.lubrication < 60
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${subsystemHealth.lubrication}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Pressure/Film</span>
            <span className={`font-bold ${subsystemHealth.lubrication < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {subsystemHealth.lubrication < 60 ? 'CRITICAL' : 'RESTORED'}
            </span>
          </span>
        </div>

        {/* Digital Twin Fault Status */}
        <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3.5 flex flex-col justify-between">
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
            Twin Fault Status
          </span>
          <div className="my-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border ${
                activeAlert.active
                  ? activeAlert.level === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeAlert.active
                    ? activeAlert.level === 'critical'
                      ? 'bg-rose-400 animate-pulse'
                      : 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
              {activeAlert.active ? activeAlert.code : 'RECONCILED'}
            </span>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{activeAlert.title}</p>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {hasInterventions ? 'All systems nominal' : 'Degradation active'}
          </span>
        </div>

        {/* Prognosis & Remaining Useful Life */}
        <div className="rounded-2xl border border-slate-800 bg-[#090e18] p-3.5 flex flex-col justify-between">
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
            Prognosis & RUL
          </span>
          <div className="flex items-baseline justify-between my-1">
            <div>
              <span className="text-xl font-black font-mono text-slate-100">
                {Math.round(missionState.pipelineResult.rul.q50_h * 60)}
              </span>
              <span className="text-xs text-slate-400 ml-1">mins</span>
            </div>
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                missionState.pipelineResult.rul.q50_h * 60 < 30
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {missionState.pipelineResult.rul.q50_h * 60 < 30 ? 'CRITICAL RTB' : 'MISSION READY'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 line-clamp-1">
            Driver: {missionState.pipelineResult.rul.driver}
          </span>
        </div>
      </div>

      {/* 3. ONE LIVE MAINTENANCE-AWARE CAUSAL GRAPH (HERO COMPONENT) */}
      <div className="rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl space-y-3 relative overflow-hidden">
        {/* Graph Header & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={CubeIcon} size={18} className="text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-100">
                Maintenance-Aware Causal Twin — Live Dynamic Topology
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Evidence → Root Cause → Subsystem → Sensor → State → Risk roll-up along 5 parallel causal corridors.
              {hasInterventions
                ? ' Digital Twin successfully reconciled. Failure corridor collapsed, edge attention reduced, and healthy margin restored.'
                : ' Active failure cascade. Apply targeted maintenance action below to execute physical repair and watch the twin reconcile live.'}
            </p>
          </div>

          {/* Compact Legend & Live Twin Indicator */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[10px] font-mono bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                [RECONCILED]: Resolved
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                [STABILIZED]: Reduced
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-cyan-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                [REDUCED]: Risk Lowered
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                [REMAINING]: Active Fault
              </span>
            </div>

            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1.5 ${
                hasInterventions
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${hasInterventions ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              {hasInterventions ? 'TWIN STATE: RECONCILED' : 'TWIN STATE: ACTIVE FAILURE CASCADE'}
            </span>
          </div>
        </div>

        {/* IN-PLACE RECONCILIATION PROGRESS OVERLAY */}
        <AnimatePresence>
          {isReconciling && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-500/50 shadow-2xl text-xs font-mono space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  RECONCILING DIGITAL TWIN...
                </span>
                <span className="font-black text-amber-400 text-sm">{reconciliationProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-emerald-500"
                  style={{ width: `${reconciliationProgress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="italic">{reconciliationStep}</span>
                <span className="text-slate-500">Deterministic Bayesian Model Re-alignment</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* THE SINGLE LIVE CAUSAL GRAPH (Configured as Ground Maintenance Twin) */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-[#06090f]">
          <CausalGraph
            nodes={liveGraphData.nodes}
            edges={liveGraphData.edges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            traceMode={traceMode}
            analysisMode={analysisMode}
            filterMode={filterMode}
            overlaySettings={overlaySettings}
            onSelectNode={handleSelectComponent}
            onSelectEdge={setSelectedEdgeId}
            onSetTraceMode={setTraceMode}
            onSetFilterMode={setFilterMode}
            onSetAnalysisMode={setAnalysisMode}
            onToggleOverlay={toggleOverlay}
            height={780}
            variant="maintenance"
            maintenanceTargetId={selectedAction?.targetComponentId}
            maintenanceRelatedIds={maintenanceRelatedIds}
            predictedHealthMap={predictedHealthMap}
            selectedActionTitle={selectedAction?.title}
            selectedActionType={selectedAction?.type}
          />
        </div>
      </div>

      {/* 4. AFFECTED COMPONENTS & SELECT MAINTENANCE ACTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Affected Components Table (Interactive with Graph Selection & Predicted Health) */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <HugeiconsIcon icon={Alert02Icon} size={16} className="text-amber-400" />
              Affected Subassemblies & Degradation Matrix
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {hasInterventions ? 'State: Reconciled' : 'State: Degraded'}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            All subassemblies and thermodynamic states actively tracked by the Digital Twin. Click any row to inspect and highlight that node in the causal graph above.
          </p>

          <AffectedComponents
            nodes={liveGraphData.nodes}
            selectedNodeId={selectedNodeId}
            onSelectComponent={handleSelectComponent}
            predictedHealthMap={predictedHealthMap}
            targetComponentId={selectedAction?.targetComponentId}
            relatedComponentIds={maintenanceRelatedIds}
          />
        </div>

        {/* Right: Select Maintenance Action & Expected Physical/Cascade Effect */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl flex flex-col justify-between h-full space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                <HugeiconsIcon icon={ToolsIcon} size={16} className="text-amber-400" />
                Select Ground Maintenance Procedure
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                Action: {selectedAction.type}
              </span>
            </div>

            {/* Action Cards Selection */}
            <div className="space-y-2">
              {availableActions.map((action) => {
                const isSelected = selectedAction.id === action.id;
                const typeBadge =
                  action.type === 'REPAIR'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : action.type === 'REPLACE'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                return (
                  <div
                    key={action.id}
                    onClick={() => handleSelectAction(action)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200">{action.title}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${typeBadge}`}>
                        {action.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{action.description}</p>
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                      <span>Target: <strong className="text-slate-300">{action.targetComponentName}</strong></span>
                      <span className="text-amber-400 font-bold">{isSelected ? '● Selected' : 'Select →'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expected Physical & Cascade Effect */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <HugeiconsIcon icon={Wrench01Icon} size={14} className="text-amber-400" />
                Predicted Physical & Cascade Effect:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                {selectedAction.expectedEffects.map((eff, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-black ${
                          eff.direction === 'up'
                            ? 'text-emerald-400'
                            : eff.direction === 'down'
                            ? 'text-cyan-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {eff.direction === 'up' ? '↑' : eff.direction === 'down' ? '↓' : '→'}
                      </span>
                      <span className="text-slate-200 font-bold text-[11px]">{eff.parameter}</span>
                    </div>
                    <span className="text-slate-400 text-[10px]">{eff.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              disabled={isReconciling || hasInterventions}
              onClick={() => handleApplyAction(selectedAction)}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                hasInterventions
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                  : isReconciling
                  ? 'bg-amber-500/40 text-amber-200 cursor-wait animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 hover:shadow-amber-500/20'
              }`}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.4} />
              <span>
                {hasInterventions
                  ? '✓ Maintenance Applied & Twin Reconciled'
                  : isReconciling
                  ? 'Reconciling Digital Twin...'
                  : 'Apply Repair & Reconcile Digital Twin'}
              </span>
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono">
              Updates the SAME live causal graph, subassembly health, edge attention, telemetry, and prognosis in-place.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Post-Reconciliation Verification Deltas (Before vs After) */}
      <div className="rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Alert02Icon} size={16} className="text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-100">
              Component Health & Causal Belief Reconciliation Matrix
            </span>
          </div>
          {latestRecord ? (
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} />
              Reconciliation Verified at {latestRecord.timestampFormatted}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-500">
              Awaiting Action Execution (Degraded Baseline Active)
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-black uppercase text-slate-400">
                <th className="py-2.5 px-3">Subassembly / Causal Metric</th>
                <th className="py-2.5 px-3">Degraded (Before)</th>
                <th className="py-2.5 px-3">Reconciled (After)</th>
                <th className="py-2.5 px-3">Physical Delta & Belief Shift</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-200">Overall Engine Health Index</td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">
                  {latestRecord ? `${latestRecord.beforeSnapshot.healthIndex}%` : `${healthIndex}%`}
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  {latestRecord ? `${latestRecord.afterSnapshot.healthIndex}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {latestRecord
                    ? `+${latestRecord.afterSnapshot.healthIndex - latestRecord.beforeSnapshot.healthIndex}% Health Recovered`
                    : 'Awaiting execution'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestRecord ? '✓ RECONCILED' : 'PENDING'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-200">Hybrid Cooling System</td>
                <td className="py-2.5 px-3 text-slate-400">
                  {latestRecord
                    ? `${latestRecord.beforeSnapshot.subsystemHealth.cooling}%`
                    : `${subsystemHealth.cooling}%`}
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  {latestRecord ? `${latestRecord.afterSnapshot.subsystemHealth.cooling}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {latestRecord ? 'Cowl restriction cleared; core convective head restored' : 'Restriction active'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestRecord ? '✓ RESTORED' : 'PENDING'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-200">Boxer Cylinder Core</td>
                <td className="py-2.5 px-3 text-slate-400">
                  {latestRecord
                    ? `${latestRecord.beforeSnapshot.subsystemHealth.cylinderCore}%`
                    : `${subsystemHealth.cylinderCore}%`}
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  {latestRecord ? `${latestRecord.afterSnapshot.subsystemHealth.cylinderCore}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {latestRecord ? 'Thermal head margin restored below 106°C baseline' : 'Thermal saturation'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestRecord ? '✓ RESTORED' : 'PENDING'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-200">Dry-Sump Lubrication Matrix</td>
                <td className="py-2.5 px-3 text-slate-400">
                  {latestRecord
                    ? `${latestRecord.beforeSnapshot.subsystemHealth.lubrication}%`
                    : `${subsystemHealth.lubrication}%`}
                </td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  {latestRecord ? `${latestRecord.afterSnapshot.subsystemHealth.lubrication}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {latestRecord ? 'Viscosity shear mitigated; line pressure 4.5 bar nominal' : 'Viscosity thin (<6 cSt)'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestRecord ? '✓ RESTORED' : 'PENDING'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-200">Active Failure Cascade Edges</td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">12 Active Edges</td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  {latestRecord ? '0 Active Edges' : '—'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {latestRecord ? 'Failure propagation corridor collapsed; edges quiet' : 'Cascading propagation'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestRecord ? '✓ COLLAPSED' : 'ACTIVE'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-200">Peak Causal Edge Attention</td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">0.91 ↑ (Tripped)</td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">
                  {latestRecord ? '0.18 ↓ (Nominal)' : '—'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {latestRecord ? 'Dynamic Bayesian attention weight lowered to nominal baseline' : 'Heightened attention'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {latestRecord ? '✓ QUIET' : 'ACTIVE'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Updated Prognosis Engine Strip */}
      <PersistentPrognosisStrip missionState={missionState} />

      {/* 7. Maintenance History Event Log */}
      <div className="rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
            <HugeiconsIcon icon={Compass01Icon} size={16} className="text-amber-400" />
            Maintenance Event History Timeline
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Total Logged Procedures: <strong className="text-slate-200">{appliedInterventions.length}</strong>
          </span>
        </div>

        {appliedInterventions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-mono">
            No maintenance procedures executed yet for this grounded aircraft window. Select an action above to execute and log.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/80 font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-black uppercase text-slate-400">
                  <th className="py-2 px-3">Timeline</th>
                  <th className="py-2 px-3">Procedure Title</th>
                  <th className="py-2 px-3">Target Assembly</th>
                  <th className="py-2 px-3">Reconciliation Result</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {appliedInterventions.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 text-slate-400">{rec.timestampFormatted}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-200">{rec.action.title}</td>
                    <td className="py-2.5 px-3 text-amber-300">{rec.action.targetComponentName}</td>
                    <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                      {rec.action.reconciliationEffect.summaryResult}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
