import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

function probabilityTone(p: number): 'high' | 'medium' | 'low' {
  if (p > 0.65) return 'high';
  if (p > 0.35) return 'medium';
  return 'low';
}

export default function AlertsFeed() {
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const risk = useEngineStore((s) => s.risk);

  const hypotheses = diagnosis?.hypotheses ?? [];
  const anyActive = hypotheses.some((h) => h.probability > 0.5);

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="section-title">Diagnosis &amp; Alerts</span>
        <span className={anyActive ? 'dot-warning' : 'dot-healthy'} />
      </div>

      {hypotheses.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 py-6">
          <ShieldCheck size={28} strokeWidth={1.5} />
          <span className="text-sm">No active hypotheses.</span>
        </div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {hypotheses.map((h, i) => (
            <motion.li
              key={h.cause}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"
            >
              <div className="flex items-start gap-2 min-w-0">
                {h.probability > 0.5 ? (
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" strokeWidth={2.2} />
                ) : (
                  <span className="dot-healthy mt-1.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 capitalize truncate">{h.cause.replaceAll('_', ' ')}</div>
                  {h.evidence.length > 0 && (
                    <div className="text-[11px] text-slate-400 truncate">evidence: {h.evidence.join(', ')}</div>
                  )}
                </div>
              </div>
              <span className={`tag-${probabilityTone(h.probability)} shrink-0`}>{(h.probability * 100).toFixed(0)}%</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {risk && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-sm">
          <span className="font-black text-slate-900">{risk.tier}: </span>
          <span className="text-slate-600">{risk.recommended_action}</span>
          <span className="block text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Authority: {risk.authority}</span>
        </div>
      )}
    </div>
  );
}
