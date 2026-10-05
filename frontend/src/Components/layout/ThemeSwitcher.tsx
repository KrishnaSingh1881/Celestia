import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

interface ThemeSwitcherProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export default function ThemeSwitcher({
  compact = false,
  showLabel = true,
  className = '',
}: ThemeSwitcherProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isLight = theme === 'light';

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        title={isLight ? 'Switch to Dark Mode (Obsidian)' : 'Switch to Light Mode (Warm Ivory)'}
        aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer border shadow-sm group ${
          isLight
            ? 'bg-[#FAF7F2] border-[#E2DDD1] text-[#0C1117] hover:border-[#00B4A4] hover:shadow-[0_0_12px_rgba(0,180,164,0.2)]'
            : 'bg-[#0F1522] border-slate-800 text-slate-200 hover:border-[#00F0DB] hover:text-[#00F0DB] hover:shadow-[0_0_12px_rgba(0,240,219,0.25)]'
        } ${className}`}
      >
        <motion.div
          key={theme}
          initial={{ scale: 0.5, rotate: isLight ? -45 : 45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {isLight ? (
            <Sun size={17} className="text-[#00A896]" strokeWidth={2.4} />
          ) : (
            <Moon size={17} className="text-[#00F0DB]" strokeWidth={2.4} />
          )}
        </motion.div>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isLight ? 'Switch to Dark Mode (Obsidian)' : 'Switch to Light Mode (Warm Ivory & Ink Black)'}
      aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm select-none ${
        isLight
          ? 'bg-[#FFFFFF] border-[#E2DDD1] hover:border-[#00B4A4] hover:shadow-[0_0_14px_rgba(0,180,164,0.18)]'
          : 'bg-[#0F1522] border-slate-800 hover:border-[#00F0DB]/60 hover:shadow-[0_0_14px_rgba(0,240,219,0.2)]'
      } ${className}`}
    >
      {/* Visual pill thumb with animated icon */}
      <div
        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 ${
          isLight
            ? 'bg-[#00B4A4]/15 text-[#009E90]'
            : 'bg-[#00F0DB]/15 text-[#00F0DB]'
        }`}
      >
        <motion.div
          key={theme}
          initial={{ scale: 0.6, rotate: isLight ? -60 : 60, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {isLight ? (
            <Sun size={14} strokeWidth={2.6} />
          ) : (
            <Moon size={14} strokeWidth={2.6} />
          )}
        </motion.div>
      </div>

      {showLabel && (
        <div className="flex flex-col text-left pr-1">
          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 leading-none">
            PALETTE
          </span>
          <span
            className={`text-[11px] font-black tracking-tight leading-none mt-0.5 flex items-center gap-1 ${
              isLight ? 'text-[#0C1117]' : 'text-slate-100'
            }`}
          >
            <span>{isLight ? 'Warm Ivory' : 'Obsidian'}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLight ? 'bg-[#00B4A4]' : 'bg-[#00F0DB]'
              }`}
            />
          </span>
        </div>
      )}
    </button>
  );
}
