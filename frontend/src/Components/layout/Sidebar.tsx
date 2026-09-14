import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  Box,
  ClipboardList,
  Gauge,
  HeartPulse,
  Home,
  type LucideIcon,
  Navigation,
  Plane,
  Plug,
  Radio,
  Rocket,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/telemetry', icon: Activity, label: 'Telemetry' },
  { to: '/sensors', icon: Radio, label: 'Sensors & Causal Graph' },
  { to: '/virtualtwin', icon: Box, label: 'Virtual Twin' },
  { to: '/health', icon: HeartPulse, label: 'Health & RUL' },
  { to: '/mission', icon: Navigation, label: 'Mission Risk' },
  { to: '/flight-simulation', icon: Plane, label: 'Flight Simulation' },
  { to: '/maintenance', icon: ClipboardList, label: 'Maintenance' },
  { to: '/connection', icon: Plug, label: 'Data Connection' },
  { to: '/startup', icon: Rocket, label: 'Startup' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function Sidebar() {
  const connected = useEngineStore((s) => s.connected);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const activeAlerts = (diagnosis?.hypotheses ?? []).filter((h) => h.probability > 0.5).length;

  return (
    <nav className="flex flex-col items-center justify-between py-5 h-full w-[68px] shrink-0 select-none z-40 bg-white border-r border-gray-200">
      <div className="flex flex-col items-center gap-6 w-full">
        <NavLink to="/" title="AeroTwin — Engine Digital Twin" className="group flex flex-col items-center gap-1">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 relative border-2 bg-white"
            style={{ borderColor: 'var(--orange)', boxShadow: '0 2px 12px rgba(255,107,53,0.18)' }}
          >
            <Gauge size={20} className="text-orange-500" strokeWidth={2.2} />
            <span
              className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
          </div>
          <span
            className="text-[8px] font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-orange-600"
            style={{ letterSpacing: '0.18em' }}
          >
            TWIN
          </span>
        </NavLink>

        <div className="flex flex-col items-center gap-3 w-full px-3">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} title={label} className="group relative w-full flex justify-center" end={to === '/'}>
              {({ isActive }) => (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative"
                  style={{
                    background: isActive ? 'rgba(255,107,53,0.12)' : 'transparent',
                    color: isActive ? 'var(--orange)' : '#64748B',
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    className={`transition-colors duration-200 ${isActive ? '' : 'group-hover:text-orange-500'}`}
                  />
                  <span
                    className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 text-xs font-medium text-white shadow-xl"
                    style={{ background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(8px)' }}
                  >
                    {label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 w-full">
        <div className="relative group cursor-pointer" title="Active diagnoses">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-gray-500 hover:text-orange-500 hover:bg-orange-50">
            <Bell size={20} strokeWidth={1.8} />
          </div>
          {activeAlerts > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow"
              style={{ background: 'var(--orange)' }}
            >
              {activeAlerts}
            </span>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 border border-orange-200 bg-orange-50 text-orange-600"
          title="Operator"
        >
          <User size={18} strokeWidth={1.8} />
        </div>
      </div>
    </nav>
  );
}
