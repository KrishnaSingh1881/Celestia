import { motion } from 'framer-motion';
import { useEngineStore } from '../../store/useEngineStore';

function KpiCard({
  label, value, sub, tag, index,
}: {
  label: string; value: string; sub?: string; tag?: { text: string; tone: 'high' | 'medium' | 'low' }; index: number;
}) {
  return (
    <motion.div
      className="card-sm flex-1 min-w-[160px]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between">
        <span className="label-xs">{label}</span>
        {tag && <span className={`tag-${tag.tone}`}>{tag.text}</span>}
      </div>
      <div className="kpi-value mt-1.5">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1 truncate">{sub}</div>}
    </motion.div>
  );
}

function tierTone(tier: string): 'high' | 'medium' | 'low' {
  if (tier === 'Nominal' || tier === 'Watch') return 'low';
  if (tier === 'Advisory' || tier === 'Caution') return 'medium';
  return 'high';
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
        index={0}
        label="Health Index"
        value={risk ? risk.health_index.toFixed(0) : '--'}
        sub={risk ? risk.tier : connected ? 'awaiting data' : 'not connected'}
        tag={risk ? { text: risk.tier, tone: tierTone(risk.tier) } : undefined}
      />
      <KpiCard
        index={1}
        label="Mission Survival"
        value={risk ? `${(risk.P_success * 100).toFixed(1)}%` : '--'}
      />
      <KpiCard
        index={2}
        label="RUL (50th pct)"
        value={rul ? `${rul.q50_h.toFixed(0)} h` : '--'}
        sub={rul ? `driver: ${rul.driver}` : undefined}
      />
      <KpiCard
        index={3}
        label="Top Diagnosis"
        value={topCause ? topCause.cause.replaceAll('_', ' ') : 'healthy'}
        sub={topCause ? `${(topCause.probability * 100).toFixed(0)}% confidence` : 'no active hypotheses'}
        tag={topCause ? { text: topCause.probability > 0.5 ? 'active' : 'watch', tone: topCause.probability > 0.5 ? 'medium' : 'low' } : undefined}
      />
    </div>
  );
}
