import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen text-slate-900" style={{ background: 'var(--page-bg)' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Suspense fallback={<div className="text-slate-400 text-sm">Loading module...</div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
