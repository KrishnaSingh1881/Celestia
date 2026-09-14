import type { ComponentType } from 'react';

// A "dynamic module" is just an entry here pointing at a lazily-imported
// component - adding one later means adding an entry to DASHBOARD_MODULES,
// never editing Dashboard.tsx (or any other page) itself. Each loader is a
// plain `() => import(...)` so Vite code-splits it into its own chunk,
// exactly like a route does in router.tsx.
export interface DashboardModule {
  id: string;
  title: string;
  loader: () => Promise<{ default: ComponentType }>;
  span?: 'full' | 'half' | 'third';
}

export const DASHBOARD_MODULES: DashboardModule[] = [
  {
    id: 'kpi-row',
    title: 'Key Indicators',
    loader: () => import('../Components/kpi/KpiCardRow'),
    span: 'full',
  },
  {
    id: 'engine-twin',
    title: 'Digital Twin',
    loader: () => import('../Components/engine/EngineTwin3D'),
    span: 'half',
  },
  {
    id: 'alerts-feed',
    title: 'Diagnosis & Alerts',
    loader: () => import('../Components/insights/AlertsFeed'),
    span: 'half',
  },
  {
    id: 'trend-chart',
    title: 'Trends',
    loader: () => import('../Components/charts/TrendChart'),
    span: 'full',
  },
];
