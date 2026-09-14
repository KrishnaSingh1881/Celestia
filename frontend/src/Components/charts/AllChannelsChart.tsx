import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AVAILABLE_CHANNELS, type ChannelName } from '../../types/contracts';
import { useEngineStore } from '../../store/useEngineStore';

const CHANNEL_COLOR: Record<ChannelName, string> = {
  MAP: '#003087',
  CHT: '#FF6B35',
  coolant_temp: '#06b6d4',
  oil_pressure: '#10b981',
  oil_temp: '#f59e0b',
  EGT_proxy: '#f43f5e',
  rpm: '#64748b',
};

// All 7 channels share one time axis but very different units/ranges, so
// each is normalized to its own recent min/max (0-1) purely for display -
// the tooltip still shows the real value, this only affects line shape.
function normalize(values: (number | undefined)[]): (number | undefined)[] {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (finite.length === 0) return values.map(() => undefined);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  return values.map((v) => (typeof v === 'number' ? (v - min) / span : undefined));
}

export default function AllChannelsChart() {
  const history = useEngineStore((s) => s.history);
  const [active, setActive] = useState<Set<ChannelName>>(new Set(AVAILABLE_CHANNELS));

  const rawByChannel: Record<ChannelName, (number | undefined)[]> = Object.fromEntries(
    AVAILABLE_CHANNELS.map((ch) => [ch, history.map((r) => r.prediction.y_hat[ch])]),
  ) as Record<ChannelName, (number | undefined)[]>;

  const normByChannel = Object.fromEntries(
    AVAILABLE_CHANNELS.map((ch) => [ch, normalize(rawByChannel[ch])]),
  ) as Record<ChannelName, (number | undefined)[]>;

  const data = history.map((r, i) => {
    const point: Record<string, number | string | undefined> = { t: r.t };
    for (const ch of AVAILABLE_CHANNELS) {
      point[ch] = active.has(ch) ? normByChannel[ch][i] : undefined;
      point[`${ch}__raw`] = rawByChannel[ch][i];
    }
    return point;
  });

  function toggle(ch: ChannelName) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="section-title">All Telemetry Channels (normalized)</span>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_CHANNELS.map((ch) => (
            <button
              key={ch}
              onClick={() => toggle(ch)}
              className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all"
              style={{
                borderColor: active.has(ch) ? CHANNEL_COLOR[ch] : '#e2e8f0',
                color: active.has(ch) ? CHANNEL_COLOR[ch] : '#94a3b8',
                background: active.has(ch) ? `${CHANNEL_COLOR[ch]}12` : 'transparent',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: active.has(ch) ? CHANNEL_COLOR[ch] : '#cbd5e1' }} />
              {ch}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={[0, 1]} />
            <Tooltip
              formatter={(_value, name, item) => {
                const payload = item?.payload as Record<string, number> | undefined;
                const raw = payload?.[`${name}__raw`];
                return [typeof raw === 'number' ? raw.toFixed(2) : '--', name] as [string, string];
              }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            {AVAILABLE_CHANNELS.filter((ch) => active.has(ch)).map((ch) => (
              <Line key={ch} type="monotone" dataKey={ch} stroke={CHANNEL_COLOR[ch]} dot={false} isAnimationActive={false} strokeWidth={1.75} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
