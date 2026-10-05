import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MissionMiniPlayer from '../mission/MissionMiniPlayer';
import { useMissionStore } from '../../store/useMissionStore';
import { useThemeStore } from '../../store/useThemeStore';

export default function Layout() {
  const location = useLocation();
  const tick = useMissionStore((s) => s.tick);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light';

  // Global continuous deterministic mission clock ticker
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.2); // cap dt to avoid large leaps when tab is inactive
      lastTime = now;
      tick(dt);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [tick]);

  // Mini-player shown on secondary operational screens, but NEVER on primary Mission or grounded Maintenance workstation
  const isMissionScreen = location.pathname === '/' || location.pathname === '/mission';
  const isMaintenanceScreen = location.pathname === '/maintenance';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`flex h-screen overflow-hidden select-none transition-colors duration-200 ${isLight ? 'text-[#0c1117] bg-[#faf7f2]' : 'text-slate-100 bg-[#070a0f]'}`}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className={`flex-1 overflow-y-auto p-4 md:p-6 transition-colors duration-200 ${isLight ? 'bg-[#faf7f2]' : 'bg-[#070a0f]'}`}>
            <Suspense
              fallback={
                <div className={`flex items-center justify-center h-48 font-mono text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Loading mission subsystem module...
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>

        {/* Floating draggable Mission Mini-Player on operational flight screens only */}
        {!isMissionScreen && !isMaintenanceScreen && <MissionMiniPlayer />}
      </div>
    </TooltipProvider>
  );
}
