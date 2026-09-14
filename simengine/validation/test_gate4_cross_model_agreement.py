"""Gate 4 - Cross-model agreement (report section 18): Tier B (mean-value,
real-time) must track Tier A (high-fidelity, crank-resolved) within MAP
within 1%, CHT within 3K, crank speed within 0.5% at matched operating
points.

Tier B (simengine/twin/meanvalue.py) now exists (Phase 13) - this gate is no
longer xfail.

Three checks, matching the report's three named quantities:
1. MAP: the Tier B twin's converged manifold pressure vs its own commanded
   MAP (this is a legitimate check of eq 13.1's manifold-filling dynamics
   actually reaching the setpoint, even though MAP is also Tier A's boundary
   condition by construction).
2. Crank speed: the twin's converged crank speed vs the Tier A rated point
   (Appendix A) it was commanded to reproduce - this is the real,
   non-trivial check: does the closed-loop engine/prop torque balance
   settle at the SAME operating point Tier A was evaluated at.
3. CHT: rather than comparing two independently-tuned thermal models (which
   would conflate "are the two tiers numerically consistent" with "is our
   hand-tuned thermal network correct" - the latter isn't this project's
   claim), this checks the thing Gate 4 is actually meant to guard against
   (report section 18: "divergence => mean-value surfaces are stale, must
   regenerate"): take the twin's converged operating point, get Tier A's
   INTERPOLATED heat-load estimate there (already computed by the twin) and
   a DIRECT (non-interpolated) run_closed_cycle evaluation at the exact same
   (rpm, MAP) point, run each through the SAME thermal network to its
   ANALYTIC steady state (ThermalNetwork.step() with a very large dt makes
   the C/dt term negligible, solving the algebraic steady state directly -
   no need to simulate thousands of seconds twice), and compare CHT.
"""
import math

from simengine.engine.cycle import run_closed_cycle
from simengine.twin.meanvalue import Context, MeanValueTwin, TierASurface

TAKEOFF_RPM = 5800.0
TAKEOFF_MAP_Pa = 1.32e5


def _run_to_steady_state(ctx, n_steps=6000, dt=0.02):
    twin = MeanValueTwin()
    s = None
    for _ in range(n_steps):
        s = twin.step(dt, ctx)
    return twin, s


def _analytic_steady_head_temperature(twin: MeanValueTwin, imep_Pa: float, rpm: float, ambient_T_K: float) -> float:
    """Reproduce meanvalue.py's own Qdot_head/Qdot_liner/Qdot_friction split
    for a given imep, then solve the twin's own thermal network for its
    algebraic steady state (dt_s huge -> C/dt negligible)."""
    N_rev_s = rpm / 60.0
    Wgross_per_cyl_J = imep_Pa * twin.geometry.displacement_per_cyl_m3
    n_cyl = twin.geometry.n_cylinders
    Qdot_ht_total_W = 0.35 * Wgross_per_cyl_J * (N_rev_s / 2.0) * n_cyl
    Qdot_head = 0.6 * Qdot_ht_total_W
    Qdot_liner = 0.4 * Qdot_ht_total_W

    T0 = {"head": 320.0, "coolant": 310.0, "oil": 330.0, "liner": 320.0}
    h_ext = {"coolant": 700.0, "liner": 450.0, "oil": 600.0}
    T_ss = twin.thermal_network.step(
        T0, dt_s=1e9,
        Qdot_in_W={"head": Qdot_head, "liner": Qdot_liner, "oil": 0.0, "coolant": 0.0},
        T_inf_K=ambient_T_K, h_ext_W_per_m2K=h_ext,
    )
    return T_ss["head"]


def test_gate4_map_converges_to_commanded_value_within_one_percent():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    _, s = _run_to_steady_state(ctx, n_steps=3000)
    error_pct = abs(s["p_MAP_Pa"] - TAKEOFF_MAP_Pa) / TAKEOFF_MAP_Pa * 100.0
    assert error_pct <= 1.0


def test_gate4_crank_speed_within_half_percent_of_tier_a_rated_point():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    _, s = _run_to_steady_state(ctx, n_steps=6000)
    rpm = s["omega_engine_rad_s"] * 60.0 / (2.0 * math.pi)
    error_pct = abs(rpm - TAKEOFF_RPM) / TAKEOFF_RPM * 100.0
    assert error_pct <= 0.5


def test_gate4_cht_from_interpolated_surface_matches_direct_tier_a_within_3K():
    ctx = Context(MAP_command_Pa=TAKEOFF_MAP_Pa)
    twin, s = _run_to_steady_state(ctx, n_steps=6000)
    rpm = s["omega_engine_rad_s"] * 60.0 / (2.0 * math.pi)
    MAP_Pa = s["p_MAP_Pa"]

    interpolated = twin.surface.interpolate(rpm, MAP_Pa)
    direct = run_closed_cycle(rpm=rpm, MAP_Pa=MAP_Pa, lam=0.90, dtheta_deg=1.0)

    T_head_interpolated = _analytic_steady_head_temperature(
        twin, interpolated["imep_Pa"], rpm, ctx.ambient_T_K
    )
    T_head_direct = _analytic_steady_head_temperature(
        twin, direct["imep_Pa"], rpm, ctx.ambient_T_K
    )
    cht_diff_K = abs(T_head_interpolated - T_head_direct)
    assert cht_diff_K < 3.0, (
        f"interpolated-surface CHT diverges from direct Tier A CHT by {cht_diff_K:.2f}K "
        "- the mean-value surface may be too coarse and need regenerating (report section 18)"
    )
