"""Gate 4 - Cross-model agreement (report section 18): Tier B (mean-value,
real-time) must track Tier A (high-fidelity, crank-resolved) within MAP
within 1%, CHT within 3K, crank speed within 0.5% at matched operating
points.

Tier B does not exist yet - it is built in Phase 13
(simengine/twin/meanvalue.py). This test is intentionally xfail (not
silently skipped: xfail still runs and reports, it just doesn't fail the
suite) until then. Phase 13 must remove the xfail marker and make this test
assert the real comparison once MeanValueTwin exists.
"""
import pytest


@pytest.mark.xfail(
    reason="Tier B (simengine/twin/meanvalue.py) does not exist yet - built in Phase 13",
    strict=True,
    raises=ImportError,
)
def test_gate4_tier_b_tracks_tier_a_at_matched_operating_point():
    from simengine.twin.meanvalue import MeanValueTwin  # noqa: F401

    raise AssertionError(
        "Phase 13 must replace this body with a real Tier A vs Tier B "
        "comparison (MAP within 1%, CHT within 3K, crank speed within 0.5%) "
        "and remove the xfail marker above."
    )
