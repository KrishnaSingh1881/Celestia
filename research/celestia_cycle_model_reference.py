"""
Celestia / SIH26054 — reference implementation of the single-zone cycle model.

Single-zone crank-angle-resolved cycle model for a Rotax 914-class
four-cylinder boosted aero piston engine.  Used to generate the figures
and the numerical anchors quoted in the technical report.

Equation references are to the technical report:
  volume(), dVdtheta(), area()      eq 3.1-3.5
  run_cycle() state integration     eq 3.8-3.10   (RK2/RK4 in crank angle, eq 14.1)
  wiebe()                           eq 4.1-4.2
  O2-limited heat release           eq 4.3-4.4
  Woschni h and wall heat flow      eq 5.1-5.3
  blow-by mass loss (leak)          eq 6.4  (simplified pressure-gated form)
  fmep_chen_flynn(), brake_numbers  eq 7.1-7.4

Calibration status: reproduces the manufacturer's three published power points
to -0.7 %, -2.5 % and +2.2 % with the seed parameters in Table 15.
"""
import numpy as np

# ---------- geometry (Rotax 914 published data) ----------
B      = 0.0795          # bore [m]
S      = 0.0610          # stroke [m]
a      = S / 2.0         # crank radius [m]
lrod   = 0.1115          # connecting rod length [m]
ncyl   = 4
rc     = 9.0             # compression ratio [-]
Vd_cyl = np.pi / 4 * B**2 * S
Vd_tot = ncyl * Vd_cyl
Vc     = Vd_cyl / (rc - 1.0)

Rg     = 287.0           # J/kg-K
LHV    = 43.5e6          # J/kg (AVGAS/MOGAS)


def volume(theta):
    """Instantaneous cylinder volume, theta in rad ATDC."""
    s = a * np.cos(theta) + np.sqrt(lrod**2 - (a * np.sin(theta))**2)
    return Vc + np.pi / 4 * B**2 * (lrod + a - s)


def dVdtheta(theta):
    ds = -a * np.sin(theta) - (a**2 * np.sin(theta) * np.cos(theta)) / \
         np.sqrt(lrod**2 - (a * np.sin(theta))**2)
    return -np.pi / 4 * B**2 * ds


def area(theta):
    """Heat-transfer area: head + crown + exposed liner."""
    x = (lrod + a) - (a * np.cos(theta) + np.sqrt(lrod**2 - (a*np.sin(theta))**2))
    return 2 * (np.pi / 4 * B**2) + np.pi * B * x


def wiebe(theta, th0, dth, aw=5.0, mw=2.0):
    z = (theta - th0) / dth
    z = np.clip(z, 0.0, 1.0)
    xb = 1.0 - np.exp(-aw * z**(mw + 1))
    dxb = aw * (mw + 1) / dth * (1 - xb) * z**mw
    return xb, dxb


def gamma_of_T(T):
    """Simple temperature-dependent ratio of specific heats."""
    return 1.38 - 6.0e-5 * (T - 300.0)


