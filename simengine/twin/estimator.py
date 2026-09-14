"""Hybrid state estimation (report section 20, eq 20.1-20.6).

UnscentedKalmanFilter runs over the AUGMENTED state x^a = [x; theta]
(physical states stacked with slowly-varying health parameters) - the
report's reason for UKF over EKF (section 20.2) is that the engine model is
strongly nonlinear (exponentials in Vogel/Arrhenius, powers in Woschni,
choked-flow switching), so linearization is both inaccurate and high
maintenance; the UKF instead propagates 2n+1 deterministic sigma points
through the actual nonlinear f()/h() the caller supplies - it never
linearizes anything.

LearnedCorrection is a small, deliberately simple model (ridge regression,
not a neural net - see its docstring for why) trained ONLY on the residual
(y - h_phys), never on raw y: physics owns extrapolation into fault
regimes/operating points it has never seen, the learned term only owns
small interpolation-scale corrections within the training envelope.
"""
from __future__ import annotations

from typing import Callable

import numpy as np


class UnscentedKalmanFilter:
    """Standard scaled-sigma-point UKF (Julier & Uhlmann / Wan & van der
    Merwe), eq 20.2-20.4. Caller supplies:
      f(x_aug, u, dt) -> x_aug_next   (process model, includes the theta
                                        random-walk: thetadot ~ N(0, small))
      h(x_aug, u)     -> y_pred        (observation model)
      Q, R                             process/measurement noise covariances
    """

    def __init__(
        self,
        f: Callable[[np.ndarray, object, float], np.ndarray],
        h: Callable[[np.ndarray, object], np.ndarray],
        Q: np.ndarray,
        R: np.ndarray,
        alpha: float = 1e-3,
        beta: float = 2.0,
        kappa: float = 0.0,
    ):
        self.f = f
        self.h = h
        self.Q = Q
        self.R = R
        self.alpha = alpha
        self.beta = beta
        self.kappa = kappa

    def _sigma_points(self, x: np.ndarray, P: np.ndarray):
        n = x.size
        lam = self.alpha**2 * (n + self.kappa) - n
        # Symmetrize P defensively before the Cholesky factorization - small
        # asymmetries accumulate from floating point outer-product sums.
        P_sym = 0.5 * (P + P.T)
        S = np.linalg.cholesky((n + lam) * P_sym)
        chi = np.zeros((2 * n + 1, n))
        chi[0] = x
        for i in range(n):
            chi[i + 1] = x + S[:, i]
            chi[n + i + 1] = x - S[:, i]
        Wm = np.full(2 * n + 1, 1.0 / (2.0 * (n + lam)))
        Wc = Wm.copy()
        Wm[0] = lam / (n + lam)
        Wc[0] = lam / (n + lam) + (1.0 - self.alpha**2 + self.beta)
        return chi, Wm, Wc

    def predict(self, x: np.ndarray, P: np.ndarray, u, dt: float):
        n = x.size
        chi, Wm, Wc = self._sigma_points(x, P)
        chi_pred = np.array([self.f(chi[i], u, dt) for i in range(2 * n + 1)])
        x_pred = np.sum(Wm[:, None] * chi_pred, axis=0)
        P_pred = self.Q.copy()
        for i in range(2 * n + 1):
            dx = chi_pred[i] - x_pred
            P_pred += Wc[i] * np.outer(dx, dx)
        return x_pred, P_pred, chi_pred, Wm, Wc

    def update(self, x_pred, P_pred, chi_pred, Wm, Wc, y: np.ndarray, u):
        Y = np.array([self.h(chi_pred[i], u) for i in range(chi_pred.shape[0])])
        y_pred = np.sum(Wm[:, None] * Y, axis=0)
        Pyy = self.R.copy()
        Pxy = np.zeros((x_pred.size, y.size))
        for i in range(chi_pred.shape[0]):
            dy = Y[i] - y_pred
            dx = chi_pred[i] - x_pred
            Pyy += Wc[i] * np.outer(dy, dy)
            Pxy += Wc[i] * np.outer(dx, dy)
        K = Pxy @ np.linalg.inv(Pyy)
        innovation = y - y_pred
        x_new = x_pred + K @ innovation
        P_new = P_pred - K @ Pyy @ K.T
        return x_new, P_new, innovation, Pyy

    def step(self, x: np.ndarray, P: np.ndarray, u, y: np.ndarray, dt: float):
        """One predict+update cycle. Returns (x_new, P_new, innovation, Pyy) -
        `innovation` and `Pyy` are exactly the statistically characterized
        residual the report says the UKF hands directly to detection
        (section 21): innovation ~ N(0, Pyy) under H0.
        """
        x_pred, P_pred, chi_pred, Wm, Wc = self.predict(x, P, u, dt)
        return self.update(x_pred, P_pred, chi_pred, Wm, Wc, y, u)


class LearnedCorrection:
    """A small ridge-regression correction term, trained only on the
    residual (y - h_phys) against a feature vector U (context + state).

    Simplified relative to eq 20.6's full physics-informed neural-network
    loss (data + ODE-residual + boundary terms): a linear/ridge model has no
    natural place to attach a differentiable ODE-residual penalty the way an
    autograd-based NN would, and adding a NN training stack (torch/tensorflow)
    is a large new dependency for a single small correction term. Ridge
    regularization instead gives the closest analogue available without
    autograd: outside the region spanned by training data (and, importantly,
    for norm(U) large / atypical), predictions decay toward the regularized
    mean rather than extrapolating aggressively - keeping physics dominant
    out-of-envelope in spirit, not by a differentiable constraint. Revisit
    with a real NN + eq 20.6's loss if/when this project takes on a
    deep-learning dependency for another reason.
    """

    def __init__(self, ridge_lambda: float = 1.0):
        self.ridge_lambda = ridge_lambda
        self.weights: np.ndarray | None = None
        self.n_features: int | None = None

    def fit(self, U: np.ndarray, residuals: np.ndarray) -> "LearnedCorrection":
        U = np.atleast_2d(np.asarray(U, dtype=float))
        residuals = np.asarray(residuals, dtype=float)
        Ub = np.hstack([U, np.ones((U.shape[0], 1))])
        n_feat = Ub.shape[1]
        A = Ub.T @ Ub + self.ridge_lambda * np.eye(n_feat)
        b = Ub.T @ residuals
        self.weights = np.linalg.solve(A, b)
        self.n_features = U.shape[1]
        return self

    def predict(self, U: np.ndarray) -> np.ndarray:
        if self.weights is None:
            U = np.atleast_2d(np.asarray(U, dtype=float))
            return np.zeros(U.shape[0])
        U = np.atleast_2d(np.asarray(U, dtype=float))
        Ub = np.hstack([U, np.ones((U.shape[0], 1))])
        return Ub @ self.weights
