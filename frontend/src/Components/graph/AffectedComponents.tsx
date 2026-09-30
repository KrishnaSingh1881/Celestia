import { useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import type { CausalNodeData } from '../../types/causalGraph';

interface AffectedComponentsProps {
  nodes: CausalNodeData[];
  selectedNodeId: string | null;
  onSelectComponent: (nodeId: string) => void;
  predictedHealthMap?: Record<string, number>;
  targetComponentId?: string | null;
  relatedComponentIds?: string[];
}

// Key physical subassemblies and thermodynamic/mechanical degradation states
const TRACKED_COMPONENT_IDS: string[] = [
  'comp_cooling',
  'state_thermal_saturation',
  'comp_lubrication',
  'state_bearing_starvation',
  'state_ring_scuff',
  'comp_cylinder',
  'comp_crankcase',
  'comp_gearbox',
  'state_parasitic_drag',
];

export default function AffectedComponents({
  nodes,
  selectedNodeId,
  onSelectComponent,
  predictedHealthMap,
  targetComponentId,
  relatedComponentIds,
}: AffectedComponentsProps) {
  // Pull live data from authentic graph nodes (single source of truth)
  const nodeMap = new Map<string, CausalNodeData>(nodes.map((n) => [n.id, n]));

  // Ensure any node selected in the graph is ALWAYS present in this table (Requirement 4 & 5)
  const componentIds = useMemo<string[]>(() => {
    const list = [...TRACKED_COMPONENT_IDS];
    if (selectedNodeId && !list.includes(selectedNodeId) && nodeMap.has(selectedNodeId)) {
      list.unshift(selectedNodeId);
    }
    if (targetComponentId && !list.includes(targetComponentId) && nodeMap.has(targetComponentId)) {
      list.unshift(targetComponentId);
    }
    return list;
  }, [selectedNodeId, targetComponentId, nodeMap]);

  const rows = componentIds.map((id: string) => {
    const node = nodeMap.get(id);
    if (!node) return null;

    const isCritical = node.criticality === 'critical' || node.activation >= 0.7;
    const isWarning = node.criticality === 'warning' || (node.activation >= 0.3 && node.activation < 0.7);
    const isSensorFault = node.criticality === 'sensor_fault';
    const isReconciled = node.reconciliationStatus === 'reconciled';

    let stateLabel = isReconciled ? 'RECONCILED' : 'NOMINAL';
    let stateColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    let impactLabel = 'LOW';
    let impactColor = 'text-slate-500';

    if (isCritical && !isReconciled) {
      stateLabel = 'CRITICAL';
      stateColor = 'text-rose-400 bg-rose-500/20 border-rose-500/40';
      impactLabel = 'HIGH';
      impactColor = 'text-rose-400 font-black';
    } else if (isWarning && !isReconciled) {
      stateLabel = node.reconciliationStatus === 'stabilized' ? 'STABILIZED' : 'WARNING';
      stateColor = 'text-amber-400 bg-amber-500/20 border-amber-500/40';
      impactLabel = 'MED';
      impactColor = 'text-amber-400 font-bold';
    } else if (isSensorFault && !isReconciled) {
      stateLabel = 'FAULT';
      stateColor = 'text-cyan-400 bg-cyan-500/20 border-cyan-500/40';
      impactLabel = 'ISOLATED';
      impactColor = 'text-cyan-400 font-bold';
    }

    return {
      id: node.id,
      name: node.label,
      subType: node.subType,
      health: node.health,
      predictedHealth: predictedHealthMap?.[node.id],
      isTarget: targetComponentId === node.id,
      isRelated: relatedComponentIds?.includes(node.id) ?? false,
      stateLabel,
      stateColor,
      impactLabel,
      impactColor,
      activation: node.activation,
      isSelected: selectedNodeId === node.id,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // Sort so target, selected, critical, and related components bubble to the top
  rows.sort((a, b) => {
    if (a.isTarget && !b.isTarget) return -1;
    if (b.isTarget && !a.isTarget) return 1;
    if (a.isSelected && !b.isSelected) return -1;
    if (b.isSelected && !a.isSelected) return 1;
    if (a.isRelated && !b.isRelated) return -1;
    if (b.isRelated && !a.isRelated) return 1;
    if (a.stateLabel === 'CRITICAL' && b.stateLabel !== 'CRITICAL') return -1;
    if (b.stateLabel === 'CRITICAL' && a.stateLabel !== 'CRITICAL') return 1;
    if (a.stateLabel === 'WARNING' && b.stateLabel === 'NOMINAL') return -1;
    if (b.stateLabel === 'WARNING' && a.stateLabel === 'NOMINAL') return 1;
    return b.activation - a.activation;
  });

  const criticalCount = rows.filter((r) => r.stateLabel === 'CRITICAL').length;
  const warningCount = rows.filter((r) => r.stateLabel === 'WARNING').length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#070b13] p-3.5 shadow-xl flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Alert02Icon} size={16} className="text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-100">
            Affected Components
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
              {warningCount} Warning
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} />
              All Systems Nominal
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-snug">
        Real-time component health and failure propagation hierarchy. Click a component to isolate its graph node and diagnostic trace.
      </p>

      {/* Component Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-slate-950/60 max-h-[300px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-black uppercase text-slate-400">
              <th className="py-2 px-3">Component / Assembly</th>
              <th className="py-2 px-2.5">Health</th>
              <th className="py-2 px-2.5">State</th>
              <th className="py-2 px-2.5">Impact</th>
              <th className="py-2 px-2 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelectComponent(row.id)}
                className={`cursor-pointer transition-colors ${
                  row.isSelected
                    ? 'bg-amber-500/15 border-l-2 border-l-amber-400'
                    : 'hover:bg-slate-900/80'
                }`}
              >
                <td className="py-2 px-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[11px] font-bold ${row.isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                        {row.name}
                      </span>
                      {row.isTarget && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[8px] font-black uppercase font-mono">
                          TARGET
                        </span>
                      )}
                      {row.isRelated && !row.isTarget && (
                        <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[8px] font-black uppercase font-mono">
                          IMPACTED
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 font-sans">{row.subType}</span>
                  </div>
                </td>
                <td className="py-2 px-2.5">
                  {row.predictedHealth && row.predictedHealth > row.health ? (
                    <div className="flex items-center gap-1">
                      <span className={`text-[11px] font-bold ${row.health < 50 ? 'text-rose-400' : row.health < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {row.health}%
                      </span>
                      <span className="text-emerald-400 font-bold text-[10px]">
                        → {row.predictedHealth}% ↑
                      </span>
                    </div>
                  ) : (
                    <span className={`text-[11px] font-bold ${row.health < 50 ? 'text-rose-400' : row.health < 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {row.health}%
                    </span>
                  )}
                </td>
                <td className="py-2 px-2.5">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${row.stateColor}`}>
                    {row.stateLabel}
                  </span>
                </td>
                <td className="py-2 px-2.5">
                  <span className={`text-[10px] ${row.impactColor}`}>
                    {row.impactLabel}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(row.id);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold transition-all ${
                      row.isSelected
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {row.isSelected ? 'Active' : 'Trace'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
