export type CausalRegion =
  | 'evidence'
  | 'root_causes'
  | 'subsystems'
  | 'sensors'
  | 'states'
  | 'risk_rollup';

export type NodeCriticality = 'nominal' | 'warning' | 'critical' | 'sensor_fault';

export interface CausalNodeTelemetry {
  label: string;
  value: string;
  unit: string;
  delta: string;
  status: NodeCriticality;
}

export interface CausalNodeData {
  id: string;
  label: string;
  region: CausalRegion;
  regionIndex: number;
  subType: string;
  functionDescription: string;
  stateDescription: string;
  health: number;
  criticality: NodeCriticality;
  activation: number; // 0.0 (quiet) to 1.0 (tripped/critical)
  telemetry: CausalNodeTelemetry[];
  evidence: string;
  upstreamDependencies: string[];
  downstreamEffects: string[];
  reconciliationStatus?: 'reconciled' | 'stabilized' | 'remaining' | 'reduced';
  // Physical force simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius?: number;
}

export interface CausalEdgeData {
  id: string;
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  relationshipType: string;
  baseWeight: number; // structural physics coupling 0.0-1.0
  attention: number; // dynamic attention weight 0.0-1.0
  deltaTrend: 'up' | 'down' | 'steady';
  active: boolean; // active cascade edge
}

export type AnalysisMode = 'graph' | 'diagnosis' | 'propagation' | 'impact';
export type FilterMode = 'all' | 'active_path' | 'anomalies' | 'critical';
export type TraceMode = 'none' | 'upstream' | 'downstream';

export interface OverlaySettings {
  showEdgeWeights: boolean;
  showAttention: boolean;
  showCriticality: boolean;
  showRelationshipTypes: boolean;
}

export interface DiagnosticCandidate {
  causeId: string;
  name: string;
  confidencePercent: number;
  supportingEvidence: string[];
  status: NodeCriticality;
}

export interface PropagationStep {
  componentId: string;
  componentName: string;
  timeToImpactSeconds: number | null;
  mechanism: string;
  severity: NodeCriticality;
}

export interface ReasoningStep {
  phase: 'Anomaly Detection' | 'Candidate Generation' | 'Root Cause Isolation' | 'Propagation Forecast' | 'Operational Synthesis';
  summary: string;
  detail: string;
  confidence: number;
}
