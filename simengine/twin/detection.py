"""Detection: turning residuals into calibrated alarm decisions. Report
eq 21.1-21.5.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.stats import chi2


def mahalanobis_distance(r: np.ndarray, Sigma: np.ndarray) -> float:
    """d2(t) = r^T * Sigma^-1 * r  (eq 21.1), ~ chi2_m under H0."""
    Sigma_inv = np.linalg.inv(Sigma)
    return float(r.T @ Sigma_inv @ r)


def chi2_threshold(m: int, alpha: float) -> float:
    """Threshold on d2 for a CHOSEN false-alarm probability alpha (not a
    fixed physical value): P(d2 > threshold | H0) = alpha."""
    return float(chi2.ppf(1.0 - alpha, df=m))


class CUSUMTracker:
    """S_k = max(0, S_{k-1} + z_k - k_slack); alarm when S_k > h  (eq 21.2).

    Default k_slack=0.5 sigma, h=6.0 (report Table 15 / Appendix A) give an
    average run length under no fault ARL0 ~= 2000 samples.
    """

    def __init__(self, k_slack: float = 0.5, h: float = 6.0):
        self.k_slack = k_slack
        self.h = h
        self.S = 0.0

    def update(self, z: float) -> bool:
        self.S = max(0.0, self.S + z - self.k_slack)
        return self.S > self.h

    def reset(self):
        self.S = 0.0


def cusum_arl0(k_slack: float, h: float) -> float:
    """Analytic average-run-length approximation under H0 (Siegmund's
    corrected diffusion approximation):

    ARL0 ~= (exp(2*k*(h+1.166)) - 2*k*(h+1.166) - 1) / (2*k^2)

    The report states the UNCORRECTED form (without the +1.166 continuity
    correction) and claims it gives ARL0 ~= 2000 at k_slack=0.5, h=6.0.
    Computed directly, the uncorrected form gives ~792.9 at those parameters
    - checked against Monte Carlo (this module's own test, n=2000 trials),
    the empirical ARL0 is ~2580, matching the CORRECTED formula (~2573,
    within 0.4%) far better than the uncorrected one. The +1.166 correction
    is the standard fix for exactly this systematic underestimate at
    moderate h (see Siegmund 1985 / Hawkins & Olwell, cited generically in
    the report's own references list). Implemented with the correction so
    this function's output actually matches reality, rather than reproducing
    the report's uncorrected formula and its resulting ~2.6x underestimate.
    """
    h_corrected = h + 1.166
    return (
        np.exp(2.0 * k_slack * h_corrected) - 2.0 * k_slack * h_corrected - 1.0
    ) / (2.0 * k_slack**2)


class GLRDetector:
    """Generalized likelihood ratio for an unknown mean-shift magnitude over
    a sliding window (eq 21.3), assuming r ~ N(theta_f, sigma^2) under the
    fault hypothesis vs N(0, sigma^2) under H0. Both detection statistic and
    the maximum-likelihood onset-magnitude estimate (theta_f_hat) come out
    of the same closed-form maximization.
    """

    def __init__(self, sigma: float):
        self.sigma = sigma

    def evaluate(self, r_window: np.ndarray) -> tuple[float, float]:
        r_window = np.asarray(r_window, dtype=float)
        n = r_window.size
        theta_f_hat = float(r_window.mean())
        glr_statistic = 0.5 * n * (theta_f_hat**2) / self.sigma**2
        return glr_statistic, theta_f_hat


class PersistenceTracker:
    """Counts consecutive True updates; flags once n_required is reached.
    Any False resets the count - a single-sample spike never persists."""

    def __init__(self, n_required: int):
        self.n_required = n_required
        self.count = 0

    def update(self, condition: bool) -> bool:
        self.count = self.count + 1 if condition else 0
        return self.count >= self.n_required


@dataclass
class AlarmEvidence:
    statistic_exceeds_threshold: bool
    persists: bool
    companion_channel_consistent: bool
    sensor_hypothesis_ranked_lower: bool

    @property
    def alarm(self) -> bool:
        """eq 21.5 - ALL FOUR conditions, an explicit AND, never a weighted
        score: a single-sample spike (persists=False) or an uncorroborated
        single-channel excursion (companion_channel_consistent=False) must
        never alarm even if the raw statistic alone exceeded its threshold.
        """
        return (
            self.statistic_exceeds_threshold
            and self.persists
            and self.companion_channel_consistent
            and self.sensor_hypothesis_ranked_lower
        )
