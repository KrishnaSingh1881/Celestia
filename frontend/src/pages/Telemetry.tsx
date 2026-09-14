import { useEngineStore } from '../store/useEngineStore';
import { AVAILABLE_CHANNELS } from '../types/contracts';

export default function Telemetry() {
  const prediction = useEngineStore((s) => s.prediction);
  const residual = useEngineStore((s) => s.residual);

  return (
    <div className="rounded-2xl bg-white shadow-card p-4">
      <h2 className="text-lg font-semibold mb-3">Live Telemetry</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="py-2">Channel</th>
            <th>Predicted (y_hat)</th>
            <th>Residual (r)</th>
            <th>Normalized (z)</th>
          </tr>
        </thead>
        <tbody>
          {AVAILABLE_CHANNELS.map((ch) => (
            <tr key={ch} className="border-b border-slate-100">
              <td className="py-2 font-medium">{ch}</td>
              <td>{prediction?.y_hat[ch]?.toFixed(2) ?? '--'}</td>
              <td>{residual?.r[ch]?.toFixed(2) ?? '--'}</td>
              <td className={residual && Math.abs(residual.z[ch] ?? 0) > 2 ? 'text-rose-500 font-semibold' : ''}>
                {residual?.z[ch]?.toFixed(2) ?? '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
