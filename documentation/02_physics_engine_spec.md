# Physics Engine Specification (Tier A)

## Overview

The **Tier A Physics Engine** ([`simengine/engine/`](file:///home/dushyant/uav-engine-twin/simengine/engine)) is a modular, crank-angle-resolved thermodynamic cycle simulator for a 4-cylinder, 4-stroke turbocharged aero piston engine (Rotax 914 class).

---

## Kinematics & Geometry

Module: [`simengine/engine/geometry.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/geometry.py)

### 1. Piston Position & Stroke Kinematics
Piston offset \(s(\theta)\) as a function of crank angle \(\theta\):

$$s(\theta) = a \cos(\theta) + \sqrt{l^2 - (a \sin(\theta))^2}$$

where:
- \(a = S / 2\) is crank radius (m)
- \(l\) is connecting rod length (m)
- \(S\) is stroke (m)
- \(B\) is bore (m)

### 2. Cylinder Volume & Derivative
Cylinder volume \(V(\theta)\) and rate of change \(\frac{dV}{d\theta}\):

$$V(\theta) = V_c + \frac{\pi}{4} B^2 \left[ (l + a) - s(\theta) \right]$$

$$\frac{dV}{d\theta} = -\frac{\pi}{4} B^2 \left( -a \sin(\theta) - \frac{a^2 \sin(\theta) \cos(\theta)}{\sqrt{l^2 - (a \sin(\theta))^2}} \right)$$

where clearance volume \(V_c = \frac{V_d}{r_c - 1}\).

### 3. Heat Transfer Surface Area
Instantaneous heat transfer area (head, piston crown, and exposed cylinder liner):

$$A(\theta) = 2 \left( \frac{\pi}{4} B^2 \right) + \pi B \left[ (l + a) - s(\theta) \right]$$

---

## Thermodynamics & Gas Properties

Module: [`simengine/engine/thermo.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/thermo.py)

The specific heat ratio \(\gamma(T)\) and constant-volume heat capacity \(c_v(T)\) are temperature-dependent:

$$\gamma(T) = \gamma_{\text{ref,intercept}} - \gamma_{\text{ref,slope}} \cdot (T - 300.0)$$

$$c_v(T) = \frac{R_g}{\gamma(T) - 1.0}$$

Default seed constants: \(\gamma_{\text{ref,intercept}} = 1.38\), \(\gamma_{\text{ref,slope}} = 6.0 \times 10^{-5} \, \text{K}^{-1}\), \(R_g = 287.0 \, \text{J/(kg}\cdot\text{K)}\).

---

## Combustion Dynamics

Module: [`simengine/engine/combustion.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/combustion.py)

### 1. Wiebe Mass Fraction Burned
Mass fraction burned \(x_b(\theta)\) and burn rate \(\frac{dx_b}{d\theta}\):

$$z = \text{clip}\left(\frac{\theta - \theta_0}{\Delta\theta_{\text{burn}}}, 0, 1\right)$$

$$x_b(\theta) = 1 - \exp\left( -a_w z^{m_w + 1} \right)$$

$$\frac{dx_b}{d\theta} = \frac{a_w (m_w + 1)}{\Delta\theta_{\text{burn}}} (1 - x_b(\theta)) z^{m_w}$$

Seed values: \(a_w = 5.0\), \(m_w = 2.0\).

### 2. Oxygen-Limited Chemical Heat Release
To account for rich fuel mixtures (\(\lambda \approx 0.85\)):

$$m_f = \frac{m_{\text{tot}}}{\lambda \cdot \text{AFR}_s + 1}, \quad m_{\text{air}} = m_{\text{tot}} - m_f$$

$$m_{\text{f,burn}} = \min\left(m_f, \frac{m_{\text{air}}}{\text{AFR}_s}\right)$$

$$\frac{dQ_{\text{ch}}}{d\theta} = m_{\text{f,burn}} \cdot \text{LHV} \cdot \eta_c \cdot \frac{dx_b}{d\theta}$$

### 3. Knock Auto-Ignition Model
Livengood-Wu integral with Douaud-Eyzat auto-ignition delay \(\tau(p,T)\):

$$\tau_{\text{ms}} = A_{\text{ms}} \cdot p_{\text{atm}}^{-n} \cdot \exp\left( \frac{B_a}{T} \right)$$

$$\frac{dI_k}{d\theta} = \frac{1}{\omega \cdot \tau_{\text{s}}}, \quad I_k = \int \frac{dI_k}{d\theta} d\theta \ge 1.0 \implies \text{Knock}$$

---

## In-Cylinder Heat Transfer & Thermal Network

Module: [`simengine/engine/heat.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/heat.py)

### 1. Woschni Correlation
Heat transfer coefficient \(h_g(\theta)\):

$$w = C_1 S_p + C_2 \frac{V_d T_{\text{ivc}}}{p_{\text{ivc}} V_{\text{ivc}}} \max(p - p_{\text{mot}}, 0)$$

$$h_g = 3.26 \cdot B^{-0.2} \cdot (p_{\text{kPa}})^{0.8} \cdot T^{-0.55} \cdot w^{0.8}$$

### 2. Lumped 4-Node Thermal Network
Nodes: Head, Coolant, Oil, Liner. Solved via Backward Euler:

$$C_i \frac{dT_i}{dt} = \dot{Q}_{\text{in},i} - \sum_{j} G_{ij}(T_i - T_j) - h_{\text{ext},i} A_{\text{ext},i}(T_i - T_{\infty})$$

---

## Gas Exchange & Universal Compressible Flow

Module: [`simengine/engine/flow.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/flow.py)

Universal compressible orifice flow equation used across valves, wastegate, leaks, and blow-by:

$$\Psi(\pi) = \begin{cases} 
\sqrt{\gamma} \left(\frac{2}{\gamma+1}\right)^{\frac{\gamma+1}{2(\gamma-1)}} & \pi \le \pi_{\text{crit}} \\
\sqrt{\frac{2\gamma}{\gamma-1} \left(\pi^{2/\gamma} - \pi^{(\gamma+1)/\gamma}\right)} & \pi > \pi_{\text{crit}}
\end{cases}$$

$$\dot{m} = C_d A \frac{p_u}{\sqrt{R_g T_u}} \Psi\left(\frac{p_d}{p_u}\right)$$

---

## Friction & Lubrication

Modules: [`simengine/engine/friction.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/friction.py), [`simengine/engine/lube.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/lube.py)

### 1. Chen-Flynn FMEP Correlation

$$\text{FMEP} = A_f + B_f p_{\max} + C_f S_p + D_f S_p^2$$

$$\text{BMEP} = \text{IMEP} - \text{PMEP} - \text{FMEP}$$

### 2. Oil Circuit & Viscosity
Oil viscosity via Vogel relation:

$$\mu(T) = K \exp\left( \frac{\theta_1}{T + \theta_2} \right)$$

Pump flow and gallery hydraulic resistance:

$$Q_{\text{pump}} = \eta_{\text{vol}} D_p N - k_l \frac{\Delta P}{\mu}, \quad R_h = \frac{128 \mu L}{\pi d^4}$$

$$p_{\text{oil}} = R_h \cdot Q_{\text{pump}}$$

---

## Closed-Cycle Solver

Module: [`simengine/engine/solver.py`](file:///home/dushyant/uav-engine-twin/simengine/engine/solver.py)

Integrates state vector \(\mathbf{y} = [p, T, m]^T\) from IVC to EVO at \(\Delta\theta = 0.2^\circ\) CA step size:

$$\frac{dT}{d\theta} = \frac{\frac{dQ_{\text{ch}}}{d\theta} - \frac{dQ_{\text{ht}}}{d\theta} - p \frac{dV}{d\theta}}{m \, c_v(T)} - \frac{T}{m} \frac{dm}{d\theta}$$

$$\frac{dp}{d\theta} = p \left( \frac{1}{m} \frac{dm}{d\theta} + \frac{1}{T} \frac{dT}{d\theta} - \frac{1}{V} \frac{dV}{d\theta} \right)$$
