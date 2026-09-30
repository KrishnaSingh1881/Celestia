import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * OrbitGraphDemo — self-contained preview build, WITH drag support.
 *
 * Fixes vs. the first pass:
 *   1. Explicit pixel SVG height (not 100%/100vh) — percentage heights
 *      can collapse to 0 inside a nested preview iframe, which is why
 *      the first version looked frozen. Physics was running, the box
 *      was just invisible.
 *   2. Real drag: pointer-down pins a node's (fx, fy), pointer-move
 *      updates it via proper client->SVG coordinate mapping (accounts
 *      for the viewBox scale), pointer-up releases it back to physics.
 *   3. Alpha ("heat") decay: the simulation settles down and stops
 *      recalculating once it's stable, then "reheats" to 1 whenever
 *      you grab a node — this is why it's normal for motion to fade
 *      out after a few seconds; that's it settling, not dying.
 *   4. Boundary clamping so nodes can't drift off-canvas.
 *
 * No pinch/zoom here — the real component doesn't have custom
 * pinch/zoom code either, only drag. If you want zoom, that's a new
 * addition, not something ported from the working version.
 */

interface OrbitNode {
  id: string;
  kind: 'center' | 'category' | 'item' | 'child';
  label: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  fixed: boolean;
  data: unknown;
}

interface OrbitEdge {
  source: string;
  target: string;
  length: number;
}

interface CategoryConfig<T = any> {
  key: string;
  label: string;
  color?: string;
  items: T[];
  getId?: (item: T, index: number) => string;
  getLabel?: (item: T) => string;
  getColor?: (item: T) => string;
  getChildren?: (item: T) => any[];
  getChildId?: (child: any, index: number) => string;
  getChildLabel?: (child: any) => string;
  getChildColor?: (child: any) => string;
}

interface OrbitGraphProps {
  centerLabel?: string;
  categories?: CategoryConfig[];
  onNodeClick?: (node: OrbitNode) => void;
  width?: number;
  height?: number;
}

const WIDTH = 960;
const HEIGHT = 560;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const CATEGORY_RADIUS = 190;
const LEAF_RADIUS = 105;
const GRANDCHILD_RADIUS = 50;

function ringPoint(base: { x: number; y: number }, i: number, total: number, r: number) {
  const angle = (i / Math.max(1, total)) * Math.PI * 2;
  return { x: base.x + Math.cos(angle) * r, y: base.y + Math.sin(angle) * r };
}

