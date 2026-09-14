import { useEffect, useMemo, useState } from 'react';
import {
  Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fetchGraphTopology } from '../../lib/api';
import type { GraphTopologyResponse } from '../../types/contracts';

const KIND_COLOR: Record<string, string> = {
  component: '#003087',
  parameter: '#FF6B35',
  observable: '#10b981',
  context: '#64748b',
};

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
      className="px-3 py-2 rounded-xl border-2 bg-white shadow-sm text-center min-w-[110px]"
      style={{ borderColor: d.activation > 0.35 ? glow : base, boxShadow: d.activation > 0.35 ? `0 0 0 3px ${glow}22` : undefined }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: base }}>
        {d.kind}
      </div>
      <div className="text-xs font-black text-slate-800 capitalize leading-tight mt-0.5">{d.label.replaceAll('_', ' ')}</div>
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

// Simple deterministic layered layout: components in the middle, parameters
// left, observables right, context along the bottom - since @xyflow/react
// has no built-in auto-layout, and pulling in a full dagre dependency for
// ~15 nodes is not worth the weight.
function layoutNodes(topology: GraphTopologyResponse): Node[] {
  const byKind: Record<string, string[]> = { parameter: [], component: [], observable: [], context: [] };
  for (const n of topology.nodes) {
    (byKind[n.kind] ?? (byKind[n.kind] = [])).push(n.id);
  }
  const colX: Record<string, number> = { parameter: 0, component: 320, observable: 640, context: 320 };
  const nodes: Node[] = [];
  for (const [kind, ids] of Object.entries(byKind)) {
    ids.forEach((id, i) => {
      const n = topology.nodes.find((x) => x.id === id)!;
      const y = kind === 'context' ? 420 + i * 90 : i * 90;
      nodes.push({
        id,
        type: 'cause',
        position: { x: colX[kind] ?? 0, y },
        data: { label: id, kind: n.kind, activation: n.activation },
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
    label: `${(e.confidence * 100).toFixed(0)}%`,
    labelStyle: { fontSize: 9, fontWeight: 700, fill: '#64748b' },
    style: { stroke: '#cbd5e1', strokeWidth: Math.max(1, e.confidence * 3) },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1', width: 14, height: 14 },
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
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="section-title">Causal Health Graph</span>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR.parameter }} /> parameter</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR.component }} /> component</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR.observable }} /> observable</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 460 }}>
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
        >
          <Background color="#f1f5f9" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
