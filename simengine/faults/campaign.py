"""Fault-injection scenario spec + the DOE campaign generator. Report
eq 16.1-16.4, section 16.3 (Appendix D's 10 axes), Table 10.
"""
from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field

import numpy as np
from scipy.stats import qmc

from simengine.faults.library import FAULT_MODE_NAMES, load_fault_specs

GROWTH_SHAPES = ["linear", "exponential", "step"]
SENSOR_NUISANCE_KINDS = ["drift", "bias", "noise_increase", "dropout"]


@dataclass
class MissionSpec:
    profile: list[str]
    isa_offset_K: float
    humidity: float
    cruise_altitude_ft: float
    power_setting_pct: float
    duration_h: float


@dataclass
class FaultEvent:
    mode: str
    target: dict
    parameter: str | None
    onset_h: float
    shape: str | None = None            # growth shape, physical faults only
    end_severity: float | None = None   # physical faults only
    rate_per_h: float | None = None     # sensor nuisances only (e.g. drift rate)


@dataclass
class ScenarioSpec:
    scenario: str
    mission: MissionSpec
    faults: list[FaultEvent]
    labels: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "ScenarioSpec":
        mission = MissionSpec(**d["mission"])
        faults = [FaultEvent(**f) for f in d["faults"]]
        return cls(scenario=d["scenario"], mission=mission, faults=faults, labels=d.get("labels", {}))


# Appendix D / Table 10 continuous-axis bounds, in the order sampled by the
# Latin hypercube below.
_CONTINUOUS_AXES = [
    # name,                 low,     high
    ("severity_end_state",  0.02,    0.60),
    ("onset_time_frac",     0.0,     0.9),
    ("cruise_altitude_ft",  8000.0,  25000.0),
    ("isa_offset_K",        -20.0,   25.0),
    ("power_setting_pct",   55.0,    100.0),
    ("engine_age_h",        0.0,     1800.0),
]


def generate_campaign(
    n_missions: int = 10000,
    seed: int | None = None,
    mission_duration_h: float = 8.0,
    sensor_nuisance_fraction: float = 1.0 / 3.0,
) -> list[ScenarioSpec]:
    """Latin-hypercube-sampled DOE campaign over Appendix D's 10 axes.

    Guarantees (by construction, not by chance): every one of the 21
    physical fault modes plus the healthy baseline appears at least once
    (stratified assignment, not random draw); approximately
    `sensor_nuisance_fraction` of missions carry a concurrent sensor
    nuisance, independent of which physical fault mode (or healthy
    baseline) they were assigned; every fault's severity end-state and
    onset time are drawn from the full LHS design, so continuous axes stay
    space-filling regardless of the categorical stratification.
    """
    rng = np.random.default_rng(seed)
    fault_specs = load_fault_specs()

    fault_categories = ["healthy"] + FAULT_MODE_NAMES
    n_cat = len(fault_categories)
    base_count, remainder = divmod(n_missions, n_cat)
    counts = [base_count + (1 if i < remainder else 0) for i in range(n_cat)]
    fault_mode_assignment = []
    for category, count in zip(fault_categories, counts):
        fault_mode_assignment.extend([category] * count)
    rng.shuffle(fault_mode_assignment)

    sampler = qmc.LatinHypercube(d=len(_CONTINUOUS_AXES), seed=rng)
    lhs_unit = sampler.random(n_missions)
    l_bounds = [axis[1] for axis in _CONTINUOUS_AXES]
    u_bounds = [axis[2] for axis in _CONTINUOUS_AXES]
    scaled = qmc.scale(lhs_unit, l_bounds, u_bounds)
    axis_values = {axis[0]: scaled[:, i] for i, axis in enumerate(_CONTINUOUS_AXES)}

    growth_shapes = [GROWTH_SHAPES[i % len(GROWTH_SHAPES)] for i in range(n_missions)]
    rng.shuffle(growth_shapes)

    n_contaminated = round(n_missions * sensor_nuisance_fraction)
    nuisance_assignment = ["none"] * (n_missions - n_contaminated)
    nuisance_assignment += [
        SENSOR_NUISANCE_KINDS[i % len(SENSOR_NUISANCE_KINDS)] for i in range(n_contaminated)
    ]
    rng.shuffle(nuisance_assignment)

    scenarios: list[ScenarioSpec] = []
    for i in range(n_missions):
        mode = fault_mode_assignment[i]
        mission = MissionSpec(
            profile=["taxi", "takeoff", "climb", "cruise", "descent", "land"],
            isa_offset_K=float(axis_values["isa_offset_K"][i]),
            humidity=0.35,
            cruise_altitude_ft=float(axis_values["cruise_altitude_ft"][i]),
            power_setting_pct=float(axis_values["power_setting_pct"][i]),
            duration_h=mission_duration_h,
        )

        faults: list[FaultEvent] = []
        if mode != "healthy":
            spec = fault_specs[mode]
            faults.append(
                FaultEvent(
                    mode=mode,
                    target={},
                    parameter=spec.parameter_path,
                    shape=growth_shapes[i],
                    onset_h=float(axis_values["onset_time_frac"][i] * mission_duration_h),
                    end_severity=float(axis_values["severity_end_state"][i]),
                )
            )

        nuisance_kind = nuisance_assignment[i]
        if nuisance_kind != "none":
            faults.append(
                FaultEvent(
                    mode="sensor_drift_bias_stuck",
                    target={"channel": "unspecified"},
                    parameter=None,
                    onset_h=float(rng.uniform(0.0, 0.9 * mission_duration_h)),
                    shape=nuisance_kind,
                    rate_per_h=float(rng.uniform(0.2, 2.0)),
                )
            )

        labels = dict(
            root_cause=mode,
            engine_age_h=float(axis_values["engine_age_h"][i]),
            true_severity_series="auto",
            first_detectable_h=None,  # computed post-hoc once the residual pipeline (Phase 14) exists
        )
        scenarios.append(
            ScenarioSpec(scenario=f"{mode}_{i:05d}", mission=mission, faults=faults, labels=labels)
        )

    return scenarios
