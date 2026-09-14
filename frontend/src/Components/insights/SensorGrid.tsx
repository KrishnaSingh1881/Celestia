import { motion } from 'framer-motion';
import { AVAILABLE_CHANNELS, type ChannelName } from '../../types/contracts';
import { useEngineStore } from '../../store/useEngineStore';

const CHANNEL_META: Record<ChannelName, { label: string; unit: string; scale?: number; toFixed: number }> = {
  MAP: { label: 'Manifold Pressure', unit: 'kPa', scale: 1e-3, toFixed: 1 },
  CHT: { label: 'Cylinder Head Temp', unit: 'K', toFixed: 1 },
  coolant_temp: { label: 'Coolant Temp', unit: 'K', toFixed: 1 },
  oil_pressure: { label: 'Oil Pressure', unit: 'bar', scale: 1e-5, toFixed: 2 },
  oil_temp: { label: 'Oil Temp', unit: 'K', toFixed: 1 },
  EGT_proxy: { label: 'Exhaust Gas Temp', unit: 'K', toFixed: 0 },
  rpm: { label: 'Engine Speed', unit: 'RPM', toFixed: 0 },
};

function statusFor(flagged: boolean): 'nominal' | 'warning' | 'critical' {
  return flagged ? 'warning' : 'nominal';
}

export default function SensorGrid() {
  const prediction = useEngineStore((s) => s.prediction);
  const residual = useEngineStore((s) => s.residual);
  const connected = useEngineStore((s) => s.connected);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {AVAILABLE_CHANNELS.map((ch, i) => {
        const meta = CHANNEL_META[ch];
        const raw = prediction?.y_hat[ch];
        const value = typeof raw === 'number' ? raw * (meta.scale ?? 1) : undefined;
        const flagged = Boolean(residual?.flags[ch]);
        const status = statusFor(flagged);
        const z = residual?.z[ch];

        return (
          <motion.div
            key={ch}
            className="card-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="label-xs">{meta.label}</span>
              <span className={status === 'critical' ? 'dot-critical' : status === 'warning' ? 'dot-warning' : 'dot-healthy'} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="kpi-value-dark">{connected && value !== undefined ? value.toFixed(meta.toFixed) : '--'}</span>
              <span className="text-xs font-semibold text-slate-400">{meta.unit}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-400 font-mono">channel: {ch}</span>
              {z !== undefined && (
                <span className={`text-[10px] font-mono font-bold ${flagged ? 'text-amber-600' : 'text-slate-300'}`}>z={z.toFixed(2)}</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
