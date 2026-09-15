import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import type { FlightSimulationStatus } from '../../types/contracts';

interface MissionReliabilityPanelProps {
  missionDemandH: number;
  simStatus: FlightSimulationStatus | null;
}

type Decision = { label: string; tone: 'ready' | 'caution' | 'abort' };

function decisionForTier(tier: string | undefined): Decision {
  if (!tier) return { label: 'STANDBY', tone: 'ready' };
  if (tier === 'Nominal' || tier === 'Watch') return { label: 'READY', tone: 'ready' };
  if (tier === 'Advisory' || tier === 'Caution') return { label: 'CAUTION', tone: 'caution' };
  return { label: 'ABORT', tone: 'abort' };
}

const TONE_STYLES: Record<Decision['tone'], { bg: string; text: string; ring: string }> = {
  ready: { bg: 'rgba(16,185,129,0.14)', text: '#10B981', ring: 'rgba(16,185,129,0.3)' },
  caution: { bg: 'rgba(245,158,11,0.14)', text: '#F59E0B', ring: 'rgba(245,158,11,0.3)' },
  abort: { bg: 'rgba(244,63,94,0.16)', text: '#F43F5E', ring: 'rgba(244,63,94,0.35)' },
};

function severityLabel(probability: number): string {
  if (probability > 0.75) return 'HIGH';
  if (probability > 0.5) return 'MODERATE';
  if (probability > 0.2) return 'LOW';
  return 'NONE';
}

export default function MissionReliabilityPanel({ missionDemandH, simStatus }: MissionReliabilityPanelProps) {
  const risk = useEngineStore((s) => s.risk);
  const rul = useEngineStore((s) => s.rul);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const residual = useEngineStore((s) => s.residual);
  const connected = useEngineStore((s) => s.connected);

  const topCause = diagnosis?.hypotheses[0];
  const faultActive = Boolean(topCause && topCause.probability > 0.5);
  const decision = decisionForTier(risk?.tier);
  const tone = TONE_STYLES[decision.tone];
  const anomalyActive = residual ? Object.values(residual.flags).some(Boolean) : false;

  const demandH = simStatus?.running ? simStatus.total_h : missionDemandH;
  const rulH = rul?.q50_h ?? null;
  const marginH = rulH !== null ? rulH - demandH : null;

  const reasoning = !connected
    ? 'Engine in standby. Reliability assessment will activate once telemetry is flowing.'
    : (risk?.recommended_action ?? 'Awaiting first pipeline result.');

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="section-title flex items-center gap-1.5">
          <ShieldCheck size={13} strokeWidth={2.4} />
          Mission Reliability &amp; Decision
        </span>
        <span className="badge-orange">{simStatus?.running ? `Phase: ${simStatus.phase_name ?? '—'}` : 'Phase: Parked'}</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">Physics-inspired prognostics · composite reliability from live health, RUL, and fault-risk gates.</p>

      <motion.div
        layout
        className="rounded-xl p-4 mb-3"
        style={{ background: 'rgba(15,23,42,0.94)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Mission Decision</div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-lg font-black"
              style={{ background: tone.bg, color: tone.text, boxShadow: `0 0 0 1px ${tone.ring}` }}
            >
              {decision.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Reliability</div>
            <div className="text-lg font-black text-white">{risk ? `${(risk.P_success * 100).toFixed(1)}%` : '—'}</div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 italic">Composite mission reliability derived from current engine health, fault risk, and mission endurance.</p>
      </motion.div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 mb-3">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Decision Reasoning</div>
        <p className="text-xs text-slate-700 leading-snug">{reasoning}</p>
      </div>

      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Mission Safety &amp; Readiness Checks</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-gray-200 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase text-slate-500">Endurance</span>
            <span className="tag-low">{rulH !== null ? 'Ready' : 'N/A'}</span>
          </div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between"><span className="text-slate-400">Demand:</span><span className="font-mono font-bold text-slate-700">{demandH.toFixed(2)} h</span></div>
            <div className="flex justify-between"><span className="text-slate-400">RUL:</span><span className="font-mono font-bold text-orange-600">{rulH !== null ? `${rulH.toFixed(0)} h` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Margin:</span><span className={`font-mono font-bold ${marginH !== null && marginH < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{marginH !== null ? `${marginH > 0 ? '+' : ''}${marginH.toFixed(2)} h` : '—'}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase text-slate-500">Health</span>
            <span className={risk && risk.health_index < 90 ? 'tag-medium' : 'tag-low'}>{risk && risk.health_index < 90 ? 'Degraded' : 'Baseline'}</span>
          </div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between"><span className="text-slate-400">SOH:</span><span className="font-mono font-bold text-slate-700">{risk ? `${risk.health_index.toFixed(0)}%` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Fault:</span><span className="font-mono font-bold text-slate-700 capitalize truncate max-w-[70px]">{faultActive ? topCause!.cause.replaceAll('_', ' ') : 'Normal'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Severity:</span><span className="font-mono font-bold text-slate-700">{faultActive ? severityLabel(topCause!.probability) : 'None'}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase text-slate-500">Mission Risk</span>
            <span className={anomalyActive ? 'tag-medium' : 'tag-low'}>{anomalyActive ? 'Active' : 'Not Active'}</span>
          </div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between"><span className="text-slate-400">Fault Risk:</span><span className="font-mono font-bold text-slate-700">{faultActive ? `${(topCause!.probability * 100).toFixed(0)}%` : '0%'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Anomaly:</span><span className="font-mono font-bold text-slate-700">{residual ? residual.d2.toFixed(2) : '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Level:</span><span className="font-mono font-bold text-slate-700">{anomalyActive ? 'Active' : 'Not Active'}</span></div>
          </div>
        </div>
      </div>

      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Authoritative Mission Demand &amp; Capability</div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Mission Demand', value: `${demandH.toFixed(2)} h`, sub: `~${Math.round(demandH * 60)} min` },
          { label: 'Engine RUL', value: rulH !== null ? `${rulH.toFixed(0)} h` : '—', sub: 'q50 estimate' },
          { label: 'RUL Margin', value: marginH !== null ? `${marginH > 0 ? '+' : ''}${marginH.toFixed(2)} h` : '—', sub: 'RUL − demand' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(15,23,42,0.94)' }}>
            <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">{stat.label}</div>
            <div className="text-sm font-black text-white mt-0.5">{stat.value}</div>
            <div className="text-[8px] text-slate-500 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
