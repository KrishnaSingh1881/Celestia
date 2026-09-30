import { create } from 'zustand';
import { PRESET_ROUTES, type MissionRoute } from '../types/mission';
import type { ScenarioId } from '../types/scenarios';
import {
  computeDeterministicMissionState,
  type DeterministicMissionState,
} from '../lib/deterministicMission';
import { useEngineStore } from './useEngineStore';
import type { PipelineResult } from '../types/contracts';
import type { MaintenanceActionOption, MaintenanceRecord } from '../types/maintenance';

interface MissionStoreState {
  scenarioId: ScenarioId;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  route: MissionRoute;
  missionState: DeterministicMissionState;
  appliedInterventions: MaintenanceRecord[];

  // Actions
  setScenario: (id: ScenarioId) => void;
  setTime: (seconds: number) => void;
  stepTime: (deltaSeconds: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setRoute: (route: MissionRoute) => void;
  tick: (dtSeconds: number) => void;
  applyMaintenanceAction: (action: MaintenanceActionOption) => void;
  resetInterventions: () => void;
}

const DEFAULT_SCENARIO: ScenarioId = 'cascade';
const DEFAULT_DURATION = 120;
const DEFAULT_ROUTE = PRESET_ROUTES[0];

function generateDeterministicHistory(
  scenarioId: ScenarioId,
  currentT: number,
  route: MissionRoute,
  totalDuration: number,
  appliedInterventions: MaintenanceRecord[] = [],
): PipelineResult[] {
  const points: PipelineResult[] = [];
  const maxT = Math.min(totalDuration, Math.max(0, currentT));
  const step = Math.max(1, maxT / 60);

  for (let s = 0; s <= maxT; s += step) {
    const computed = computeDeterministicMissionState(scenarioId, s, route, totalDuration, appliedInterventions);
    points.push(computed.pipelineResult);
  }

  // Ensure exact current sample is the latest
  const latest = computeDeterministicMissionState(scenarioId, maxT, route, totalDuration, appliedInterventions);
  if (points.length === 0 || points[points.length - 1].t !== maxT) {
    points.push(latest.pipelineResult);
  }

  return points;
}

// Initial state computation
const initialScenario = DEFAULT_SCENARIO;
const initialTime = 0;
const initialInterventions: MaintenanceRecord[] = [];
const initialMissionState = computeDeterministicMissionState(
  initialScenario,
  initialTime,
  DEFAULT_ROUTE,
  DEFAULT_DURATION,
  initialInterventions,
);
const initialHistory = generateDeterministicHistory(
  initialScenario,
  initialTime,
  DEFAULT_ROUTE,
  DEFAULT_DURATION,
  initialInterventions,
);

// Initial sync to engine store
setTimeout(() => {
  useEngineStore.getState().syncDeterministicState(initialMissionState.pipelineResult, initialHistory);
}, 0);

export const useMissionStore = create<MissionStoreState>((set, get) => ({
  scenarioId: initialScenario,
  currentTime: initialTime,
  totalDuration: DEFAULT_DURATION,
  isPlaying: true, // Auto-play continuous deterministic mission by default
  playbackSpeed: 1,
  route: DEFAULT_ROUTE,
  missionState: initialMissionState,
  appliedInterventions: initialInterventions,

  setScenario: (id: ScenarioId) => {
    const { route, totalDuration } = get();
    // Spec: "Changing scenario must reset the complete deterministic mission state."
    const resetTime = 0;
    const clearedInterventions: MaintenanceRecord[] = [];
    const nextState = computeDeterministicMissionState(id, resetTime, route, totalDuration, clearedInterventions);
    const history = generateDeterministicHistory(id, resetTime, route, totalDuration, clearedInterventions);

    set({
      scenarioId: id,
      currentTime: resetTime,
      missionState: nextState,
      appliedInterventions: clearedInterventions,
    });

    useEngineStore.getState().syncDeterministicState(nextState.pipelineResult, history);
  },

  setTime: (time: number) => {
    const { scenarioId, route, totalDuration, appliedInterventions } = get();
    const clamped = Math.max(0, Math.min(totalDuration, time));
    const nextState = computeDeterministicMissionState(scenarioId, clamped, route, totalDuration, appliedInterventions);
    const history = generateDeterministicHistory(scenarioId, clamped, route, totalDuration, appliedInterventions);

    set({
      currentTime: clamped,
      missionState: nextState,
    });

    useEngineStore.getState().syncDeterministicState(nextState.pipelineResult, history);
  },

  stepTime: (deltaSeconds: number) => {
    const { currentTime, totalDuration, scenarioId, route, appliedInterventions } = get();
    const target = Math.max(0, Math.min(totalDuration, currentTime + deltaSeconds));
    const nextState = computeDeterministicMissionState(scenarioId, target, route, totalDuration, appliedInterventions);
    const history = generateDeterministicHistory(scenarioId, target, route, totalDuration, appliedInterventions);

    set({
      currentTime: target,
      missionState: nextState,
    });

    useEngineStore.getState().syncDeterministicState(nextState.pipelineResult, history);
  },

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),

  setRoute: (route: MissionRoute) => {
    const { scenarioId, currentTime, totalDuration, appliedInterventions } = get();
    const nextState = computeDeterministicMissionState(scenarioId, currentTime, route, totalDuration, appliedInterventions);
    set({ route, missionState: nextState });
  },

  tick: (dtSeconds: number) => {
    const { isPlaying, playbackSpeed, currentTime, totalDuration, scenarioId, route, appliedInterventions } = get();
    if (!isPlaying) return;

    const delta = dtSeconds * playbackSpeed;
    let nextTime = currentTime + delta;

    if (nextTime > totalDuration) {
      // Loop or stop: continuous mission restarts seamlessly from 0
      nextTime = 0;
    }

    const nextState = computeDeterministicMissionState(scenarioId, nextTime, route, totalDuration, appliedInterventions);
    set({
      currentTime: nextTime,
      missionState: nextState,
    });

    // Update live pipeline values on engine store
    useEngineStore.getState().syncDeterministicState(nextState.pipelineResult);
  },

  applyMaintenanceAction: (action: MaintenanceActionOption) => {
    const { scenarioId, currentTime, route, totalDuration, missionState, appliedInterventions } = get();

    // 1. Snapshot Before State
    const beforeSnapshot = {
      healthIndex: missionState.healthIndex,
      subsystemHealth: { ...missionState.subsystemHealth },
      activeAlertTitle: missionState.activeAlert.active ? missionState.activeAlert.title : 'All Systems Nominal',
      criticality: missionState.activeAlert.level,
      rulMinutes: Math.round(missionState.pipelineResult.rul.q50_h * 60),
    };

    // Format timestamp string
    const mins = Math.floor(currentTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(currentTime % 60).toString().padStart(2, '0');
    const timestampFormatted = `T+${mins}:${secs}`;

    const tempRecord: MaintenanceRecord = {
      id: `maint_${Date.now()}_${action.id}`,
      timestampSeconds: currentTime,
      timestampFormatted,
      action,
      beforeSnapshot,
      afterSnapshot: { ...beforeSnapshot }, // placeholder before recompute
      status: 'RECONCILED',
    };

    const nextInterventions = [...appliedInterventions, tempRecord];

    // 2. Recompute Reconciled State
    const nextState = computeDeterministicMissionState(
      scenarioId,
      currentTime,
      route,
      totalDuration,
      nextInterventions
    );

    // 3. Snapshot After State
    const afterSnapshot = {
      healthIndex: nextState.healthIndex,
      subsystemHealth: { ...nextState.subsystemHealth },
      activeAlertTitle: nextState.activeAlert.active ? nextState.activeAlert.title : 'Reconciled (Nominal)',
      criticality: nextState.activeAlert.level,
      rulMinutes: Math.round(nextState.pipelineResult.rul.q50_h * 60),
    };

    tempRecord.afterSnapshot = afterSnapshot;

    // 4. Update state globally
    const history = generateDeterministicHistory(
      scenarioId,
      currentTime,
      route,
      totalDuration,
      nextInterventions
    );

    set({
      appliedInterventions: nextInterventions,
      missionState: nextState,
    });

    useEngineStore.getState().syncDeterministicState(nextState.pipelineResult, history);
  },

  resetInterventions: () => {
    const { scenarioId, currentTime, route, totalDuration } = get();
    const nextState = computeDeterministicMissionState(scenarioId, currentTime, route, totalDuration, []);
    const history = generateDeterministicHistory(scenarioId, currentTime, route, totalDuration, []);

    set({
      appliedInterventions: [],
      missionState: nextState,
    });

    useEngineStore.getState().syncDeterministicState(nextState.pipelineResult, history);
  },
}));
