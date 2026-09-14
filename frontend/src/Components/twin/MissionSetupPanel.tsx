import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigation, Plus, Trash2 } from 'lucide-react';
import { postMissionPlan } from '../../lib/api';
import type { MissionPlanResponse, MissionSegmentRequest } from '../../types/contracts';

interface Preset {
  name: string;
  segments: MissionSegmentRequest[];
}

// Adapted from Virtualengine-main's MissionSetupPanel.tsx interaction
// pattern (preset selector, segment cards, summary/start panel) - rebuilt
// around this project's own phase/duration/power mission-risk model
// (simengine.twin.mission_risk) instead of literal lat/lon navigation,
// since there is no geo-routing model here to back that up.
const PRESETS: Preset[] = [
  {
    name: 'Standard Patrol',
    segments: [
      { name: 'Climb', duration_h: 0.5, power_pct: 100 },
      { name: 'Cruise', duration_h: 4.0, power_pct: 65 },
      { name: 'Descent', duration_h: 0.5, power_pct: 35 },
    ],
  },
  {
    name: 'High-Power Dash',
    segments: [
      { name: 'Climb', duration_h: 0.3, power_pct: 100 },
      { name: 'Dash', duration_h: 1.0, power_pct: 95 },
      { name: 'Return Cruise', duration_h: 1.5, power_pct: 60 },
    ],
  },
  {
    name: 'Long Endurance',
    segments: [
      { name: 'Climb', duration_h: 0.4, power_pct: 90 },
      { name: 'Loiter', duration_h: 8.0, power_pct: 45 },
      { name: 'Descent', duration_h: 0.4, power_pct: 30 },
    ],
  },
];

const TIER_BADGE: Record<string, string> = {
  Nominal: 'tag-low',
  Watch: 'tag-low',
  Advisory: 'tag-medium',
  Caution: 'tag-medium',
  Warning: 'tag-high',
};

export default function MissionSetupPanel() {
  const [segments, setSegments] = useState<MissionSegmentRequest[]>(PRESETS[0].segments);
  const [plan, setPlan] = useState<MissionPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSegment(index: number, patch: Partial<MissionSegmentRequest>) {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSegment() {
    setSegments((prev) => [...prev, { name: `Segment ${prev.length + 1}`, duration_h: 1.0, power_pct: 50 }]);
  }

  function removeSegment(index: number) {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }

  async function runPlan() {
    setLoading(true);
    setError(null);
    try {
      const result = await postMissionPlan(segments);
      setPlan(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <span className="section-title flex items-center gap-1.5">
          <Navigation size={13} strokeWidth={2.4} />
          Mission Setup
        </span>
        <div className="flex gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                setSegments(preset.segments);
                setPlan(null);
              }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-slate-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {segments.map((seg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2"
              >
                <input
                  value={seg.name}
                  onChange={(e) => updateSegment(i, { name: e.target.value })}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none flex-1 min-w-0"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={seg.duration_h}
                    onChange={(e) => updateSegment(i, { duration_h: Number(e.target.value) })}
                    className="w-14 text-xs font-mono text-right bg-slate-50 rounded-md px-1.5 py-0.5 outline-none"
                  />
                  <span className="text-[10px] text-slate-400">h</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 w-28">
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={seg.power_pct}
                    onChange={(e) => updateSegment(i, { power_pct: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{seg.power_pct}%</span>
                </div>
                <button onClick={() => removeSegment(i)} className="text-slate-300 hover:text-rose-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button onClick={addSegment} className="btn-ghost w-full justify-center text-xs py-1.5">
            <Plus size={13} /> Add segment
          </button>
          <button onClick={runPlan} disabled={loading || segments.length === 0} className="btn-orange w-full justify-center mt-2 disabled:opacity-50">
            {loading ? 'Computing...' : 'Plan Mission'}
          </button>
          {error && <div className="text-xs text-rose-500">{error}</div>}
        </div>

        <div className="bg-orange-50/60 border border-orange-100 rounded-2xl p-4 flex flex-col">
          {!plan ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-4">
              Configure segments and click <span className="font-bold mx-1">Plan Mission</span> to compute per-segment survival probability.
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-xs">Overall Result</span>
                <span className={TIER_BADGE[plan.overall_tier] ?? 'tag-medium'}>{plan.overall_tier}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="kpi-value">{(plan.overall_survival_probability * 100).toFixed(2)}%</span>
                <span className="text-xs text-slate-500">survival · {plan.total_duration_h.toFixed(1)} h total</span>
              </div>
              <p className="text-xs text-slate-600">{plan.recommended_action}</p>
              <ul className="space-y-1.5 pt-1 border-t border-orange-100">
                {plan.segments.map((seg) => (
                  <li key={seg.name} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{seg.name}</span>
                    <span className="text-slate-400">{seg.duration_h}h @ {seg.power_pct}%</span>
                    <span className="font-mono font-bold text-slate-800">{(seg.survival_probability * 100).toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
