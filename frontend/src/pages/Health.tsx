import { useEngineStore } from '../store/useEngineStore';

export default function Health() {
  const risk = useEngineStore((s) => s.risk);
  const rul = useEngineStore((s) => s.rul);
  const diagnosis = useEngineStore((s) => s.diagnosis);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white shadow-card p-4">
        <h2 className="text-lg font-semibold mb-2">Health Index &amp; Advisory</h2>
        <div className="text-4xl font-bold text-orange-600">{risk ? risk.health_index.toFixed(0) : '--'}</div>
        <div className="text-sm text-slate-500">{risk?.tier ?? 'no data'}</div>
        <p className="text-sm mt-2">{risk?.recommended_action}</p>
        <p className="text-xs text-slate-400 mt-1">Authority: {risk?.authority ?? '--'} - the system never commands an actuator.</p>
      </div>

      <div className="rounded-2xl bg-white shadow-card p-4">
        <h2 className="text-lg font-semibold mb-2">Remaining Useful Life</h2>
        {rul ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-500">5th pct (planning number)</div>
              <div className="text-2xl font-semibold">{rul.q05_h.toFixed(0)} h</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">50th pct</div>
              <div className="text-2xl font-semibold">{rul.q50_h.toFixed(0)} h</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">95th pct</div>
              <div className="text-2xl font-semibold">{rul.q95_h.toFixed(0)} h</div>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">No data yet.</div>
        )}
        {rul && <div className="text-xs text-slate-400 mt-2">Governing driver: {rul.driver} ({rul.component})</div>}
      </div>

      <div className="rounded-2xl bg-white shadow-card p-4">
        <h2 className="text-lg font-semibold mb-2">Ranked Diagnosis</h2>
        <ul className="space-y-1 text-sm">
          {(diagnosis?.hypotheses ?? []).map((h) => (
            <li key={h.cause} className="flex justify-between border-b border-slate-100 py-1">
              <span>{h.cause.replaceAll('_', ' ')}</span>
              <span className="font-semibold">{(h.probability * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
