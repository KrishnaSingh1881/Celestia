import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const STAGES = [
  { key: 'frame', label: 'Telemetry Frame' },
  { key: 'context', label: 'Context' },
  { key: 'prediction', label: 'Prediction' },
  { key: 'residual', label: 'Residual' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'rul', label: 'RUL' },
  { key: 'risk', label: 'Risk' },
] as const;

export default function PipelineDiagram() {
  const lastUpdatedAt = useEngineStore((s) => s.lastUpdatedAt);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (lastUpdatedAt) setPulseKey((k) => k + 1);
  }, [lastUpdatedAt]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <span className="section-title">Pipeline (Appendix F)</span>
        <span className="text-[10px] text-slate-400">Context → Prediction → Residual → Diagnosis → RUL → Risk</span>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1.5 shrink-0">
            <motion.div
              key={`${stage.key}-${pulseKey}`}
              className="step-pill"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--orange)' }} />
              {stage.label}
            </motion.div>
            {i < STAGES.length - 1 && <ArrowRight size={13} className="text-slate-300 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
