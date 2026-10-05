import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  RadioIcon,
} from '@hugeicons/core-free-icons';
import { useMissionStore } from '../store/useMissionStore';
import { useThemeStore } from '../store/useThemeStore';
import { buildCausalTopology } from '../lib/causalGraphData';
import CausalGraph from '../Components/graph/CausalGraph';
import AffectedComponents from '../Components/graph/AffectedComponents';
import DiagnosticDrawer from '../Components/graph/DiagnosticDrawer';
import PersistentPrognosisStrip from '../Components/graph/PersistentPrognosisStrip';
import EdgeWeightsPanel from '../Components/graph/EdgeWeightsPanel';
import SensorGrid from '../Components/insights/SensorGrid';
import type {
  AnalysisMode,
  FilterMode,
  OverlaySettings,
  TraceMode,
} from '../types/causalGraph';

export default function SensorMonitoring() {
  const missionState = useMissionStore((s) => s.missionState);
  const appliedInterventions = useMissionStore((s) => s.appliedInterventions);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';
  const { scenarioId, timeSeconds } = missionState;

  // Build authentic Celestia causal topology
  const { nodes, edges } = useMemo(
    () => buildCausalTopology(missionState, appliedInterventions),
    [missionState, appliedInterventions]
  );

  // Workspace interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('comp_cooling');
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

  const toggleOverlay = (key: keyof OverlaySettings) => {
    setOverlaySettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectComponent = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setTraceMode('downstream');
  };

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  // Active cascade headline narrative
  const cascadeNarrative = useMemo(() => {
    if (scenarioId === 'cascade') {
      if (timeSeconds < 20) {
        return {
          title: 'NOMINAL BASELINE CRUISE',
          flow: ['Ram-air Cooling', 'Head Thermal Equilibrium', 'Dry-Sump Lubrication', 'Nominal Cruise Governor (5500 RPM)'],
          severity: 'nominal',
        };
      } else if (timeSeconds < 45) {
        return {
          title: 'ACTIVE CASCADE: COOLING RESTRICTION',
          flow: ['Cooling Duct Airflow Choked (-73%)', 'Coolant Manifold Surge (+34°C)', 'Head Thermal Saturation (128°C)', 'Secondary Oil Heat Transfer'],
          severity: 'warning',
        };
      } else if (timeSeconds < 75) {
        return {
          title: 'ACTIVE CASCADE: THERMAL BLEED & LUBRICATION COLLAPSE',
          flow: ['Cylinder Head Boiling Threshold', 'Oil Bulk Temp 128°C', 'Viscosity Sheared to 5.2 cSt', 'Gallery Pressure Sag (1.6 bar)'],
          severity: 'critical',
        };
      } else {
        return {
          title: 'ACTIVE CASCADE: BEARING BOUNDARY SEIZURE & DRAG',
          flow: ['Hydrodynamic Film Loss', 'Crankshaft Micro-Scuffing (0.44g)', 'Parasitic Drag (-680 RPM)', 'MANDATORY EMERGENCY RTB'],
          severity: 'emergency',
        };
      }
    } else if (scenarioId === 'sensor') {
      return {
        title: 'SENSOR ANOMALY ISOLATED (PARITY SPACE VERIFIED)',
        flow: ['CHT-1 Drift (+36°C)', 'Parity Residual z=+4.8σ', 'Multi-Channel Discrepancy', 'Physical Core 100% Intact', 'MISSION CONTINUES'],
        severity: 'sensor_fault',
      };
    } else if (scenarioId === 'thermal') {
      return {
        title: 'THERMAL SATURATION LIMIT REACHED',
        flow: ['Ambient Heat Sink Depleted', 'Cooling System Thermal Saturation', 'CHT Surge', 'Throttle Derating Recommended'],
        severity: 'warning',
      };
    } else if (scenarioId === 'lubrication') {
      return {
        title: 'DRY-SUMP OIL PUMP CAVITATION',
        flow: ['Scavenge Aeration', 'Pressure Loss (<2.0 bar)', 'Bearing Boundary Contact', 'Immediate Precautionary Landing'],
        severity: 'critical',
      };
    }

    return {
      title: 'CLOSED-LOOP NOMINAL CRUISE EQUILIBRIUM',
      flow: ['Combustion Stoichiometry', 'Ram-Air Dissipation', 'Hydrodynamic Film Separation', 'Autopilot Navigation'],
      severity: 'nominal',
    };
  }, [scenarioId, timeSeconds]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-4 pb-20 select-none"
    >
      {/* 1. Header & Active Cascade Banner */}
      <div className={`rounded-2xl border p-4 shadow-xl flex flex-col gap-3 transition-colors ${
        isLight ? 'border-[#e2ddd1] bg-white text-[#0c1117] shadow-md' : 'border-slate-800 bg-[#070b13] text-slate-100 shadow-xl'
      }`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3 ${
          isLight ? 'border-[#e2ddd1]' : 'border-slate-800/80'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-[#0c1117]' : 'text-slate-100'
              }`}>
                <HugeiconsIcon icon={RadioIcon} size={18} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
                Causal Intelligence Workspace
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                isLight ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                Diagnosis + Prognosis
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Live directed causal network mapping evidence, root causes, physical subsystems, sensors, failure states, and mission consequences.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs self-start md:self-auto">
            <span className={`px-2.5 py-1 rounded-lg border ${
              isLight ? 'bg-[#faf7f2] border-[#e2ddd1] text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              Scenario: <strong className={isLight ? 'text-amber-800 capitalize' : 'text-amber-400 capitalize'}>{scenarioId}</strong>
            </span>
            <span className={`px-2.5 py-1 rounded-lg border ${
              isLight ? 'bg-[#faf7f2] border-[#e2ddd1] text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              Timeline: <strong className={isLight ? 'text-[#0c1117]' : 'text-slate-200'}>{timeSeconds.toFixed(1)}s</strong>
            </span>
          </div>
        </div>

        {/* Active Cascade Propagation Path */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${cascadeNarrative.severity === 'emergency' || cascadeNarrative.severity === 'critical' ? 'bg-rose-500 animate-pulse' : cascadeNarrative.severity === 'warning' ? 'bg-amber-400 animate-pulse' : cascadeNarrative.severity === 'sensor_fault' ? 'bg-cyan-400' : 'bg-emerald-400'}`} />
            <span className={`font-black uppercase tracking-wide text-xs ${
              cascadeNarrative.severity === 'emergency' || cascadeNarrative.severity === 'critical'
                ? isLight ? 'text-rose-700' : 'text-rose-400'
                : cascadeNarrative.severity === 'warning'
                ? isLight ? 'text-amber-800' : 'text-amber-400'
                : cascadeNarrative.severity === 'sensor_fault'
                ? isLight ? 'text-cyan-800' : 'text-cyan-400'
                : isLight ? 'text-emerald-800' : 'text-emerald-400'
            }`}>
              {cascadeNarrative.title}
            </span>
          </div>

          {/* Sequential Step Nodes */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
            {cascadeNarrative.flow.map((step, idx) => (
              <React.Fragment key={idx}>
                <span className={`px-2 py-0.5 rounded-md border whitespace-nowrap shadow-2xs ${
                  isLight ? 'bg-[#faf7f2] border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}>
                  {step}
                </span>
                {idx < cascadeNarrative.flow.length - 1 && (
                  <HugeiconsIcon icon={ArrowRight01Icon} size={12} className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Real-time Telemetry Sensor Strip */}
      <SensorGrid />

      {/* 3. Main Workspace: Causal Graph (Left) + Diagnostic Drawer (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Graph Canvas */}
        <div className="xl:col-span-8 2xl:col-span-9">
          <CausalGraph
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            traceMode={traceMode}
            analysisMode={analysisMode}
            filterMode={filterMode}
            overlaySettings={overlaySettings}
            onSelectNode={setSelectedNodeId}
            onSelectEdge={setSelectedEdgeId}
            onSetTraceMode={setTraceMode}
            onSetFilterMode={setFilterMode}
            onSetAnalysisMode={setAnalysisMode}
            onToggleOverlay={toggleOverlay}
          />
        </div>

        {/* Diagnostic / Analytical Contextual Drawer & Affected Components */}
        <div className="xl:col-span-4 2xl:col-span-3 flex flex-col gap-4">
          <AffectedComponents
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectComponent={handleSelectComponent}
          />
          <div className="h-[640px]">
            <DiagnosticDrawer
              selectedNode={selectedNode}
              missionState={missionState}
              traceMode={traceMode}
              onSetTraceMode={setTraceMode}
              onSelectNodeById={setSelectedNodeId}
            />
          </div>
        </div>
      </div>

      {/* 4. Persistent Prognosis Engine Strip (Always Visible!) */}
      <PersistentPrognosisStrip missionState={missionState} />

      {/* 5. Changing Graph Weights & Attention Panel (USP) */}
      <EdgeWeightsPanel
        edges={edges}
        selectedEdgeId={selectedEdgeId}
        onSelectEdge={setSelectedEdgeId}
      />
    </motion.div>
  );
}
