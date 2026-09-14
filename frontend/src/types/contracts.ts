// Mirrors simengine/twin/contracts.py exactly - these ARE the pipeline
// stage boundaries (report Appendix F). Keep field names identical to the
// pydantic models on the backend; do not redeclare shapes elsewhere.

export interface Context {
  altitude_m: number;
  airspeed_m_s: number;
  phase: string;
  ambient_T_K: number;
  ambient_p_Pa: number;
  throttle_pct: number;
}

export interface Prediction {
  y_hat: Record<string, number>;
  x_hat: Record<string, number>;
  theta_hat: Record<string, number>;
  P_diag: Record<string, number>;
}

export interface Residual {
  r: Record<string, number>;
  z: Record<string, number>;
  d2: number;
  S_diag: Record<string, number>;
  flags: Record<string, boolean>;
}

export interface Hypothesis {
  cause: string;
  probability: number;
  evidence: string[];
}

export interface Diagnosis {
  hypotheses: Hypothesis[];
}

export interface RUL {
  component: string;
  q05_h: number;
  q50_h: number;
  q95_h: number;
  driver: string;
}

export interface Risk {
  P_success: number;
  tier: 'Nominal' | 'Watch' | 'Advisory' | 'Caution' | 'Warning' | string;
  recommended_action: string;
  authority: string;
  health_index: number;
}

export interface PipelineResult {
  t: number;
  prediction: Prediction;
  residual: Residual;
  diagnosis: Diagnosis;
  rul: RUL;
  risk: Risk;
}

// The channel names backend.app.pipeline.AVAILABLE_CHANNELS actually
// produces predictions/residuals for today - kept here so the frontend
// never invents a channel name the backend cannot answer for.
export const AVAILABLE_CHANNELS = [
  'MAP',
  'CHT',
  'coolant_temp',
  'oil_pressure',
  'oil_temp',
  'EGT_proxy',
  'rpm',
] as const;

export type ChannelName = (typeof AVAILABLE_CHANNELS)[number];

// Mirrors backend/app/schemas.py's graph/health/mission additions.
export interface GraphNode {
  id: string;
  kind: 'component' | 'parameter' | 'observable' | 'context' | string;
  activation: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  gain: number;
  lag_h: number;
  confidence: number;
}

export interface GraphTopologyResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface HealthBreakdownResponse {
  health_index: number;
  contributions: Record<string, number>;
}

export interface MissionSegmentRequest {
  name: string;
  duration_h: number;
  power_pct: number;
}

export interface MissionSegmentResult extends MissionSegmentRequest {
  survival_probability: number;
}

export interface MissionPlanResponse {
  segments: MissionSegmentResult[];
  overall_survival_probability: number;
  overall_tier: Risk['tier'];
  recommended_action: string;
  total_duration_h: number;
}
