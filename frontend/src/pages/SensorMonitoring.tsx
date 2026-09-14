import { motion } from 'framer-motion';
import SensorGrid from '../Components/insights/SensorGrid';
import CausalGraphView from '../Components/graph/CausalGraphView';

export default function SensorMonitoring() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="space-y-5">
      <div>
        <h1 className="page-title">Sensor Data &amp; Causal Graph</h1>
        <p className="text-sm text-slate-400 mt-1">
          Raw predicted channel values, parity-space residual flags, and the live causal health graph driving root-cause diagnosis.
        </p>
      </div>
      <SensorGrid />
      <CausalGraphView />
    </motion.div>
  );
}
