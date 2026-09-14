"""CAN-like bus framing (report section 17): pack per-channel observations
into frames with realistic identifiers, mixed rates, and non-simultaneous,
jittered timestamps - so the ingestion/time-sync layer is exercised the same
way it will be against a real bus before one is ever connected.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class CANFrame:
    can_id: int
    timestamp_s: float
    channel_name: str
    value: float


class CANFrameEncoder:
    def __init__(self, channel_rate_hz: dict[str, float], channel_ids: dict[str, int] | None = None):
        """channel_rate_hz: e.g. {'CHT_1': 5.0, 'oil_pressure': 10.0, ...}
        (Appendix B's per-signal rates). channel_ids defaults to a stable,
        distinct id per channel name (insertion order), starting at 0x100.
        """
        self.channel_rate_hz = dict(channel_rate_hz)
        if channel_ids is None:
            channel_ids = {name: 0x100 + i for i, name in enumerate(self.channel_rate_hz)}
        self.channel_ids = channel_ids

    def encode(
        self,
        channel_series: dict[str, np.ndarray],
        duration_s: float,
        jitter_ms: float = 0.0,
        rng: np.random.Generator | None = None,
    ) -> list[CANFrame]:
        """Pack each channel's series into frames at ITS OWN rate (mixed
        rates across channels is deliberate - this is what a real bus looks
        like), with independent timestamp jitter per frame, then return all
        frames merged and sorted by timestamp (non-simultaneous arrival)."""
        rng = rng or np.random.default_rng()
        frames: list[CANFrame] = []
        for name, rate_hz in self.channel_rate_hz.items():
            values = np.asarray(channel_series[name])
            n_samples = min(int(duration_s * rate_hz), values.size)
            can_id = self.channel_ids[name]
            for i in range(n_samples):
                t_nominal = i / rate_hz
                jitter_s = rng.normal(0.0, jitter_ms / 1000.0) if jitter_ms > 0 else 0.0
                frames.append(
                    CANFrame(
                        can_id=can_id,
                        timestamp_s=t_nominal + jitter_s,
                        channel_name=name,
                        value=float(values[i]),
                    )
                )
        frames.sort(key=lambda f: f.timestamp_s)
        return frames
