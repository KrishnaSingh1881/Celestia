"""Sensor observation-model emulation (report section 17, Appendix E, eq
17.1):

y_k = gamma_s * h(x_{k-d}) + (b0 + beta_d*t_k) + q(.) + v_k,  v_k ~ N(0, sigma_s^2)

Every consumer of "true" simulated state must be forced through this model
- nothing downstream should ever see clean values it will never see in the
field. Corruption stages are applied in a fixed order: delay -> gain error
-> bias+drift -> thermocouple-style lag -> quantization -> noise ->
dropout/freeze.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class SensorChannelConfig:
    lag_tau_s: float | None = None          # 1st-order thermocouple-style lag
    noise_std: float = 0.0                   # Gaussian measurement noise
    bias: float = 0.0                        # constant offset
    drift_rate_per_s: float = 0.0            # ramp/random-walk-style drift
    quant_bits: int | None = None            # ADC resolution
    quant_range: tuple[float, float] | None = None
    delay_samples: int = 0                   # bus latency, in samples
    dropout_prob: float = 0.0                # Bernoulli per-sample dropout -> NaN
    freeze_at_sample: int | None = None      # Type-2 failure: hold last value from here on
    gain_error: float = 0.0                  # fractional scale error, e.g. 0.03 = +3%


class SensorChannel:
    def __init__(self, config: SensorChannelConfig):
        self.config = config

    def observe(self, true_value_series, dt_s: float, rng: np.random.Generator | None = None):
        """Apply every configured corruption stage to a true-value time
        series and return the corrupted observation (NaN where dropped)."""
        cfg = self.config
        rng = rng or np.random.default_rng()
        x = np.asarray(true_value_series, dtype=float).copy()
        n = x.size
        t = np.arange(n) * dt_s

        # 1. delay (bus/transport latency, in whole samples)
        if cfg.delay_samples > 0:
            if cfg.delay_samples >= n:
                x = np.full(n, x[0])
            else:
                x = np.concatenate([np.full(cfg.delay_samples, x[0]), x[: n - cfg.delay_samples]])

        # 2. gain error
        x = x * (1.0 + cfg.gain_error)

        # 3. bias + drift
        x = x + cfg.bias + cfg.drift_rate_per_s * t

        # 4. thermocouple-style 1st-order lag (discrete exponential smoothing)
        if cfg.lag_tau_s:
            alpha = dt_s / (cfg.lag_tau_s + dt_s)
            lagged = np.empty(n)
            lagged[0] = x[0]
            for i in range(1, n):
                lagged[i] = lagged[i - 1] + alpha * (x[i] - lagged[i - 1])
            x = lagged

        # 5. quantization (ADC resolution)
        if cfg.quant_bits is not None:
            lo, hi = cfg.quant_range if cfg.quant_range is not None else (float(x.min()), float(x.max()))
            span = max(hi - lo, 1e-12)
            n_levels = 2**cfg.quant_bits
            step = span / n_levels
            x = lo + np.round((x - lo) / step) * step

        # 6. Gaussian noise (sets the detectability floor)
        if cfg.noise_std > 0:
            x = x + rng.normal(0.0, cfg.noise_std, size=n)

        # 7. dropout - Bernoulli gaps, marked NaN (estimator must survive these)
        if cfg.dropout_prob > 0:
            dropped = rng.random(n) < cfg.dropout_prob
            x = np.where(dropped, np.nan, x)

        # 8. stuck/frozen sensor (the dangerous Type-2 failure, section 2.5):
        # holds the last value from freeze_at_sample onward, REGARDLESS of
        # what the true value does afterward - applied last and unconditionally
        # so it always wins over any other stage's output.
        if cfg.freeze_at_sample is not None and cfg.freeze_at_sample < n:
            held_value = x[cfg.freeze_at_sample]
            x[cfg.freeze_at_sample:] = held_value

        return x
