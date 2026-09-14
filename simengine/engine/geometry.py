"""Slider-crank kinematics and cylinder volume/area — report eq 3.1-3.5.

Ported from research/celestia_cycle_model_reference.py (already validated
against Table 4), wrapped in an EngineGeometry value object instead of module
globals so calibration (Phase 9) can vary bore/stroke/rod-length without
reimporting the module.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from simengine.config import load_seed_params


@dataclass(frozen=True)
class EngineGeometry:
    """All lengths in meters, all angles in radians unless *_deg suffixed."""

    bore_m: float          # B
    stroke_m: float        # S
    conrod_length_m: float  # l
    n_cylinders: int
    compression_ratio: float  # r_c

    @property
    def crank_radius_m(self) -> float:
        """a = S / 2."""
        return self.stroke_m / 2.0

    @property
    def displacement_per_cyl_m3(self) -> float:
        """V_d,cyl = (pi/4) * B^2 * S."""
        return np.pi / 4.0 * self.bore_m**2 * self.stroke_m

    @property
    def displacement_total_m3(self) -> float:
        return self.n_cylinders * self.displacement_per_cyl_m3

    @property
    def clearance_volume_m3(self) -> float:
        """V_c = V_d,cyl / (r_c - 1)  (eq 3.2)."""
        return self.displacement_per_cyl_m3 / (self.compression_ratio - 1.0)

    def piston_pin_to_crank_offset(self, theta_rad):
        """s(theta) = a*cos(theta) + sqrt(l^2 - (a*sin(theta))^2)  (eq 3.1)."""
        a = self.crank_radius_m
        l = self.conrod_length_m
        return a * np.cos(theta_rad) + np.sqrt(l**2 - (a * np.sin(theta_rad)) ** 2)

    def volume(self, theta_rad):
        """V(theta) = V_c + (pi/4)*B^2*[(l+a) - s(theta)]  (eq 3.2)."""
        a = self.crank_radius_m
        l = self.conrod_length_m
        s = self.piston_pin_to_crank_offset(theta_rad)
        return self.clearance_volume_m3 + np.pi / 4.0 * self.bore_m**2 * (
            (l + a) - s
        )

    def dVdtheta(self, theta_rad):
        """Analytic derivative of eq 3.2 (eq 3.3)."""
        a = self.crank_radius_m
        l = self.conrod_length_m
        sin_t = np.sin(theta_rad)
        cos_t = np.cos(theta_rad)
        radicand = l**2 - (a * sin_t) ** 2
        ds_dtheta = -a * sin_t - (a**2 * sin_t * cos_t) / np.sqrt(radicand)
        return -np.pi / 4.0 * self.bore_m**2 * ds_dtheta

    def area(self, theta_rad):
        """Heat-transfer area: head + crown + exposed liner (eq 3.5)."""
        a = self.crank_radius_m
        l = self.conrod_length_m
        s = self.piston_pin_to_crank_offset(theta_rad)
        x = (l + a) - s
        return 2.0 * (np.pi / 4.0 * self.bore_m**2) + np.pi * self.bore_m * x

    @classmethod
    def from_config(cls) -> "EngineGeometry":
        p = load_seed_params()
        spec = p["fixed_from_spec"]
        return cls(
            bore_m=spec["bore_m"],
            stroke_m=spec["stroke_m"],
            conrod_length_m=spec["conrod_length_m"],
            n_cylinders=spec["n_cylinders"],
            compression_ratio=spec["compression_ratio"],
        )
