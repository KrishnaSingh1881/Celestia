"""Tier B: the real-time mean-value twin (report section 13.2, eq 13.1).

Central architecture point (section 13): Tier B does NOT recompute a
crank-angle-resolved cycle every step. It reads Tier A's PRECOMPUTED
surfaces (here: a small (rpm, MAP) grid of actual
simengine.engine.cycle.run_closed_cycle() results, built once and
interpolated at runtime via TierASurface) and integrates a small,
cycle-averaged ODE system at 20-50 Hz - cheap enough to run in real time on
modest hardware, sharing the same seed parameters as Tier A.

Scope notes (read before extending):
- eta_v(N, Pi) is NOT read from a Tier A surface: Tier A takes MAP directly
  as a boundary condition and has no intake/volumetric-efficiency model of
  its own to build such a surface from (see report eq 6.1 - eta_v ties
  intake flow to engine speed, a Tier-B-only concept). A smooth analytic
  eta_v(N) proxy is used instead (_nominal_eta_v below); replace with a real
  fitted surface once an intake model exists.
- The turbocharger's compressor/wastegate response is a simplified
  proportional control law tracking a commanded MAP, and turbine power is a
  lumped proxy scaling with fuel energy flow - the report gives the
  compressor/turbine EQUATIONS (eq 6.5-6.7, in simengine.engine.turbo) but
  no seed constants for a full compressor/turbine map, so this is a
  documented placeholder, not a fitted model.
- Every other quantity (friction, thermal network, oil circuit) reuses the
  exact same simengine.engine.* functions Tier A uses (Chen-Flynn friction,
  the 4-node ThermalNetwork, Vogel viscosity + Hagen-Poiseuille oil
  pressure) - these are shared, not reimplemented.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.interpolate import RegularGridInterpolator

from simengine.config import load_seed_params
from simengine.engine import dynamics, friction, lube
from simengine.engine.cycle import run_closed_cycle
from simengine.engine.geometry import EngineGeometry
from simengine.engine.heat import ThermalNetwork, ThermalNode


class TierASurface:
    """A small (rpm, MAP) grid of real Tier A run_closed_cycle() outputs,
    built once at construction time and interpolated at runtime. This is the
    literal mechanism behind "Tier B reads Tier A's precomputed surfaces
    rather than recomputing them" - not a metaphor for some other lookup.
    """

    def __init__(
        self,
        rpm_grid=(4500.0, 5000.0, 5500.0, 5800.0, 6200.0),
        MAP_grid=(0.80e5, 1.00e5, 1.05e5, 1.20e5, 1.32e5, 1.45e5),
        lam: float = 0.90,
        dtheta_deg: float = 2.0,
    ):
        self.rpm_grid = np.array(rpm_grid, dtype=float)
        self.MAP_grid = np.array(MAP_grid, dtype=float)

        n_rpm, n_map = self.rpm_grid.size, self.MAP_grid.size
        imep = np.zeros((n_rpm, n_map))
        p_max = np.zeros((n_rpm, n_map))
        T_evo = np.zeros((n_rpm, n_map))

        for i, rpm in enumerate(self.rpm_grid):
            for j, MAP_Pa in enumerate(self.MAP_grid):
                result = run_closed_cycle(rpm=rpm, MAP_Pa=MAP_Pa, lam=lam, dtheta_deg=dtheta_deg)
                imep[i, j] = result["imep_Pa"]
                p_max[i, j] = result["p_max_Pa"]
                T_evo[i, j] = result["T_evo_K"]

        points = (self.rpm_grid, self.MAP_grid)
        self._imep_interp = RegularGridInterpolator(points, imep, bounds_error=False, fill_value=None)
        self._pmax_interp = RegularGridInterpolator(points, p_max, bounds_error=False, fill_value=None)
        self._tevo_interp = RegularGridInterpolator(points, T_evo, bounds_error=False, fill_value=None)

    def interpolate(self, rpm: float, MAP_Pa: float) -> dict:
        rpm_c = float(np.clip(rpm, self.rpm_grid.min(), self.rpm_grid.max()))
        MAP_c = float(np.clip(MAP_Pa, self.MAP_grid.min(), self.MAP_grid.max()))
        point = np.array([[rpm_c, MAP_c]])
        return dict(
            imep_Pa=float(self._imep_interp(point)[0]),
            p_max_Pa=float(self._pmax_interp(point)[0]),
            T_evo_K=float(self._tevo_interp(point)[0]),
        )


def _nominal_eta_v(N_rev_s: float) -> float:
    """Smooth placeholder volumetric-efficiency-vs-speed curve, peaking near
    a mid-high rpm and falling off at both extremes - see module scope note."""
    rpm = N_rev_s * 60.0
    peak_rpm = 5200.0
    width = 2500.0
    return 0.92 * np.exp(-((rpm - peak_rpm) / width) ** 2)


@dataclass
class MeanValueTwinState:
    p_MAP_Pa: float
    omega_engine_rad_s: float
    omega_tc_rad_s: float
    T_head_K: float
    T_coolant_K: float
    T_oil_K: float
    T_liner_K: float
    p_oil_Pa: float

    def as_dict(self) -> dict:
        return dict(
            p_MAP_Pa=self.p_MAP_Pa, omega_engine_rad_s=self.omega_engine_rad_s,
            omega_tc_rad_s=self.omega_tc_rad_s, T_head_K=self.T_head_K,
            T_coolant_K=self.T_coolant_K, T_oil_K=self.T_oil_K,
            T_liner_K=self.T_liner_K, p_oil_Pa=self.p_oil_Pa,
        )


@dataclass
class Context:
    """Minimal operating-context input for one Tier B step (a forward
    reference to Phase 17's full contracts.Context - kept local/minimal here
    so Phase 13 does not have to wait on Phase 17)."""

    MAP_command_Pa: float
    ambient_T_K: float = 288.15
    ambient_p_Pa: float = 101325.0
    # T_prop = k * omega_engine^2. 8.89e-4 is calibrated (by numeric search,
    # not derived from a propeller map - no propeller CT/CQ constants are
    # seeded in this project yet) so the engine/prop torque balance settles
    # near the take-off rated point (5800rpm) at MAP_command=1.32e5 Pa.
    prop_load_k: float = 8.89e-4
    theta: dict = field(default_factory=dict)  # health-parameter overrides


class MeanValueTwin:
    """The Tier B 8-state ODE system: manifold filling, turbo shaft, crank
    shaft, 4 thermal nodes, and oil-circuit pressure - integrated with a
    simple fixed-step RK4 at whatever dt the caller steps with (20-50 Hz
    per the report; this class is dt-agnostic, the caller picks the rate)."""

    def __init__(self, geometry: EngineGeometry | None = None, surface: TierASurface | None = None):
        self.geometry = geometry or EngineGeometry.from_config()
        self.surface = surface or TierASurface()
        params = load_seed_params()
        self.Rg = params["fixed_from_literature"]["gas_constant_J_per_kgK"]
        self.gear_ratio = params["fixed_from_spec"]["gear_ratio"]
        self.pmep_Pa = params["fitted"]["pmep_Pa"]
        self.chen_flynn = friction.chen_flynn_params_from_config()

        # Sized so that a full-power heat load (tens of kW into the coolant
        # circuit, ~10kW of friction heat into the oil - see meanvalue.py's
        # derivation notes) produces temperature DIFFERENCES of a few tens of
        # K, not hundreds, and so each node's time constant (C/G) lands
        # in the report's stated ranges (head 30-90s, coolant 60-150s, oil
        # 5-15min). An earlier, much smaller head-coolant conductance (60
        # W/K) required a ~280K temperature difference just to conduct a
        # realistic heat load through it, which is why the network never
        # reached a bounded steady state.
        self.thermal_network = ThermalNetwork(
            nodes=[
                ThermalNode("head", thermal_mass_J_per_K=54000.0, area_ext_m2=0.0),
                ThermalNode("coolant", thermal_mass_J_per_K=132000.0, area_ext_m2=1.2),
                ThermalNode("oil", thermal_mass_J_per_K=72000.0, area_ext_m2=0.4),
                ThermalNode("liner", thermal_mass_J_per_K=10800.0, area_ext_m2=0.8),
            ],
            conductances={("head", "coolant"): 1800.0},
        )

        self.state = MeanValueTwinState(
            p_MAP_Pa=1.0e5, omega_engine_rad_s=500.0, omega_tc_rad_s=1000.0,
            T_head_K=350.0, T_coolant_K=340.0, T_oil_K=330.0, T_liner_K=345.0,
            p_oil_Pa=3.0e5,
        )

    def _derivatives(self, state: MeanValueTwinState, ctx: Context) -> dict:
        N_rev_s = state.omega_engine_rad_s / (2.0 * np.pi)
        rpm = N_rev_s * 60.0
        Sp = 2.0 * self.geometry.stroke_m * max(N_rev_s, 1e-6)

        eta_v_mult = ctx.theta.get("eta_v_mult", 1.0)
        eta_v = eta_v_mult * _nominal_eta_v(N_rev_s)
        Ti = ctx.ambient_T_K + 15.0  # crude intake-manifold-air-temp rise over ambient
        mdot_eng = eta_v * (state.p_MAP_Pa / (self.Rg * Ti)) * self.geometry.displacement_total_m3 * (N_rev_s / 2.0)

        # Simplified turbo+wastegate response tracking the commanded MAP
        # (see module scope note) - proportional control toward MAP_command.
        # K_wg is chosen so that A = (Rg*Ti/V_manifold)*K_wg gives a manifold
        # filling time constant tau=1/A ~ 0.1-0.2s, a physically reasonable
        # response speed AND (importantly) small enough that this explicit
        # forward-Euler step stays stable at the Tier B outer step size
        # (A*dt << 2) - an earlier, much larger K_wg made this ODE stiff
        # enough to blow up in a couple hundred steps.
        V_manifold_m3 = 1.5e-3
        K_wg = 1.5e-7
        mdot_comp = mdot_eng + K_wg * (ctx.MAP_command_Pa - state.p_MAP_Pa)
        dp_MAP_dt = (self.Rg * Ti / V_manifold_m3) * (mdot_comp - mdot_eng)

        surf = self.surface.interpolate(rpm, state.p_MAP_Pa)
        friction_mult = ctx.theta.get("friction_mult", 1.0)
        FMEP = friction_mult * friction.fmep_chen_flynn(surf["p_max_Pa"], Sp, **self.chen_flynn)
        BMEP = friction.bmep(surf["imep_Pa"], self.pmep_Pa, FMEP)
        Tb = friction.brake_torque(BMEP, self.geometry.displacement_total_m3)
        T_prop = ctx.prop_load_k * state.omega_engine_rad_s**2
        J_eff = 0.06
        domega_engine_dt = dynamics.crank_domega_dt(Tb, T_prop, self.gear_ratio, 0.97, J_eff)

        # Turbo shaft: the literal inertial ODE (eq 6.7, engine.turbo.domega_tc_dt)
        # is numerically stiff at real turbo J/power scales (a real
        # turbocharger's rotor accelerates on millisecond timescales) - not
        # integrable with a plain forward Euler step at Tier B's 20-50Hz outer
        # rate without sub-stepping. Multi-rate sub-stepping for exactly this
        # kind of fast subsystem is the report's own section 14.2 concern;
        # until that exists here, use a quasi-steady first-order relaxation
        # toward a boost-ratio-dependent target speed instead - directionally
        # correct (spools toward a higher target as commanded boost rises)
        # without the stiffness. engine.turbo's functions remain available
        # and tested (Phase 4) for whichever future sub-stepped model replaces this.
        Pi = state.p_MAP_Pa / ctx.ambient_p_Pa
        omega_tc_target = 2000.0 + 12000.0 * max(Pi - 1.0, 0.0)
        tau_tc_s = 0.3
        domega_tc_dt = (omega_tc_target - state.omega_tc_rad_s) / tau_tc_s

        n_cyl = self.geometry.n_cylinders
        # dQht_dtheta isn't separately tracked at the Tier B level; approximate
        # total wall heat rejection rate from the interpolated peak-pressure
        # surface via a fixed fraction of net indicated work (a documented
        # lumped proxy, not a report equation) - split between head/liner.
        Wgross_per_cyl_J = surf["imep_Pa"] * self.geometry.displacement_per_cyl_m3
        Qdot_ht_total_W = 0.35 * Wgross_per_cyl_J * (N_rev_s / 2.0) * n_cyl
        Qdot_head = 0.6 * Qdot_ht_total_W
        Qdot_liner = 0.4 * Qdot_ht_total_W
        Qdot_friction = lube.friction_heat_rate(FMEP, self.geometry.displacement_total_m3, N_rev_s)

        T_current = {
            "head": state.T_head_K, "coolant": state.T_coolant_K,
            "oil": state.T_oil_K, "liner": state.T_liner_K,
        }
        # cooling_mult < 1.0 models cooling_degradation (Appendix C: fouled
        # radiator / lost ram-air effectiveness, h_ext*A falls) - added here
        # (rather than only in engine/* directly) so Phase 17's pipeline can
        # inject this specific fault into a running twin via ctx.theta,
        # without needing a bespoke code path per fault.
        cooling_mult = ctx.theta.get("cooling_mult", 1.0)
        h_ext = {
            "coolant": cooling_mult * 700.0,
            "liner": cooling_mult * 450.0,
            "oil": 600.0,
        }
        T_next = self.thermal_network.step(
            T_current, dt_s=1.0,  # unit step; caller's outer dt scales the returned delta
            Qdot_in_W={"head": Qdot_head, "liner": Qdot_liner, "oil": Qdot_friction, "coolant": 0.0},
            T_inf_K=ctx.ambient_T_K, h_ext_W_per_m2K=h_ext,
        )
        dT_head_dt = T_next["head"] - T_current["head"]
        dT_coolant_dt = T_next["coolant"] - T_current["coolant"]
        dT_oil_dt = T_next["oil"] - T_current["oil"]
        dT_liner_dt = T_next["liner"] - T_current["liner"]

        eta_vol_pump = ctx.theta.get("eta_vol_pump", 0.9)
        mu_oil = lube.vogel_viscosity(state.T_oil_K, K=6e-6, theta1_K=900.0, theta2_K=120.0)
        Q_pump = lube.pump_flow(eta_vol_pump, D_p_m3_per_rev=2e-5, N_rev_s=N_rev_s, k_l=2e-14,
                                 dP_Pa=state.p_oil_Pa, mu_Pa_s=mu_oil)
        # d_m=8e-4 (~0.8mm effective diameter) represents the combined
        # restriction of bearing clearances + gallery, not a bare pipe bore -
        # a plain ~7mm gallery bore alone gives a laughably small resistance
        # (observed: ~65 Pa oil pressure instead of a few bar) because real
        # systems' pressure is set mostly by clearance/orifice restriction,
        # not gallery length.
        R_h = lube.gallery_hydraulic_resistance(mu_oil, L_m=0.05, d_m=8e-4)
        p_oil_ss = lube.oil_pressure(R_h, max(Q_pump, 0.0))
        tau_oil_hydraulic_s = 0.5
        dp_oil_dt = (p_oil_ss - state.p_oil_Pa) / tau_oil_hydraulic_s

        return dict(
            p_MAP_Pa=dp_MAP_dt, omega_engine_rad_s=domega_engine_dt, omega_tc_rad_s=domega_tc_dt,
            T_head_K=dT_head_dt, T_coolant_K=dT_coolant_dt, T_oil_K=dT_oil_dt, T_liner_K=dT_liner_dt,
            p_oil_Pa=dp_oil_dt,
        )

    def step(self, dt_s: float, ctx: Context) -> dict:
        """Advance the twin by dt_s (forward Euler - adequate at the
        report's 20-50Hz Tier B rate for this reduced state set) and return
        the new state as a plain dict (Prediction-shaped, per Phase 17)."""
        deriv = self._derivatives(self.state, ctx)
        for field_name, rate in deriv.items():
            setattr(self.state, field_name, getattr(self.state, field_name) + rate * dt_s)
        return self.state.as_dict()
