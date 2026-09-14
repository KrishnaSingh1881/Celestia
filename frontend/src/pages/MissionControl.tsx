import { useEngineStore } from '../store/useEngineStore';

const TIER_COLOR: Record<string, string> = {
  Nominal: 'bg-emerald-500',
  Watch: 'bg-emerald-500',
  Advisory: 'bg-orange-400',
  Caution: 'bg-orange-600',
  Warning: 'bg-rose-500',
};

export default function MissionControl() {
  const risk = useEngineStore((s) => s.risk);

  return (
    <div className="rounded-2xl bg-white shadow-card p-6">
      <h2 className="text-lg font-semibold mb-4">Mission Risk &amp; Go/No-Go</h2>
      <div className="flex items-center gap-4">
        <div className={`h-16 w-16 rounded-full ${risk ? TIER_COLOR[risk.tier] ?? 'bg-slate-300' : 'bg-slate-300'}`} />
        <div>
          <div className="text-2xl font-bold">{risk?.tier ?? 'No data'}</div>
          <div className="text-sm text-slate-500">
            Mission survival probability: {risk ? `${(risk.P_success * 100).toFixed(2)}%` : '--'}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm">{risk?.recommended_action}</p>
      <p className="mt-2 text-xs text-slate-400">
        This is a recommendation only - authority ({risk?.authority ?? 'crew decides'}) stays with the crew at
        every tier. No code path in this system commands an actuator.
      </p>
    </div>
  );
}
