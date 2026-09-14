"""Typed access to simengine/config/fault_library.yaml (Table 6 + the
sensor-nuisance DOE axis)."""
from __future__ import annotations

from dataclasses import dataclass

from simengine.config import load_fault_library


@dataclass(frozen=True)
class FaultSpec:
    name: str
    parameter_path: str | None
    equation_ref: str
    first_mover_channels: list[str]
    discriminator_rule: str
    onset_timescale_hours: object  # [min, max] hours, or a descriptive string


def _to_spec(entry: dict) -> FaultSpec:
    return FaultSpec(
        name=entry["name"],
        parameter_path=entry.get("parameter_path"),
        equation_ref=entry["equation_ref"],
        first_mover_channels=list(entry["first_mover_channels"]),
        discriminator_rule=entry["discriminator_rule"],
        onset_timescale_hours=entry["onset_timescale_hours"],
    )


def load_fault_specs() -> dict[str, FaultSpec]:
    """The 21 physical fault modes (Table 6), keyed by name."""
    lib = load_fault_library()
    return {e["name"]: _to_spec(e) for e in lib["faults"]}


def load_sensor_nuisance_specs() -> dict[str, FaultSpec]:
    """The observation-model-only sensor nuisance(s) - a DOE axis distinct
    from the 21 physical faults (see fault_library.yaml's own header note)."""
    lib = load_fault_library()
    return {e["name"]: _to_spec(e) for e in lib["sensor_nuisances"]}


FAULT_MODE_NAMES = list(load_fault_specs().keys())
