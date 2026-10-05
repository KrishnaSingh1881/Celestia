import { Activity, Clock, Radio, ShieldAlert, ShieldCheck, TrendingUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEngineStore } from '../../store/useEngineStore';
import { useMissionStore } from '../../store/useMissionStore';
import { useThemeStore } from '../../store/useThemeStore';
import { SCENARIOS } from '../../types/scenarios';
import ThemeSwitcher from './ThemeSwitcher';

export default function TopBar() {
  const location = useLocation();
  const isMaintenance = location.pathname === '/maintenance';

  const connected = useEngineStore((s) => s.connected);
  const residual = useEngineStore((s) => s.residual);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const rul = useEngineStore((s) => s.rul);
  const risk = useEngineStore((s) => s.risk);

  const scenarioId = useMissionStore((s) => s.scenarioId);
  const currentTime = useMissionStore((s) => s.currentTime);
  const currentScenario = SCENARIOS[scenarioId];

  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

  const anyFlagged = residual ? Object.values(residual.flags).some(Boolean) : false;
  const topCause = diagnosis?.hypotheses[0];

  return (
    <header className={`px-5 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-sm select-none z-30 transition-colors duration-200 border-b ${
      isLight ? 'bg-[#f4efe6] border-[#e2ddd1] text-[#0c1117]' : 'bg-[#090d14] border-slate-800/80 text-slate-100 shadow-lg'
    }`}>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className={`text-xs font-black tracking-tight uppercase ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
            AeroTwin Digital Twin
          </span>
        </div>

        <span className={isLight ? 'text-slate-300' : 'text-slate-700'}>|</span>

        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold font-mono ${
          isLight
            ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        }`}>
          <Radio size={11} className="animate-pulse" />
          <span>SYNCHRONIZED</span>
        </div>

        <span className={isLight ? 'text-slate-300' : 'text-slate-700'}>|</span>

        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className={`uppercase font-sans font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {isMaintenance ? 'DOCK / HANGAR:' : 'Scenario:'}
          </span>
          <span className={`font-bold uppercase ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
            {isMaintenance ? 'GROUNDED WORKSTATION' : currentScenario.name}
          </span>
          <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>·</span>
          <span className={isMaintenance ? (isLight ? 'text-amber-800 font-bold' : 'text-amber-400 font-bold') : (isLight ? 'text-slate-600' : 'text-slate-400')}>
            {isMaintenance ? 'MAINTENANCE WINDOW' : `t=${currentTime.toFixed(1)}s`}
          </span>
        </div>
      </div>

      {/* Real Pipeline Stage Indicators */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5">
        <span className={`text-[10px] font-black uppercase tracking-wider hidden xl:inline ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Pipeline:
        </span>

        {/* 1. Detection Stage */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs transition-all shadow-xs ${
            anyFlagged
              ? isLight
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              : isLight
              ? 'bg-white border-[#e2ddd1] text-[#0c1117]'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
          title="Detection: Mahalanobis distance & residual thresholds"
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              anyFlagged
                ? isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-400'
                : isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {anyFlagged ? <ShieldAlert size={12} strokeWidth={2.4} /> : <ShieldCheck size={12} strokeWidth={2.4} />}
          </div>
          <div className="flex flex-col">
            <span className={`text-[9px] font-bold leading-none ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>DETECTION</span>
            <span className={`text-[11px] font-black leading-none mt-0.5 ${
              anyFlagged
                ? isLight ? 'text-rose-700' : 'text-rose-400'
                : isLight ? 'text-[#0c1117]' : 'text-slate-100'
            }`}>
              {anyFlagged ? 'ANOMALY' : 'NOMINAL'}
            </span>
          </div>
        </div>

        {/* 2. Diagnosis Stage */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs transition-all shadow-xs ${
            topCause && topCause.probability > 0.5 && topCause.cause !== 'healthy'
              ? isLight
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
              : isLight
              ? 'bg-white border-[#e2ddd1] text-[#0c1117]'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
          title="Causal health graph: ranked root-cause diagnosis"
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center ${
              topCause && topCause.probability > 0.5 && topCause.cause !== 'healthy'
                ? isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'
                : isLight ? 'bg-cyan-100 text-[#00a896]' : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            <Activity size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className={`text-[9px] font-bold leading-none ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>DIAGNOSIS</span>
            <span className={`text-[11px] font-black leading-none mt-0.5 truncate max-w-[130px] ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
              {topCause ? topCause.cause.replaceAll('_', ' ') : 'healthy'}
            </span>
          </div>
        </div>

        {/* 3. Prognosis / RUL Stage */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs shadow-xs ${
            isLight
              ? 'bg-white border-[#e2ddd1] text-[#0c1117]'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
          title="Remaining useful life (50th percentile)"
        >
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
            isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'
          }`}>
            <Clock size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className={`text-[9px] font-bold leading-none ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>RUL (Q50)</span>
            <span className={`text-[11px] font-black leading-none mt-0.5 font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>
              {rul ? rul.q50_h.toFixed(0) : '--'}{' '}
              <span className={`text-[9px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>HRS</span>
            </span>
          </div>
        </div>

        {/* 4. Risk / Aircraft State Stage */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs shadow-xs ${
            isLight
              ? 'bg-white border-[#e2ddd1] text-[#0c1117]'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
          title={isMaintenance ? 'Aircraft grounded in maintenance dock' : 'Mission risk tier & survival probability'}
        >
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
            isMaintenance
              ? isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'
              : isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            <TrendingUp size={12} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <span className={`text-[9px] font-bold leading-none ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {isMaintenance ? 'AIRCRAFT' : 'MISSION'}
            </span>
            <span
              className={`text-[11px] font-black leading-none mt-0.5 ${
                isMaintenance
                  ? isLight ? 'text-amber-800 font-bold' : 'text-amber-400'
                  : risk?.tier === 'Critical' || risk?.tier === 'Warning'
                  ? isLight ? 'text-rose-700' : 'text-rose-400'
                  : risk?.tier === 'Caution' || risk?.tier === 'Advisory'
                  ? isLight ? 'text-amber-800' : 'text-amber-400'
                  : isLight ? 'text-emerald-700' : 'text-emerald-400'
              }`}
            >
              {isMaintenance ? 'GROUNDED' : risk?.tier ?? '--'}
            </span>
          </div>
        </div>

        <span className={isLight ? 'text-slate-300 hidden sm:inline' : 'text-slate-700 hidden sm:inline'}>|</span>

        {/* Theme Mode Switcher (Warm Ivory / Obsidian) */}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
