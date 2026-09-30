export type ScenarioId = 'cascade' | 'nominal' | 'thermal' | 'lubrication' | 'sensor';

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  tagline: string;
  description: string;
  severity: 'nominal' | 'warning' | 'critical';
  durationSeconds: number;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  cascade: {
    id: 'cascade',
    name: 'Cascading Failure',
    tagline: 'Cooling Loss → Oil Breakdown → Friction Surge',
    description:
      'Primary radiator restriction triggers thermal surge, leading to oil viscosity collapse, dry-sump starvation, and severe piston ring friction drag.',
    severity: 'critical',
    durationSeconds: 120,
  },
  nominal: {
    id: 'nominal',
    name: 'Nominal Patrol',
    tagline: 'Standard Reconnaissance Envelope',
    description:
      'Standard multi-phase flight profile with all parameters within nominal green operational thresholds. No component anomalies detected.',
    severity: 'nominal',
    durationSeconds: 120,
  },
  thermal: {
    id: 'thermal',
    name: 'Thermal Degradation',
    tagline: 'Radiator Airflow Restriction',
    description:
      'Gradual loss of ram-air heat exchanger effectiveness. Cylinder head temperatures climb past 140°C while oil pressure remains initially buffered.',
    severity: 'warning',
    durationSeconds: 120,
  },
  lubrication: {
    id: 'lubrication',
    name: 'Lubrication Degradation',
    tagline: 'Dry-Sump Scavenge Pump Wear',
    description:
      'Progressive volumetric loss in scavenge pump causing oil pressure drop below 2.0 bar and journal bearing temperature surge.',
    severity: 'warning',
    durationSeconds: 120,
  },
  sensor: {
    id: 'sensor',
    name: 'Sensor Anomaly',
    tagline: 'Intermittent CHT Thermocouple Drift',
    description:
      'Observation-layer thermocouple noise and bias without physical thermodynamic breakdown. Identified via decoupled coolant residual analysis.',
    severity: 'warning',
    durationSeconds: 120,
  },
};

export const SCENARIO_LIST: ScenarioDefinition[] = [
  SCENARIOS.cascade,
  SCENARIOS.nominal,
  SCENARIOS.thermal,
  SCENARIOS.lubrication,
  SCENARIOS.sensor,
];
