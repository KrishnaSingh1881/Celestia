import { motion } from 'framer-motion';
import FlightSimulationPanel from '../Components/simulation/FlightSimulationPanel';

export default function FlightSimulation() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <div className="mb-5">
        <h1 className="page-title">Flight Simulation</h1>
        <p className="text-sm text-slate-400 mt-1">
          Script a phase-by-phase flight profile and optionally inject a physics-verified fault - the engine actually
          flies it through the same real pipeline a live telemetry feed uses, so results appear on the Dashboard,
          Sensors, and Virtual Twin pages while it runs.
        </p>
      </div>
      <FlightSimulationPanel />
    </motion.div>
  );
}
