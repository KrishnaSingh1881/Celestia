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
  RadioIcon,
  Settings01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEngineStore } from '../../store/useEngineStore';
import { useMissionStore } from '../../store/useMissionStore';
import { useThemeStore } from '../../store/useThemeStore';
import ThemeSwitcher from './ThemeSwitcher';

interface NavItem {
  to: string;
  icon: IconSvgElement;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: Navigation03Icon, label: 'Mission' },
  { to: '/virtualtwin', icon: CubeIcon, label: 'Engine Twin' },
  { to: '/telemetry', icon: Activity01Icon, label: 'Telemetry' },
  { to: '/sensors', icon: RadioIcon, label: 'Root Cause / Graph' },
  { to: '/health', icon: HeartPulseIcon, label: 'Prognosis & RUL' },
  { to: '/dashboard', icon: Home01Icon, label: 'Engine Overview' },
  { to: '/flight-simulation', icon: PlaneIcon, label: 'Flight Simulation' },
  { to: '/maintenance', icon: ClipboardListIcon, label: 'Maintenance' },
  { to: '/settings', icon: Settings01Icon, label: 'Settings' },
];

export default function Sidebar() {
  const connected = useEngineStore((s) => s.connected);
  const missionState = useMissionStore((s) => s.missionState);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';
  const activeAlerts = missionState.activeAlert.active ? 1 : 0;

  return (
    <nav className={`flex flex-col items-center justify-between py-4 h-full w-[68px] shrink-0 select-none z-40 transition-colors duration-200 border-r ${
      isLight ? 'bg-[#f4efe6] border-[#e2ddd1]' : 'bg-[#090d14] border-slate-800/80'
    }`}>
      <div className="flex flex-col items-center gap-5 w-full">
        {/* Brand Icon */}
        <NavLink to="/" title="Celestia — UAV Engine Digital Twin" className="group flex flex-col items-center gap-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 relative border ${
            isLight
              ? 'border-amber-500/50 bg-white shadow-sm'
              : 'border-amber-500/40 bg-slate-900 shadow-md'
          }`}>
            <HugeiconsIcon icon={GaugeIcon} size={20} className={isLight ? 'text-amber-600' : 'text-amber-400'} strokeWidth={2.2} />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border ${
                isLight ? 'border-white' : 'border-slate-950'
              } ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}
            />
          </div>
          <span
            className={`text-[8px] font-black tracking-widest ${isLight ? 'text-amber-700' : 'text-amber-400'}`}
            style={{ letterSpacing: '0.14em' }}
          >
            CELESTIA
          </span>
        </NavLink>

        {/* Navigation Items */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <NavLink to={to} className="group relative w-full flex justify-center" end={to === '/'}>
                  {({ isActive }) => (
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isActive
                          ? isLight
                            ? 'bg-[#00a896]/15 text-[#00a896] border border-[#00a896]/40 shadow-xs'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-sm'
                          : isLight
                          ? 'text-slate-600 hover:text-[#0c1117] hover:bg-[#eae4d7]'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                      }`}
                    >
                      <HugeiconsIcon
                        icon={icon}
                        size={20}
                        strokeWidth={isActive ? 2.4 : 1.8}
                        className="transition-colors"
                      />
                    </div>
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className={isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117] font-bold text-xs shadow-md' : 'bg-slate-900 border-slate-800 text-slate-100 font-bold text-xs'}>
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Operator, Theme Switcher & Alert status */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Compact Dark/Light Mode Switcher */}
        <ThemeSwitcher compact />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative group cursor-pointer">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isLight ? 'text-slate-600 hover:text-[#00a896] hover:bg-[#eae4d7]' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900'
              }`}>
                <HugeiconsIcon icon={BellIcon} size={20} strokeWidth={1.8} />
              </div>
              {activeAlerts > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black text-slate-950 bg-amber-400 shadow-sm animate-pulse">
                  {activeAlerts}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className={isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117] font-bold text-xs shadow-md' : 'bg-slate-900 border-slate-800 text-slate-100 font-bold text-xs'}>
            {activeAlerts > 0 ? `${activeAlerts} active mission alert` : 'All alerts clear'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 border ${
              isLight ? 'border-[#e2ddd1] bg-white text-slate-700 shadow-xs' : 'border-slate-800 bg-slate-900 text-slate-300'
            }`}>
              <HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.8} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className={isLight ? 'bg-white border-[#e2ddd1] text-[#0c1117] font-bold text-xs shadow-md' : 'bg-slate-900 border-slate-800 text-slate-100 font-bold text-xs'}>
            Flight Controller Operator
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
