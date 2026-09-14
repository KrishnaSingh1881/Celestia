"""Telling a lying sensor from a dying engine. Report eq 22.1-22.3.

Three complementary mechanisms, combined into a ranked (never binary)
posterior over hypotheses:
1. Parity relations (22.1) - a projection that annihilates the true state,
   so a healthy system's parity vector is ~0 regardless of trajectory; a
   sensor-i fault drives it along a FIXED direction (W @ e_i), giving a
   per-channel suspicion score.
2. The physical version (22.2) - a genuine engine fault must obey energy/
   mass conservation (a visible source or loss-of-removal channel must
   also move); implemented as an explicit rule, not a learned model, plus a
   rolling-variance frozen-sensor detector (the Type-2 failure).
3. Bayesian combination (22.3) - always a ranked list with evidence, never
   a single verdict.
"""
from __future__ import annotations

import numpy as np


def build_parity_matrix(Hx: np.ndarray, tol: float = 1e-10) -> np.ndarray:
    """W spanning the left null space of Hx, i.e. W @ Hx = 0 (eq 22.1) -
    "W annihilates the state" for ANY state trajectory.

    Hx is (n_channels, n_states). W's rows must satisfy w @ Hx = 0, i.e.
    w is in the null space of Hx.T (a map R^n_channels -> R^n_states). SVD
    Hx.T = U @ diag(s) @ Vt (Vt is n_channels x n_channels); the rows of Vt
    past the rank of Hx.T span exactly that null space.
    """
    Hx = np.atleast_2d(Hx)
    _u, s, vt = np.linalg.svd(Hx.T)
    rank = int(np.sum(s > tol))
    W = vt[rank:, :]
    return W


def parity_vector(W: np.ndarray, Y_window: np.ndarray, Hu: np.ndarray, U_window: np.ndarray) -> np.ndarray:
    """p(t) = W * (Y_window - Hu*U_window)  (eq 22.1)."""
    return W @ (Y_window - Hu @ U_window)


def suspicion_score(p: np.ndarray, W: np.ndarray, channel_index: int) -> float:
    """cos(psi_i) = p^T*(W*e_i) / (||p|| * ||W*e_i||)  (eq 22.2) - sensor
    `channel_index` is suspected as this -> 1."""
    n_channels = W.shape[1]
    e_i = np.zeros(n_channels)
    e_i[channel_index] = 1.0
    W_ei = W @ e_i
    denom = np.linalg.norm(p) * np.linalg.norm(W_ei)
    if denom < 1e-12:
        return 0.0
    return float(np.dot(p, W_ei) / denom)


def has_energy_balance_explanation(source_increased: bool, removal_decreased: bool) -> bool:
    """Plain-language physical check (eq 22.2): a genuine engine fault needs
    a visible energy source increase OR a visible loss of removal capacity
    somewhere in the other channels. If neither moved, the anomalous channel
    itself is the more likely explanation (a sensor fault)."""
    return source_increased or removal_decreased


def rolling_variance(x: np.ndarray, window: int) -> np.ndarray:
    x = np.asarray(x, dtype=float)
    n = x.size
    var = np.full(n, np.nan)
    for i in range(window - 1, n):
        var[i] = x[i - window + 1 : i + 1].var()
    return var


def is_frozen(x: np.ndarray, window: int, variance_threshold: float = 1e-10) -> np.ndarray:
    """Flags samples whose trailing short-window variance has collapsed to
    ~0 - the Type-2 stuck/frozen-sensor failure (report section 2.5), which
    can hold a value that still LOOKS plausible."""
    var = rolling_variance(x, window)
    with np.errstate(invalid="ignore"):
        return var < variance_threshold


def bayesian_posterior(likelihoods: dict[str, float], priors: dict[str, float] | None = None) -> dict[str, float]:
    """P(Hj|E) = P(E|Hj)*P(Hj) / sum_l(P(E|Hl)*P(Hl))  (eq 22.3)."""
    if priors is None:
        priors = {h: 1.0 / len(likelihoods) for h in likelihoods}
    numerators = {h: likelihoods[h] * priors.get(h, 0.0) for h in likelihoods}
    total = sum(numerators.values())
    if total <= 0:
        return {h: 0.0 for h in likelihoods}
    return {h: v / total for h, v in numerators.items()}


def rank_hypotheses(likelihoods: dict[str, float], priors: dict[str, float] | None = None) -> list[tuple[str, float]]:
    """Ranked (name, posterior) list, most likely first - NEVER collapse
    this to a single verdict (report section 22.3's explicit point)."""
    posterior = bayesian_posterior(likelihoods, priors)
    return sorted(posterior.items(), key=lambda kv: kv[1], reverse=True)
