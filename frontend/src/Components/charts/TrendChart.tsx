import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEngineStore } from '../../store/useEngineStore';

export default function TrendChart() {
  const history = useEngineStore((s) => s.history);

  const data = history.map((r) => ({
    t: r.t,
    CHT: r.prediction.y_hat.CHT,
    oil_pressure_bar: r.prediction.y_hat.oil_pressure ? r.prediction.y_hat.oil_pressure / 1e5 : undefined,
  }));

  return (
    <div className="rounded-2xl bg-white shadow-card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Predicted CHT (K) &amp; oil pressure (bar)</div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="t" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line yAxisId="left" type="monotone" dataKey="CHT" stroke="#FF6B35" dot={false} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="oil_pressure_bar" stroke="#334155" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
