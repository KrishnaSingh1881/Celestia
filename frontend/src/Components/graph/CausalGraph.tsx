import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FilterIcon,
  RefreshIcon,
  Search01Icon,
  SlidersHorizontalIcon,
} from '@hugeicons/core-free-icons';
import {
  REGION_CONFIG,
  getDownstreamNodeIds,
  getUpstreamNodeIds,
} from '../../lib/causalGraphData';
import {
  computeParallelCausalLanes,
  PARALLEL_LANE_Y,
  LANE_NAMES,
  REGION_X_POSITIONS,
} from '../../lib/causalLaneLayout';
import type {
  AnalysisMode,
  CausalEdgeData,
  CausalNodeData,
  FilterMode,
  OverlaySettings,
  TraceMode,
} from '../../types/causalGraph';

const GRAPH_WIDTH = 1480;
const GRAPH_HEIGHT = 1180;
const REGION_X = REGION_X_POSITIONS;

interface CausalGraphProps {
  nodes: CausalNodeData[];
  edges: CausalEdgeData[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  traceMode: TraceMode;
  analysisMode: AnalysisMode;
  filterMode: FilterMode;
  overlaySettings: OverlaySettings;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onSetTraceMode: (mode: TraceMode) => void;
  onSetFilterMode: (mode: FilterMode) => void;
  onSetAnalysisMode: (mode: AnalysisMode) => void;
  onToggleOverlay: (key: keyof OverlaySettings) => void;
  height?: number | string;
  hideToolbar?: boolean;
  variant?: 'analytical' | 'maintenance';
  maintenanceTargetId?: string | null;
  maintenanceRelatedIds?: string[];
  predictedHealthMap?: Record<string, number>;
  selectedActionTitle?: string;
  selectedActionType?: string;
}

export default function CausalGraph({
  nodes: dynamicNodes,
  edges: dynamicEdges,
  selectedNodeId,
  selectedEdgeId,
  traceMode,
  analysisMode,
  filterMode,
  overlaySettings,
  onSelectNode,
  onSelectEdge,
  onSetTraceMode,
  onSetFilterMode,
  onSetAnalysisMode,
  onToggleOverlay,
  height,
  hideToolbar = false,
  variant = 'analytical',
  maintenanceTargetId,
  maintenanceRelatedIds,
  predictedHealthMap,
  selectedActionTitle,
  selectedActionType,
}: CausalGraphProps) {
  // Simulation physics refs
  const nodesRef = useRef<CausalNodeData[]>([]);
  const edgesRef = useRef<CausalEdgeData[]>([]);
  const alphaRef = useRef(1.0);
  const draggingRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, forceTick] = useState(0);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [overlaysOpen, setOverlaysOpen] = useState(false);

  // Initialize nodes into parallel causal lanes with lane continuity across columns
  useEffect(() => {
    const layoutMap = computeParallelCausalLanes(
      dynamicNodes,
      dynamicEdges,
      GRAPH_WIDTH,
      GRAPH_HEIGHT
    );
    const existingMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    const initialized: CausalNodeData[] = dynamicNodes.map((node) => {
      const existing = existingMap.get(node.id);
      const laneCoord = layoutMap.get(node.id);
      const targetX = laneCoord?.x ?? REGION_X[node.regionIndex] ?? 110;
      const targetY = laneCoord?.y ?? GRAPH_HEIGHT / 2;
      const radius = node.region === 'subsystems' || node.region === 'risk_rollup' ? 24 : 20;

      return {
        ...node,
        radius,
        x: existing?.x ?? targetX,
        y: existing?.y ?? targetY,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
      };
    });

    nodesRef.current = initialized;
    edgesRef.current = dynamicEdges;
    alphaRef.current = 1.0;
    forceTick((t) => t + 1);
  }, [dynamicNodes.length]);

  // Keep state and telemetry synchronized without resetting positions
  useEffect(() => {
    const freshMap = new Map(dynamicNodes.map((n) => [n.id, n]));
    nodesRef.current = nodesRef.current.map((n) => {
      const fresh = freshMap.get(n.id);
      if (!fresh) return n;
      return {
        ...n,
        stateDescription: fresh.stateDescription,
        health: fresh.health,
        criticality: fresh.criticality,
        activation: fresh.activation,
        telemetry: fresh.telemetry,
        evidence: fresh.evidence,
        reconciliationStatus: fresh.reconciliationStatus,
      };
    });
    edgesRef.current = dynamicEdges;
    forceTick((t) => t + 1);
  }, [dynamicNodes, dynamicEdges]);

