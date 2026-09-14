import numpy as np
import pytest

from simengine.sensors.bus import CANFrameEncoder


def test_frame_ids_are_distinct_and_stable():
    encoder = CANFrameEncoder(channel_rate_hz={"CHT_1": 5.0, "oil_pressure": 10.0, "EGT_1": 5.0})
    series = {name: np.full(200, 1.0) for name in ["CHT_1", "oil_pressure", "EGT_1"]}
    frames = encoder.encode(series, duration_s=10.0)

    ids_by_channel = {f.channel_name: f.can_id for f in frames}
    assert len(set(ids_by_channel.values())) == 3  # all distinct

    # Re-encoding must produce the SAME id per channel (stability).
    frames2 = encoder.encode(series, duration_s=10.0)
    ids_by_channel2 = {f.channel_name: f.can_id for f in frames2}
    assert ids_by_channel == ids_by_channel2


def test_per_channel_rate_matches_configuration():
    encoder = CANFrameEncoder(channel_rate_hz={"slow": 2.0, "fast": 20.0})
    series = {"slow": np.full(1000, 1.0), "fast": np.full(1000, 1.0)}
    duration_s = 5.0
    frames = encoder.encode(series, duration_s=duration_s)

    n_slow = sum(1 for f in frames if f.channel_name == "slow")
    n_fast = sum(1 for f in frames if f.channel_name == "fast")
    assert n_slow == int(duration_s * 2.0)
    assert n_fast == int(duration_s * 20.0)


def test_frames_are_sorted_by_timestamp_and_interleaved_across_channels():
    encoder = CANFrameEncoder(channel_rate_hz={"a": 3.0, "b": 7.0})
    series = {"a": np.arange(100.0), "b": np.arange(100.0) * -1.0}
    frames = encoder.encode(series, duration_s=5.0)

    timestamps = [f.timestamp_s for f in frames]
    assert timestamps == sorted(timestamps)
    channel_names = {f.channel_name for f in frames}
    assert channel_names == {"a", "b"}  # both channels actually present, interleaved by time


def test_jitter_perturbs_timestamps_away_from_the_nominal_grid():
    encoder = CANFrameEncoder(channel_rate_hz={"a": 5.0})
    series = {"a": np.zeros(50)}
    frames = encoder.encode(series, duration_s=5.0, jitter_ms=50.0, rng=np.random.default_rng(0))
    nominal = [i / 5.0 for i in range(len(frames))]
    actual = [f.timestamp_s for f in sorted(frames, key=lambda f: f.timestamp_s)]
    # With meaningful jitter, timestamps should not sit exactly on the
    # nominal 1/rate grid.
    assert any(abs(a - n) > 1e-6 for a, n in zip(actual, nominal))
