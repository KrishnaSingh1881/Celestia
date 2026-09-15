import { useEffect, useMemo, useState } from 'react';
import {
  Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fetchGraphTopology } from '../../lib/api';
import type { GraphTopologyResponse } from '../../types/contracts';

// Five kinds now, not four: `context` = real simengine.twin.contracts.Context
// input fields, `equation` = the real MeanValueTwin/EngineSession processing
// blocks (backend.app.pipeline.architecture_nodes_and_edges()), `observable`
// = the 7 real sensor channels, `component` = the fault causal graph (Beta-
// Bernoulli-learned confidence), `output` = the real PipelineResult fields
// this pipeline actually returns. See that backend function's own comment
// for exactly which edges are real/structural vs. learned/probabilistic.
const KIND_COLOR: Record<string, string> = {
  context: '#8B5CF6',
  equation: '#4285F4',
  observable: '#10B981',
  component: '#1E293B',
  output: '#D97706',
};

const KIND_LABEL: Record<string, string> = {
  context: 'input',
  equation: 'processing',
  observable: 'sensor',
  component: 'fault',
  output: 'output',
};

// Equation-block ids that sit BEFORE the sensor layer (physics prediction)
// vs. AFTER it (detection/diagnosis/prognosis) - kind alone doesn't capture
// pipeline order, so layout needs this explicit staging.
const PREDICTION_EQUATION_IDS = new Set([
  'context_mapping', 'volumetric_efficiency', 'manifold_turbo_response', 'turbo_shaft_relaxation',
  'combustion_surface', 'friction_torque', 'crank_prop_dynamics', 'thermal_network', 'oil_circuit',
  'predicted_channel_synthesis',
]);
const DETECTION_EQUATION_IDS = new Set(['residual_normalization', 'cusum_detection', 'causal_diagnosis']);
const PROGNOSIS_EQUATION_IDS = new Set(['health_index', 'rul_estimation', 'mission_risk']);

function stageOf(id: string, kind: string): number {
  if (kind === 'context') return 0;
  if (PREDICTION_EQUATION_IDS.has(id)) return 1;
  if (kind === 'observable') return 2;
  if (kind === 'component' || DETECTION_EQUATION_IDS.has(id)) return 3;
  if (PROGNOSIS_EQUATION_IDS.has(id)) return 4;
  if (kind === 'output') return 5;
  return 2;
}

function activationGlow(activation: number): string {
  if (activation > 0.65) return '#EF4444';
  if (activation > 0.35) return '#F59E0B';
  return 'transparent';
}

function CauseNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; kind: string; activation: number };
  const base = KIND_COLOR[d.kind] ?? '#64748b';
  const glow = activationGlow(d.activation);
  return (
    <div
      className="px-3 py-2 rounded-xl border-2 bg-white shadow-xs text-center min-w-[124px] max-w-[150px]"
      style={{ borderColor: d.activation > 0.35 ? glow : base, boxShadow: d.activation > 0.35 ? `0 0 0 3px ${glow}22` : undefined }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: base }}>
        {KIND_LABEL[d.kind] ?? d.kind}
      </div>
      <div className="text-[11px] font-black text-slate-800 capitalize leading-tight mt-0.5">{d.label.replaceAll('_', ' ')}</div>
      {d.activation > 0.05 && (
        <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: glow !== 'transparent' ? glow : '#94a3b8' }}>
          {(d.activation * 100).toFixed(0)}%
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { cause: CauseNode };

const STAGE_X = [0, 260, 540, 820, 1120, 1400];
const ROW_HEIGHT = 78;

// Deterministic layered layout (no dagre dependency): every node gets a
// stage (0-5, see stageOf()) that decides its column, then nodes within a
// stage are stacked in id order - dense enough at ~40 nodes that a real
// auto-layout wouldn't buy much over this for the cost of the dependency.
function layoutNodes(topology: GraphTopologyResponse): Node[] {
  const byStage: Record<number, typeof topology.nodes> = {};
  for (const n of topology.nodes) {
    const stage = stageOf(n.id, n.kind);
    (byStage[stage] ?? (byStage[stage] = [])).push(n);
  }
  const nodes: Node[] = [];
  for (const [stageStr, ns] of Object.entries(byStage)) {
    const stage = Number(stageStr);
    const sorted = [...ns].sort((a, b) => a.id.localeCompare(b.id));
    const totalHeight = sorted.length * ROW_HEIGHT;
    sorted.forEach((n, i) => {
      nodes.push({
        id: n.id,
        type: 'cause',
        position: { x: STAGE_X[stage] ?? stage * 280, y: i * ROW_HEIGHT - totalHeight / 2 },
        data: { label: n.id, kind: n.kind, activation: n.activation },
      });
    });
  }
  return nodes;
}

function layoutEdges(topology: GraphTopologyResponse): Edge[] {
  return topology.edges.map((e) => ({
    id: `${e.source}->${e.target}`,
    source: e.source,
    target: e.target,
    animated: e.confidence > 0.5,
    label: e.lag_h > 0 || e.gain !== 1 ? `${(e.confidence * 100).toFixed(0)}%` : undefined,
    labelStyle: { fontSize: 9, fontWeight: 700, fill: '#64748b' },
    style: { stroke: '#cbd5e1', strokeWidth: Math.max(1, e.confidence * 3) },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1', width: 12, height: 12 },
  }));
}

export default function CausalGraphView() {
  const [topology, setTopology] = useState<GraphTopologyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchGraphTopology()
        .then((t) => {
          if (!cancelled) setTopology(t);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    };
    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const nodes = useMemo(() => (topology ? layoutNodes(topology) : []), [topology]);
  const edges = useMemo(() => (topology ? layoutEdges(topology) : []), [topology]);

  if (error) {
    return <div className="card text-sm text-rose-500">Failed to load causal graph: {error}</div>;
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-wrap gap-2">
        <div>
          <span className="section-title">Full System Graph</span>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Inputs → real physics equation blocks → sensors → fault diagnosis → prognosis → outputs. {topology ? `${topology.nodes.length} nodes, ${topology.edges.length} edges.` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-400 flex-wrap">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[kind] }} /> {label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 680 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll
          minZoom={0.25}
        >
          <Background color="#f1f5f9" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