  // Controlled force simulation settling (settles quickly in ~35 frames and stops - no continuous background loop)
  useEffect(() => {
    let animId: number;

    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const alpha = alphaRef.current;

      if (alpha > 0.005) {
        const layoutMap = computeParallelCausalLanes(nodes, edges, GRAPH_WIDTH, GRAPH_HEIGHT);

        // 1. Strong restoring force keeping nodes strictly anchored in their designated parallel causal lanes
        nodes.forEach((n) => {
          if (n.x == null || n.y == null) return;

          if (n.fx != null && n.fy != null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
            return;
          }

          const laneCoord = layoutMap.get(n.id);
          const targetX = laneCoord?.x ?? REGION_X[n.regionIndex] ?? 110;
          const targetY = laneCoord?.y ?? GRAPH_HEIGHT / 2;

          n.vx = (n.vx ?? 0) + (targetX - n.x) * 0.18 * alpha;
          n.vy = (n.vy ?? 0) + (targetY - n.y) * 0.16 * alpha;

          // Damping
          n.vx = (n.vx ?? 0) * 0.72;
          n.vy = (n.vy ?? 0) * 0.72;

          n.x += n.vx;
          n.y += n.vy;

          const r = n.radius ?? 20;
          n.x = Math.max(r + 25, Math.min(GRAPH_WIDTH - r - 25, n.x));
          n.y = Math.max(r + 55, Math.min(GRAPH_HEIGHT - r - 35, n.y));
        });

        // 2. Pairwise repulsion to prevent local collisions between sub-lane neighbors
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = Math.max(25, dx * dx + dy * dy);
            if (distSq > 50000) continue;

            const dist = Math.sqrt(distSq);
            const minClearance = (a.radius ?? 20) + (b.radius ?? 20) + 40;
            if (dist < minClearance) {
              const force = (3000 * alpha) / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (a.fx == null) {
                a.vx = (a.vx ?? 0) - fx;
                a.vy = (a.vy ?? 0) - fy;
              }
              if (b.fx == null) {
                b.vx = (b.vx ?? 0) + fx;
                b.vy = (b.vy ?? 0) + fy;
              }
            }
          }
        }

        alphaRef.current *= 0.91; // rapidly cools down and settles
        forceTick((t) => t + 1);
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  // SVG coordinate transformation
  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * GRAPH_WIDTH,
      y: ((clientY - rect.top) / rect.height) * GRAPH_HEIGHT,
    };
  };

  const handlePointerDown = (nodeId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = nodeId;
    alphaRef.current = 0.5;

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      const p = toSvgPoint(e.clientX, e.clientY);
      node.fx = p.x;
      node.fy = p.y;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const id = draggingRef.current;
    if (!id) return;
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    node.fx = p.x;
    node.fy = p.y;
    forceTick((t) => t + 1);
  };

  const handlePointerUp = () => {
    const id = draggingRef.current;
    if (id) {
      const node = nodesRef.current.find((n) => n.id === id);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    draggingRef.current = null;
  };

  const handleResetLayout = () => {
    alphaRef.current = 0.8;
    nodesRef.current.forEach((n) => {
      n.fx = null;
      n.fy = null;
      n.vx = 0;
      n.vy = 0;
    });
    forceTick((t) => t + 1);
  };

  // Automatic Causal Corridor (Upstream Causes + Selected Node + Downstream Effects - Requirements 4, 8, 9)
  const { corridorNodeIds, corridorEdgeIds, upstreamNodeIds, downstreamNodeIds } = useMemo(() => {
    if (!selectedNodeId) {
      return {
        corridorNodeIds: new Set<string>(),
        corridorEdgeIds: new Set<string>(),
        upstreamNodeIds: new Set<string>(),
        downstreamNodeIds: new Set<string>(),
      };
    }

    const up = getUpstreamNodeIds(selectedNodeId, edgesRef.current);
    const down = getDownstreamNodeIds(selectedNodeId, edgesRef.current);
    const cNodes = new Set<string>([selectedNodeId, ...up, ...down]);

    if (variant === 'maintenance' && maintenanceRelatedIds && maintenanceRelatedIds.length > 0) {
      maintenanceRelatedIds.forEach((id) => cNodes.add(id));
    }

    const cEdges = new Set<string>();

    edgesRef.current.forEach((e) => {
      if (cNodes.has(e.source) && cNodes.has(e.target)) {
        cEdges.add(e.id);
      }
    });

    return {
      corridorNodeIds: cNodes,
      corridorEdgeIds: cEdges,
      upstreamNodeIds: up,
      downstreamNodeIds: down,
    };
  }, [selectedNodeId, dynamicEdges, variant, maintenanceRelatedIds]);

  // Selected node details and connected attention edges for inspector
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodesRef.current.find((n) => n.id === selectedNodeId) ?? null;
  }, [nodesRef.current, selectedNodeId]);

  const selectedNodeConnectedEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edgesRef.current.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [edgesRef.current, selectedNodeId]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  // Filtered nodes based on filterMode & search
  const visibleNodeIds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return new Set(
      nodes
        .filter((n) => {
          if (filterMode === 'active_path' && n.activation < 0.25) return false;
          if (filterMode === 'anomalies' && n.criticality === 'nominal') return false;
          if (filterMode === 'critical' && n.criticality !== 'critical') return false;
          if (q && !n.label.toLowerCase().includes(q) && !n.functionDescription.toLowerCase().includes(q)) {
            return false;
          }
          return true;
        })
        .map((n) => n.id)
    );
  }, [nodes, filterMode, searchQuery]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#06090f] shadow-2xl overflow-hidden relative">
      {/* 1. Header Bar: Ground Maintenance Twin Bar vs Analytical Mode Bar */}
      {variant === 'maintenance' ? (
        <div className="p-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-950/25 via-slate-900 to-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase font-mono tracking-wider">
              Ground Maintenance Twin
            </span>
            {selectedActionType && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-amber-300 font-mono font-bold">
                {selectedActionType}
              </span>
            )}
            {selectedActionTitle && (
              <span className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
                <span className="text-slate-400 font-normal">Procedure:</span>
                <span className="text-amber-400">{selectedActionTitle}</span>
              </span>
            )}
            {maintenanceTargetId && (
              <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                <span className="text-slate-500">Target Subassembly:</span>
                <strong className="text-sky-300 font-bold">
                  {nodes.find((n) => n.id === maintenanceTargetId)?.label ?? maintenanceTargetId}
                </strong>
                {nodes.find((n) => n.id === maintenanceTargetId) && (
                  <span className="ml-1 text-[11px] font-bold text-amber-300">
                    ({nodes.find((n) => n.id === maintenanceTargetId)!.health}%
                    {predictedHealthMap?.[maintenanceTargetId] &&
                    nodes.find((n) => n.id === maintenanceTargetId)!.health < predictedHealthMap[maintenanceTargetId]
                      ? ` → ${predictedHealthMap[maintenanceTargetId]}%`
                      : ''}
                    )
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5 text-sky-300 font-bold">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-sky-400 bg-sky-950" />
              Target Subassembly
            </span>
            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Impacted / Related Corridor
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-100 font-bold">XX%</span>
              Individual Component Health
            </span>
            <button
              onClick={handleResetLayout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 ml-1"
              title="Re-settle force simulation"
            >
              <HugeiconsIcon icon={RefreshIcon} size={12} />
            </button>
          </div>
        </div>
      ) : !hideToolbar ? (
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Analytical Emphasis Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['graph', 'diagnosis', 'propagation', 'impact'] as AnalysisMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAnalysisMode(mode)}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  analysisMode === mode
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <HugeiconsIcon icon={FilterIcon} size={12} /> Filter:
            </span>
            {(['all', 'active_path', 'anomalies', 'critical'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => onSetFilterMode(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  filterMode === f
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}

            {traceMode !== 'none' && (
              <button
                onClick={() => onSetTraceMode('none')}
                className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 flex items-center gap-1 transition-colors"
                title="Clear active trace"
              >
                <span>Trace: {traceMode}</span>
                <span className="text-xs">×</span>
              </button>
            )}

            {/* Overlays Dropdown Toggle */}
            <div className="relative">
              <button
                onClick={() => setOverlaysOpen(!overlaysOpen)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 transition-colors"
              >
                <HugeiconsIcon icon={SlidersHorizontalIcon} size={12} />
                <span>Overlays ▼</span>
              </button>

              {overlaysOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 p-2 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-40 space-y-1 text-slate-300 text-[11px]">
                  <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800/60 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlaySettings.showAttention}
                      onChange={() => onToggleOverlay('showAttention')}
                      className="accent-amber-500"
                    />
                    <span>Edge Attention (USP)</span>
                  </label>
                  <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800/60 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlaySettings.showEdgeWeights}
                      onChange={() => onToggleOverlay('showEdgeWeights')}
                      className="accent-amber-500"
                    />
                    <span>Base Physics Weights</span>
                  </label>
                  <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800/60 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlaySettings.showCriticality}
                      onChange={() => onToggleOverlay('showCriticality')}
                      className="accent-amber-500"
                    />
                    <span>Node Criticality Badges</span>
                  </label>
                  <label className="flex items-center gap-2 p-1.5 hover:bg-slate-800/60 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlaySettings.showRelationshipTypes}
                      onChange={() => onToggleOverlay('showRelationshipTypes')}
                      className="accent-amber-500"
                    />
                    <span>Relationship Types</span>
                  </label>
                </div>
              )}
            </div>

            {/* Search Box */}
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Search graph..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2.5 py-1 rounded-lg text-[10px] bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500/60 w-28 sm:w-36"
              />
            </div>

            <button
              onClick={handleResetLayout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800"
              title="Re-settle force simulation"
            >
              <HugeiconsIcon icon={RefreshIcon} size={12} />
            </button>
          </div>
        </div>
      ) : null}

      {/* 2. Interactive SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        width="100%"
        height={height ?? GRAPH_HEIGHT}
        style={{
          display: 'block',
          touchAction: 'none',
          background: 'radial-gradient(ellipse at center, #090f1a 0%, #05080e 100%)',
          maxHeight: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <marker
            id="arrow-nominal"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" />
          </marker>
          <marker
            id="arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
          </marker>
          <marker
            id="arrow-traced-up"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06b6d4" />
          </marker>
          <marker
            id="arrow-traced-down"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* 5 Parallel Causal Lane Guide Corridors (Horizontal Highways) */}
        {PARALLEL_LANE_Y.map((ly, lIdx) => (
          <g key={`corridor-${lIdx}`}>
            {/* Subtle shaded horizontal corridor band */}
            <rect
              x={25}
              y={ly - 70}
              width={GRAPH_WIDTH - 50}
              height={140}
              fill={lIdx % 2 === 0 ? '#0b121e' : '#070c16'}
              rx={14}
              opacity={0.4}
            />
            <line
              x1={35}
              y1={ly}
              x2={GRAPH_WIDTH - 35}
              y2={ly}
              stroke="#1a2538"
              strokeWidth={1}
              strokeDasharray="4 8"
              opacity={0.45}
            />
            {/* Lane Title Tag */}
            <text
              x={40}
              y={ly - 50}
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="800"
              letterSpacing="1.2"
              opacity={0.7}
            >
              LANE {lIdx + 1}: {LANE_NAMES[lIdx].toUpperCase()}
            </text>
          </g>
        ))}

        {/* 6 Causal Region Vertical Lanes */}
        {REGION_X.map((rx, idx) => {
          const cfg = Object.values(REGION_CONFIG)[idx];
          return (
            <g key={idx}>
              {/* Lane dividing dashed line */}
              <line
                x1={rx}
                y1={45}
                x2={rx}
                y2={GRAPH_HEIGHT - 25}
                stroke="#1e293b"
                strokeWidth={1}
                strokeDasharray="4 6"
              />
              {/* Region Header Label */}
              <text
                x={rx}
                y={32}
                textAnchor="middle"
                fill={cfg.color}
                fontSize="11"
                fontWeight="900"
                letterSpacing="1.5"
                opacity={0.8}
              >
                {cfg.label}
              </text>
              <text
                x={rx}
                y={46}
                textAnchor="middle"
                fill="#475569"
                fontSize="8"
                fontWeight="600"
              >
                {cfg.desc}
              </text>
            </g>
          );
        })}

        {/* Causal Edges Layer */}
        <g className="edges-layer">
          {edges.map((e) => {
            const s = nodes.find((n) => n.id === e.source);
            const t = nodes.find((n) => n.id === e.target);
            if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return null;

            const isCorridorEdge = corridorEdgeIds.has(e.id);
            const isDirectlyConnected = selectedNodeId === e.source || selectedNodeId === e.target;
            const isUpstreamEdge = isCorridorEdge && (upstreamNodeIds.has(e.source) || upstreamNodeIds.has(e.target));
            const isDownstreamEdge = isCorridorEdge && (downstreamNodeIds.has(e.source) || downstreamNodeIds.has(e.target));
            const isSelected = selectedEdgeId === e.id;
            const isActive = e.active;

            // Strict Visual Hierarchy: When a node is selected, create a focus corridor (Requirement 8 & 9)
            let opacity = 0.20;
            let strokeColor = '#243247';
            let strokeWidth = Math.max(1.2, e.baseWeight * 1.8);
            let marker = 'url(#arrow-nominal)';

            if (selectedNodeId != null) {
              if (isCorridorEdge) {
                opacity = 1.0;
                strokeColor = isDirectlyConnected ? '#38bdf8' : isUpstreamEdge ? '#06b6d4' : isDownstreamEdge ? '#f59e0b' : '#38bdf8';
                strokeWidth = isDirectlyConnected ? 3.2 : 2.6;
                marker = isUpstreamEdge ? 'url(#arrow-traced-up)' : 'url(#arrow-traced-down)';
              } else {
                opacity = 0.03;
                strokeColor = '#1e293b';
                strokeWidth = 1.0;
              }
            } else if (isSelected) {
              opacity = 1.0;
              strokeColor = '#f59e0b';
              strokeWidth = 3.2;
              marker = 'url(#arrow-traced-down)';
            } else if (isActive) {
              opacity = 0.90;
              strokeColor = '#f43f5e';
              strokeWidth = Math.max(2.2, e.attention * 3.2);
              marker = 'url(#arrow-active)';
            }

            // Distribute edge ports to prevent line merging
            const outEdges = edges.filter((ed) => ed.source === e.source);
            const inEdges = edges.filter((ed) => ed.target === e.target);
            const outIdx = outEdges.findIndex((ed) => ed.id === e.id);
            const inIdx = inEdges.findIndex((ed) => ed.id === e.id);

            const sourceOffsetY = outEdges.length > 1 ? (outIdx - (outEdges.length - 1) / 2) * 7 : 0;
            const targetOffsetY = inEdges.length > 1 ? (inIdx - (inEdges.length - 1) / 2) * 7 : 0;

            const r_s = s.radius ?? 20;
            const r_t = t.radius ?? 20;
            const startX = s.x + r_s;
            const startY = s.y + sourceOffsetY;
            const endX = t.x - r_t - 3;
            const endY = t.y + targetOffsetY;

            // Smooth horizontal cubic bezier curve
            const dx = endX - startX;
            const cp1x = startX + dx * 0.42;
            const cp1y = startY;
            const cp2x = startX + dx * 0.58;
            const cp2y = endY;
            const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

            return (
              <g
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectEdge(isSelected ? null : e.id);
                }}
                className="cursor-pointer"
              >
                {/* Static Edge Path - Completely Still, No Continuous Moving Jitter (Requirement 2) */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={marker}
                />

                {/* Overlays on Edge (Attention / Weight / Relationship) */}
                {(overlaySettings.showAttention || isSelected || (isActive && e.attention > 0.6) || (selectedNodeId && isCorridorEdge)) && (
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 5}
                    textAnchor="middle"
                    fill={isActive ? '#fca5a5' : isCorridorEdge ? '#38bdf8' : '#fbbf24'}
                    fontSize="9"
                    fontWeight="800"
                    opacity={opacity > 0.1 ? 1.0 : 0.05}
                    className="font-mono pointer-events-none select-none drop-shadow-sm"
                  >
                    {overlaySettings.showAttention
                      ? `att: ${e.attention.toFixed(2)} ${e.deltaTrend === 'up' ? '↑' : ''}`
                      : overlaySettings.showEdgeWeights
                      ? `w: ${e.baseWeight.toFixed(2)}`
                      : overlaySettings.showRelationshipTypes
                      ? e.relationshipType.replace('_', ' ')
                      : `${e.attention.toFixed(2)} ↑`}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Causal Nodes Layer */}
        <g className="nodes-layer">
          {nodes.map((n) => {
            if (n.x == null || n.y == null) return null;

            const isVisible = visibleNodeIds.has(n.id);
            const isCorridorNode = selectedNodeId ? corridorNodeIds.has(n.id) : true;
            const isSelected = selectedNodeId === n.id;
            const isHovered = hoveredNodeId === n.id;
            const isCritical = n.criticality === 'critical';
            const isWarning = n.criticality === 'warning';
            const isSensorFault = n.criticality === 'sensor_fault';
            const isActive = n.activation > 0.45;

            // Visual Hierarchy: When a node is selected, create a focus corridor (Requirement 8 & 9)
            let nodeOpacity = 1.0;
            if (!isVisible) {
              nodeOpacity = 0.08;
            } else if (selectedNodeId != null) {
              nodeOpacity = isCorridorNode ? 1.0 : 0.08;
            } else {
              nodeOpacity = isCritical || isWarning || isActive ? 1.0 : 0.85;
            }

            // HEALTH COLOR IS ALWAYS PRESERVED (Requirement 7)
            let coreColor = '#334155';
            if (isCritical) {
              coreColor = '#f43f5e';
            } else if (isWarning) {
              coreColor = '#fbbf24';
            } else if (isSensorFault) {
              coreColor = '#06b6d4';
            } else if (n.reconciliationStatus === 'reconciled') {
              coreColor = '#10b981';
            }

            let strokeColor = isCritical ? '#f43f5e' : isWarning ? '#fbbf24' : isSensorFault ? '#06b6d4' : '#334155';
            let strokeWidth = isCritical || isWarning ? 2.2 : 1.6;
            let fillColor = isCritical ? '#1f0d14' : isWarning ? '#1c1608' : '#090e18';

            const r = n.radius ?? 20;

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                opacity={nodeOpacity}
                onPointerDown={handlePointerDown(n.id)}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() => setHoveredNodeId((h) => (h === n.id ? null : h))}
                onClick={() => onSelectNode(isSelected ? null : n.id)}
                style={{ cursor: 'grab' }}
              >
                {/* Dedicated Selection Outer Double-Ring when Selected (Requirement 4 & 7) */}
                {isSelected && (
                  <>
                    <circle
                      r={r + 6}
                      fill="none"
                      stroke={variant === 'maintenance' ? '#f59e0b' : '#38bdf8'}
                      strokeWidth={3}
                    />
                    <circle
                      r={r + 10}
                      fill="none"
                      stroke={variant === 'maintenance' ? '#f59e0b' : '#38bdf8'}
                      strokeWidth={1.5}
                      strokeOpacity={0.4}
                    />
                  </>
                )}

                {/* Node Outer Shell */}
                <circle
                  r={r}
                  fill={fillColor}
                  stroke={isHovered ? '#ffffff' : strokeColor}
                  strokeWidth={isHovered ? 2.8 : strokeWidth}
                />

                {/* Inner Core Indicator (Always Preserves Health Color: Red / Amber / Green) */}
                <circle
                  r={r * 0.72}
                  fill={coreColor}
                  opacity={n.criticality === 'nominal' && !n.reconciliationStatus ? 0.7 : 0.95}
                />

                {/* INDIVIDUAL COMPONENT HEALTH (Unconditionally visible on all nodes) */}
                <text
                  y={4}
                  textAnchor="middle"
                  fontSize={r >= 24 ? '11' : '10'}
                  fontWeight="900"
                  fill="#ffffff"
                  className="pointer-events-none select-none font-mono drop-shadow-md"
                >
                  {n.health}%
                </text>

                {/* Node Label Text */}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isSelected || isCritical ? '800' : '600'}
                  fill={isSelected ? '#38bdf8' : isCritical ? '#fca5a5' : isWarning ? '#fde68a' : '#94a3b8'}
                  className="pointer-events-none select-none drop-shadow-md"
                >
                  {n.label}
                </text>

                {/* Maintenance Target Indicator Pill (Above Node) */}
                {variant === 'maintenance' && n.id === maintenanceTargetId && (
                  <g transform={`translate(0, ${-(r + 10)})`}>
                    <rect
                      x={-28}
                      y={-8}
                      width={56}
                      height={16}
                      rx={4}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <text
                      y={3.5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="900"
                      fill="#090e18"
                      className="font-mono tracking-wider"
                    >
                      TARGET
                    </text>
                  </g>
                )}

                {/* Predicted Post-Repair Health Recovery Badge in Maintenance Mode */}
                {variant === 'maintenance' &&
                  predictedHealthMap?.[n.id] &&
                  predictedHealthMap[n.id] > n.health &&
                  !n.reconciliationStatus && (
                    <g transform={`translate(0, ${r + 27})`}>
                      <rect
                        x={-44}
                        y={-7}
                        width={88}
                        height={15}
                        rx={4}
                        fill="#064e3b"
                        stroke="#10b981"
                        strokeWidth={1}
                      />
                      <text
                        y={3.5}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="900"
                        fill="#6ee7b7"
                        className="font-mono"
                      >
                        {n.health}% → {predictedHealthMap[n.id]}% ↑
                      </text>
                    </g>
                  )}

                {/* Visible Reconciliation Status Badge */}
                {n.reconciliationStatus && (
                  <g transform={`translate(0, ${r + 26})`}>
                    <rect
                      x={-34}
                      y={-7}
                      width={68}
                      height={13}
                      rx={3}
                      fill={
                        n.reconciliationStatus === 'reconciled'
                          ? '#064e3b'
                          : n.reconciliationStatus === 'stabilized'
                          ? '#78350f'
                          : n.reconciliationStatus === 'reduced'
                          ? '#083344'
                          : '#881337'
                      }
                      stroke={
                        n.reconciliationStatus === 'reconciled'
                          ? '#10b981'
                          : n.reconciliationStatus === 'stabilized'
                          ? '#f59e0b'
                          : n.reconciliationStatus === 'reduced'
                          ? '#06b6d4'
                          : '#f43f5e'
                      }
                      strokeWidth={0.8}
                    />
                    <text
                      y={2.5}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="900"
                      letterSpacing="0.4"
                      fill={
                        n.reconciliationStatus === 'reconciled'
                          ? '#6ee7b7'
                          : n.reconciliationStatus === 'stabilized'
                          ? '#fde68a'
                          : n.reconciliationStatus === 'reduced'
                          ? '#67e8f9'
                          : '#fca5a5'
                      }
                      className="font-mono uppercase select-none pointer-events-none"
                    >
                      {n.reconciliationStatus === 'reconciled'
                        ? 'RECONCILED'
                        : n.reconciliationStatus === 'stabilized'
                        ? 'STABILIZED'
                        : n.reconciliationStatus === 'reduced'
                        ? 'REDUCED'
                        : 'REMAINING'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* 3. Compact Selected Node Inspector Card (Requirements 6 & 10) */}
      {selectedNode &&
        (variant === 'maintenance' ? (
          <div className="absolute top-14 right-4 z-30 max-w-xs w-80 rounded-xl border border-amber-500/50 bg-[#080d16]/95 p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2.5 pointer-events-auto">
            <div className="flex items-start justify-between gap-1.5 border-b border-slate-800 pb-2">
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      selectedNode.health < 50
                        ? 'bg-rose-400'
                        : selectedNode.health < 80
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span className="font-black text-slate-100 text-xs truncate block">
                    {selectedNode.label}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                  {selectedNode.subType} · {selectedNode.region.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(null);
                }}
                className="text-slate-400 hover:text-slate-100 p-0.5 rounded hover:bg-slate-800"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Individual Component Health & Predicted Recovery */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold">Individual Health</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-base font-black ${
                      selectedNode.health < 50
                        ? 'text-rose-400'
                        : selectedNode.health < 80
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedNode.health}%
                  </span>
                  {predictedHealthMap?.[selectedNode.id] &&
                    selectedNode.health < predictedHealthMap[selectedNode.id] && (
                      <span className="text-emerald-400 font-black text-xs">
                        → {predictedHealthMap[selectedNode.id]}% ↑
                      </span>
                    )}
                </div>
              </div>

              {/* Health Bar with Predicted Gain */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
                <div
                  className={`h-full ${
                    selectedNode.health < 50
                      ? 'bg-rose-500'
                      : selectedNode.health < 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${selectedNode.health}%` }}
                />
                {predictedHealthMap?.[selectedNode.id] &&
                  selectedNode.health < predictedHealthMap[selectedNode.id] && (
                    <div
                      className="h-full bg-emerald-400/50 absolute top-0"
                      style={{
                        left: `${selectedNode.health}%`,
                        width: `${predictedHealthMap[selectedNode.id] - selectedNode.health}%`,
                      }}
                    />
                  )}
              </div>

              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>
                  Status:{' '}
                  <strong
                    className={
                      selectedNode.health < 50
                        ? 'text-rose-400'
                        : selectedNode.health < 80
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {selectedNode.reconciliationStatus
                      ? selectedNode.reconciliationStatus.toUpperCase()
                      : selectedNode.health < 50
                      ? 'DEGRADED'
                      : selectedNode.health < 80
                      ? 'WARNING'
                      : 'NOMINAL'}
                  </strong>
                </span>
                {predictedHealthMap?.[selectedNode.id] &&
                  selectedNode.health < predictedHealthMap[selectedNode.id] && (
                    <span className="text-emerald-400 font-bold">
                      +{predictedHealthMap[selectedNode.id] - selectedNode.health}% Post-Repair
                    </span>
                  )}
              </div>
            </div>

            {/* Active Procedure Context */}
            {selectedActionTitle && (
              <div className="text-[10px] space-y-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <span className="text-amber-300 font-bold block">Assigned Procedure:</span>
                <span className="text-slate-200 block truncate">{selectedActionTitle}</span>
              </div>
            )}

            {/* Upstream & Downstream Counts */}
            <div className="text-[10px] space-y-1 pt-1 border-t border-slate-800 text-slate-400">
              <div className="flex justify-between">
                <span>Upstream Causes:</span>
                <strong className="text-cyan-400">
                  {upstreamNodeIds.size > 0 ? `${upstreamNodeIds.size} nodes` : 'Direct Source'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Downstream Cascade:</span>
                <strong className="text-amber-400">
                  {downstreamNodeIds.size > 0 ? `${downstreamNodeIds.size} nodes` : 'Terminal Node'}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute top-14 right-4 z-30 max-w-xs w-72 rounded-xl border border-sky-500/50 bg-[#080d16]/95 p-3 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2 pointer-events-auto">
            <div className="flex items-start justify-between gap-1.5 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      selectedNode.criticality === 'critical'
                        ? '#f43f5e'
                        : selectedNode.criticality === 'warning'
                        ? '#fbbf24'
                        : selectedNode.criticality === 'sensor_fault'
                        ? '#06b6d4'
                        : '#10b981',
                  }}
                />
                <div className="truncate">
                  <span className="font-bold text-slate-100 text-xs truncate block">
                    {selectedNode.label}
                  </span>
                  <span className="text-[9px] text-slate-400 capitalize block">
                    {selectedNode.region.replace('_', ' ')} · {selectedNode.subType}
                  </span>
                </div>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(null);
                }}
                className="text-slate-400 hover:text-slate-100 p-0.5 rounded hover:bg-slate-800"
                title="Deselect / Clear corridor focus"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="p-1 rounded bg-slate-900 border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase block">Health</span>
                <span
                  className={`font-black text-xs ${
                    selectedNode.health < 50
                      ? 'text-rose-400'
                      : selectedNode.health < 80
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {selectedNode.health}%
                </span>
              </div>
              <div className="p-1 rounded bg-slate-900 border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase block">State</span>
                <span
                  className={`font-black text-[9px] uppercase truncate block ${
                    selectedNode.criticality === 'critical'
                      ? 'text-rose-400'
                      : selectedNode.criticality === 'warning'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {selectedNode.reconciliationStatus
                    ? selectedNode.reconciliationStatus.toUpperCase()
                    : selectedNode.criticality}
                </span>
              </div>
              <div className="p-1 rounded bg-slate-900 border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase block">Impact</span>
                <span
                  className={`font-black text-[9px] uppercase block ${
                    selectedNode.criticality === 'critical'
                      ? 'text-rose-400'
                      : selectedNode.criticality === 'warning'
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {selectedNode.criticality === 'critical' ? 'HIGH' : selectedNode.criticality === 'warning' ? 'MED' : 'LOW'}
                </span>
              </div>
            </div>

            <div className="text-[10px] space-y-1 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-slate-400">
                <span>Upstream Causes:</span>
                <strong className="text-cyan-400">{upstreamNodeIds.size > 0 ? `${upstreamNodeIds.size} nodes` : 'Root'}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Downstream Cascade:</span>
                <strong className="text-amber-400">{downstreamNodeIds.size > 0 ? `${downstreamNodeIds.size} nodes` : 'None'}</strong>
              </div>
              {selectedNodeConnectedEdges.length > 0 && (
                <div className="flex items-center justify-between text-slate-400 pt-0.5">
                  <span>Peak Attention:</span>
                  <strong className="text-amber-300">
                    {Math.max(...selectedNodeConnectedEdges.map((e) => e.attention)).toFixed(2)}{' '}
                    {selectedNodeConnectedEdges.some((e) => e.deltaTrend === 'up') ? '↑' : '↓'}
                  </strong>
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
