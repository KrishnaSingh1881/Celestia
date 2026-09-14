import numpy as np
import pytest

from simengine.sensors.emulate import SensorChannel, SensorChannelConfig

DT = 0.1
N = 200
T = np.arange(N) * DT


def constant_channel(**kwargs) -> SensorChannel:
    return SensorChannel(SensorChannelConfig(**kwargs))


def test_no_corruption_passes_true_value_through():
    ch = constant_channel()
    true_series = 100.0 + 5.0 * np.sin(T)
    observed = ch.observe(true_series, DT)
    assert np.allclose(observed, true_series)


def test_bias_adds_constant_offset():
    ch = constant_channel(bias=3.5)
    true_series = np.full(N, 100.0)
    observed = ch.observe(true_series, DT)
    assert np.allclose(observed, 103.5)


def test_gain_error_scales_value():
    ch = constant_channel(gain_error=0.05)
    true_series = np.full(N, 200.0)
    observed = ch.observe(true_series, DT)
    assert np.allclose(observed, 210.0)


def test_drift_ramps_over_time():
    ch = constant_channel(drift_rate_per_s=2.0)
    true_series = np.full(N, 50.0)
    observed = ch.observe(true_series, DT)
    expected = 50.0 + 2.0 * T
    assert np.allclose(observed, expected)


def test_lag_filter_smooths_a_step_change():
    ch = constant_channel(lag_tau_s=2.0)
    true_series = np.concatenate([np.full(N // 2, 100.0), np.full(N - N // 2, 150.0)])
    observed = ch.observe(true_series, DT)
    # Immediately after the step, the observed value must lag well behind
    # the true value (that is the entire point of a thermocouple lag).
    idx_just_after = N // 2 + 2
    assert observed[idx_just_after] < 0.6 * true_series[idx_just_after] + 0.4 * true_series[0]
    # Long after the step, it should have caught up.
    assert observed[-1] == pytest.approx(150.0, abs=1.0)


def test_quantization_produces_discrete_levels():
    ch = constant_channel(quant_bits=4, quant_range=(0.0, 16.0))
    true_series = np.linspace(0.0, 16.0, N)
    observed = ch.observe(true_series, DT)
    step = 16.0 / 2**4
    remainder = np.mod(observed, step)
    assert np.all((remainder < 1e-9) | (np.abs(remainder - step) < 1e-9))


def test_noise_adds_dispersion_around_true_value():
    ch = constant_channel(noise_std=1.0)
    true_series = np.full(2000, 100.0)
    observed = ch.observe(true_series, DT, rng=np.random.default_rng(0))
    assert 0.7 <= np.std(observed) <= 1.3
    assert abs(np.mean(observed) - 100.0) < 0.2


def test_dropout_marks_samples_nan_at_roughly_configured_rate():
    ch = constant_channel(dropout_prob=0.2)
    true_series = np.full(5000, 100.0)
    observed = ch.observe(true_series, DT, rng=np.random.default_rng(1))
    frac_nan = np.mean(np.isnan(observed))
    assert 0.15 <= frac_nan <= 0.25


def test_freeze_holds_last_value_regardless_of_subsequent_true_changes():
    ch = constant_channel(freeze_at_sample=50)
    true_series = 100.0 + np.arange(N, dtype=float)  # keeps changing after freeze
    observed = ch.observe(true_series, DT)
    held_value = true_series[50]
    assert np.allclose(observed[50:], held_value)
    assert np.allclose(observed[:50], true_series[:50])
    # The true series kept climbing well past the held value - freezing must
    # ignore that entirely.
    assert true_series[-1] > held_value + 10


def test_corruption_stages_compose():
    ch = constant_channel(bias=1.0, gain_error=0.1, noise_std=0.01)
    true_series = np.full(1000, 10.0)
    observed = ch.observe(true_series, DT, rng=np.random.default_rng(2))
    expected_center = 10.0 * 1.1 + 1.0
    assert abs(np.mean(observed) - expected_center) < 0.05
