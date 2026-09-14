import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HeartPulse } from 'lucide-react';
import { fetchHealthBreakdown } from '../../lib/api';
import type { HealthBreakdownResponse } from '../../types/contracts';
import { useEngineStore } from '../../store/useEngineStore';

export default function HealthBreakdownPanel() {
  const [breakdown, setBreakdown] = useState<HealthBreakdownResponse | null>(null);
  const lastUpdatedAt = useEngineStore((s) => s.lastUpdatedAt);

  useEffect(() => {
    fetchHealthBreakdown()
      .then(setBreakdown)
      .catch(() => setBreakdown(null));
  }, [lastUpdatedAt]);

  const contributions = Object.entries(breakdown?.contributions ?? {}).sort((a, b) => a[1] - b[1]);
  const maxMagnitude = Math.max(1e-6, ...contributions.map(([, v]) => Math.abs(v)));

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="section-title flex items-center gap-1.5">
          <HeartPulse size={13} strokeWidth={2.4} />
          Health Index Breakdown
        </span>
        <span className="kpi-value">{breakdown ? breakdown.health_index.toFixed(0) : '--'}</span>
      </div>

      {contributions.length === 0 && <div className="text-sm text-slate-400 py-4">No contributing residuals - health at baseline.</div>}

      <ul className="space-y-2">
        {contributions.map(([channel, value], i) => (
          <motion.li
            key={channel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="flex items-center gap-3"
          >
            <span className="text-xs font-semibold text-slate-600 w-28 shrink-0 truncate">{channel.replaceAll('_', ' ')}</span>
            <div className="progress-orange flex-1">
              <motion.div
                className="progress-orange-fill"
                style={{ background: value < 0 ? '#ef4444' : '#10b981' }}
                initial={{ width: 0 }}
                animate={{ width: `${(Math.abs(value) / maxMagnitude) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className={`text-xs font-mono font-bold w-12 text-right ${value < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
              {value > 0 ? '+' : ''}
              {value.toFixed(1)}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
