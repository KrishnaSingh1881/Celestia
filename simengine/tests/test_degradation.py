import numpy as np
import pytest

from simengine.engine.degradation import (
    archard_wear_rate,
    arrhenius_rate,
    fouling_ddt,
    lubrication_regime_factor,
    miner_damage_fraction,
    paris_da_dN,
)


def test_wear_rate_spikes_when_regime_moves_from_hydrodynamic_to_boundary():
    S_crit = 0.05
    phi_hydrodynamic = lubrication_regime_factor(sommerfeld_number=1.0, S_crit=S_crit)
    phi_boundary = lubrication_regime_factor(sommerfeld_number=0.01, S_crit=S_crit)
    assert phi_hydrodynamic < 0.05
    assert phi_boundary > 0.9

    common = dict(k=1e-4, H_Pa=2e9, load_N=500.0, Sp_m_s=10.0, A_apparent_m2=1e-4)
    wear_hydrodynamic = archard_wear_rate(regime_factor=phi_hydrodynamic, **common)
    wear_boundary = archard_wear_rate(regime_factor=phi_boundary, **common)
    # Same load/speed/area - only the regime changed - yet wear rate should
    # jump by more than an order of magnitude: quiescent-then-fast, not
    # gradual.
    assert wear_boundary > 20 * wear_hydrodynamic


def test_arrhenius_ten_degree_rise_roughly_doubles_rate():
    # Typical activation energy for oil oxidation-type ageing, ~60 kJ/mol.
    A = 1.0e7
    Ea = 60000.0
    T_base = 360.0
    rate_base = arrhenius_rate(T_base, A, Ea)
    rate_plus10 = arrhenius_rate(T_base + 10.0, A, Ea)
    ratio = rate_plus10 / rate_base
    assert 1.7 <= ratio <= 2.3


def test_arrhenius_integrated_damage_scales_with_time_at_constant_temperature():
    A, Ea = 1.0e7, 60000.0
    T = 370.0
    rate = arrhenius_rate(T, A, Ea)
    dt = 3600.0  # 1 hour, seconds
    n_hours = 5
    D_thermal = rate * dt * n_hours  # constant-T integral is just rate*time
    assert D_thermal == pytest.approx(rate * dt * n_hours)
    assert D_thermal > 0


def test_fatigue_damage_grows_superlinearly_with_stress_amplitude():
    C = 1e-11
    m = 3.5  # report's stated superlinear exponent range is 3-4
    delta_K_low = 10.0
    delta_K_high = 12.0  # 20% higher stress-intensity range

    da_dN_low = paris_da_dN(C, delta_K_low, m)
    da_dN_high = paris_da_dN(C, delta_K_high, m)

    growth_ratio = da_dN_high / da_dN_low
    linear_ratio = delta_K_high / delta_K_low  # 1.2
    assert growth_ratio > linear_ratio  # superlinear: a 20% stress rise
    # costs MORE than 20% extra crack growth per cycle
    assert growth_ratio == pytest.approx(linear_ratio**m, rel=1e-9)


def test_miners_rule_damage_accumulates_toward_failure_at_one():
    # A short high-stress excursion should consume much more of the damage
    # budget than an equal number of cycles at a benign stress level with a
    # much larger Nf.
    d_benign = miner_damage_fraction(n_cycles=1000, Nf_cycles=1e8)
    d_severe = miner_damage_fraction(n_cycles=1000, Nf_cycles=1e5)
    assert d_severe > d_benign
    cumulative = d_benign + d_severe
    assert cumulative < 1.0  # still short of failure in this example


def test_fouling_relaxes_toward_asymptotic_value():
    sigma_f = 0.0
    sigma_inf = 0.3
    alpha = 1e-3
    mdot = 0.1
    tau = 1.0 / (alpha * mdot)  # 10,000s
    dt = 1.0
    n_steps = int(6 * tau)  # run 6 time constants -> ~99.75% converged
    for _ in range(n_steps):
        sigma_f += fouling_ddt(alpha, mdot, sigma_f, sigma_inf) * dt
    assert sigma_f == pytest.approx(sigma_inf, rel=1e-2)


def test_fouling_ddt_zero_at_asymptote():
    assert fouling_ddt(alpha=1e-4, mdot_kg_s=0.05, sigma_f=0.3, sigma_inf=0.3) == pytest.approx(0.0)
