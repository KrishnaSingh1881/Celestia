import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * OrbitGraph — a read-only-to-your-database, draggable-in-the-UI
 * force-directed visualization of one entity and its data across a
 * fixed set of categories.
 *
 * See ORBIT_GRAPH_PATTERN.md for the full rule set. Quick recap:
 *   - Center node = the entity. Category nodes always render, even
 *     empty. Leaf nodes map 1:1 to real items you pass in.
 *   - Node position is physics-only, recomputed every mount, never
 *     meant to be read as data.
 *   - Nodes ARE draggable by the user (mouse/touch) — that's a UI
 *     convenience, not a write: dragging only ever changes local x/y
 *     in memory. This component makes ZERO network calls and ZERO
 *     writes. Fetching data and reacting to clicks (onNodeClick) is
 *     entirely the caller's job.
 *   - No built-in pinch/zoom. Add it yourself if you need it — it's
 *     not part of this pattern.
 *
 * USAGE
 * <OrbitGraph
 *   centerLabel="Ada Lovelace"
 *   categories={[
 *     {
 *       key: 'gaps', label: 'Learning Gaps', color: '#f59e0b',
 *       items: gaps,                              // real array from your API
 *       getId: (g) => g.id,
 *       getLabel: (g) => g.concept,
 *       getColor: (g) => STATUS_COLOR[g.status],   // optional per-item color
 *       getChildren: (g) => g.evidence,            // optional, for a 3rd ring
 *     },
 *     { key: 'topics', label: 'Study Topics', color: '#38bdf8', items: topics, ... },
 *   ]}
 *   onNodeClick={(node) => console.log(node)}
 * />
 */

const WIDTH = 960;
const HEIGHT = 560;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const CATEGORY_RADIUS = 190;
const LEAF_RADIUS = 105;
const GRANDCHILD_RADIUS = 50;

/** Point at radius `r` from `base`, spread evenly among `total` siblings at index `i`. */
function ringPoint(base, i, total, r) {
  const angle = (i / Math.max(1, total)) * Math.PI * 2;
  return { x: base.x + Math.cos(angle) * r, y: base.y + Math.sin(angle) * r };
}

/** Rule 3 + 12: build one node per real row, seeded on rings around its parent. */
function buildGraph(centerLabel, categories) {
  const nodes = [];
  const edges = [];

  const centerId = 'orbit-center';
  nodes.push({
    id: centerId, kind: 'center', label: centerLabel, color: '#818cf8', radius: 26,
    x: CENTER.x, y: CENTER.y, vx: 0, vy: 0, fx: CENTER.x, fy: CENTER.y, fixed: true, data: null,
  });

  categories.forEach((cat, ci) => {
    const items = cat.items || [];
    const catPos = ringPoint(CENTER, ci, categories.length, CATEGORY_RADIUS);
    const catId = `category-${cat.key}`;

    // Rule 2: category anchor ALWAYS renders, even at zero items.
    nodes.push({
      id: catId, kind: 'category', label: `${cat.label} (${items.length})`,
      color: cat.color || '#94a3b8', radius: 18,
      x: catPos.x, y: catPos.y, vx: 0, vy: 0, fx: null, fy: null, fixed: false,
      data: { key: cat.key, label: cat.label, count: items.length },
    });
    edges.push({ source: centerId, target: catId, length: CATEGORY_RADIUS });

    items.forEach((item, ii) => {
      const getId = cat.getId || ((it, idx) => it.id ?? `${cat.key}-${idx}`);
      const getLabel = cat.getLabel || ((it) => it.label ?? String(it));
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

      // Optional third ring (Rule 3: still one node per real row).
      children.forEach((child, gi) => {
        const getChildId = cat.getChildId || ((c, idx) => c.id ?? `${itemId}-${idx}`);
        const getChildLabel = cat.getChildLabel || ((c) => c.label ?? String(c));
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

export default function OrbitGraph({ centerLabel = 'Entity', categories = [], onNodeClick, width = WIDTH, height = HEIGHT }) {
  const graphKey = useMemo(
    () => JSON.stringify(categories.map((c) => [c.key, (c.items || []).length])),
    [centerLabel, categories]
  );

  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const alphaRef = useRef(1); // Rule 18: "heat" — decays as the layout settles, reheats on drag.
  const draggingRef = useRef(null);
  const svgRef = useRef(null);
  const [, forceTick] = useState(0);
  const [hovered, setHovered] = useState(null);

  // Rule 17: a data change is a brand-new graph — reseed, don't interpolate.
  useEffect(() => {
    const built = buildGraph(centerLabel, categories);
    nodesRef.current = built.nodes;
    edgesRef.current = built.edges;
    alphaRef.current = 1;
  }, [graphKey]);

  useEffect(() => {
    let frame;
    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const alpha = alphaRef.current;

      // Rule 18: skip recompute once settled — saves CPU, and dragging
      // (which resets alpha to 1) is what wakes it back up.
      if (alpha > 0.002) {
        // Rule 8: pairwise repulsion, O(n^2) — fine at typical node counts.
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

        // Rule 9: spring edges pulling toward each ring's rest length.
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

        // Rule 10 + 11: damp, integrate, keep in bounds.
        for (const n of nodes) {
          if (n.fx != null && n.fy != null) {
            n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0;
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

  // Rule 19: client-pixel -> SVG-coordinate mapping, accounting for the
  // viewBox scale factor — required for drag to track the cursor correctly
  // at any rendered size.
  const toSvgPoint = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  };

  const handlePointerDown = (nodeId) => (e) => {
    e.stopPropagation();
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node && node.kind === 'center') return; // center stays pinned
    draggingRef.current = nodeId;
    alphaRef.current = 1;
  };

  const handlePointerMove = (e) => {
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
      height={height} // IMPORTANT: explicit pixel height. A percentage
                       // ("100%"/"100vh") can collapse to 0 inside a
                       // nested container and make the whole thing look
                       // dead even though the physics loop is running.
      style={{ background: 'transparent', touchAction: 'none', display: 'block' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Rule 15: edges drawn under nodes, low-opacity, no arrowheads. */}
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
            <text
              y={n.radius + 14}
              textAnchor="middle"
              fontSize={n.kind === 'child' ? 9 : 11}
              fill="#e2e8f0"
            >
              {n.label}
            </text>
          </g>
        ))}
      </g>

      {/* Rule 16: hover reads straight from the node's own attached data. */}
      {hovered && (
        <foreignObject x={Math.min(width - 220, hovered.x + 20)} y={Math.max(0, hovered.y - 20)} width={220} height={120}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 10px',
              color: '#e2e8f0',
              fontSize: 12,
            }}
          >
            <strong>{hovered.label}</strong>
            {hovered.data && (
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
