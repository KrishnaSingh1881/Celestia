import { useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { CausalEdgeData } from '../../types/causalGraph';

interface EdgeWeightsPanelProps {
  edges: CausalEdgeData[];
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string | null) => void;
}

export default function EdgeWeightsPanel({
  edges,
  selectedEdgeId,
  onSelectEdge,
}: EdgeWeightsPanelProps) {
  // Sort edges by attention descending so the most critical relationships are on top
  const sortedEdges = useMemo(() => {
    return [...edges].sort((a, b) => b.attention - a.attention);
  }, [edges]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return edges.find((e) => e.id === selectedEdgeId) ?? null;
  }, [edges, selectedEdgeId]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#070b13] p-4 shadow-xl space-y-3 text-slate-200">
      {/* Header and USP Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Edge Weight &amp; Dynamic Attention
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Celestia USP
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 italic font-sans">
            &ldquo;Changes with evidence, engine state and mission context.&rdquo;
          </p>
        </div>

        {selectedEdge && (
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold font-mono text-amber-300 flex items-center gap-1.5 self-start sm:self-auto">
            <span>Selected:</span>
            <span>{selectedEdge.sourceLabel} → {selectedEdge.targetLabel}</span>
            <span className="text-amber-400 font-black">({selectedEdge.attention} {selectedEdge.deltaTrend === 'up' ? '↑' : ''})</span>
            <button
              onClick={() => onSelectEdge(null)}
              className="ml-1 text-slate-400 hover:text-slate-200 text-xs"
              title="Clear edge selection"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Edge Attention List (Top 6 active relationships) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
        {sortedEdges.slice(0, 6).map((edge) => {
          const isSelected = selectedEdgeId === edge.id;
          const isActive = edge.active;

          return (
            <div
              key={edge.id}
              onClick={() => onSelectEdge(isSelected ? null : edge.id)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                  : isActive
                  ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-400/80 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase truncate" title={edge.relationshipType}>
                  {edge.relationshipType.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1 font-mono font-black text-xs">
                  <span className={isActive ? 'text-rose-400' : 'text-amber-400'}>
                    {edge.attention}
                  </span>
                  {edge.deltaTrend === 'up' && (
                    <span className="text-rose-400 text-xs font-bold animate-pulse">↑</span>
                  )}
                  {edge.deltaTrend === 'down' && (
                    <span className="text-slate-500 text-xs">↓</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-bold text-slate-200 truncate">
                <span className="truncate">{edge.sourceLabel}</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={12} className="shrink-0 text-slate-500" />
                <span className="truncate">{edge.targetLabel}</span>
              </div>

              {/* Attention Gauge Bar */}
              <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isActive ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${edge.attention * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
