# Orbit Graph — Reusable Pattern Spec

A read-only visualization: one center node for an entity, a fixed
ring of category nodes that always render even when empty, and real
records branching out from populated categories. Node position comes
from a local physics simulation purely for layout — meaningless,
recomputed every time, never persisted. It is always a second window
onto data that already exists elsewhere, never a new source of truth.

Domain-agnostic — the entity can be a user, a project, a device, a
ticket, anything with trackable categories of data. Categories and
node types are defined per-project via config, not hardcoded.

---

## Contract

1. One center node = the entity being visualized.
2. A fixed ring of category anchor nodes always renders, even at zero
   items in that category — the full tracked shape must be visible
   before any data exists.
3. Every leaf node under a populated category maps 1:1 to a real row
   from an existing read endpoint. Do not invent nodes; do not
   aggregate silently — if it's on the graph, it's fetchable
   elsewhere too.
4. Node position (x, y) is never persisted and carries no meaning —
   don't let position imply rank, severity, or anything the viewer
   might read as data.
5. Any "verdict"/status label shown on a node may be computed locally
   in the view from the real data for readability, but must never be
   written back to the database or feed into any downstream logic
   (grading, aggregation, alerts, scores). It is the view's opinion,
   not a stored fact.
6. Zero write calls (POST/PUT/PATCH/DELETE) anywhere in the
   component. Read-only, always.

## Physics (recomputed every frame, never persisted)

7. State per node: `{ x, y, vx, vy }`. Center node is typically pinned
   (`vx = vy = 0`, fixed at canvas center) — everything else moves.
8. Repulsion: every node pushes every other node away, force falling
   off with distance (inverse-square or inverse-linear both work at
   small node counts). O(n²) is fine below a few hundred nodes — don't
   reach for a spatial index unless the node count actually demands
   it.
9. Attraction: every edge acts as a spring pulling its two nodes
   toward a target rest length (e.g. category anchors sit at a fixed
   radius from center, leaf nodes at a fixed radius from their
   category). Spring force ∝ (current distance − rest length).
10. Damping: multiply velocity by a decay factor each tick (e.g. 0.85)
    so the layout settles instead of oscillating forever.
11. Integrate: `x += vx, y += vy`, every animation frame
    (`requestAnimationFrame`, not `setInterval`).
12. Initial placement isn't random: seed category nodes at even
    angles around the center (a ring), and seed each category's
    children at even angles around their category node (a ring around
    a ring). This gives the simulation a sane starting shape instead
    of settling out of chaos, and keeps same-category items visually
    grouped.

## Rendering

13. Plain SVG, not a canvas/WebGL library — `<circle>` per node,
    `<line>`/`<path>` per edge, positions bound directly to the
    physics state each frame. No dependency beyond the framework
    already in use.
14. Circle radius encodes a real, readable quantity (e.g. record
    count attached to that node) — never used to encode the invented
    "verdict" from rule 5; that stays color/label only, so size
    remains traceable to a real number.
15. Edges are drawn under nodes, low-opacity, no arrowheads — this is
    a relationship map, not a flowchart; direction doesn't matter.
16. Hover/click reads from the node's own attached data object (the
    same real API payload the node was built from, rule 3) — never a
    second fetch. The interaction surface and the data source are the
    same object.
17. On unmount/remount (e.g. switching the selected entity), discard
    all physics state and reseed from rule 12 — don't try to
    interpolate between two different entities' graphs.
18. The physics loop tracks a decaying "heat" value (start at 1,
    multiply by ~0.985 each tick, skip recomputation once it drops
    below ~0.002). This lets the layout settle and stop burning CPU
    instead of jittering forever — settling is expected behavior, not
    the simulation dying. Any user interaction that moves a node
    (see rule 19) resets heat to 1 so the layout responds immediately.
19. Nodes are user-draggable: pointer-down on a non-center node pins
    it (`fx`/`fy`), pointer-move updates that pin using a proper
    client-pixel → SVG-coordinate conversion (via the SVG element's
    bounding rect and the viewBox scale — not raw clientX/Y), pointer-
    up releases the pin back to the simulation. The center node stays
    fixed and is not draggable. Dragging only ever changes in-memory
    x/y — it is still purely cosmetic per rule 4, and still makes zero
    write calls per rule 6.
20. The SVG element must use an explicit pixel height, not a
    percentage or viewport unit (`height="580"`, not `height="100%"`
    or `100vh`). A percentage height can resolve to 0 inside a nested
    container (an iframe, a flex child with no defined height), which
    makes the whole graph look frozen/invisible even though the
    physics loop is running correctly.
21. No pinch/zoom is part of this pattern. If a project needs it,
    that's an addition on top, not something implied by rules 1–20 —
    document it separately rather than assuming it's included.
