import { motion } from 'framer-motion';
import { CalendarClock, Wrench } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

interface ScheduleItem {
  task: string;
  dueIn: string;
  tone: 'high' | 'medium' | 'low';
  note: string;
}

// Maintenance items are derived entirely from RUL quantiles and ranked
// diagnosis - there is no separate maintenance-scheduling model in
// simengine, this is just a presentation of the same first-passage/
// causal-graph output the rest of the dashboard already shows.
function buildSchedule(
  rul: ReturnType<typeof useEngineStore.getState>['rul'],
  diagnosis: ReturnType<typeof useEngineStore.getState>['diagnosis'],
): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  if (rul) {
    const tone = rul.q05_h < 50 ? 'high' : rul.q05_h < 150 ? 'medium' : 'low';
    items.push({
      task: `Inspect ${rul.component.replaceAll('_', ' ')}`,
      dueIn: `${rul.q05_h.toFixed(0)}–${rul.q95_h.toFixed(0)} h`,
      tone,
      note: `Governing driver: ${rul.driver.replaceAll('_', ' ')} (50th pct ${rul.q50_h.toFixed(0)} h)`,
    });
  }

  for (const h of diagnosis?.hypotheses ?? []) {
    if (h.probability < 0.3) continue;
    const tone = h.probability > 0.65 ? 'high' : h.probability > 0.45 ? 'medium' : 'low';
    items.push({
      task: `Investigate ${h.cause.replaceAll('_', ' ')}`,
      dueIn: h.probability > 0.65 ? 'before next flight' : 'next scheduled check',
      tone,
      note: h.evidence.length > 0 ? `evidence: ${h.evidence.join(', ')}` : `${(h.probability * 100).toFixed(0)}% confidence`,
    });
  }

  return items.slice(0, 5);
}

export default function MaintenanceSchedule() {
  const rul = useEngineStore((s) => s.rul);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const items = buildSchedule(rul, diagnosis);

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="section-title flex items-center gap-1.5">
          <Wrench size={13} strokeWidth={2.4} />
          Maintenance Schedule
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 py-6">
          <CalendarClock size={28} strokeWidth={1.5} />
          <span className="text-sm">No maintenance actions recommended.</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <motion.li
              key={item.task}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 capitalize truncate">{item.task}</div>
                <div className="text-[11px] text-slate-400 truncate">{item.note}</div>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <span className={`tag-${item.tone}`}>{item.dueIn}</span>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
