import type {
  ChannelName,
  Context,
  FaultInjectionSpec,
  FlightPhaseSpec,
  FlightSimulationStatus,
  GraphTopologyResponse,
  HealthBreakdownResponse,
  MissionPlanResponse,
  MissionSegmentRequest,
  PipelineResult,
} from '../types/contracts';

// Single place the backend's base URL is read from - never hardcode a host
// anywhere else in the app.
export const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? String(import.meta.env.VITE_API_BASE_URL)
    : 'http://localhost:8000';

export const WS_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL)
    ? String(import.meta.env.VITE_WS_URL)
    : API_BASE_URL.replace(/^http/, 'ws') + '/ws/telemetry';

export interface IngestFrame {
  t: number;
  channel: Partial<Record<ChannelName, number>>;
  context?: Partial<Context>;
  dt_s?: number;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export function ingestTelemetry(frame: IngestFrame): Promise<{ results: PipelineResult[] }> {
  return postJson('/api/telemetry/ingest', frame);
}

export function resetSession(): Promise<{ status: string }> {
  return postJson('/api/session/reset', {});
}

export function fetchHealth(): Promise<{ status: string }> {
  return getJson('/api/health');
}

export function fetchGraphTopology(): Promise<GraphTopologyResponse> {
  return getJson('/api/graph/topology');
}

export function fetchHealthBreakdown(): Promise<HealthBreakdownResponse> {
  return getJson('/api/health/breakdown');
}

export function postMissionPlan(segments: MissionSegmentRequest[]): Promise<MissionPlanResponse> {
  return postJson('/api/mission/plan', { segments });
}

export function fetchMissionPlan(): Promise<MissionPlanResponse | null> {
  return getJson('/api/mission/plan');
}

export function startFlightSimulation(
  phases: FlightPhaseSpec[],
  fault: FaultInjectionSpec,
  real_seconds_per_sim_hour: number,
): Promise<FlightSimulationStatus> {
  return postJson('/api/simulation/start', { phases, fault, real_seconds_per_sim_hour });
}

export function stopFlightSimulation(): Promise<FlightSimulationStatus> {
  return postJson('/api/simulation/stop', {});
}

export function fetchFlightSimulationStatus(): Promise<FlightSimulationStatus> {
  return getJson('/api/simulation/status');
}
