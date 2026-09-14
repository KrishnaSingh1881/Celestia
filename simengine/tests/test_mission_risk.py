import pathlib
import re

import pytest

from simengine.twin.mission_risk import (
    AdvisoryTierClassifier,
    expected_cost_go,
    expected_cost_nogo,
    mission_survival_probability,
    recommend_go,
)

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SIMENGINE_DIR = REPO_ROOT / "simengine"


def test_mission_survival_probability_decreases_with_hazard():
    low_hazard = mission_survival_probability(lambda t: 0.001, [0.0, 10.0])
    high_hazard = mission_survival_probability(lambda t: 0.05, [0.0, 10.0])
    assert 0.0 < high_hazard < low_hazard < 1.0


def test_multi_segment_survival_matches_product_of_segment_survivals():
    import numpy as np

    lambda_fn = lambda t: 0.01
    boundaries = [0.0, 5.0, 8.0, 12.0]
    combined = mission_survival_probability(lambda_fn, boundaries)
    total_time = boundaries[-1] - boundaries[0]
    expected = float(np.exp(-0.01 * total_time))
    assert combined == pytest.approx(expected, rel=1e-3)


def test_go_no_go_flips_when_loss_cost_rises_enough():
    P_success = 0.95
    C_op, C_abort, C_maint = 50.0, 500.0, 200.0  # E[C_nogo] = 700

    assert recommend_go(P_success, C_loss=2000.0, C_op=C_op, C_abort=C_abort, C_maint=C_maint) is True
    assert recommend_go(P_success, C_loss=1_000_000.0, C_op=C_op, C_abort=C_abort, C_maint=C_maint) is False


def test_expected_cost_helpers_match_formulas():
    assert expected_cost_go(0.9, C_loss=1000.0, C_op=50.0) == pytest.approx(0.1 * 1000.0 + 0.9 * 50.0)
    assert expected_cost_nogo(C_abort=300.0, C_maint=100.0) == pytest.approx(400.0)


@pytest.mark.parametrize(
    "kwargs,expected_tier",
    [
        (
            dict(HI=95.0, persistent_residual=False, coincidence_confirmed=False, RUL_5pct_h=1000.0,
                 remaining_mission_h=5.0, cascade_projected_to_limit=False, is_knock_or_oil_pressure_class=False),
            "Nominal",
        ),
        (
            dict(HI=85.0, persistent_residual=True, coincidence_confirmed=False, RUL_5pct_h=1000.0,
                 remaining_mission_h=5.0, cascade_projected_to_limit=False, is_knock_or_oil_pressure_class=False,
                 dominant_channel="oil_temp"),
            "Watch",
        ),
        (
            dict(HI=70.0, persistent_residual=True, coincidence_confirmed=True, RUL_5pct_h=1000.0,
                 remaining_mission_h=5.0, cascade_projected_to_limit=False, is_knock_or_oil_pressure_class=False),
            "Advisory",
        ),
        (
            dict(HI=50.0, persistent_residual=True, coincidence_confirmed=True, RUL_5pct_h=2.0,
                 remaining_mission_h=5.0, cascade_projected_to_limit=False, is_knock_or_oil_pressure_class=False),
            "Caution",
        ),
        (
            dict(HI=20.0, persistent_residual=True, coincidence_confirmed=True, RUL_5pct_h=1000.0,
                 remaining_mission_h=5.0, cascade_projected_to_limit=True, is_knock_or_oil_pressure_class=False),
            "Warning",
        ),
    ],
)
def test_advisory_tier_classifier_matches_table_12_rows(kwargs, expected_tier):
    result = AdvisoryTierClassifier().classify(**kwargs)
    assert result.tier == expected_tier
    assert result.authority in ("none", "crew decides")
    if expected_tier != "Nominal" and expected_tier != "Watch":
        assert result.authority == "crew decides"


def test_no_actuator_control_function_exists_anywhere_in_simengine():
    forbidden_patterns = re.compile(r"\b(actuate|write_actuator|override_fadec|command_actuator)\w*\s*\(", re.IGNORECASE)
    offending = []
    for path in SIMENGINE_DIR.rglob("*.py"):
        text = path.read_text()
        for match in forbidden_patterns.finditer(text):
            offending.append(f"{path.relative_to(REPO_ROOT)}: {match.group(0)}")
    assert not offending, f"found actuator-control-shaped function(s): {offending}"
