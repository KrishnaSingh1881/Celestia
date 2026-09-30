import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Activity,
  Cpu,
  ArrowRight,
  ArrowDownRight,
  Sparkles,
  Radio,
} from 'lucide-react';
import EngineTwin3D from '../Components/engine/EngineTwin3D';
import { useMissionStore } from '../store/useMissionStore';
import {
  ENGINE_COMPONENTS_LIST,
  getComponentDetails,
  type EngineComponentId,
} from '../types/engineComponents';

export default function VirtualTwin() {
  const [selectedComponentId, setSelectedComponentId] = useState<EngineComponentId>('cylinder');

  const missionState = useMissionStore((s) => s.missionState);
  const currentTime = useMissionStore((s) => s.currentTime);
  const scenarioId = useMissionStore((s) => s.scenarioId);

  const selectedDetails = getComponentDetails(selectedComponentId, missionState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-5 max-w-[1600px] mx-auto pb-12 select-none"
    >
      {/* ─── Page Title Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-xl font-black tracking-tight text-slate-100 uppercase">
              Engine Digital Twin
            </h1>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-slate-900 border border-amber-500/40 text-amber-400 font-bold">
              MODULAR ENGINE ARCHITECTURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive 3D digital-twin inspection. Select any subassembly to examine thermodynamic state, sensor channels, and failure cascades.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Scenario:</span>
            <span className="text-amber-400 font-bold uppercase">{scenarioId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">t={currentTime.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* ─── Main Twin Workspace: 3D Canvas (68%) + Component Inspector (32%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Interactive 3D Digital Twin View */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <EngineTwin3D
            height={620}
            selectedSubsystem={selectedComponentId}
            onSelectSubsystem={(id) => id && setSelectedComponentId(id as EngineComponentId)}
            showInspectorCard={false}
          />

          {/* Quick Subassembly Switcher Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 shrink-0 flex items-center gap-1">
              <Layers size={11} className="text-amber-400" />
              Subassemblies:
            </span>
            {ENGINE_COMPONENTS_LIST.map((comp) => {
              const isSelected = selectedComponentId === comp.id;
              return (
                <button
                  key={comp.id}
                  onClick={() => setSelectedComponentId(comp.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-slate-950' : 'bg-slate-600'
                    }`}
                  />
                  {comp.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Component Inspector Panel */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-xl flex-1 flex flex-col justify-between space-y-4">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Cpu size={12} />
                  {selectedDetails.category}
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    selectedDetails.status === 'critical'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                      : selectedDetails.status === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : selectedDetails.status === 'sensor_fault'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {selectedDetails.status.toUpperCase()}
                </span>
              </div>

              {/* Title & Description */}
              <div className="mt-3">
                <h3 className="text-base font-black text-slate-100">{selectedDetails.name}</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {selectedDetails.description}
                </p>
              </div>

              {/* Live State & Health Bar */}
              <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Twin State:</span>
                  <span className="font-mono font-bold text-amber-400 text-xs">
                    Health: {selectedDetails.health}%
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-200 leading-snug">
                  {selectedDetails.stateText}
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      selectedDetails.health >= 80
                        ? 'bg-emerald-400'
                        : selectedDetails.health >= 50
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    style={{ width: `${selectedDetails.health}%` }}
                  />
                </div>
              </div>

              {/* Associated Live Telemetry */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity size={11} className="text-cyan-400" />
                  Associated Telemetry Channels
                </span>
                <div className="space-y-1.5">
                  {selectedDetails.telemetry.map((tel, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-slate-400 font-sans text-[11px]">{tel.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-100">
                          {tel.value} {tel.unit}
                        </span>
                        <span className="text-[10px] text-amber-400 font-bold">{tel.delta}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sensor Instrumentation */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Radio size={11} className="text-amber-400" />
                  Sensors &amp; Observation Layer
                </span>
                <div className="space-y-1.5">
                  {selectedDetails.sensors.map((sensor, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px]"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-200">
                        <span>{sensor.name}</span>
                        <span className="font-mono text-cyan-300">{sensor.value}</span>
                      </div>
                      <div className="text-slate-400 mt-0.5 text-[9px] flex justify-between">
                        <span>{sensor.type}</span>
                        <span className="uppercase text-emerald-400 font-semibold">{sensor.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upstream & Downstream Dependencies */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-[10px]">
              <div>
                <span className="font-bold text-slate-400 flex items-center gap-1 mb-1 uppercase tracking-wider text-[9px]">
                  <ArrowRight size={10} className="text-emerald-400" /> Upstream Dependencies:
                </span>
                <ul className="space-y-0.5 text-slate-300 list-disc list-inside">
                  {selectedDetails.upstreamDependencies.map((dep, i) => (
                    <li key={i}>{dep}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="font-bold text-slate-400 flex items-center gap-1 mb-1 uppercase tracking-wider text-[9px]">
                  <ArrowDownRight size={10} className="text-rose-400" /> Downstream Failure Propagation:
                </span>
                <ul className="space-y-0.5 text-slate-300 list-disc list-inside">
                  {selectedDetails.downstreamEffects.map((eff, i) => (
                    <li key={i}>{eff}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modular Engine Architecture Studio ─────────────────────────── */}
      <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              Modular Engine Architecture
            </span>
            <h3 className="text-sm font-bold text-slate-200">
              Reference Piston Propulsion Platform · Configuration Matrix
            </h3>
          </div>
          <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles size={13} />
            MODULAR ENGINE SUPPORT — COMING SOON
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Architecture</div>
            <div className="text-xs font-bold text-slate-100 mt-1">4-Cyl Boxer</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">180° Opposed</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Displacement</div>
            <div className="text-xs font-bold text-slate-100 mt-1">1,211 cm³</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">84 × 61 mm Bore/Stroke</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Compression</div>
            <div className="text-xs font-bold text-slate-100 mt-1">10.5 : 1</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Static Ratio</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Firing Sequence</div>
            <div className="text-xs font-bold text-slate-100 mt-1">1 - 3 - 2 - 4</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Primary Dynamic Balance</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Gearbox (PSRU)</div>
            <div className="text-xs font-bold text-slate-100 mt-1">2.43 : 1</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Integrated Clutch</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Lubrication</div>
            <div className="text-xs font-bold text-slate-100 mt-1">Dry-Sump</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">External Sump Tank</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
