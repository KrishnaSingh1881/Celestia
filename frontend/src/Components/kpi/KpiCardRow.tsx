import { useEngineStore } from '../../store/useEngineStore';

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'bad' ? 'text-rose-500' : tone === 'warn' ? 'text-orange-500' : 'text-emerald-500';
  return (
    <div className="flex-1 min-w-[140px] rounded-2xl bg-white shadow-card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function tierTone(tier: string): 'good' | 'warn' | 'bad' {
  if (tier === 'Nominal' || tier === 'Watch') return 'good';
  if (tier === 'Advisory' || tier === 'Caution') return 'warn';
  return 'bad';
}

export default function KpiCardRow() {
  const risk = useEngineStore((s) => s.risk);
  const rul = useEngineStore((s) => s.rul);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const connected = useEngineStore((s) => s.connected);

  const topCause = diagnosis?.hypotheses[0];

  return (
    <div className="flex flex-wrap gap-3">
      <KpiCard
        label="Health index"
        value={risk ? `${risk.health_index.toFixed(0)}` : '--'}
        sub={risk ? risk.tier : connected ? 'awaiting data' : 'not connected'}
        tone={risk ? tierTone(risk.tier) : undefined}
      />
      <KpiCard
        label="Mission survival"
        value={risk ? `${(risk.P_success * 100).toFixed(1)}%` : '--'}
      />
      <KpiCard
        label="RUL (50th pct)"
        value={rul ? `${rul.q50_h.toFixed(0)} h` : '--'}
        sub={rul ? rul.driver : undefined}
      />
      <KpiCard
        label="Top diagnosis"
        value={topCause ? topCause.cause.replaceAll('_', ' ') : 'healthy'}
        sub={topCause ? `${(topCause.probability * 100).toFixed(0)}% confidence` : undefined}
        tone={topCause && topCause.probability > 0.5 ? 'warn' : 'good'}
      />
    </div>
  );
}
