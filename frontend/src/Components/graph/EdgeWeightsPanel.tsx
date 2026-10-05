import { useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { CausalEdgeData } from '../../types/causalGraph';
import { useThemeStore } from '../../store/useThemeStore';

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
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

  // Sort edges by attention descending so the most critical relationships are on top
  const sortedEdges = useMemo(() => {
    return [...edges].sort((a, b) => b.attention - a.attention);
  }, [edges]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return edges.find((e) => e.id === selectedEdgeId) ?? null;
  }, [edges, selectedEdgeId]);

  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
      isLight ? 'border-[#e2ddd1] bg-white text-[#0c1117] shadow-md' : 'border-slate-800 bg-[#070b13] text-slate-200 shadow-xl'
    }`}>
      {/* Header and USP Explanation */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b ${
        isLight ? 'border-[#e2ddd1]' : 'border-slate-800/80'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
              Edge Weight &amp; Dynamic Attention
            </span>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
              isLight ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              Celestia USP
            </span>
          </div>
          <p className={`text-[11px] mt-0.5 italic font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            &ldquo;Changes with evidence, engine state and mission context.&rdquo;
          </p>
        </div>

        {selectedEdge && (
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold font-mono flex items-center gap-1.5 self-start sm:self-auto ${
            isLight
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <span>Selected:</span>
            <span>{selectedEdge.sourceLabel} → {selectedEdge.targetLabel}</span>
            <span className={`font-black ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>({selectedEdge.attention} {selectedEdge.deltaTrend === 'up' ? '↑' : ''})</span>
            <button
              onClick={() => onSelectEdge(null)}
              className={`ml-1 text-xs ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
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
                  ? isLight
                    ? 'bg-amber-50 border-amber-500 shadow-md ring-1 ring-amber-400'
                    : 'bg-amber-500/20 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                  : isActive
                  ? isLight
                    ? 'bg-[#faf7f2] border-rose-300 hover:border-rose-400 shadow-xs'
                    : 'bg-slate-900/90 border-rose-500/40 hover:border-rose-400/80 shadow-sm'
                  : isLight
                  ? 'bg-[#faf7f2] border-[#e2ddd1] hover:border-[#00a896]'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[10px] font-mono uppercase truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`} title={edge.relationshipType}>
                  {edge.relationshipType.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-1 font-mono font-black text-xs">
                  <span className={isActive ? (isLight ? 'text-rose-700' : 'text-rose-400') : (isLight ? 'text-amber-800' : 'text-amber-400')}>
                    {edge.attention}
                  </span>
                  {edge.deltaTrend === 'up' && (
                    <span className={`text-xs font-bold animate-pulse ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>↑</span>
                  )}
                  {edge.deltaTrend === 'down' && (
                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>↓</span>
                  )}
                </div>
              </div>

              <div className={`flex items-center gap-1.5 font-bold truncate ${isLight ? 'text-[#0c1117]' : 'text-slate-200'}`}>
                <span className="truncate">{edge.sourceLabel}</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={12} className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className="truncate">{edge.targetLabel}</span>
              </div>

              {/* Attention Gauge Bar */}
              <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                <div
                  className={`h-full transition-all duration-300 ${
                    isActive ? (isLight ? 'bg-rose-600' : 'bg-rose-500') : (isLight ? 'bg-amber-600' : 'bg-amber-400')
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
