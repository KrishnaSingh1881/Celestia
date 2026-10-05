import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/useMissionStore';
import { useThemeStore } from '../../store/useThemeStore';

export default function SensorGrid() {
  const missionState = useMissionStore((s) => s.missionState);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';
  const { channels } = missionState;

  const sensorCards = [
    {
      id: 'cht',
      label: 'Cylinder Head Temp (CHT)',
      channel: 'CHT',
      data: channels.cht,
      unit: '°C',
    },
    {
      id: 'coolantTemp',
      label: 'Coolant Manifold Temp',
      channel: 'coolant_temp',
      data: channels.coolantTemp,
      unit: '°C',
    },
    {
      id: 'oilPressure',
      label: 'Oil Gallery Pressure',
      channel: 'oil_pressure',
      data: channels.oilPressure,
      unit: 'bar',
    },
    {
      id: 'oilTemp',
      label: 'Sump Oil Temperature',
      channel: 'oil_temp',
      data: channels.oilTemp,
      unit: '°C',
    },
    {
      id: 'rpm',
      label: 'Engine Speed (RPM)',
      channel: 'rpm',
      data: channels.rpm,
      unit: 'RPM',
    },
    {
      id: 'map',
      label: 'Manifold Air Pressure',
      channel: 'MAP',
      data: channels.map,
      unit: 'kPa',
    },
    {
      id: 'egt',
      label: 'Exhaust Gas Temp',
      channel: 'EGT_proxy',
      data: channels.egt,
      unit: '°C',
    },
    {
      id: 'vibration',
      label: 'Crankshaft Vibration',
      channel: 'vibration',
      data: channels.vibration,
      unit: 'g RMS',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
      {sensorCards.map((sc, i) => {
        const valStr =
          typeof sc.data.current === 'number'
            ? sc.id === 'vibration'
              ? sc.data.current.toFixed(2)
              : sc.id === 'oilPressure'
              ? sc.data.current.toFixed(1)
              : Math.round(sc.data.current).toString()
            : String(sc.data.current);

        const isSensorFault = (sc.data.status as string) === 'sensor_fault' || (missionState.scenarioId === 'sensor' && sc.id === 'cht' && missionState.timeSeconds >= 40);
        const isCritical = sc.data.status === 'critical';
        const isWarning = sc.data.status === 'warning';

        const statusBadgeColor = isSensorFault
          ? isLight ? 'text-cyan-800 bg-cyan-100 border-cyan-300' : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
          : isCritical
          ? isLight ? 'text-rose-700 bg-rose-100 border-rose-300' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
          : isWarning
          ? isLight ? 'text-amber-800 bg-amber-100 border-amber-300' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : isLight ? 'text-emerald-800 bg-emerald-100 border-emerald-300' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

        const dotColor = isSensorFault
          ? 'bg-cyan-500'
          : isCritical
          ? 'bg-rose-500 animate-pulse'
          : isWarning
          ? 'bg-amber-400'
          : 'bg-emerald-500';

        return (
          <motion.div
            key={sc.id}
            className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
              isLight ? 'bg-white border-[#e2ddd1] shadow-xs' : 'bg-slate-900/70 border-slate-800 shadow-sm'
            }`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.02 }}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-[10px] font-bold truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`} title={sc.label}>
                {sc.label}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
            </div>

            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-lg font-black font-mono ${isLight ? 'text-[#0c1117]' : 'text-slate-100'}`}>{valStr}</span>
              <span className={`text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{sc.unit}</span>
            </div>

            <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${isLight ? 'border-[#e2ddd1]' : 'border-slate-800/80'}`}>
              <span className={`font-mono truncate ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{sc.channel}</span>
              <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9px] border ${statusBadgeColor}`}>
                {isSensorFault ? 'FAULT' : `z=${sc.data.zScore}`}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
