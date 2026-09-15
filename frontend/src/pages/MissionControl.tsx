import { motion } from 'framer-motion';
import MissionReliabilityPanel from '../Components/simulation/MissionReliabilityPanel';

// backend.app.pipeline computes the live risk.P_success against a fixed
// 2.0h "remaining mission" assumption (see EngineSession.step's
// remaining_mission_h) - reused here so this page's mission-demand figure
// matches the real number the backend's own reliability output was
// actually computed against, rather than inventing a different one.
const BACKEND_ASSUMED_REMAINING_MISSION_H = 2.0;

export default function MissionControl() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <div className="mb-5">
        <h1 className="page-title">Mission Prediction</h1>
        <p className="text-sm text-slate-400 mt-1">
          Live mission reliability and go/no-go decision, derived from the engine's current health, RUL, and fault
          state - authority always stays with the crew, no tier here ever commands an actuator.
        </p>
      </div>
      <div className="max-w-2xl">
        <MissionReliabilityPanel missionDemandH={BACKEND_ASSUMED_REMAINING_MISSION_H} simStatus={null} />
      </div>
    </motion.div>
  );
}
