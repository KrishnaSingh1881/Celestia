interface PlaceholderProps {
  title: string;
}

// Honest stand-in for routes not yet built out (Phase 18 scoped the core
// architecture - dynamic modules, live backend wiring, the 3D twin,
// Dashboard/Telemetry/Health/Mission Control - over full-fidelity coverage
// of every page in the original IA). Wire real content in here following
// the same pattern as pages/Health.tsx or pages/Telemetry.tsx: a Zustand
// selector reading real backend fields, never mock data.
export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="rounded-2xl bg-white shadow-card p-6 text-slate-500">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">{title}</h2>
      <p className="text-sm">This page is routed and lazy-loaded but not yet built out.</p>
    </div>
  );
}
