import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sun,
  Moon,
  Check,
  Palette,
  Activity,
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

export default function Settings() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isLight = theme === 'light';

  const [refreshRate, setRefreshRate] = useState('60');
  const [fxQuality, setFxQuality] = useState('high');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-4xl mx-auto space-y-6 pb-12"
    >
      {/* Header */}
      <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F0DB] animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-100">
              System Settings & Appearance
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure UI themes, telemetry visual modes, and workstation display parameters.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <Palette size={13} className="text-[#00F0DB]" />
          <span className="text-[10px] font-mono font-bold uppercase text-slate-300">
            Active: {isLight ? 'Warm Ivory' : 'Obsidian'}
          </span>
        </div>
      </div>

      {/* Theme Selection Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <Palette size={16} className="text-[#00F0DB]" />
            Color Palette & Interface Theme
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Choose between the Warm Ivory & Ink Black palette or the Aerospace Cockpit Obsidian mode.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Warm Ivory Option */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3 shadow-md ${
              isLight
                ? 'border-[#00A896] bg-[#FAF7F2] ring-2 ring-[#00A896]/30'
                : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
            }`}
          >
            {isLight && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00A896] text-white flex items-center justify-center">
                <Check size={12} strokeWidth={3} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00A896]/15 border border-[#00A896]/30 flex items-center justify-center text-[#00A896]">
                <Sun size={20} strokeWidth={2.4} />
              </div>
              <div>
                <div className="text-sm font-black text-[#0C1117]">Warm Ivory & Ink Black</div>
                <div className="text-[10px] text-[#475569] font-mono mt-0.5">
                  High-legibility paper aesthetic · Electric Teal accents
                </div>
              </div>
            </div>

            {/* Palette Preview Swatches */}
            <div className="flex items-center gap-2 pt-1 border-t border-[#E2DDD1]">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#475569]">
                <span className="w-3.5 h-3.5 rounded-md bg-[#FAF7F2] border border-[#D5CFC2] shadow-xs" title="Warm Ivory #FAF7F2" />
                <span>Ivory</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#475569]">
                <span className="w-3.5 h-3.5 rounded-md bg-[#0C1117] border border-black shadow-xs" title="Ink Black #0C1117" />
                <span>Ink</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#475569]">
                <span className="w-3.5 h-3.5 rounded-md bg-[#00A896] shadow-xs" title="Electric Teal #00A896" />
                <span>Electric Teal</span>
              </div>
            </div>
          </button>

          {/* Obsidian Option */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3 shadow-md ${
              !isLight
                ? 'border-[#00F0DB] bg-[#0A0E17] ring-2 ring-[#00F0DB]/30'
                : 'border-[#E2DDD1] bg-[#F5F0E6] hover:border-slate-400'
            }`}
          >
            {!isLight && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00F0DB] text-slate-950 flex items-center justify-center">
                <Check size={12} strokeWidth={3} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00F0DB]/15 border border-[#00F0DB]/30 flex items-center justify-center text-[#00F0DB]">
                <Moon size={20} strokeWidth={2.4} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-100">Aerospace Obsidian</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Cockpit dark mode · Glowing Electric Teal instruments
                </div>
              </div>
            </div>

            {/* Palette Preview Swatches */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                <span className="w-3.5 h-3.5 rounded-md bg-[#070A0F] border border-slate-700 shadow-xs" title="Obsidian #070A0F" />
                <span>Obsidian</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                <span className="w-3.5 h-3.5 rounded-md bg-[#F1F5F9] border border-slate-500 shadow-xs" title="Slate White #F1F5F9" />
                <span>White</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                <span className="w-3.5 h-3.5 rounded-md bg-[#00F0DB] shadow-xs" title="Electric Teal #00F0DB" />
                <span>Electric Teal</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Telemetry Display Preferences */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <Activity size={16} className="text-[#00F0DB]" />
            Telemetry Stream & 3D Engine Preferences
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Adjust visual refresh rates and hardware acceleration features.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Telemetry Frame Rate</span>
              <span className="text-[10px] font-mono font-bold text-[#00F0DB]">{refreshRate} FPS</span>
            </div>
            <div className="flex gap-2">
              {['30', '60', '120'].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setRefreshRate(rate)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                    refreshRate === rate
                      ? 'bg-[#00F0DB]/20 border-[#00F0DB] text-[#00F0DB]'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate} Hz
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">3D Shading Fidelity</span>
              <span className="text-[10px] font-mono font-bold uppercase text-[#00F0DB]">{fxQuality}</span>
            </div>
            <div className="flex gap-2">
              {['medium', 'high', 'ultra'].map((q) => (
                <button
                  key={q}
                  onClick={() => setFxQuality(q)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer border ${
                    fxQuality === q
                      ? 'bg-[#00F0DB]/20 border-[#00F0DB] text-[#00F0DB]'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
