import { NavLink } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Activity01Icon,
  BellIcon,
  ClipboardListIcon,
  CubeIcon,
  GaugeIcon,
  HeartPulseIcon,
  Home01Icon,
  Navigation03Icon,
  PlaneIcon,
  PlugIcon,
  RadioIcon,
  Rocket01Icon,
  Settings01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEngineStore } from '../../store/useEngineStore';

interface NavItem {
  to: string;
  icon: IconSvgElement;
  label: string;
}

// Icons ported to Hugeicons (hugeicons.com/react-icons, free tier) as this
// project's primary icon system - lucide-react (already used elsewhere in
// the app, e.g. TopBar's pipeline cards) is left as-is rather than
// mechanically swapped everywhere, since both are legitimate, well-
// maintained icon sets and a full rip-and-replace across every already-
// shipped component isn't worth the regression risk for a cosmetic change.
const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: Home01Icon, label: 'Dashboard' },
  { to: '/telemetry', icon: Activity01Icon, label: 'Telemetry' },
  { to: '/sensors', icon: RadioIcon, label: 'Sensors & Causal Graph' },
  { to: '/virtualtwin', icon: CubeIcon, label: 'Virtual Twin' },
  { to: '/health', icon: HeartPulseIcon, label: 'Health & RUL' },
  { to: '/mission', icon: Navigation03Icon, label: 'Mission Risk' },
  { to: '/flight-simulation', icon: PlaneIcon, label: 'Flight Simulation' },
  { to: '/maintenance', icon: ClipboardListIcon, label: 'Maintenance' },
  { to: '/connection', icon: PlugIcon, label: 'Data Connection' },
  { to: '/startup', icon: Rocket01Icon, label: 'Startup' },
  { to: '/settings', icon: Settings01Icon, label: 'Settings' },
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
            style={{ borderColor: 'var(--orange)', boxShadow: '0 2px 12px rgba(66,133,244,0.18)' }}
          >
            <HugeiconsIcon icon={GaugeIcon} size={20} className="text-orange-500" strokeWidth={2.2} />
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
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <NavLink to={to} className="group relative w-full flex justify-center" end={to === '/'}>
                  {({ isActive }) => (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
                      style={{
                        background: isActive ? 'rgba(66,133,244,0.12)' : 'transparent',
                        color: isActive ? 'var(--orange)' : '#64748B',
                      }}
                    >
                      <HugeiconsIcon
                        icon={icon}
                        size={20}
                        strokeWidth={isActive ? 2.4 : 1.8}
                        className={`transition-colors duration-200 ${isActive ? '' : 'group-hover:text-orange-500'}`}
                      />
                    </div>
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 w-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative group cursor-pointer">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-gray-500 hover:text-orange-500 hover:bg-orange-50">
                <HugeiconsIcon icon={BellIcon} size={20} strokeWidth={1.8} />
              </div>
              {activeAlerts > 0 && (
                <span
                  className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ background: 'var(--orange)' }}
                >
                  {activeAlerts}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Active diagnoses</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 border border-orange-200 bg-orange-50 text-orange-600">
              <HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.8} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Operator</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
