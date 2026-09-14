"""Loaders for the two canonical YAML config files.

engine_seed_params.yaml is Table 1 (reference engine) + Table 15 (seed
parameters) from the Celestia SIH26054 report. fault_library.yaml is Table 6
(21 physical fault modes) plus the sensor-nuisance DOE axis. Every other
simengine module reads its constants through these two functions rather than
hardcoding numbers, so the report's tables stay the single source of truth.
"""
from pathlib import Path

import yaml

_CONFIG_DIR = Path(__file__).parent


def load_seed_params() -> dict:
    with open(_CONFIG_DIR / "engine_seed_params.yaml") as f:
        return yaml.safe_load(f)


def load_fault_library() -> dict:
    with open(_CONFIG_DIR / "fault_library.yaml") as f:
        return yaml.safe_load(f)
