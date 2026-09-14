"""Vibration order analysis: a Tier A synthesis model for generating labeled
training data (eq 9.1-9.4), and the Tier B/edge-side FFT+envelope feature
extractor (report section 2.4/9.3, Appendix B/F: raw vibration never leaves
the aircraft, only this length-21 feature vector does, at 1-2 Hz).
"""
from __future__ import annotations

import numpy as np
from scipy.signal import hilbert

# Canonical order set used for both synthesis and extraction, per report
# section 9.2: firing/2nd-order (2.0x), half-order family (0.5x/1.5x/2.5x -
# misfire/injector/weak cylinder), plus common harmonics used as a general
# "is anything unusual building up" spread.
STANDARD_ORDERS = (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 6.0)


def bearing_defect_frequencies(
    n_balls: int, f_r_hz: float, d_ball_m: float, D_pitch_m: float, contact_angle_rad: float
):
    """Ball-pass frequencies outer/inner race (eq 9.2)."""
    ratio = (d_ball_m / D_pitch_m) * np.cos(contact_angle_rad)
    f_bpfo = (n_balls * f_r_hz / 2.0) * (1.0 - ratio)
    f_bpfi = (n_balls * f_r_hz / 2.0) * (1.0 + ratio)
    return f_bpfo, f_bpfi


def _impulse_response(tau_s, natural_freq_hz: float, zeta: float):
    """g(t) = exp(-zeta*omega_n*t) * sin(omega_n*sqrt(1-zeta^2)*t), causal
    (zero for t < 0)  (eq 9.4)."""
    omega_n = 2.0 * np.pi * natural_freq_hz
    # Clip the exponent's argument to 0 for tau < 0 before calling exp() -
    # those samples are discarded by the np.where below anyway, but evaluating
    # exp() on a large negative tau (i.e. a large positive exponent) would
    # overflow first.
    tau_safe = np.clip(tau_s, 0.0, None)
    g = np.exp(-zeta * omega_n * tau_safe) * np.sin(omega_n * np.sqrt(1.0 - zeta**2) * tau_safe)
    return np.where(tau_s >= 0.0, g, 0.0)


