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

/** Alias kept for parity with the baseline's naming - same clamp-and-scale
 * behaviour as rpmToVisualSpeed(), used by the crank-angle animation loop. */
export const rpmToSpeed = rpmToVisualSpeed;

/** Interpolated thermal color as a hex string, driven by 3 thresholds
 * (nominal/warn/crit) instead of thermalColor()'s 4, matching the shape
 * the ported cylinder-head component expects. */
export function thermalTarget(value: number, nominal: number, warn: number, crit: number): string {
  return thermalColor(value, nominal, (nominal + warn) / 2, crit);
}

/** Small deterministic idle jitter (position offset in meters) scaled by a
 * 0-1 intensity, standing in for the baseline's accelerometer-driven
 * vibrationJitter() - this project has no vibration sensor channel yet, so
 * intensity is derived from RPM fraction only and is purely cosmetic. */
export function vibrationJitter(t: number, intensity: number, amplitude: number): { x: number; y: number; z: number } {
  const a = amplitude * intensity;
  return {
    x: Math.sin(t * 47.0) * a * 0.4,
    y: Math.sin(t * 53.0 + 1.3) * a,
    z: Math.sin(t * 61.0 + 2.7) * a * 0.4,
  };
}
