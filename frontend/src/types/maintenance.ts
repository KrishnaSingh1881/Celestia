import type { ScenarioId } from './scenarios';

export type MaintenanceActionType =
  | 'INSPECT'
  | 'REPAIR'
  | 'REPLACE'
  | 'CLEAN_RESTORE'
  | 'CALIBRATE'
  | 'CLEAR_FAULT';

export interface ExpectedEffectItem {
  parameter: string;
  direction: 'up' | 'down' | 'stable';
  detail: string;
}

export interface MaintenanceActionOption {
  id: string;
  type: MaintenanceActionType;
  title: string;
  description: string;
  targetComponentId: string;
  targetComponentName: string;
  applicableScenarios: ScenarioId[];
  expectedEffects: ExpectedEffectItem[];
  reconciliationEffect: {
    healthDelta: number;
    subsystemHealthDelta: {
      cooling?: number;
      cylinderCore?: number;
      lubrication?: number;
      sensors?: number;
    };
    activeFaultResolved: boolean;
    resolvedNodeIds: string[];
    reducedNodeIds: string[];
    newRiskLevel: 'nominal' | 'warning' | 'critical';
    summaryResult: string;
  };
}

export interface MaintenanceRecord {
  id: string;
  timestampSeconds: number;
  timestampFormatted: string;
  action: MaintenanceActionOption;
  beforeSnapshot: {
    healthIndex: number;
    subsystemHealth: {
      cooling: number;
      cylinderCore: number;
      lubrication: number;
      sensors: number;
    };
    activeAlertTitle: string;
    criticality: string;
    rulMinutes: number;
  };
  afterSnapshot: {
    healthIndex: number;
    subsystemHealth: {
      cooling: number;
      cylinderCore: number;
      lubrication: number;
      sensors: number;
    };
    activeAlertTitle: string;
    criticality: string;
    rulMinutes: number;
  };
  status: 'RECONCILED' | 'IN_PROGRESS';
}