function buildGraph(centerLabel: string, categories: CategoryConfig[]): { nodes: OrbitNode[]; edges: OrbitEdge[] } {
  const nodes: OrbitNode[] = [];
  const edges: OrbitEdge[] = [];

  const centerId = 'orbit-center';
  nodes.push({
    id: centerId, kind: 'center', label: centerLabel, color: '#818cf8', radius: 26,
    x: CENTER.x, y: CENTER.y, vx: 0, vy: 0, fx: CENTER.x, fy: CENTER.y, fixed: true, data: null,
  });

  categories.forEach((cat, ci) => {
    const items = cat.items || [];
    const catPos = ringPoint(CENTER, ci, categories.length, CATEGORY_RADIUS);
    const catId = `category-${cat.key}`;

    nodes.push({
      id: catId, kind: 'category', label: `${cat.label} (${items.length})`,
      color: cat.color || '#94a3b8', radius: 18,
      x: catPos.x, y: catPos.y, vx: 0, vy: 0, fx: null, fy: null, fixed: false,
      data: { key: cat.key, label: cat.label, count: items.length },
    });
    edges.push({ source: centerId, target: catId, length: CATEGORY_RADIUS });

    items.forEach((item, ii) => {
      const getId = cat.getId || ((it: any, idx: number) => it.id ?? `${cat.key}-${idx}`);
      const getLabel = cat.getLabel || ((it: any) => it.label ?? String(it));
      const getColor = cat.getColor || (() => cat.color || '#94a3b8');
      const getChildren = cat.getChildren || (() => []);

      const itemId = `item-${cat.key}-${getId(item, ii)}`;
      const pos = ringPoint(catPos, ii, items.length, LEAF_RADIUS);
      const children = getChildren(item) || [];

      nodes.push({
        id: itemId, kind: 'item', label: getLabel(item), color: getColor(item),
        radius: 11 + Math.min(8, children.length),
        x: pos.x, y: pos.y, vx: 0, vy: 0, fx: null, fy: null, fixed: false, data: item,
      });
      edges.push({ source: catId, target: itemId, length: LEAF_RADIUS });

      children.forEach((child, gi) => {
        const getChildId = cat.getChildId || ((c: any, idx: number) => c.id ?? `${itemId}-${idx}`);
        const getChildLabel = cat.getChildLabel || ((c: any) => c.label ?? String(c));
        const getChildColor = cat.getChildColor || (() => getColor(item));

        const childId = `child-${itemId}-${getChildId(child, gi)}`;
        const cpos = ringPoint(pos, gi, Math.max(1, children.length), GRANDCHILD_RADIUS);

        nodes.push({
          id: childId, kind: 'child', label: getChildLabel(child), color: getChildColor(child),
          radius: 5, x: cpos.x, y: cpos.y, vx: 0, vy: 0, fx: null, fy: null, fixed: false, data: child,
        });
        edges.push({ source: itemId, target: childId, length: GRANDCHILD_RADIUS });
      });
    });
  });

  return { nodes, edges };
}

function OrbitGraph({ centerLabel = 'Entity', categories = [], onNodeClick, width = WIDTH, height = HEIGHT }: OrbitGraphProps) {
  const graphKey = useMemo(
    () => JSON.stringify(categories.map((c) => [c.key, (c.items || []).length])),
    [centerLabel, categories]
  );

  const nodesRef = useRef<OrbitNode[]>([]);
  const edgesRef = useRef<OrbitEdge[]>([]);
  const alphaRef = useRef(1);
  const draggingRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, forceTick] = useState(0);
  const [hovered, setHovered] = useState<OrbitNode | null>(null);

  useEffect(() => {
    const built = buildGraph(centerLabel, categories);
    nodesRef.current = built.nodes;
    edgesRef.current = built.edges;
    alphaRef.current = 1;
  }, [graphKey]);

  useEffect(() => {
    let frame: number;
    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const alpha = alphaRef.current;

      if (alpha > 0.002) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = Math.max(1, dx * dx + dy * dy);
            const dist = Math.sqrt(distSq);
            const force = (2400 * alpha) / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a.fx == null) { a.vx -= fx; a.vy -= fy; }
            if (b.fx == null) { b.vx += fx; b.vy += fy; }
          }
        }

        edges.forEach((e) => {
          const a = nodes.find((n) => n.id === e.source);
          const b = nodes.find((n) => n.id === e.target);
          if (!a || !b) return;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const displacement = (dist - e.length) * 0.06 * alpha;
          const fx = (dx / dist) * displacement;
          const fy = (dy / dist) * displacement;
          if (a.fx == null) { a.vx += fx; a.vy += fy; }
          if (b.fx == null) { b.vx -= fx; b.vy -= fy; }
        });

        for (const n of nodes) {
          if (n.fx != null && n.fy != null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.vx += (CENTER.x - n.x) * 0.002 * alpha;
          n.vy += (CENTER.y - n.y) * 0.002 * alpha;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(n.radius, Math.min(WIDTH - n.radius, n.x));
          n.y = Math.max(n.radius, Math.min(HEIGHT - n.radius, n.y));
        }

        alphaRef.current *= 0.985;
        forceTick((t) => t + 1);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  };

  const handlePointerDown = (nodeId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node && node.kind === 'center') return; // center stays pinned
    draggingRef.current = nodeId;
    alphaRef.current = 1; // reheat so it responds immediately
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
      if (node) { node.fx = null; node.fy = null; }
    }
    draggingRef.current = null;
  };

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ background: '#0f172a', touchAction: 'none', display: 'block' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <g opacity={0.25} stroke="#94a3b8" strokeWidth={1}>
        {edges.map((e, i) => {
          const s = nodes.find((n) => n.id === e.source);
          const t = nodes.find((n) => n.id === e.target);
          if (!s || !t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} />;
        })}
      </g>

      <g>
        {nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            onPointerDown={handlePointerDown(n.id)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered((h) => (h && h.id === n.id ? null : h))}
            onClick={() => onNodeClick && onNodeClick(n)}
            style={{ cursor: n.kind === 'center' ? 'default' : 'grab' }}
          >
            <circle r={n.radius} fill={n.color} opacity={n.kind === 'center' ? 1 : 0.85} />
            <text y={n.radius + 14} textAnchor="middle" fontSize={n.kind === 'child' ? 9 : 11} fill="#e2e8f0">
              {n.label}
            </text>
          </g>
        ))}
      </g>

      {hovered && (
        <foreignObject x={Math.min(width - 220, hovered.x + 20)} y={Math.max(0, hovered.y - 20)} width={220} height={120}>
          <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 12 }}>
            <strong>{hovered.label}</strong>
            {hovered.data != null && (
              <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 10, opacity: 0.8 }}>
                {JSON.stringify(hovered.data, null, 2).slice(0, 200)}
              </pre>
            )}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------