def run_cycle(rpm=5800.0, MAP=1.32e5, Tivc=330.0, lam=0.85,
              th_ign=-22.0, dth_burn=60.0, eta_c=0.94,
              Twall=450.0, leak=0.0, hmult=1.0, dtheta=0.2,
              IVC=-140.0, EVO=140.0, AFRs=14.6):
    """Integrate the closed part of the cycle (IVC -> EVO) with RK4.

    leak  : blow-by leakage coefficient  [1/rad] (ring wear fault)
    hmult : heat-transfer multiplier (cooling / deposit fault)
    """
    om = rpm * 2 * np.pi / 60.0
    Sp = 2 * S * rpm / 60.0                      # mean piston speed [m/s]
    th = np.arange(IVC, EVO + dtheta, dtheta) * np.pi / 180.0
    n = th.size

    V1 = volume(th[0])
    m0 = MAP * V1 / (Rg * Tivc)                  # trapped mass [kg]
    mf = m0 / (lam * AFRs + 1.0)                 # fuel mass [kg]
    mair = m0 - mf
    mf_burn = min(mf, mair / AFRs)               # O2-limited under rich running
    Qtot = mf_burn * LHV * eta_c

    th0 = th_ign * np.pi / 180.0
    dth = dth_burn * np.pi / 180.0

    # motored reference trace (for Woschni)
    p_mot = MAP * (V1 / volume(th))**1.32

    p = np.zeros(n); T = np.zeros(n); m = np.zeros(n)
    h_arr = np.zeros(n); xb_arr = np.zeros(n); q_ht = np.zeros(n)
    p[0], T[0], m[0] = MAP, Tivc, m0

    def deriv(i, pv, Tv, mv):
        thv = th[i]
        Vv, dVv = volume(thv), dVdtheta(thv)
        g = gamma_of_T(Tv)
        _, dxb = wiebe(thv, th0, dth)
        dQch = Qtot * dxb
        # Woschni correlation (SI, p in kPa -> W/m^2K)
        C1 = 2.28
        C2 = 3.24e-3 if thv > th0 else 0.0
        w = C1 * Sp + C2 * (Vd_cyl * Tivc) / (MAP * V1) * max(pv - p_mot[i], 0.0)
        h = hmult * 3.26 * B**-0.2 * (pv / 1000.0)**0.8 * Tv**-0.55 * w**0.8
        dQht = h * area(thv) * (Tv - Twall) / om          # per rad
        dm = -leak * mv * max(pv - 1.0e5, 0.0) / 1.0e5    # blow-by
        cv = Rg / (g - 1.0)
        dT = (dQch - dQht - pv * dVv) / (mv * cv) - Tv * dm / mv
        dp = (dm / mv + dT / Tv - dVv / Vv) * pv
        return dp, dT, dm, h, dQht

    for i in range(n - 1):
        pv, Tv, mv = p[i], T[i], m[i]
        d1 = deriv(i, pv, Tv, mv)
        d2 = deriv(min(i + 1, n - 1), pv + 0.5 * dtheta * np.pi/180 * d1[0],
                   Tv + 0.5 * dtheta * np.pi/180 * d1[1],
                   mv + 0.5 * dtheta * np.pi/180 * d1[2])
        h_step = dtheta * np.pi / 180
        p[i+1] = pv + h_step * d2[0]
        T[i+1] = Tv + h_step * d2[1]
        m[i+1] = mv + h_step * d2[2]
        h_arr[i] = d1[3]; q_ht[i] = d1[4]
        xb_arr[i] = wiebe(th[i], th0, dth)[0]
    xb_arr[-1] = wiebe(th[-1], th0, dth)[0]
    h_arr[-1] = h_arr[-2]; q_ht[-1] = q_ht[-2]

    V = volume(th)
    Wgross = np.trapezoid(p, V)                  # J per cylinder, closed period
    imep = Wgross / Vd_cyl
    return dict(th=th * 180/np.pi, p=p, T=T, m=m, V=V, xb=xb_arr, h=h_arr,
                q_ht=q_ht, imep=imep, W=Wgross, pmax=p.max(), Tmax=T.max(),
                Tevo=T[-1], mf=mf, rpm=rpm, MAP=MAP, Qtot=Qtot,
                qht_tot=np.trapezoid(q_ht, th))


def fmep_chen_flynn(pmax, rpm, A=0.90e5, Bc=0.012, Cc=2.0e3, Dc=120.0):
    Sp = 2 * S * rpm / 60.0
    return A + Bc * pmax + Cc * Sp + Dc * Sp**2


def brake_numbers(res, pmep=0.25e5):
    rpm = res['rpm']
    imep_n = res['imep'] - pmep
    fmep = fmep_chen_flynn(res['pmax'], rpm)
    bmep = imep_n - fmep
    P = bmep * Vd_tot * (rpm / 60.0) / 2.0
    Tq = bmep * Vd_tot / (4 * np.pi)
    mdot_f = res['mf'] * ncyl * (rpm / 60.0) / 2.0
    bsfc = mdot_f * 3.6e6 / (P / 1e3) if P > 0 else np.nan   # g/kWh
    eta = P / (mdot_f * LHV)
    return dict(imep=res['imep']/1e5, fmep=fmep/1e5, bmep=bmep/1e5,
                P_kW=P/1e3, Tq=Tq, bsfc=bsfc, eta=eta, mdot_f=mdot_f)


if __name__ == "__main__":
    for rpm, MAP, lam, tag in [(5800, 1.32e5, 0.85, "take-off"),
                               (5500, 1.20e5, 0.88, "max continuous"),
                               (5000, 1.05e5, 0.95, "75% cruise")]:
        r = run_cycle(rpm=rpm, MAP=MAP, lam=lam)
        b = brake_numbers(r)
        print(f"{tag:15s} rpm={rpm} MAP={MAP/1e5:.2f}bar  "
              f"pmax={r['pmax']/1e5:6.1f}bar Tmax={r['Tmax']:6.0f}K "
              f"Tevo={r['Tevo']:5.0f}K IMEP={b['imep']:5.2f} FMEP={b['fmep']:4.2f} "
              f"BMEP={b['bmep']:5.2f}bar P={b['P_kW']:6.1f}kW Tq={b['Tq']:6.1f}Nm "
              f"bsfc={b['bsfc']:5.0f} eta={b['eta']*100:4.1f}%")
