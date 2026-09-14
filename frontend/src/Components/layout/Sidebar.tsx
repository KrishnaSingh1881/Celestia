import { NavLink } from 'react-router-dom';
import {
  Gauge,
  Activity,
  HeartPulse,
  Wrench,
  Settings as SettingsIcon,
  Radio,
  FlaskConical,
  Plug,
  Rocket,
  Navigation,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/telemetry', label: 'Telemetry', icon: Activity },
  { to: '/health', label: 'Health & RUL', icon: HeartPulse },
  { to: '/mission', label: 'Mission Control', icon: Navigation },
  { to: '/faults', label: 'Fault Simulation', icon: FlaskConical },
  { to: '/sensors', label: 'Sensors', icon: Radio },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/connection', label: 'Data Connection', icon: Plug },
  { to: '/startup', label: 'Startup', icon: Rocket },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <nav className="w-56 shrink-0 bg-slate-900 text-slate-200 flex flex-col py-4">
      <div className="px-4 pb-4 text-lg font-semibold text-white">AeroTwin</div>
      <ul className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-orange-500 text-white' : 'hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