// Sample data — deliberately generic, swap for your real categories.
// ---------------------------------------------------------------

interface SampleItem {
  id: string;
  label: string;
  status: 'good' | 'warn' | 'bad';
  children?: { id: string; label: string; status: 'good' | 'warn' | 'bad' }[];
}

const STATUS_COLOR: Record<SampleItem['status'], string> = {
  good: '#34d399', warn: '#f59e0b', bad: '#f87171',
};

const sampleCategories: CategoryConfig<SampleItem>[] = [
  {
    key: 'category-1', label: 'Category 1', color: '#f59e0b',
    items: [
      { id: 'a', label: 'Item A', status: 'bad', children: [
        { id: 'a1', label: 'Detail 1', status: 'bad' },
        { id: 'a2', label: 'Detail 2', status: 'warn' },
        { id: 'a3', label: 'Detail 3', status: 'good' },
      ]},
      { id: 'b', label: 'Item B', status: 'warn' },
    ],
    getColor: (item) => STATUS_COLOR[item.status],
    getChildren: (item) => item.children || [],
    getChildLabel: (child) => child.label,
    getChildColor: (child) => STATUS_COLOR[child.status],
  },
  {
    key: 'category-2', label: 'Category 2', color: '#38bdf8',
    items: [
      { id: 'c', label: 'Item C', status: 'good' },
      { id: 'd', label: 'Item D', status: 'good' },
      { id: 'e', label: 'Item E', status: 'warn' },
    ],
    getColor: (item) => STATUS_COLOR[item.status],
  },
  { key: 'category-3', label: 'Category 3', color: '#a855f7', items: [] },
  {
    key: 'category-4', label: 'Category 4', color: '#34d399',
    items: [{ id: 'f', label: 'Item F', status: 'good' }],
    getColor: (item) => STATUS_COLOR[item.status],
  },
];

export default function OrbitGraphDemo() {
  return (
    <div style={{ width: '100%', background: '#0f172a', padding: 12 }}>
      <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px' }}>
        Drag any node. It settles after a few seconds — that's the simulation
        cooling down, not stopping. Grab a node again to reheat it.
      </p>
      <OrbitGraph
        centerLabel="Sample Entity"
        categories={sampleCategories}
        onNodeClick={(node) => console.log('clicked', node)}
      />
    </div>
  );
}
