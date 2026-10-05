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
  computeOrbitSeedPositions,
  REGION_X_POSITIONS,
} from '../../lib/causalLaneLayout';
import { useThemeStore } from '../../store/useThemeStore';
import type {
  AnalysisMode,
  CausalEdgeData,
  CausalNodeData,
  FilterMode,
  OverlaySettings,
  TraceMode,
} from '../../types/causalGraph';

const GRAPH_WIDTH = 1480;
const GRAPH_HEIGHT = 1000;
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
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

  // Simulation physics refs (OrbitGraph pattern: local force simulation, draggable, repulsion, springs, damping)
  const nodesRef = useRef<CausalNodeData[]>([]);
  const edgesRef = useRef<CausalEdgeData[]>([]);
  const alphaRef = useRef(1.0);
  const draggingRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, forceTick] = useState(0);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [overlaysOpen, setOverlaysOpen] = useState(false);

  // Initialize nodes with organic seed layout: column staging (X) + subsystem vertical breathing room (Y)
  useEffect(() => {
    const layoutMap = computeOrbitSeedPositions(
      dynamicNodes,
      dynamicEdges,
      GRAPH_WIDTH,
      GRAPH_HEIGHT
    );
    const existingMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    const initialized: CausalNodeData[] = dynamicNodes.map((node) => {
      const existing = existingMap.get(node.id);
      const seedCoord = layoutMap.get(node.id);
      const targetX = seedCoord?.x ?? REGION_X[node.regionIndex] ?? 120;
      const targetY = seedCoord?.y ?? GRAPH_HEIGHT / 2;
      const radius = node.region === 'subsystems' || node.region === 'risk_rollup' ? 24 : 21;

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

  // Keep state and telemetry synchronized without resetting user positions
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

  // OrbitGraph Local Physics Simulation
  // Repulsion + Springs + Anti-Collision + Soft Column & Subsystem Guidance + Fluid Damping
  useEffect(() => {
    let animId: number;

    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const alpha = alphaRef.current;

      if (alpha > 0.003) {
        const layoutMap = computeOrbitSeedPositions(nodes, edges, GRAPH_WIDTH, GRAPH_HEIGHT);

        // 1. Soft restoring force toward column & subsystem zone (organic structure without rigid grid locking)
        nodes.forEach((n) => {
          if (n.x == null || n.y == null) return;

          if (n.fx != null && n.fy != null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
            return;
          }

          const seedCoord = layoutMap.get(n.id);
          const targetX = seedCoord?.x ?? REGION_X[n.regionIndex] ?? 120;
          const targetY = seedCoord?.y ?? GRAPH_HEIGHT / 2;

          // Soft guidance keeps left-to-right flow while allowing dynamic orbital flexing
          n.vx = (n.vx ?? 0) + (targetX - n.x) * 0.045 * alpha;
          n.vy = (n.vy ?? 0) + (targetY - n.y) * 0.030 * alpha;
        });

        // 2. Pairwise node repulsion (OrbitGraph Principle 8)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = Math.max(16, dx * dx + dy * dy);
            const dist = Math.sqrt(distSq);

            // Inverse-square repulsion
            const force = (3600 * alpha) / distSq;
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

            // Anti-collision clearance to guarantee zero label / circle overlap
            const minClearance = (a.radius ?? 22) + (b.radius ?? 22) + 52;
            if (dist < minClearance) {
              const overlap = minClearance - dist;
              const push = overlap * 0.16 * alpha;
              const px = (dx / dist) * push;
              const py = (dy / dist) * push;
              if (a.fx == null) {
                a.vx = (a.vx ?? 0) - px;
                a.vy = (a.vy ?? 0) - py;
              }
              if (b.fx == null) {
                b.vx = (b.vx ?? 0) + px;
                b.vy = (b.vy ?? 0) + py;
              }
            }
          }
        }

        // 3. Spring-like edge attraction (OrbitGraph Principle 9)
        edges.forEach((e) => {
          const a = nodes.find((n) => n.id === e.source);
          const b = nodes.find((n) => n.id === e.target);
          if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

          // Rest length ~230px keeps connected nodes naturally linked
          const restLength = 230;
          const displacement = (dist - restLength) * 0.035 * alpha;
          const fx = (dx / dist) * displacement;
          const fy = (dy / dist) * displacement;

          if (a.fx == null) {
            a.vx = (a.vx ?? 0) + fx;
            a.vy = (a.vy ?? 0) + fy;
          }
          if (b.fx == null) {
            b.vx = (b.vx ?? 0) - fx;
            b.vy = (b.vy ?? 0) - fy;
          }
        });

        // 4. Damping & Integration (OrbitGraph Principle 10 & 11)
        nodes.forEach((n) => {
          if (n.x == null || n.y == null) return;
          if (n.fx != null && n.fy != null) return;

          n.vx = (n.vx ?? 0) * 0.86;
          n.vy = (n.vy ?? 0) * 0.86;

          n.x += n.vx;
          n.y += n.vy;

          const r = n.radius ?? 22;
          n.x = Math.max(r + 35, Math.min(GRAPH_WIDTH - r - 35, n.x));
          n.y = Math.max(r + 75, Math.min(GRAPH_HEIGHT - r - 45, n.y));
        });

        alphaRef.current *= 0.982;
        forceTick((t) => t + 1);
      }

      animId = requestAnimationFrame(step);
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

  // Interactive node dragging with OrbitGraph reheat
  const handlePointerDown = (nodeId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = nodeId;
    alphaRef.current = 0.85; // Reheat simulation to respond dynamically

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
    alphaRef.current = Math.max(alphaRef.current, 0.4);
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
    alphaRef.current = Math.max(alphaRef.current, 0.25);
  };

  const handleResetLayout = () => {
    const layoutMap = computeOrbitSeedPositions(
      nodesRef.current,
      edgesRef.current,
      GRAPH_WIDTH,
      GRAPH_HEIGHT
    );
    nodesRef.current.forEach((n) => {
      const seed = layoutMap.get(n.id);
      if (seed) {
        n.x = seed.x;
        n.y = seed.y;
      }
      n.fx = null;
      n.fy = null;
      n.vx = 0;
      n.vy = 0;
    });
    alphaRef.current = 1.0;
    forceTick((t) => t + 1);
  };

  // Causal Corridor computation
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

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodesRef.current.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId]);

  const selectedNodeConnectedEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edgesRef.current.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId);
  }, [selectedNodeId]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  // Filtered nodes
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
    <div
      className={`flex flex-col rounded-2xl border ${
        isLight ? 'border-[#e2ddd1] bg-[#ffffff] shadow-md' : 'border-slate-800 bg-[#06090f] shadow-2xl'
      } overflow-hidden relative`}
    >
      {/* 1. Header Bar: Ground Maintenance Twin Bar vs Analytical Mode Bar */}
      {variant === 'maintenance' ? (
        <div
          className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isLight
              ? 'border-[#e2ddd1] bg-[#f4efe6] text-[#0c1117]'
              : 'border-amber-500/30 bg-gradient-to-r from-amber-950/25 via-slate-900 to-slate-950 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase font-mono tracking-wider ${
                isLight
                  ? 'bg-[#00A896]/15 text-[#008f80] border border-[#00A896]/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              Ground Maintenance Twin
            </span>
            {selectedActionType && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isLight ? 'bg-white border border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-900 border border-slate-800 text-amber-300'
                }`}
              >
                {selectedActionType}
              </span>
            )}
            {selectedActionTitle && (
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>
                <span className={isLight ? 'text-[#475569]' : 'text-slate-400 font-normal'}>Procedure:</span>
                <span className={isLight ? 'text-[#008f80]' : 'text-amber-400'}>{selectedActionTitle}</span>
              </span>
            )}
            {maintenanceTargetId && (
              <span
                className={`text-xs font-mono flex items-center gap-1.5 px-2 py-0.5 rounded border ${
                  isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-950/80 border-slate-800 text-slate-300'
                }`}
              >
                <span className={isLight ? 'text-[#64748b]' : 'text-slate-500'}>Target Subassembly:</span>
                <strong className={isLight ? 'text-[#0284c7] font-bold' : 'text-sky-300 font-bold'}>
                  {nodes.find((n) => n.id === maintenanceTargetId)?.label ?? maintenanceTargetId}
                </strong>
                {nodes.find((n) => n.id === maintenanceTargetId) && (
                  <span className={`ml-1 text-[11px] font-bold ${isLight ? 'text-[#008f80]' : 'text-amber-300'}`}>
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

          <div className={`flex items-center gap-3 text-[10px] font-mono flex-wrap ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
            <span className={`flex items-center gap-1.5 font-bold ${isLight ? 'text-[#0284c7]' : 'text-sky-300'}`}>
              <span className="w-2.5 h-2.5 rounded-full border-2 border-sky-400 bg-sky-500" />
              Target Subassembly
            </span>
            <span className={`flex items-center gap-1.5 font-bold ${isLight ? 'text-[#b45309]' : 'text-amber-300'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Impacted Corridor
            </span>
            <span className={`flex items-center gap-1 ${isLight ? 'text-[#0c1117]' : 'text-slate-300'}`}>
              <span className={`px-1.5 py-0.5 rounded font-bold ${isLight ? 'bg-[#f4efe6] text-[#0c1117]' : 'bg-slate-800 text-slate-100'}`}>
                XX%
              </span>
              Component Health
            </span>
            <button
              onClick={handleResetLayout}
              className={`p-1.5 rounded-lg border ml-1 cursor-pointer transition-colors ${
                isLight ? 'text-[#475569] hover:text-[#0c1117] bg-white border-[#e2ddd1]' : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
              }`}
              title="Re-settle Orbit physics simulation"
            >
              <HugeiconsIcon icon={RefreshIcon} size={12} />
            </button>
          </div>
        </div>
      ) : !hideToolbar ? (
        <div
          className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isLight ? 'border-[#e2ddd1] bg-[#f4efe6] text-[#0c1117]' : 'border-slate-800/80 bg-slate-900/90 text-slate-200'
          }`}
        >
          {/* Analytical Emphasis Tabs */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border ${isLight ? 'bg-white border-[#e2ddd1]' : 'bg-slate-950 border-slate-800'}`}>
            {(['graph', 'diagnosis', 'propagation', 'impact'] as AnalysisMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAnalysisMode(mode)}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  analysisMode === mode
                    ? isLight
                      ? 'bg-[#00A896] text-white shadow-xs'
                      : 'bg-amber-500 text-slate-950 shadow-sm'
                    : isLight
                    ? 'text-[#475569] hover:text-[#0c1117] hover:bg-[#f4efe6]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Graph Status Badge */}
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400">
            <span className={`px-2 py-0.5 rounded-md border ${isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
              Live Graph: {nodes.length} Nodes · {edges.length} Causal Edges
            </span>
            <span className={`px-2 py-0.5 rounded-md border ${isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-800' : 'bg-cyan-950/40 border-cyan-800/50 text-cyan-300'}`}>
              Orbit Physics Enabled
            </span>
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isLight ? 'text-[#475569]' : 'text-slate-500'}`}>
              <HugeiconsIcon icon={FilterIcon} size={12} /> Filter:
            </span>
            {(['all', 'active_path', 'anomalies', 'critical'] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => onSetFilterMode(f)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  filterMode === f
                    ? isLight
                      ? 'bg-[#00A896]/15 text-[#008f80] border border-[#00A896]/40'
                      : 'bg-slate-800 text-amber-400 border border-amber-500/40'
                    : isLight
                    ? 'bg-white text-[#475569] hover:text-[#0c1117] border border-[#e2ddd1]'
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                  isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117] hover:border-[#cbd5e1]' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <HugeiconsIcon icon={SlidersHorizontalIcon} size={12} />
                <span>Overlays ▼</span>
              </button>

              {overlaysOpen && (
                <div
                  className={`absolute right-0 top-full mt-1.5 w-48 p-2 rounded-xl border shadow-2xl z-40 space-y-1 text-[11px] ${
                    isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117]' : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isLight ? 'hover:bg-[#f4efe6]' : 'hover:bg-slate-800/60'}`}>
                    <input
                      type="checkbox"
                      checked={overlaySettings.showAttention}
                      onChange={() => onToggleOverlay('showAttention')}
                      className="accent-amber-500"
                    />
                    <span>Edge Attention (USP)</span>
                  </label>
                  <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isLight ? 'hover:bg-[#f4efe6]' : 'hover:bg-slate-800/60'}`}>
                    <input
                      type="checkbox"
                      checked={overlaySettings.showEdgeWeights}
                      onChange={() => onToggleOverlay('showEdgeWeights')}
                      className="accent-amber-500"
                    />
                    <span>Base Physics Weights</span>
                  </label>
                  <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isLight ? 'hover:bg-[#f4efe6]' : 'hover:bg-slate-800/60'}`}>
                    <input
                      type="checkbox"
                      checked={overlaySettings.showCriticality}
                      onChange={() => onToggleOverlay('showCriticality')}
                      className="accent-amber-500"
                    />
                    <span>Node Criticality Badges</span>
                  </label>
                  <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isLight ? 'hover:bg-[#f4efe6]' : 'hover:bg-slate-800/60'}`}>
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
                className={`pl-7 pr-2.5 py-1 rounded-lg text-[10px] border focus:outline-none w-28 sm:w-36 ${
                  isLight
                    ? 'bg-white border-[#e2ddd1] text-[#0c1117] focus:border-[#00A896]'
                    : 'bg-slate-950 border-slate-800 text-slate-200 focus:border-amber-500/60'
                }`}
              />
            </div>

            <button
              onClick={handleResetLayout}
              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                isLight ? 'text-[#475569] hover:text-[#0c1117] bg-white border-[#e2ddd1]' : 'text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800'
              }`}
              title="Reset Orbit graph layout & settle physics"
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
          background: isLight ? '#faf7f2' : 'radial-gradient(ellipse at center, #0a1120 0%, #04070d 100%)',
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
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={isLight ? '#94a3b8' : '#475569'} />
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
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={isLight ? '#0284c7' : '#06b6d4'} />
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
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={isLight ? '#d97706' : '#f59e0b'} />
          </marker>
        </defs>

        {/* 6 Causal Stage Columns (Organic forward causal progression without rigid swimlanes) */}
        {REGION_X.map((rx, idx) => {
          const cfg = Object.values(REGION_CONFIG)[idx];
          return (
            <g key={idx}>
              {/* Subtle vertical stage guide */}
              <line
                x1={rx}
                y1={58}
                x2={rx}
                y2={GRAPH_HEIGHT - 45}
                stroke={isLight ? '#e2ddd1' : '#1e293b'}
                strokeWidth={1}
                strokeDasharray="4 8"
                opacity={isLight ? 0.8 : 0.5}
              />
              {/* Stage Pill Header at the top */}
              <g transform={`translate(${rx}, 28)`}>
                <rect
                  x={-68}
                  y={-14}
                  width={136}
                  height={24}
                  rx={12}
                  fill={isLight ? '#ffffff' : '#0c1527'}
                  stroke={cfg.color}
                  strokeWidth={1.2}
                  strokeOpacity={0.8}
                />
                <circle cx={-52} cy={-2} r={3.5} fill={cfg.color} />
                <text
                  x={-42}
                  y={2}
                  fill={cfg.color}
                  fontSize="10"
                  fontWeight="900"
                  letterSpacing="1"
                  className="font-mono select-none pointer-events-none"
                >
                  {cfg.label}
                </text>
              </g>
              {/* Descriptive Stage Caption */}
              <text
                x={rx}
                y={48}
                textAnchor="middle"
                fill={isLight ? '#64748b' : '#64748b'}
                fontSize="8"
                fontWeight="600"
                className="select-none pointer-events-none"
              >
                {cfg.desc}
              </text>
            </g>
          );
        })}

        {/* Causal Edges Layer (OrbitGraph elastic connections) */}
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

            // Strict Visual Hierarchy: Active corridor is highlighted, but nominal edges are ALWAYS visible (never 0.03!)
            let opacity = isLight ? 0.32 : 0.26;
            let strokeColor = isLight ? '#94a3b8' : '#334155';
            let strokeWidth = Math.max(1.3, e.baseWeight * 1.8);
            let marker = 'url(#arrow-nominal)';

            if (selectedNodeId != null) {
              if (isCorridorEdge) {
                opacity = 1.0;
                strokeColor = isDirectlyConnected
                  ? isLight ? '#00A896' : '#38bdf8'
                  : isUpstreamEdge
                  ? isLight ? '#0284c7' : '#06b6d4'
                  : isDownstreamEdge
                  ? isLight ? '#d97706' : '#f59e0b'
                  : isLight ? '#00A896' : '#38bdf8';
                strokeWidth = isDirectlyConnected ? 3.4 : 2.8;
                marker = isUpstreamEdge ? 'url(#arrow-traced-up)' : 'url(#arrow-traced-down)';
              } else {
                opacity = isLight ? 0.22 : 0.18; // Subtle, but clearly present!
                strokeColor = isLight ? '#cbd5e1' : '#1e293b';
                strokeWidth = 1.2;
              }
            } else if (isSelected) {
              opacity = 1.0;
              strokeColor = isLight ? '#d97706' : '#f59e0b';
              strokeWidth = 3.2;
              marker = 'url(#arrow-traced-down)';
            } else if (isActive) {
              opacity = 0.95;
              strokeColor = isLight ? '#e11d48' : '#f43f5e';
              strokeWidth = Math.max(2.2, e.attention * 3.4);
              marker = 'url(#arrow-active)';
            }

            // Distribute edge ports to prevent line merging
            const outEdges = edges.filter((ed) => ed.source === e.source);
            const inEdges = edges.filter((ed) => ed.target === e.target);
            const outIdx = outEdges.findIndex((ed) => ed.id === e.id);
            const inIdx = inEdges.findIndex((ed) => ed.id === e.id);

            const sourceOffsetY = outEdges.length > 1 ? (outIdx - (outEdges.length - 1) / 2) * 7 : 0;
            const targetOffsetY = inEdges.length > 1 ? (inIdx - (inEdges.length - 1) / 2) * 7 : 0;

            const r_s = s.radius ?? 21;
            const r_t = t.radius ?? 21;
            const startX = s.x + r_s;
            const startY = s.y + sourceOffsetY;
            const endX = t.x - r_t - 3;
            const endY = t.y + targetOffsetY;

            // Smooth horizontal cubic bezier curve
            const dx = endX - startX;
            const cp1x = startX + dx * 0.45;
            const cp1y = startY;
            const cp2x = startX + dx * 0.55;
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
                {/* Edge Path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={isActive ? '6 4' : undefined}
                  markerEnd={marker}
                />

                {/* Overlays on Edge (Attention / Weight / Relationship) */}
                {(overlaySettings.showAttention || isSelected || (isActive && e.attention > 0.6) || (selectedNodeId && isCorridorEdge)) && (
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 6}
                    textAnchor="middle"
                    fill={isActive ? '#fca5a5' : isCorridorEdge ? '#38bdf8' : isLight ? '#d97706' : '#fbbf24'}
                    fontSize="9"
                    fontWeight="800"
                    opacity={opacity > 0.15 ? 1.0 : 0.4}
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

        {/* Causal Nodes Layer (Interactive Orbit nodes) */}
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

            // UNASSOCIATED NODES NEVER DISAPPEAR (refer celestia_engine_graph.html)
            let nodeOpacity = 1.0;
            if (!isVisible) {
              nodeOpacity = 0.52; // Muted if filtered out by search/filter, but still clearly visible!
            } else if (selectedNodeId != null) {
              nodeOpacity = isCorridorNode ? 1.0 : (isLight ? 0.78 : 0.72); // Crisp and legible, NOT 0.08!
            } else {
              nodeOpacity = isCritical || isWarning || isActive ? 1.0 : (isLight ? 0.92 : 0.88);
            }

            // Health color indicator
            let coreColor = '#475569';
            if (isCritical) {
              coreColor = '#f43f5e';
            } else if (isWarning) {
              coreColor = '#fbbf24';
            } else if (isSensorFault) {
              coreColor = '#06b6d4';
            } else if (n.reconciliationStatus === 'reconciled') {
              coreColor = '#10b981';
            } else if (n.health > 85) {
              coreColor = '#059669';
            }

            let strokeColor = isLight
              ? isCritical ? '#dc2626' : isWarning ? '#d97706' : isSensorFault ? '#0284c7' : '#94a3b8'
              : isCritical ? '#f43f5e' : isWarning ? '#fbbf24' : isSensorFault ? '#06b6d4' : '#475569';
            let strokeWidth = isCritical || isWarning ? 2.4 : 1.6;
            let fillColor = isLight
              ? isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#ffffff'
              : isCritical ? '#1f0d14' : isWarning ? '#1c1608' : '#0c1322';

            const r = n.radius ?? 21;

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
                {/* Dedicated Selection Outer Double-Ring when Selected */}
                {isSelected && (
                  <>
                    <circle
                      r={r + 7}
                      fill="none"
                      stroke={variant === 'maintenance' ? (isLight ? '#d97706' : '#f59e0b') : (isLight ? '#00A896' : '#38bdf8')}
                      strokeWidth={3}
                    />
                    <circle
                      r={r + 12}
                      fill="none"
                      stroke={variant === 'maintenance' ? (isLight ? '#d97706' : '#f59e0b') : (isLight ? '#00A896' : '#38bdf8')}
                      strokeWidth={1.5}
                      strokeOpacity={0.45}
                    />
                  </>
                )}

                {/* Node Outer Shell */}
                <circle
                  r={r}
                  fill={fillColor}
                  stroke={isHovered ? (isLight ? '#0c1117' : '#ffffff') : strokeColor}
                  strokeWidth={isHovered ? 2.8 : strokeWidth}
                />

                {/* Inner Core Indicator (Preserves Health Color) */}
                <circle
                  r={r * 0.72}
                  fill={coreColor}
                  opacity={n.criticality === 'nominal' && !n.reconciliationStatus ? (isLight ? 0.9 : 0.8) : 0.98}
                />

                {/* Health Percentage Text (Always bold, high contrast, legible) */}
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

                {/* Node Label Text (High contrast, clearly visible on all nodes) */}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isSelected || isCritical ? '800' : '700'}
                  fill={
                    isLight
                      ? isSelected ? '#008f80' : isCritical ? '#dc2626' : isWarning ? '#b45309' : '#0f172a'
                      : isSelected ? '#38bdf8' : isCritical ? '#fca5a5' : isWarning ? '#fde68a' : '#e2e8f0'
                  }
                  className="pointer-events-none select-none"
                >
                  {n.label}
                </text>

                {/* SubType Tag under Node Label */}
                <text
                  y={r + 25}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill={isLight ? '#64748b' : '#64748b'}
                  className="pointer-events-none select-none font-mono"
                >
                  {n.subType}
                </text>

                {/* Maintenance Target Indicator Pill (Above Node) */}
                {variant === 'maintenance' && n.id === maintenanceTargetId && (
                  <g transform={`translate(0, ${-(r + 12)})`}>
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
                    <g transform={`translate(0, ${r + 37})`}>
                      <rect
                        x={-44}
                        y={-7}
                        width={88}
                        height={15}
                        rx={4}
                        fill={isLight ? '#dcfce7' : '#064e3b'}
                        stroke={isLight ? '#16a34a' : '#10b981'}
                        strokeWidth={1}
                      />
                      <text
                        y={3.5}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="900"
                        fill={isLight ? '#15803d' : '#6ee7b7'}
                        className="font-mono"
                      >
                        {n.health}% → {predictedHealthMap[n.id]}% ↑
                      </text>
                    </g>
                  )}

                {/* Reconciliation Status Badge */}
                {n.reconciliationStatus && (
                  <g transform={`translate(0, ${r + 36})`}>
                    <rect
                      x={-34}
                      y={-7}
                      width={68}
                      height={13}
                      rx={3}
                      fill={
                        isLight
                          ? n.reconciliationStatus === 'reconciled'
                            ? '#dcfce7'
                            : n.reconciliationStatus === 'stabilized'
                            ? '#fef3c7'
                            : n.reconciliationStatus === 'reduced'
                            ? '#e0f2fe'
                            : '#fee2e2'
                          : n.reconciliationStatus === 'reconciled'
                          ? '#064e3b'
                          : n.reconciliationStatus === 'stabilized'
                          ? '#78350f'
                          : n.reconciliationStatus === 'reduced'
                          ? '#083344'
                          : '#881337'
                      }
                      stroke={
                        isLight
                          ? n.reconciliationStatus === 'reconciled'
                            ? '#16a34a'
                            : n.reconciliationStatus === 'stabilized'
                            ? '#d97706'
                            : n.reconciliationStatus === 'reduced'
                            ? '#0284c7'
                            : '#dc2626'
                          : n.reconciliationStatus === 'reconciled'
                          ? '#10b981'
                          : n.reconciliationStatus === 'stabilized'
                          ? '#f59e0b'
                          : n.reconciliationStatus === 'reduced'
                          ? '#06b6d4'
                          : '#f43f5e'
                      }
                      strokeWidth={1}
                    />
                    <text
                      y={2.5}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="900"
                      letterSpacing="0.4"
                      fill={
                        isLight
                          ? n.reconciliationStatus === 'reconciled'
                            ? '#15803d'
                            : n.reconciliationStatus === 'stabilized'
                            ? '#92400e'
                            : n.reconciliationStatus === 'reduced'
                            ? '#0369a1'
                            : '#b91c1c'
                          : n.reconciliationStatus === 'reconciled'
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

        {/* Legend Overlay at bottom (matching celestia_engine_graph.html) */}
        <g transform={`translate(28, ${GRAPH_HEIGHT - 38})`}>
          <rect
            x={0}
            y={0}
            width={720}
            height={28}
            rx={8}
            fill={isLight ? '#ffffff' : '#070d18'}
            stroke={isLight ? '#e2ddd1' : '#1e293b'}
            strokeWidth={1}
            opacity={0.94}
          />
          <g transform="translate(14, 18)" fontSize="9.5" className="font-mono">
            <circle cx={0} cy={-4} r={4} fill="#06b6d4" />
            <text x={8} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>Evidence</text>

            <circle cx={80} cy={-4} r={4} fill="#f43f5e" />
            <text x={88} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>Root Causes</text>

            <circle cx={178} cy={-4} r={4} fill="#38bdf8" />
            <text x={186} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>Subsystems</text>

            <circle cx={274} cy={-4} r={4} fill="#34d399" />
            <text x={282} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>Sensors</text>

            <circle cx={352} cy={-4} r={4} fill="#fbbf24" />
            <text x={360} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>States</text>

            <circle cx={420} cy={-4} r={4} fill="#e11d48" />
            <text x={428} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>Risk Roll-up</text>

            <line x1={515} y1={-4} x2={545} y2={-4} stroke="#f43f5e" strokeWidth={2.4} strokeDasharray="4 2" />
            <text x={552} y={-1} fill={isLight ? '#475569' : '#94a3b8'}>Active Flow</text>
          </g>
        </g>
      </svg>

      {/* 3. Compact Selected Node Inspector Card */}
      {selectedNode &&
        (variant === 'maintenance' ? (
          <div
            className={`absolute top-14 right-4 z-30 max-w-xs w-80 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2.5 pointer-events-auto ${
              isLight ? 'border-[#00A896] bg-white/98 text-[#0c1117]' : 'border-amber-500/50 bg-[#080d16]/95 text-slate-200'
            }`}
          >
            <div className={`flex items-start justify-between gap-1.5 border-b pb-2 ${isLight ? 'border-[#e2ddd1]' : 'border-slate-800'}`}>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedNode.health < 50
                        ? 'bg-rose-400'
                        : selectedNode.health < 80
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span className={`font-black text-xs truncate block ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                    {selectedNode.label}
                  </span>
                </div>
                <span className={`text-[10px] mt-0.5 block truncate ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
                  {selectedNode.subType} · {selectedNode.region.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(null);
                }}
                className={`p-0.5 rounded cursor-pointer ${
                  isLight ? 'text-[#475569] hover:text-[#0c1117] hover:bg-[#f4efe6]' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Individual Component Health & Predicted Recovery */}
            <div className={`p-2.5 rounded-lg border space-y-2 ${isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-950/80 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>Individual Health</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-base font-black ${
                      selectedNode.health < 50
                        ? isLight ? 'text-rose-600' : 'text-rose-400'
                        : selectedNode.health < 80
                        ? isLight ? 'text-amber-600' : 'text-amber-400'
                        : isLight ? 'text-emerald-600' : 'text-emerald-400'
                    }`}
                  >
                    {selectedNode.health}%
                  </span>
                  {predictedHealthMap?.[selectedNode.id] &&
                    selectedNode.health < predictedHealthMap[selectedNode.id] && (
                      <span className={`font-black text-xs ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        → {predictedHealthMap[selectedNode.id]}% ↑
                      </span>
                    )}
                </div>
              </div>

              {/* Health Bar with Predicted Gain */}
              <div className={`w-full h-2.5 rounded-full overflow-hidden border relative ${isLight ? 'bg-[#e2ddd1] border-[#d4cdbf]' : 'bg-slate-900 border-slate-800'}`}>
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

              <div className={`flex justify-between text-[9px] font-mono ${isLight ? 'text-[#64748b]' : 'text-slate-500'}`}>
                <span>
                  Status:{' '}
                  <strong
                    className={
                      selectedNode.health < 50
                        ? isLight ? 'text-rose-600 font-bold' : 'text-rose-400'
                        : selectedNode.health < 80
                        ? isLight ? 'text-amber-600 font-bold' : 'text-amber-400'
                        : isLight ? 'text-emerald-600 font-bold' : 'text-emerald-400'
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
                    <span className={`font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      +{predictedHealthMap[selectedNode.id] - selectedNode.health}% Post-Repair
                    </span>
                  )}
              </div>
            </div>

            {/* Active Procedure Context */}
            {selectedActionTitle && (
              <div className={`text-[10px] space-y-1 p-2 rounded-lg border ${isLight ? 'bg-amber-50/80 border-amber-300 text-amber-950' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <span className={`font-bold block ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>Assigned Procedure:</span>
                <span className={`block truncate ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>{selectedActionTitle}</span>
              </div>
            )}

            {/* Upstream & Downstream Counts */}
            <div className={`text-[10px] space-y-1 pt-1 border-t ${isLight ? 'border-[#e2ddd1] text-[#475569]' : 'border-slate-800 text-slate-400'}`}>
              <div className="flex justify-between">
                <span>Upstream Causes:</span>
                <strong className={isLight ? 'text-[#0284c7]' : 'text-cyan-400'}>
                  {upstreamNodeIds.size > 0 ? `${upstreamNodeIds.size} nodes` : 'Direct Source'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Downstream Cascade:</span>
                <strong className={isLight ? 'text-[#d97706]' : 'text-amber-400'}>
                  {downstreamNodeIds.size > 0 ? `${downstreamNodeIds.size} nodes` : 'Terminal Node'}
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`absolute top-14 right-4 z-30 max-w-xs w-72 rounded-xl border p-3 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2 pointer-events-auto ${
              isLight ? 'border-[#00A896] bg-white/98 text-[#0c1117]' : 'border-sky-500/50 bg-[#080d16]/95 text-slate-200'
            }`}
          >
            <div className={`flex items-start justify-between gap-1.5 border-b pb-1.5 ${isLight ? 'border-[#e2ddd1]' : 'border-slate-800'}`}>
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
                  <span className={`font-bold text-xs truncate block ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
                    {selectedNode.label}
                  </span>
                  <span className={`text-[9px] capitalize block ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
                    {selectedNode.region.replace('_', ' ')} · {selectedNode.subType}
                  </span>
                </div>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(null);
                }}
                className={`p-0.5 rounded cursor-pointer ${isLight ? 'text-[#475569] hover:text-[#0c1117] hover:bg-[#f4efe6]' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                title="Deselect / Clear corridor focus"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center">
              <div className={`p-1 rounded border ${isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900 border-slate-800'}`}>
                <span className={`text-[8px] uppercase block ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Health</span>
                <span
                  className={`font-black text-xs ${
                    selectedNode.health < 50
                      ? isLight ? 'text-rose-600' : 'text-rose-400'
                      : selectedNode.health < 80
                      ? isLight ? 'text-amber-600' : 'text-amber-400'
                      : isLight ? 'text-emerald-600' : 'text-emerald-400'
                  }`}
                >
                  {selectedNode.health}%
                </span>
              </div>
              <div className={`p-1 rounded border ${isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900 border-slate-800'}`}>
                <span className={`text-[8px] uppercase block ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>State</span>
                <span
                  className={`font-black text-[9px] uppercase truncate block ${
                    selectedNode.criticality === 'critical'
                      ? isLight ? 'text-rose-600' : 'text-rose-400'
                      : selectedNode.criticality === 'warning'
                      ? isLight ? 'text-amber-600' : 'text-amber-400'
                      : isLight ? 'text-emerald-600' : 'text-emerald-400'
                  }`}
                >
                  {selectedNode.reconciliationStatus
                    ? selectedNode.reconciliationStatus.toUpperCase()
                    : selectedNode.criticality}
                </span>
              </div>
              <div className={`p-1 rounded border ${isLight ? 'bg-[#faf7f2] border-[#e2ddd1]' : 'bg-slate-900 border-slate-800'}`}>
                <span className={`text-[8px] uppercase block ${isLight ? 'text-[#64748b]' : 'text-slate-400'}`}>Impact</span>
                <span
                  className={`font-black text-[9px] uppercase block ${
                    selectedNode.criticality === 'critical'
                      ? isLight ? 'text-rose-600' : 'text-rose-400'
                      : selectedNode.criticality === 'warning'
                      ? isLight ? 'text-amber-600' : 'text-amber-400'
                      : isLight ? 'text-[#64748b]' : 'text-slate-400'
                  }`}
                >
                  {selectedNode.criticality === 'critical' ? 'HIGH' : selectedNode.criticality === 'warning' ? 'MED' : 'LOW'}
                </span>
              </div>
            </div>

            <div className={`text-[10px] space-y-1 pt-1 border-t ${isLight ? 'border-[#e2ddd1]' : 'border-slate-800'}`}>
              <div className={`flex items-center justify-between ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
                <span>Upstream Causes:</span>
                <strong className={isLight ? 'text-[#0284c7]' : 'text-cyan-400'}>{upstreamNodeIds.size > 0 ? `${upstreamNodeIds.size} nodes` : 'Root'}</strong>
              </div>
              <div className={`flex items-center justify-between ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
                <span>Downstream Cascade:</span>
                <strong className={isLight ? 'text-[#d97706]' : 'text-amber-400'}>{downstreamNodeIds.size > 0 ? `${downstreamNodeIds.size} nodes` : 'None'}</strong>
              </div>
              {selectedNodeConnectedEdges.length > 0 && (
                <div className={`flex items-center justify-between pt-0.5 ${isLight ? 'text-[#475569]' : 'text-slate-400'}`}>
                  <span>Peak Attention:</span>
                  <strong className={isLight ? 'text-[#d97706]' : 'text-amber-300'}>
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