def synthesize_vibration(
    t_s: np.ndarray,
    f0_hz: float,
    order_amplitudes: dict[float, float],
    order_phases: dict[float, float] | None = None,
    impulse_times_s: list[float] | None = None,
    impulse_freq_hz: float = 3000.0,
    impulse_zeta: float = 0.05,
    impulse_amplitude: float = 1.0,
    noise_std: float = 0.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Synthesized vibration signal (eq 9.3):

    v(t) = sum_k(A_k*sin(2*pi*k*f0*t + phi_k)) + sum_j(impulse_j * g(t-t_j)) + noise(t)

    A fault is authored as EITHER a changed A_k at the relevant order OR an
    added impulse train at a defect frequency - ground truth is exact because
    the caller chose the perturbation.
    """
    order_phases = order_phases or {}
    t_s = np.asarray(t_s, dtype=float)
    signal = np.zeros_like(t_s)

    for order, amplitude in order_amplitudes.items():
        phi = order_phases.get(order, 0.0)
        signal = signal + amplitude * np.sin(2.0 * np.pi * order * f0_hz * t_s + phi)

    if impulse_times_s:
        for t_j in impulse_times_s:
            tau = t_s - t_j
            signal = signal + impulse_amplitude * _impulse_response(
                tau, impulse_freq_hz, impulse_zeta
            )

    if noise_std > 0.0:
        rng = rng or np.random.default_rng()
        signal = signal + rng.normal(0.0, noise_std, size=t_s.shape)

    return signal


def _band_energy(power_spectrum, freqs, center_freq, halfwidth_frac: float = 0.15):
    if center_freq is None or center_freq <= 0:
        return 0.0
    lo = center_freq * (1.0 - halfwidth_frac)
    hi = center_freq * (1.0 + halfwidth_frac)
    mask = (freqs >= lo) & (freqs <= hi)
    if not np.any(mask):
        return 0.0
    return float(power_spectrum[mask].sum())


def _kurtosis(x):
    x = np.asarray(x, dtype=float)
    mu = x.mean()
    sigma = x.std()
    if sigma == 0:
        return 0.0
    return float(np.mean((x - mu) ** 4) / sigma**4)


def extract_edge_features(
    raw_signal: np.ndarray,
    fs_hz: float,
    f0_hz: float,
    mesh_freq_hz: float | None = None,
    bpfo_freq_hz: float | None = None,
    bpfi_freq_hz: float | None = None,
) -> np.ndarray:
    """On-device FFT + envelope feature extractor: 1kHz-class raw signal in,
    a fixed length-21 feature vector out, at the 1-2Hz rate the aircraft
    downlink can afford (Appendix B/F). This is the function that would run
    on the edge tier in a real deployment; raw vibration itself never leaves
    this function.

    Feature order (21 total): rms, peak, crest_factor, kurtosis,
    band_energy(0.5x, 1x, 1.5x, 2x, 2.5x, 3x, 4x, 6x, mesh) [9],
    half_order_ratio (E_0.5x/E_2x), spectral_centroid, spectral_spread,
    spectral_flatness, bpfo_envelope_peak, bpfi_envelope_peak,
    cyclostationary_indicator, total_spectral_energy.
    """
    x = np.asarray(raw_signal, dtype=float)
    n = x.size

    rms = float(np.sqrt(np.mean(x**2)))
    peak = float(np.max(np.abs(x)))
    crest_factor = peak / rms if rms > 0 else 0.0
    kurt = _kurtosis(x)

    freqs = np.fft.rfftfreq(n, d=1.0 / fs_hz)
    power_spectrum = (np.abs(np.fft.rfft(x)) ** 2) / n

    band_feats = [_band_energy(power_spectrum, freqs, order * f0_hz) for order in STANDARD_ORDERS]
    band_feats.append(_band_energy(power_spectrum, freqs, mesh_freq_hz))

    e_half = band_feats[STANDARD_ORDERS.index(0.5)]
    e_two = band_feats[STANDARD_ORDERS.index(2.0)]
    half_order_ratio = e_half / (e_two + 1e-12)

    total_energy = float(power_spectrum.sum())
    centroid = float(np.sum(freqs * power_spectrum) / (total_energy + 1e-12))
    spread = float(
        np.sqrt(np.sum(((freqs - centroid) ** 2) * power_spectrum) / (total_energy + 1e-12))
    )
    eps = 1e-15
    log_mean = np.mean(np.log(power_spectrum + eps))
    arith_mean = np.mean(power_spectrum) + eps
    flatness = float(np.exp(log_mean) / arith_mean)

    analytic_signal = hilbert(x)
    envelope = np.abs(analytic_signal)
    env_power_spectrum = (np.abs(np.fft.rfft(envelope - envelope.mean())) ** 2) / n
    env_freqs = np.fft.rfftfreq(n, d=1.0 / fs_hz)

    def envelope_peak_near(freq):
        if freq is None or freq <= 0:
            return 0.0
        lo, hi = freq * 0.85, freq * 1.15
        mask = (env_freqs >= lo) & (env_freqs <= hi)
        if not np.any(mask):
            return 0.0
        return float(env_power_spectrum[mask].max())

    bpfo_peak = envelope_peak_near(bpfo_freq_hz)
    bpfi_peak = envelope_peak_near(bpfi_freq_hz)
    cyclostationary_indicator = _kurtosis(envelope - envelope.mean())

    features = (
        [rms, peak, crest_factor, kurt]
        + band_feats
        + [half_order_ratio, centroid, spread, flatness, bpfo_peak, bpfi_peak,
           cyclostationary_indicator, total_energy]
    )
    result = np.array(features, dtype=float)
    assert result.size == 21, f"expected 21 features, got {result.size}"
    return result
