import { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';

const EngineTwin3D = lazy(() => import('../Components/engine/EngineTwin3D'));
const HealthBreakdownPanel = lazy(() => import('../Components/twin/HealthBreakdownPanel'));
const PipelineDiagram = lazy(() => import('../Components/twin/PipelineDiagram'));
const MissionSetupPanel = lazy(() => import('../Components/twin/MissionSetupPanel'));

export default function VirtualTwin() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="space-y-5">
      <div>
        <h1 className="page-title">Virtual Twin</h1>
        <p className="text-sm text-slate-400 mt-1">
          Full engine digital twin: 3D model, pipeline stage status, health-index breakdown, and mission-risk planning.
        </p>
      </div>

      <Suspense fallback={<div className="card text-slate-400 text-sm">Loading twin...</div>}>
        <EngineTwin3D />
      </Suspense>

      <Suspense fallback={<div className="card text-slate-400 text-sm">Loading pipeline...</div>}>
        <PipelineDiagram />
      </Suspense>

      <Suspense fallback={<div className="card text-slate-400 text-sm">Loading health breakdown...</div>}>
        <HealthBreakdownPanel />
      </Suspense>

      <Suspense fallback={<div className="card text-slate-400 text-sm">Loading mission setup...</div>}>
        <MissionSetupPanel />
      </Suspense>
    </motion.div>
  );
}
