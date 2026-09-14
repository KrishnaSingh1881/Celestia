"""Gate 2 - External anchors (report section 18). Published power at the
three rated points, BSFC in 240-300 g/kWh, peak cylinder pressure 50-75 bar -
none of these were fitted except the power numbers themselves (Phase 9's
calibration objective is power only; BSFC and peak pressure are predictions).

This gate reuses Phase 5's test_tier_a_regression.py functions directly
(imported via the module, not re-collected as top-level names here, so
pytest does not double-run them under two different module paths) rather
than re-deriving the same assertions a second time.
"""
from simengine.tests import test_tier_a_regression as _phase5


def test_gate2_power_bsfc_and_pmax_all_rated_points():
    for point_name in _phase5.RATED_POINTS:
        _phase5.test_power_within_reported_error_band(point_name)
        _phase5.test_bsfc_in_expected_band(point_name)
        _phase5.test_peak_pressure_in_expected_band(point_name)


def test_gate2_takeoff_ranks_highest():
    _phase5.test_takeoff_power_ranks_highest_among_rated_points()
