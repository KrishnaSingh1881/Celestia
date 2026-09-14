import importlib.util
import pathlib

import numpy as np
import pytest

from simengine.engine.heat import (
    ThermalNetwork,
    ThermalNode,
    blowdown_temperature,
    dQht_dtheta,
    probe_temperature,
    woschni_h,
    woschni_params_from_config,
)

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
REFERENCE_SCRIPT = REPO_ROOT / "research" / "celestia_cycle_model_reference.py"

# research/ is a local-only reference (deliberately untracked - see
# .gitignore) holding the original spec + reference script this project was
# built from. It exists on the machine that authored simengine, but not on a
# fresh clone or in CI. This one test is the only runtime dependency on it
# anywhere in the suite; skip gracefully rather than fail when it's absent,
# since the physics it validates is already independently pinned by
# test_tier_a_regression.py's Table 4 numbers.
_HAS_REFERENCE_SCRIPT = REFERENCE_SCRIPT.exists()


def _load_reference_module():
    spec = importlib.util.spec_from_file_location("celestia_reference", REFERENCE_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.skipif(
    not _HAS_REFERENCE_SCRIPT,
    reason="research/celestia_cycle_model_reference.py is a local-only reference, not present in this checkout",
)
def test_woschni_and_wall_heat_loss_match_reference_bit_for_bit():
    ref = _load_reference_module()
    result = ref.run_cycle(rpm=5800.0, MAP=1.32e5, Tivc=330.0, lam=0.85)

    rpm = result["rpm"]
    MAP = result["MAP"]
    V = result["V"]
    p = result["p"]
    T = result["T"]
    th_deg = result["th"]
    theta_rad = th_deg * np.pi / 180.0
    theta0_rad = -22.0 * np.pi / 180.0  # run_cycle's default th_ign

    V1 = V[0]
    Sp = 2 * ref.S * rpm / 60.0
    p_mot = MAP * (V1 / V) ** 1.32
    omega = rpm * 2 * np.pi / 60.0

    params = woschni_params_from_config()
    h_computed, _ = woschni_h(
        p_Pa=p,
        T_K=T,
        Sp_m_s=Sp,
        bore_m=ref.B,
        C1=params["C1"],
        C2=params["C2"],
        Vd_cyl_m3=ref.Vd_cyl,
        Tivc_K=330.0,
        MAP_Pa=MAP,
        V1_m3=V1,
        p_mot_Pa=p_mot,
        theta_rad=theta_rad,
        theta0_rad=theta0_rad,
    )
    area = ref.area(theta_rad)
    qht_computed = dQht_dtheta(h_computed, area, T, params["Twall_K"], omega)

    # reference's run_cycle patches the last array element to equal the
    # second-to-last (h_arr[-1] = h_arr[-2]; q_ht[-1] = q_ht[-2]) - compare
    # everywhere else.
    h_ref = result["h"][:-1]
    qht_ref = result["q_ht"][:-1]
    assert np.allclose(h_computed[:-1], h_ref, rtol=1e-6)
    assert np.allclose(qht_computed[:-1], qht_ref, rtol=1e-6)


def test_woschni_c2_gate_zeroes_before_ignition():
    params = woschni_params_from_config()
    theta0_rad = np.deg2rad(-22.0)
    theta_before = np.array([np.deg2rad(-100.0)])
    theta_after = np.array([np.deg2rad(0.0)])

    # Construct a case where p is well above p_mot so the C2 term would be
    # visible if active.
    common = dict(
        T_K=np.array([500.0]),
        Sp_m_s=10.0,
        bore_m=0.0795,
        C1=params["C1"],
        C2=params["C2"],
        Vd_cyl_m3=3.028e-4,
        Tivc_K=330.0,
        MAP_Pa=1.32e5,
        V1_m3=1.0e-4,
        p_mot_Pa=np.array([1.0e5]),
        p_Pa=np.array([5.0e5]),
    )
    h_before, w_before = woschni_h(theta_rad=theta_before, theta0_rad=theta0_rad, **common)
    h_after, w_after = woschni_h(theta_rad=theta_after, theta0_rad=theta0_rad, **common)
    assert w_after > w_before  # C2 term only contributes after ignition


def test_egt_probe_worked_example():
    # Report's own worked example: Tevo=2148K -> Tbd~=1520K -> Tprobe~=1150K
    # (880 degC). The report does not give the exact p_evo/p_exh/h_p/A_p/mdot/
    # cp inputs it used to reach these rounded figures - here we pick
    # physically reasonable values (typical boosted-engine EVO/exhaust
    # pressures, typical exhaust-gas mass flow and h_p for a probe in a fast
    # exhaust stream) that reproduce the same waypoints, as a consistency
    # check on the two formulas rather than a bit-for-bit reproduction.
    gamma = 1.3
    T_evo = 2148.0
    p_evo = 4.69e5   # representative EVO pressure, boosted high-power point
    p_exh = 1.05e5   # representative exhaust manifold pressure
    T_bd = blowdown_temperature(T_evo, p_exh, p_evo, gamma)
    assert T_bd == pytest.approx(1520.0, rel=0.02)

    T_probe = probe_temperature(
        T_blowdown_K=T_bd,
        T_pipe_K=400.0,
        h_p_W_per_m2K=2200.0,
        A_p_m2=0.01,
        mdot_kg_s=0.05,
        cp_J_per_kgK=1100.0,
    )
    assert T_probe == pytest.approx(1150.0, rel=0.02)
    assert T_probe < T_bd  # probe always lags the true blowdown temperature


def test_thermal_network_reaches_steady_state_within_expected_time_constant():
    # Single-node network: C*dT/dt = Qdot_in - G_ext*(T - T_inf). Analytic
    # time constant tau = C / G_ext. Choose values so tau = 60s (within the
    # report's head-node range of 30-90s).
    C = 6000.0       # J/K
    G_ext = 100.0    # W/K
    tau = C / G_ext
    assert 30.0 <= tau <= 90.0

    net = ThermalNetwork(
        nodes=[ThermalNode(name="head", thermal_mass_J_per_K=C, area_ext_m2=1.0)],
    )
    T_inf = 300.0
    Qdot = 500.0
    T_final_expected = T_inf + Qdot / G_ext

    T = {"head": T_inf}
    dt = 1.0
    n_steps = int(20 * tau)  # run for many time constants
    settle_step = None
    for step in range(n_steps):
        T = net.step(T, dt, {"head": Qdot}, T_inf, {"head": G_ext / 1.0})
        if settle_step is None and abs(T["head"] - T_final_expected) <= 0.05 * (
            T_final_expected - T_inf
        ):
            settle_step = step

    assert settle_step is not None, "network never settled"
    settle_time = settle_step * dt
    # 95% settling of a first-order system happens at ~3*tau; allow a broad
    # [1*tau, 5*tau] band per the roadmap's stated tolerance.
    assert tau <= settle_time <= 5 * tau
    assert T["head"] == pytest.approx(T_final_expected, rel=1e-2)


def test_thermal_network_multi_node_conducts_heat_between_nodes():
    net = ThermalNetwork(
        nodes=[
            ThermalNode(name="head", thermal_mass_J_per_K=5000.0, area_ext_m2=0.0),
            ThermalNode(name="coolant", thermal_mass_J_per_K=8000.0, area_ext_m2=1.0),
        ],
        conductances={("head", "coolant"): 50.0},
    )
    T = {"head": 400.0, "coolant": 350.0}
    T_inf = 300.0
    for _ in range(2000):
        T = net.step(T, 1.0, {"head": 0.0, "coolant": 0.0}, T_inf, {"coolant": 20.0})
    # With no more heat input, both nodes should relax toward ambient, and the
    # hotter head node should have transferred heat into the coolant node
    # along the way (they should end up much closer together than they started).
    assert abs(T["head"] - T["coolant"]) < abs(400.0 - 350.0)
