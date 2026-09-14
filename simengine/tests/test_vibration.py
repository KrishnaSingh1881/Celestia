import numpy as np
import pytest

from simengine.engine.vibration import (
    STANDARD_ORDERS,
    bearing_defect_frequencies,
    extract_edge_features,
    synthesize_vibration,
)

FS = 20000.0  # Hz sampling rate for the synthesized "raw" signal
DURATION_S = 2.0
F0 = 96.7  # Hz, e.g. ~5800 rpm crank speed / 60


def _time_vector():
    return np.arange(0.0, DURATION_S, 1.0 / FS)


def test_extract_edge_features_always_returns_length_21():
    t = _time_vector()
    healthy = synthesize_vibration(t, F0, order_amplitudes={1.0: 1.0, 2.0: 0.5})
    feats = extract_edge_features(healthy, FS, F0)
    assert feats.shape == (21,)
    assert np.all(np.isfinite(feats))

    # Also check a very short / oddly-sized signal still returns length 21.
    short_signal = healthy[:777]
    feats_short = extract_edge_features(short_signal, FS, F0)
    assert feats_short.shape == (21,)


def test_misfire_raises_half_order_band_energy():
    t = _time_vector()
    healthy = synthesize_vibration(
        t, F0, order_amplitudes={1.0: 1.0, 2.0: 1.0}, noise_std=0.01, rng=np.random.default_rng(0)
    )
    misfire = synthesize_vibration(
        t, F0, order_amplitudes={1.0: 1.0, 2.0: 1.0, 0.5: 0.8, 1.5: 0.6, 2.5: 0.4},
        noise_std=0.01, rng=np.random.default_rng(0),
    )

    feats_healthy = extract_edge_features(healthy, FS, F0)
    feats_misfire = extract_edge_features(misfire, FS, F0)

    half_idx = 4 + STANDARD_ORDERS.index(0.5)  # 4 leading scalar features before the band block
    half_order_ratio_idx = 4 + len(STANDARD_ORDERS) + 1  # + mesh slot, then half_order_ratio

    assert feats_misfire[half_idx] > feats_healthy[half_idx]
    assert feats_misfire[half_order_ratio_idx] > feats_healthy[half_order_ratio_idx]


def test_bearing_defect_impulse_train_raises_envelope_peak():
    t = _time_vector()
    f_r = F0  # shaft rotation frequency
    f_bpfo, f_bpfi = bearing_defect_frequencies(
        n_balls=8, f_r_hz=f_r, d_ball_m=0.008, D_pitch_m=0.04, contact_angle_rad=0.0
    )
    assert f_bpfo > 0 and f_bpfi > f_bpfo

    healthy = synthesize_vibration(t, F0, order_amplitudes={1.0: 1.0, 2.0: 0.5}, noise_std=0.02,
                                    rng=np.random.default_rng(1))

    n_impulses = int(DURATION_S * f_bpfo)
    impulse_times = [(k + 0.5) / f_bpfo for k in range(n_impulses)]
    bearing_fault = synthesize_vibration(
        t, F0, order_amplitudes={1.0: 1.0, 2.0: 0.5}, noise_std=0.02,
        rng=np.random.default_rng(1),
        impulse_times_s=impulse_times, impulse_freq_hz=3000.0, impulse_zeta=0.05,
        impulse_amplitude=3.0,
    )

    feats_healthy = extract_edge_features(healthy, FS, F0, bpfo_freq_hz=f_bpfo, bpfi_freq_hz=f_bpfi)
    feats_fault = extract_edge_features(bearing_fault, FS, F0, bpfo_freq_hz=f_bpfo, bpfi_freq_hz=f_bpfi)

    bpfo_idx = 4 + len(STANDARD_ORDERS) + 1 + 3  # half_order_ratio, centroid, spread, flatness, then bpfo
    assert feats_fault[bpfo_idx] > feats_healthy[bpfo_idx]


def test_bearing_defect_frequencies_formula():
    f_bpfo, f_bpfi = bearing_defect_frequencies(
        n_balls=9, f_r_hz=50.0, d_ball_m=0.01, D_pitch_m=0.05, contact_angle_rad=0.0
    )
    ratio = (0.01 / 0.05)
    assert f_bpfo == pytest.approx((9 * 50.0 / 2.0) * (1 - ratio))
    assert f_bpfi == pytest.approx((9 * 50.0 / 2.0) * (1 + ratio))
    assert f_bpfi > f_bpfo
