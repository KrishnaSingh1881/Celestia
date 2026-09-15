import { useEffect } from 'react';
import { Activity, Clock, Radio, ShieldCheck, TrendingUp } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

export default function TopBar() {
  const connected = useEngineStore((s) => s.connected);
  const connect = useEngineStore((s) => s.connect);
  const lastUpdatedAt = useEngineStore((s) => s.lastUpdatedAt);
  const residual = useEngineStore((s) => s.residual);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const rul = useEngineStore((s) => s.rul);
  const risk = useEngineStore((s) => s.risk);

  useEffect(() => {
    connect();
  }, [connect]);

  const anyFlagged = residual ? Object.values(residual.flags).some(Boolean) : false;
  const topCause = diagnosis?.hypotheses[0];

  return (
    <header className="bg-white border-b border-gray-200/80 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-xs select-none z-30">
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-black tracking-tight text-gray-900 uppercase">Engine Digital Twin</span>
        </div>
        <span className="text-gray-300">|</span>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
            connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <Radio size={11} className={connected ? 'animate-pulse text-emerald-600' : 'text-amber-500'} />
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </div>
        {lastUpdatedAt && (
          <span className="text-[10px] text-gray-400">updated {new Date(lastUpdatedAt).toLocaleTimeString()}</span>
        )}
      </div>

      {/* Pipeline stage indicators — every value here is real backend output */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider hidden xl:inline">Pipeline:</span>

        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs transition-all shadow-xs ${
            anyFlagged ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50/80 border-gray-200 text-gray-700'
          }`}
          title="Detection: Mahalanobis distance + CUSUM/GLR per channel"
        >
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${anyFlagged ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            <ShieldCheck size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 leading-none">DETECTION</span>
            <span className="text-[11px] font-black leading-none mt-0.5">{anyFlagged ? 'ALARM' : 'NOMINAL'}</span>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs transition-all shadow-xs ${
            topCause && topCause.probability > 0.5 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-gray-50/80 border-gray-200 text-gray-700'
          }`}
          title="Causal health graph: ranked root-cause diagnosis"
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              topCause && topCause.probability > 0.5 ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600'
            }`}
          >
            <Activity size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 leading-none">DIAGNOSIS</span>
            <span className="text-[11px] font-black leading-none mt-0.5 truncate max-w-[110px]">
              {topCause && topCause.probability > 0.5 ? topCause.cause.replaceAll('_', ' ') : 'healthy'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-700 text-xs shadow-xs" title="Remaining useful life (50th percentile)">
          <div className="w-5 h-5 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
            <Clock size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 leading-none">RUL</span>
            <span className="text-[11px] font-black leading-none mt-0.5 font-mono">
              {rul ? rul.q50_h.toFixed(0) : '--'} <span className="text-[9px] font-normal text-gray-400">HRS</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-700 text-xs shadow-xs" title="Mission risk / go-no-go tier">
          <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 leading-none">MISSION</span>
            <span className="text-[11px] font-black leading-none mt-0.5">{risk?.tier ?? '--'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
