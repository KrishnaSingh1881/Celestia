// Small, framework-agnostic visual helper functions for the 3D twin -
// pure functions so they're easy to unit-reason-about independent of R3F.

/** 5-stop thermal ramp: cool blue -> chrome -> amber -> hot red -> flame
 * orange, parameterized by (value, nominal, warn, crit) - mirrors the
 * baseline's thermalTarget() concept, simplified to a single reusable
 * function instead of a bespoke per-component version. */
export function thermalColor(value: number, nominal: number, warn: number, crit: number): string {
  if (value <= nominal) return '#3b82f6'; // cool blue
  if (value <= (nominal + warn) / 2) return '#cbd5e1'; // chrome/neutral
  if (value <= warn) return '#f59e0b'; // amber
  if (value <= crit) return '#ef4444'; // hot red
  return '#ff5a1f'; // combustion orange
}

/** Clamp a visual angular speed so very high RPM stays legible on screen
 * (the baseline's rpmToSpeed() concept). */
export function rpmToVisualSpeed(rpm: number): number {
  const clamped = Math.min(Math.max(rpm, 0), 6500);
  return (clamped / 60) * (2 * Math.PI) * 0.15; // rad/s, scaled down for legibility
}
