import type { CausalEdgeData, CausalNodeData } from '../types/causalGraph';

export interface LayoutSeedResult {
  x: number;
  y: number;
  subsystemIndex: number;
}

export const REGION_X_POSITIONS = [120, 370, 630, 890, 1140, 1370];

export const SUBSYSTEM_STREAMS = [
  { name: 'Thermal Dissipation Loop', targetY: 170, color: '#06b6d4' },
  { name: 'Combustion & Cylinder Core', targetY: 340, color: '#f59e0b' },
  { name: 'Dry-Sump Lubrication Circuit', targetY: 510, color: '#38bdf8' },
  { name: 'Crankcase & Tribology Assembly', targetY: 680, color: '#f43f5e' },
  { name: 'Drivetrain & Mission Directives', targetY: 850, color: '#10b981' },
];

// Backwards compatibility aliases
export const PARALLEL_LANE_Y = SUBSYSTEM_STREAMS.map((s) => s.targetY);
export const LANE_NAMES = SUBSYSTEM_STREAMS.map((s) => s.name);

/**
 * Deterministically classify any graph node into one of the 5 subsystem streams
 * (thermal, combustion, lubrication, tribology/crankcase, drivetrain/mission)
 * to provide natural vertical separation without rigid grid locking.
 */
export function getSubsystemStreamIndex(node: CausalNodeData, edges: CausalEdgeData[]): number {
  const id = node.id.toLowerCase();
  const label = node.label.toLowerCase();

  // 1. Thermal / Cooling Stream
  if (
    id.includes('coolant') ||
    id.includes('cooling') ||
    id.includes('ambient') ||
    id.includes('thermal_saturation') ||
    label.includes('coolant') ||
    label.includes('cooling') ||
    label.includes('ambient') ||
    label.includes('thermal saturation')
  ) {
    return 0;
  }

  // 2. Combustion & Cylinder Stream
  if (
    id.includes('cylinder') ||
    id.includes('cht') ||
    id.includes('egt') ||
    id.includes('ring_scuff') ||
    label.includes('cylinder') ||
    label.includes('cht') ||
    label.includes('thermocouple') ||
    label.includes('piston ring')
  ) {
    return 1;
  }

  // 3. Lubrication & Oil Stream
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

  // 4. Crankcase, Bearing & Vibration Stream
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
    label.includes('accelerometer') ||
    label.includes('seizure')
  ) {
    return 3;
  }

  // 5. Drivetrain, Climb, Power Deficit & Flight Mission Directives
  if (
    id.includes('gearbox') ||
    id.includes('prop') ||
    id.includes('rtb') ||
    id.includes('power_deficit') ||
    id.includes('climb') ||
    id.includes('mission_continue') ||
    label.includes('gearbox') ||
    label.includes('power deficit') ||
    label.includes('climb') ||
    label.includes('emergency rtb') ||
    label.includes('mission continue')
  ) {
    return 4;
  }

  // Fallback: Infer stream from direct connections
  const incoming = edges.filter((e) => e.target === node.id);
  if (incoming.length > 0) {
    const parentId = incoming[0].source.toLowerCase();
    if (parentId.includes('cool') || parentId.includes('ambient')) return 0;
    if (parentId.includes('cyl') || parentId.includes('cht')) return 1;
    if (parentId.includes('oil') || parentId.includes('lube')) return 2;
    if (parentId.includes('crank') || parentId.includes('bearing') || parentId.includes('vibe')) return 3;
    if (parentId.includes('gear') || parentId.includes('risk') || parentId.includes('power')) return 4;
  }

  return 2; // Default middle stream
}

// Backwards compatibility alias
export const getCausalLaneIndex = getSubsystemStreamIndex;

/**
 * Computes organic seed positions for all nodes.
 * Column staging (X) guarantees clean left-to-right causal progression (Evidence -> Risk).
 * Subsystem stream (Y) gives organic vertical breathing room ("a lil separation")
 * so failure chains don't collapse or clutter, while letting OrbitGraph physics flex freely.
 */
export function computeOrbitSeedPositions(
  nodes: CausalNodeData[],
  edges: CausalEdgeData[],
  _graphWidth = 1480,
  graphHeight = 1000,
): Map<string, LayoutSeedResult> {
  const layoutMap = new Map<string, LayoutSeedResult>();

  // Group nodes by [regionIndex]
  const regionGroups: Record<number, CausalNodeData[]> = {};
  for (let r = 0; r < 6; r++) {
    regionGroups[r] = [];
  }

  nodes.forEach((node) => {
    const reg = Math.max(0, Math.min(5, node.regionIndex));
    regionGroups[reg].push(node);
  });

  // For each causal column, sort nodes by their subsystem affinity
  // then distribute them with natural vertical spacing
  for (let reg = 0; reg < 6; reg++) {
    const colNodes = regionGroups[reg] ?? [];
    if (colNodes.length === 0) continue;

    // Sort by subsystem stream index
    const sorted = [...colNodes].sort((a, b) => {
      const sA = getSubsystemStreamIndex(a, edges);
      const sB = getSubsystemStreamIndex(b, edges);
      if (sA !== sB) return sA - sB;
      return a.id.localeCompare(b.id);
    });

    const colX = REGION_X_POSITIONS[reg] ?? 120 + reg * 250;

    // Distribute vertically across available height with balanced top/bottom margins
    const topMargin = 150;
    const bottomMargin = 120;
    const availableH = graphHeight - topMargin - bottomMargin;
    const step = colNodes.length > 1 ? availableH / (colNodes.length - 1) : 0;

    sorted.forEach((node, idx) => {
      const streamIdx = getSubsystemStreamIndex(node, edges);
      const idealStreamY = SUBSYSTEM_STREAMS[streamIdx]?.targetY ?? 500;
      
      // Blend ideal subsystem target Y with indexed distribution to guarantee vertical spacing
      const distributedY = colNodes.length > 1 ? topMargin + idx * step : graphHeight / 2;
      const initialY = distributedY * 0.65 + idealStreamY * 0.35;

      layoutMap.set(node.id, {
        x: colX,
        y: initialY,
        subsystemIndex: streamIdx,
      });
    });
  }

  return layoutMap;
}

// Backwards compatibility alias
export const computeParallelCausalLanes = computeOrbitSeedPositions;
