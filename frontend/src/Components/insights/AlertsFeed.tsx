import { useEngineStore } from '../../store/useEngineStore';

export default function AlertsFeed() {
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const risk = useEngineStore((s) => s.risk);

  const hypotheses = diagnosis?.hypotheses ?? [];

  return (
    <div className="rounded-2xl bg-white shadow-card p-4 h-full">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Diagnosis (ranked, never a single verdict)</div>
      {hypotheses.length === 0 && <div className="text-sm text-slate-400">No data yet.</div>}
      <ul className="space-y-2">
        {hypotheses.map((h) => (
          <li key={h.cause} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1">
            <div>
              <div className="font-medium text-slate-800">{h.cause.replaceAll('_', ' ')}</div>
              {h.evidence.length > 0 && (
                <div className="text-xs text-slate-400">evidence: {h.evidence.join(', ')}</div>
              )}
            </div>
            <div className="text-orange-600 font-semibold">{(h.probability * 100).toFixed(0)}%</div>
          </li>
        ))}
      </ul>
      {risk && (
        <div className="mt-3 text-sm">
          <span className="font-semibold">{risk.tier}: </span>
          <span className="text-slate-600">{risk.recommended_action}</span>
          <span className="block text-xs text-slate-400 mt-1">Authority: {risk.authority}</span>
        </div>
      )}
    </div>
  );
}
