import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Map as MapIcon, Radar } from 'lucide-react';
import FlightSimulationPanel from '../Components/simulation/FlightSimulationPanel';
import MissionRoutePanel from '../Components/simulation/MissionRoutePanel';
import MissionReliabilityPanel from '../Components/simulation/MissionReliabilityPanel';
import FlightMap from '../Components/simulation/FlightMap';
import { fetchFlightSimulationStatus } from '../lib/api';
import type { FlightPhaseSpec, FlightSimulationStatus } from '../types/contracts';
import { PRESET_ROUTES, type MissionRoute } from '../types/mission';

type WorkspaceTab = 'setup' | 'map';

export default function FlightSimulation() {
  const [route, setRoute] = useState<MissionRoute>(PRESET_ROUTES[0]);
  const [missionDemandH, setMissionDemandH] = useState(0.4);
  const [phases, setPhases] = useState<FlightPhaseSpec[]>([
    { name: 'Climb', duration_h: 0.05, throttle_pct: 100 },
    { name: 'Cruise', duration_h: 0.3, throttle_pct: 65 },
    { name: 'Descent', duration_h: 0.05, throttle_pct: 35 },
  ]);
  const [simStatus, setSimStatus] = useState<FlightSimulationStatus | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>('setup');

  // Independent of FlightSimulationPanel's own polling (which only runs
  // while that component is mounted, i.e. while the Setup tab is active) -
  // this keeps the Map tab's live marker/telemetry updating even while
  // the Setup tab (and its panel) isn't rendered.
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetchFlightSimulationStatus()
        .then((s) => {
          if (!cancelled) setSimStatus(s);
        })
        .catch(() => undefined);
    };
    poll();
    const interval = setInterval(poll, 800);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function applyRoute(routePhases: FlightPhaseSpec[], totalDurationH: number) {
    setPhases(routePhases);
    setMissionDemandH(totalDurationH);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Flight Simulation</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Plan a real-world geodesic route, review the mission reliability decision, then run the phase-by-phase
            flight profile through the same real pipeline a live telemetry feed uses - results appear on the
            Dashboard, Sensors, and Virtual Twin pages while it runs.
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setTab('setup')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
              tab === 'setup' ? 'border-orange-300 bg-orange-50/60 text-orange-600' : 'border-gray-200 text-slate-500'
            }`}
          >
            <Radar size={14} /> Mission Setup
          </button>
          <button
            onClick={() => setTab('map')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
              tab === 'map' ? 'border-orange-300 bg-orange-50/60 text-orange-600' : 'border-gray-200 text-slate-500'
            }`}
          >
            <MapIcon size={14} /> Flight Map
          </button>
        </div>
      </div>

      {tab === 'setup' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
            <MissionRoutePanel route={route} onRouteChange={setRoute} onApplyRoute={applyRoute} disabled={simStatus?.running} />
            <MissionReliabilityPanel missionDemandH={missionDemandH} simStatus={simStatus} />
          </div>
          <FlightSimulationPanel phases={phases} onPhasesChange={setPhases} />
        </div>
      ) : (
        <FlightMap route={route} simStatus={simStatus} />
      )}
    </motion.div>
  );
}
