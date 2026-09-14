"""Mean effective pressures and Chen-Flynn friction. Report eq 7.1-7.4."""
from __future__ import annotations

from simengine.config import load_seed_params


def imep(Wgross_J: float, Vd_cyl_m3: float) -> float:
    """IMEP = Wgross / Vd_cyl  (eq 7.1)."""
    return Wgross_J / Vd_cyl_m3


def fmep_chen_flynn(p_max_Pa: float, Sp_m_s: float, Af_Pa: float, Bf: float, Cf: float, Df: float):
    """Chen-Flynn friction correlation (eq 7.3).

    FMEP = Af + Bf*p_max + Cf*Sp + Df*Sp^2
    """
    return Af_Pa + Bf * p_max_Pa + Cf * Sp_m_s + Df * Sp_m_s**2


def bmep(imep_Pa: float, pmep_Pa: float, fmep_Pa: float) -> float:
    """BMEP = IMEP - PMEP - FMEP  (eq 7.2)."""
    return imep_Pa - pmep_Pa - fmep_Pa


def brake_torque(bmep_Pa: float, Vd_tot_m3: float) -> float:
    """Tb = BMEP * Vd_tot / (4*pi)  (eq 7.4)."""
    import numpy as np

    return bmep_Pa * Vd_tot_m3 / (4.0 * np.pi)


def brake_power(bmep_Pa: float, Vd_tot_m3: float, N_rev_s: float) -> float:
    """Pb = BMEP * Vd_tot * N/2  (eq 7.4, N in rev/s)."""
    return bmep_Pa * Vd_tot_m3 * N_rev_s / 2.0


def chen_flynn_params_from_config() -> dict:
    fitted = load_seed_params()["fitted"]
    return {
        "Af_Pa": fitted["chen_flynn_Af_Pa"],
        "Bf": fitted["chen_flynn_Bf"],
        "Cf": fitted["chen_flynn_Cf"],
        "Df": fitted["chen_flynn_Df"],
    }
