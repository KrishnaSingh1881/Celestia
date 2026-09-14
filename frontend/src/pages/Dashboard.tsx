import { Suspense, lazy, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DASHBOARD_MODULES } from '../modules/registry';

export default function Dashboard() {
  // Each module is lazy()-wrapped here, once, so the dynamic-module
  // architecture is real: adding an entry to DASHBOARD_MODULES is the only
  // change needed to add a new panel - this component never changes.
  const modules = useMemo(
    () => DASHBOARD_MODULES.map((m) => ({ ...m, Component: lazy(m.loader) })),
    [],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <div className="mb-5">
        <h1 className="page-title">Engine Overview</h1>
        <p className="text-sm text-slate-400 mt-1">Live digital twin, telemetry, alerts, and maintenance status.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map(({ id, title, span, Component }) => (
          <div key={id} className={span === 'full' ? 'md:col-span-2' : ''}>
            <Suspense fallback={<div className="card text-slate-400 text-sm">Loading {title}...</div>}>
              <Component />
            </Suspense>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
