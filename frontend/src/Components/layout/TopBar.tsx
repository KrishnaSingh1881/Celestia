import { useEffect } from 'react';
import { useEngineStore } from '../../store/useEngineStore';

export default function TopBar() {
  const connected = useEngineStore((s) => s.connected);
  const connect = useEngineStore((s) => s.connect);
  const lastUpdatedAt = useEngineStore((s) => s.lastUpdatedAt);

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
      <div className="text-sm text-slate-500">MALE UAV Aero Piston Engine Digital Twin</div>
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        {connected ? 'Live' : 'Disconnected'}
        {lastUpdatedAt && (
          <span className="text-xs text-slate-400 ml-2">
            updated {new Date(lastUpdatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </header>
  );
}
