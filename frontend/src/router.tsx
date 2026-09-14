import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from './Components/layout/Layout';

// Every page is lazy() - never a static top-level import - so Vite splits
// each into its own chunk (see docs/BUILD_ROADMAP.md Phase 18's dynamic-
// module requirement, and modules/registry.ts for the same idea applied to
// Dashboard panels).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Telemetry = lazy(() => import('./pages/Telemetry'));
const Health = lazy(() => import('./pages/Health'));
const MissionControl = lazy(() => import('./pages/MissionControl'));
const FaultSimulation = lazy(() => import('./pages/FaultSimulation'));
const SensorMonitoring = lazy(() => import('./pages/SensorMonitoring'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const DataConnectionPage = lazy(() => import('./pages/DataConnectionPage'));
const EngineStartup = lazy(() => import('./pages/EngineStartup'));
const Settings = lazy(() => import('./pages/Settings'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'telemetry', element: <Telemetry /> },
      { path: 'health', element: <Health /> },
      { path: 'mission', element: <MissionControl /> },
      { path: 'faults', element: <FaultSimulation /> },
      { path: 'sensors', element: <SensorMonitoring /> },
      { path: 'maintenance', element: <MaintenancePage /> },
      { path: 'connection', element: <DataConnectionPage /> },
      { path: 'startup', element: <EngineStartup /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
