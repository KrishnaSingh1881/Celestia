import type { CausalEdgeData, CausalNodeData } from '../types/causalGraph';

export interface LaneLayoutResult {
  x: number;
  y: number;
  laneIndex: number;
}

export const REGION_X_POSITIONS = [110, 360, 620, 880, 1140, 1380];

// 5 Distinct Horizontal Causal Lanes (Vertical Y coordinates with generous 210px separation)
export const PARALLEL_LANE_Y = [130, 340, 550, 760, 970];

export const LANE_NAMES = [
  'Thermal Dissipation & Radiator Loop',
  'Combustion Chamber & Cylinder Core',
  'Dry-Sump Lubrication Circuit',
  'Crankcase Tribology & Bearing Assembly',
  'Propulsion Drivetrain & Mission Directives',
];

/**
 * Deterministically classify any graph node into one of the 5 parallel causal lanes
 * based on subsystem identity, failure mechanism, and topological stream.
 */
export function getCausalLaneIndex(node: CausalNodeData, edges: CausalEdgeData[]): number {
  const id = node.id.toLowerCase();
  const label = node.label.toLowerCase();

  // 1. Lane 0: Thermal / Radiator Cooling Stream
  if (
    id.includes('coolant') ||
    id.includes('cooling') ||
    id.includes('ambient') ||
    id.includes('thermal_saturation') ||
    label.includes('coolant') ||
    label.includes('cooling') ||
    label.includes('thermal saturation')
  ) {
    return 0;
  }

  // 2. Lane 1: Combustion Core & CHT Reciprocating Stream
  if (
    id.includes('cylinder') ||
    id.includes('cht') ||
    id.includes('egt') ||
    id.includes('ring_scuff') ||
    id.includes('mission_continue') ||
    label.includes('cylinder') ||
    label.includes('cht') ||
    label.includes('ring')
  ) {
    return 1;
  }

  // 3. Lane 2: Hydraulic Lubrication Stream
  if (
    id.includes('lubricat') ||
    id.includes('oil') ||
    id.includes('cavitation') ||
    id.includes('viscosity') ||
    label.includes('lubricat') ||
    label.includes('oil') ||
    label.includes('scavenge')
  ) {
    return 2;
  }

  // 4. Lane 3: Tribological Bearing & Power Section Stream
  if (
    id.includes('crank') ||
    id.includes('bearing') ||
    id.includes('vibe') ||
    id.includes('vibration') ||
    id.includes('drag') ||
    id.includes('seizure') ||
    label.includes('crankcase') ||
    label.includes('bearing') ||
    label.includes('vibration') ||
    label.includes('parasitic') ||
    label.includes('seizure')
  ) {
    return 3;
  }

  // 5. Lane 4: Drivetrain Reduction & Flight Command Stream
  if (
    id.includes('gearbox') ||
    id.includes('prop') ||
    id.includes('rtb') ||
    id.includes('power_deficit') ||
    id.includes('climb') ||
    label.includes('gearbox') ||
    label.includes('power deficit') ||
    label.includes('emergency rtb')
  ) {
    return 4;
  }

  // Fallback: Infer lane from direct upstream or downstream connections
  const incoming = edges.filter((e) => e.target === node.id);
  if (incoming.length > 0) {
    const parentId = incoming[0].source.toLowerCase();
    if (parentId.includes('cool')) return 0;
    if (parentId.includes('cyl') || parentId.includes('cht')) return 1;
    if (parentId.includes('oil') || parentId.includes('lube')) return 2;
    if (parentId.includes('crank') || parentId.includes('bearing')) return 3;
    if (parentId.includes('gear') || parentId.includes('risk')) return 4;
  }

  return 2; // Middle default lane
}

/**
 * Computes deterministic (X, Y) lane positions for all nodes.
 * Keeps related causal paths aligned horizontally across columns,
 * while separating parallel branches into dedicated vertical lanes.
 */
export function computeParallelCausalLanes(
  nodes: CausalNodeData[],
  edges: CausalEdgeData[],
  _graphWidth = 1480,
  _graphHeight = 1180,
): Map<string, LaneLayoutResult> {
  const layoutMap = new Map<string, LaneLayoutResult>();

  // Group nodes by [regionIndex][laneIndex]
  const matrix: Record<number, Record<number, CausalNodeData[]>> = {};

  nodes.forEach((node) => {
    const reg = Math.max(0, Math.min(5, node.regionIndex));
    const lane = getCausalLaneIndex(node, edges);
    if (!matrix[reg]) matrix[reg] = {};
    if (!matrix[reg][lane]) matrix[reg][lane] = [];
    matrix[reg][lane].push(node);
  });

  // Calculate coordinates with sub-lane spacing for multiple nodes in the same lane & region
  nodes.forEach((node) => {
    const reg = Math.max(0, Math.min(5, node.regionIndex));
    const lane = getCausalLaneIndex(node, edges);
    const laneNodes = matrix[reg]?.[lane] ?? [node];
    const nodeIndexInLane = laneNodes.findIndex((n) => n.id === node.id);

    const x = REGION_X_POSITIONS[reg] ?? reg * 250 + 110;
    const baseLaneY = PARALLEL_LANE_Y[lane] ?? lane * 210 + 130;

    // Sub-lane vertical distribution if multiple nodes share the exact same lane in the same column
    let y = baseLaneY;
    if (laneNodes.length > 1) {
      const step = 85;
      const offset = (nodeIndexInLane - (laneNodes.length - 1) / 2) * step;
      y = baseLaneY + offset;
    }

    // High connection nodes get slight centering prioritization
    if (node.id === 'comp_cooling' || node.id === 'comp_crankcase') {
      y = baseLaneY;
    }

    layoutMap.set(node.id, { x, y, laneIndex: lane });
  });

  return layoutMap;
}
