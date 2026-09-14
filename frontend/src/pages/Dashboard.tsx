import { Suspense, lazy, useMemo } from 'react';
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {modules.map(({ id, title, span, Component }) => (
        <div key={id} className={span === 'full' ? 'md:col-span-2' : ''}>
          <Suspense fallback={<div className="text-slate-400 text-sm">Loading {title}...</div>}>
            <Component />
          </Suspense>
        </div>
      ))}
    </div>
  );
}
