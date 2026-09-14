import time

import numpy as np
import pytest

from simengine.twin.meanvalue import Context, MeanValueTwin, TierASurface
from simengine.engine.cycle import run_closed_cycle

TAKEOFF_RPM = 5800.0
TAKEOFF_MAP_Pa = 1.32e5


def _run_to_steady_state(ctx, n_steps=20000, dt=0.02):
    twin = MeanValueTwin()
    s = None
    for _ in range(n_steps):
        s = twin.step(dt, ctx)
    return twin, s


def test_map_converges_to_commanded_value():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    _, s = _run_to_steady_state(ctx, n_steps=3000)
    assert s["p_MAP_Pa"] == pytest.approx(TAKEOFF_MAP_Pa, rel=1e-6)


def test_crank_speed_settles_near_takeoff_rated_point():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    _, s = _run_to_steady_state(ctx, n_steps=6000)
    rpm = s["omega_engine_rad_s"] * 60.0 / (2.0 * np.pi)
    error_pct = abs(rpm - TAKEOFF_RPM) / TAKEOFF_RPM * 100.0
    assert error_pct <= 0.5


def test_thermal_states_stay_bounded_and_physically_plausible():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    _, s = _run_to_steady_state(ctx, n_steps=6000)
    for key in ("T_head_K", "T_coolant_K", "T_oil_K", "T_liner_K"):
        assert 280.0 < s[key] < 500.0, f"{key}={s[key]} out of a physically plausible range"


def test_oil_pressure_lands_in_a_sensible_range():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    _, s = _run_to_steady_state(ctx, n_steps=3000)
    assert 1.0e5 <= s["p_oil_Pa"] <= 8.0e5  # roughly 1-8 bar


def test_twin_step_is_fast_enough_for_real_time_use():
    twin = MeanValueTwin()
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    t0 = time.time()
    for _ in range(1000):
        twin.step(0.02, ctx)
    elapsed = time.time() - t0
    assert elapsed < 1.0, f"1000 Tier B steps took {elapsed:.2f}s, expected well under 1s"


def test_tier_a_surface_interpolation_matches_direct_evaluation_off_grid():
    surf = TierASurface()
    rpm, MAP_Pa = 5650.0, 1.15e5  # deliberately off every grid line
    direct = run_closed_cycle(rpm=rpm, MAP_Pa=MAP_Pa, lam=0.90, dtheta_deg=1.0)
    interp = surf.interpolate(rpm, MAP_Pa)
    assert interp["p_max_Pa"] == pytest.approx(direct["p_max_Pa"], rel=0.01)
    assert interp["imep_Pa"] == pytest.approx(direct["imep_Pa"], rel=0.02)
    assert abs(interp["T_evo_K"] - direct["T_evo_K"]) < 5.0
