"""Heat transfer: Woschni in-cylinder correlation, the lumped thermal network,
and the EGT probe observation model. Report eq 5.1-5.7.

The Woschni piece is ported bit-for-bit from
research/celestia_cycle_model_reference.py's run_cycle()::deriv() (validated
there against Table 4); this module exposes it as standalone functions so it
can be called from the generic RK4 solver (Phase 1) instead of being inlined
in a single monolithic cycle function.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from simengine.config import load_seed_params


def motored_pressure(V_current_m3, MAP_Pa: float, V1_m3: float, poly_exponent: float = 1.32):
    """Motored (no-combustion) reference pressure trace used as the Woschni
    high-pressure-cycle term's baseline: p_mot = MAP*(V1/V)^n."""
    return MAP_Pa * (V1_m3 / V_current_m3) ** poly_exponent


def woschni_h(
    p_Pa,
    T_K,
    Sp_m_s: float,
    bore_m: float,
    C1: float,
    C2: float,
    Vd_cyl_m3: float,
    Tivc_K: float,
    MAP_Pa: float,
    V1_m3: float,
    p_mot_Pa,
    theta_rad=None,
    theta0_rad: float | None = None,
):
    """Woschni in-cylinder heat-transfer coefficient (eq 5.1-5.2).

    w = C1*Sp + C2*(Vd*Tivc)/(MAP*V1) * max(p - p_mot, 0)
    h_g = 3.26 * B^-0.2 * (p_kPa)^0.8 * T^-0.55 * w^0.8

    The reference implementation gates the C2 (combustion-induced turbulence)
    term to zero before ignition start (theta <= theta0): during compression
    p ~= p_mot anyway, but the gate is part of the validated formula, so it is
    reproduced exactly here. Pass theta_rad/theta0_rad to enable the gate;
    omitting them leaves C2 always active (e.g. for a mean-value model that
    has no discrete ignition event).

    Returns (h_g, w).
    """
    if theta_rad is not None and theta0_rad is not None:
        C2_active = np.where(np.asarray(theta_rad) > theta0_rad, C2, 0.0)
    else:
        C2_active = C2
    w = C1 * Sp_m_s + C2_active * (Vd_cyl_m3 * Tivc_K) / (MAP_Pa * V1_m3) * np.maximum(
        p_Pa - p_mot_Pa, 0.0
    )
    h_g = 3.26 * bore_m**-0.2 * (p_Pa / 1000.0) ** 0.8 * T_K**-0.55 * w**0.8
    return h_g, w


def dQht_dtheta(h_g, area_m2, T_K, Twall_K: float, omega_rad_s: float):
    """Wall heat-loss rate per crank angle (eq 5.3)."""
    return h_g * area_m2 * (T_K - Twall_K) / omega_rad_s


def woschni_params_from_config() -> dict:
    p = load_seed_params()
    lit = p["fixed_from_literature"]
    fitted = p["fitted"]
    return {
        "C1": lit["woschni_C1"],
        "C2": lit["woschni_C2"],
        "Twall_K": fitted["wall_temperature_K"],
    }


# ---------------------------------------------------------------------------
# 4-node lumped thermal network (eq 5.4), separate 100ms backward-Euler loop.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ThermalNode:
    name: str
    thermal_mass_J_per_K: float  # m_i * c_p,i
    area_ext_m2: float = 0.0     # 0 if this node has no direct external convection path


@dataclass
class ThermalNetwork:
    """A small linear lumped-capacitance network solved by backward Euler.

    Nodes: typically {head, coolant, oil, liner}. `conductances` gives the
    internal node-to-node link 1/R_ij for each connected pair (report calls
    this term (Ti-Tj)/Rij summed over neighbours j). External convection
    coefficients h_i (W/m^2K) are passed PER STEP, not stored on the node -
    this is deliberate: Phase 4's ISA atmosphere/airspeed model computes h_i
    for the air-cooled cylinder-barrel node dynamically, and this class must
    not need to change to accept that.
    """

    nodes: list[ThermalNode]
    conductances: dict[tuple[str, str], float] = field(default_factory=dict)

    def __post_init__(self):
        self._names = [n.name for n in self.nodes]
        self._index = {name: i for i, name in enumerate(self._names)}
        self._by_name = {n.name: n for n in self.nodes}

    def step(
        self,
        T: dict[str, float],
        dt_s: float,
        Qdot_in_W: dict[str, float],
        T_inf_K: float,
        h_ext_W_per_m2K: dict[str, float] | None = None,
    ) -> dict[str, float]:
        """Advance the network state by dt_s using backward (implicit) Euler.

        m_i*cp_i*dTi/dt = Qdot_in_i - sum_j((Ti-Tj)/Rij) - h_i*A_i*(Ti-Tinf)
        """
        h_ext_W_per_m2K = h_ext_W_per_m2K or {}
        n = len(self._names)
        A = np.zeros((n, n))
        b = np.zeros(n)

        for name in self._names:
            i = self._index[name]
            node = self._by_name[name]
            C = node.thermal_mass_J_per_K
            Gext = h_ext_W_per_m2K.get(name, 0.0) * node.area_ext_m2
            A[i, i] += C / dt_s + Gext
            b[i] += C / dt_s * T[name] + Qdot_in_W.get(name, 0.0) + Gext * T_inf_K

        for (a, c), G in self.conductances.items():
            i, j = self._index[a], self._index[c]
            A[i, i] += G
            A[j, j] += G
            A[i, j] -= G
            A[j, i] -= G

        T_vec_new = np.linalg.solve(A, b)
        return {name: T_vec_new[self._index[name]] for name in self._names}


# ---------------------------------------------------------------------------
# EGT probe observation model (eq 5.6-5.7) - never compare in-cylinder T
# directly to an EGT sensor reading; always pass it through this model first.
# ---------------------------------------------------------------------------


def blowdown_temperature(T_evo_K: float, p_exh_Pa: float, p_evo_Pa: float, gamma: float):
    """Isentropic blowdown expansion from EVO conditions to exhaust pressure
    (eq 5.6)."""
    return T_evo_K * (p_exh_Pa / p_evo_Pa) ** ((gamma - 1.0) / gamma)


def probe_temperature(
    T_blowdown_K: float,
    T_pipe_K: float,
    h_p_W_per_m2K: float,
    A_p_m2: float,
    mdot_kg_s: float,
    cp_J_per_kgK: float,
):
    """First-order thermal lag of the EGT probe relative to the true blowdown
    gas temperature (eq 5.7)."""
    return T_pipe_K + (T_blowdown_K - T_pipe_K) * np.exp(
        -h_p_W_per_m2K * A_p_m2 / (mdot_kg_s * cp_J_per_kgK)
    )
