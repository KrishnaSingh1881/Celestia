"""Live flight-profile simulator.

Drives an independent "truth" simengine.twin.meanvalue.MeanValueTwin through
a scripted mission profile (a sequence of named phases, each commanding a
throttle percentage for a duration) in a background asyncio task. Every
fine integration step's output is fed straight through the SAME
backend.app.pipeline.EngineSession.step() call and WebSocket broadcast path
that /api/telemetry/ingest uses (see backend/app/main.py's
FlightSimulator wiring) - so a running simulation updates the live
Dashboard/Sensors/Virtual Twin pages exactly as a real telemetry feed would,
never by fabricating prediction/diagnosis/RUL/risk numbers on the side.

Command vs. actual: the "truth" twin is stepped with the phase's commanded
throttle AND (optionally) a ramping fault theta override; EngineSession's
OWN internal twin (stepped inside EngineSession.step(), from the session-
side twin_ctx below) is deliberately NOT given that fault theta - it
represents what the aircraft's own controller/model expects a healthy
engine to do at that throttle setting, so the residual (truth vs. expected)
is what actually carries the fault signature into detection/diagnosis,
exactly like a real sensor-vs-model comparison would.

Only two fault modes get a real theta hook here (cooling_degradation ->
cooling_mult, oil_pump_wear -> eta_vol_pump) because those are the only two
MeanValueTwin theta hooks verified (in backend/tests/test_campaign_evaluation.py)
to actually drive their OWN declared first-mover channels correctly - every
other physical fault mode in fault_library.yaml either has no theta hook
yet or (per that test's docstring, main_rod_bearing_wear via friction_mult)
was tried and found to move the WRONG channel. Offering a fault mode here
that isn't backed by real physics would be exactly the kind of scripted/
fabricated behavior this project has deliberately avoided everywhere else.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import numpy as np

from simengine.twin.meanvalue import Context as TwinContext
from simengine.twin.meanvalue import MeanValueTwin

# 20Hz - the lenient (larger-dt) end of Tier B's documented stable 20-50Hz
# range (see meanvalue.py's MeanValueTwin docstring and its K_wg stability
# note), chosen deliberately here (rather than the tests' 0.02s/50Hz) to
# cover more simulated time per real CPU second without leaving the
# documented-stable envelope.
DT_S = 0.05
WARMUP_S = 90.0  # sim-seconds of silent warmup so playback doesn't start mid-transient
BROADCAST_INTERVAL_S = 0.15  # real seconds between broadcasts (~6-7 Hz)

MAP_IDLE_PA = 0.80e5
MAP_FULL_PA = 1.32e5

FAULT_THETA_KEYS = {
    "cooling_degradation": "cooling_mult",
    "oil_pump_wear": "eta_vol_pump",
}


def throttle_to_map_pa(throttle_pct: float) -> float:
    """Same linear idle-to-rated-MAP mapping backend.app.pipeline.
    api_context_to_twin_context() uses for manually-posted frames, kept
    consistent so a scripted phase and a manual ingest at the same
    throttle command produce the same commanded MAP."""
    frac = float(np.clip(throttle_pct / 100.0, 0.0, 1.0))
    return MAP_IDLE_PA + frac * (MAP_FULL_PA - MAP_IDLE_PA)


def measured_channels_from_state(twin: MeanValueTwin, state: dict) -> dict[str, float]:
    rpm = state["omega_engine_rad_s"] * 60.0 / (2.0 * np.pi)
    surf = twin.surface.interpolate(rpm, state["p_MAP_Pa"])
    return {
        "MAP": state["p_MAP_Pa"], "CHT": state["T_head_K"], "coolant_temp": state["T_coolant_K"],
        "oil_pressure": state["p_oil_Pa"], "oil_temp": state["T_oil_K"],
        "EGT_proxy": surf["T_evo_K"], "rpm": rpm,
    }


def severity_at(frac: float, onset_frac: float, end_severity: float, shape: str) -> float:
    """Fault severity in [0, end_severity] as a function of mission
    fraction elapsed (0-1), ramping from onset_frac to 1.0 in the given
    shape - mirrors simengine.faults.campaign's GROWTH_SHAPES concept
    (linear/exponential/step), simplified to a closed form since this
    doesn't need the campaign generator's DOE sampling machinery."""
    if frac <= onset_frac:
        return 0.0
    span = max(1.0 - onset_frac, 1e-6)
    progress = min((frac - onset_frac) / span, 1.0)
    if shape == "step":
        return end_severity
    if shape == "exponential":
        return end_severity * (1.0 - np.exp(-3.0 * progress))
    return end_severity * progress


@dataclass
class FlightPhase:
    name: str
    duration_h: float
    throttle_pct: float


@dataclass
class FlightSimulator:
    """Owns at most one running simulation task, mirroring this backend's
    single global EngineSession (one engine, one session, one flight in
    progress at a time).

    `on_step` is called on EVERY fine integration step (dt_s=DT_S each time)
    so the session's own internal twin advances in lockstep with the truth
    twin below - stepping it only once per broadcast chunk would let the
    session's model of "what a healthy engine should be doing" silently
    fall behind simulated time relative to the truth twin, producing large
    residuals that reflect that drift rather than any injected fault.
    `on_broadcast` is called once per broadcast chunk (~1/BROADCAST_INTERVAL_S)
    with the most recent step's pipeline result, to actually publish it."""

    on_step: Callable[[dict[str, float], TwinContext, float], Any]
    on_broadcast: Callable[[float, Any], Awaitable[None]]

    _task: "asyncio.Task | None" = field(default=None, init=False)
    _phases: list[FlightPhase] = field(default_factory=list, init=False)
    _fault_mode: str = field(default="none", init=False)
    _fault_onset_frac: float = field(default=0.3, init=False)
    _fault_end_severity: float = field(default=0.5, init=False)
    _fault_shape: str = field(default="linear", init=False)
    _real_seconds_per_sim_hour: float = field(default=90.0, init=False)
    _elapsed_h: float = field(default=0.0, init=False)
    _total_h: float = field(default=0.0, init=False)
    _phase_index: int = field(default=0, init=False)
    _current_severity: float = field(default=0.0, init=False)
    _last_error: str | None = field(default=None, init=False)

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def status(self) -> dict:
        phase_name = (
            self._phases[self._phase_index].name
            if self._phases and self._phase_index < len(self._phases)
            else None
        )
        return {
            "running": self.running,
            "phase_name": phase_name,
            "phase_index": self._phase_index,
            "phase_count": len(self._phases),
            "elapsed_h": self._elapsed_h,
            "total_h": self._total_h,
            "progress_pct": (self._elapsed_h / self._total_h * 100.0) if self._total_h > 0 else 0.0,
            "fault_mode": self._fault_mode,
            "fault_severity": self._current_severity,
            "error": self._last_error,
        }

    async def start(
        self,
        phases: list[FlightPhase],
        fault_mode: str,
        fault_onset_frac: float,
        fault_end_severity: float,
        fault_shape: str,
        real_seconds_per_sim_hour: float,
    ) -> None:
        await self.stop()
        self._phases = phases
        self._total_h = sum(p.duration_h for p in phases)
        self._fault_mode = fault_mode
        self._fault_onset_frac = fault_onset_frac
        self._fault_end_severity = fault_end_severity
        self._fault_shape = fault_shape
        self._real_seconds_per_sim_hour = real_seconds_per_sim_hour
        self._elapsed_h = 0.0
        self._phase_index = 0
        self._current_severity = 0.0
        self._last_error = None
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    def _phase_at(self, elapsed_h: float) -> tuple[int, FlightPhase]:
        t = 0.0
        for i, phase in enumerate(self._phases):
            if elapsed_h < t + phase.duration_h or i == len(self._phases) - 1:
                return i, phase
            t += phase.duration_h
        return len(self._phases) - 1, self._phases[-1]

    def _theta_for_severity(self, severity: float) -> dict[str, float]:
        key = FAULT_THETA_KEYS.get(self._fault_mode)
        if key is None or severity <= 0.0:
            return {}
        return {key: max(1.0 - severity, 0.15)}

    async def _run(self) -> None:
        if not self._phases:
            return
        try:
            await self._run_inner()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - surfaced via status(), not swallowed
            self._last_error = f"{type(exc).__name__}: {exc}"
            raise

    async def _run_inner(self) -> None:
        truth = MeanValueTwin()
        first_throttle = self._phases[0].throttle_pct

        # Silent warmup at the first phase's operating point, so playback
        # doesn't open on a cold-start transient (matches the warmup pattern
        # backend/tests/test_campaign_evaluation.py uses before applying a
        # labeled condition). Critically, this must step the SESSION's own
        # internal twin through on_step() in lockstep too, with the same
        # healthy (theta-free) context truth uses - stepping only `truth`
        # here left the session's twin cold-started relative to an already-
        # settled truth twin the moment playback began, which showed up as
        # a large spurious residual on CHT/coolant_temp misdiagnosed as
        # cooling_degradation even with no fault configured at all.
        warmup_ctx = TwinContext(MAP_command_Pa=throttle_to_map_pa(first_throttle))
        for _ in range(int(WARMUP_S / DT_S)):
            state = truth.step(DT_S, warmup_ctx)
            measured = measured_channels_from_state(truth, state)
            self.on_step(measured, warmup_ctx, DT_S)

        target_sim_seconds_per_real_second = 3600.0 / max(self._real_seconds_per_sim_hour, 1e-6)
        steps_per_chunk = max(1, round(BROADCAST_INTERVAL_S * target_sim_seconds_per_real_second / DT_S))

        while self._elapsed_h < self._total_h:
            chunk_start = time.monotonic()
            phase_idx, phase = self._phase_at(self._elapsed_h)
            self._phase_index = phase_idx
            frac = self._elapsed_h / self._total_h if self._total_h > 0 else 1.0
            severity = severity_at(frac, self._fault_onset_frac, self._fault_end_severity, self._fault_shape)
            self._current_severity = severity
            theta = self._theta_for_severity(severity)

            map_pa = throttle_to_map_pa(phase.throttle_pct)
            twin_ctx_truth = TwinContext(MAP_command_Pa=map_pa, theta=theta)
            twin_ctx_session = TwinContext(MAP_command_Pa=map_pa)

            latest_pipeline_result: Any = None
            for _ in range(steps_per_chunk):
                state = truth.step(DT_S, twin_ctx_truth)
                measured = measured_channels_from_state(truth, state)
                # Session-side twin steps in lockstep with the truth twin
                # (same dt, every fine step) - see class docstring.
                latest_pipeline_result = self.on_step(measured, twin_ctx_session, DT_S)
                self._elapsed_h += DT_S / 3600.0
                if self._elapsed_h >= self._total_h:
                    break

            if latest_pipeline_result is not None:
                await self.on_broadcast(self._elapsed_h * 3600.0, latest_pipeline_result)

            elapsed_wall = time.monotonic() - chunk_start
            await asyncio.sleep(max(0.0, BROADCAST_INTERVAL_S - elapsed_wall))

        self._phase_index = len(self._phases) - 1
