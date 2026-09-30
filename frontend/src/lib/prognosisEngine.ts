import type { DeterministicMissionState } from './deterministicMission';

export interface PrognosisHorizon {
  horizonMinutes: number;
  projectedHealth: number;
  projectedChtCelsius: number;
  projectedOilPressureBar: number;
  projectedRiskTier: string;
}

export interface PrognosisChainData {
  scenarioId: string;
  timeSeconds: number;

  // Stage 1: Current State
  currentState: {
    healthIndex: number;
    riskTier: string;
    governingComponent: string;
    anomalyMetricD2: number;
    keyMetrics: Array<{ label: string; value: string; unit: string; status: 'nominal' | 'warning' | 'critical' }>;
  };

  // Stage 2: Observed Trend
  observedTrend: {
    trendClassification: 'STABLE' | 'DEGRADING_ACCELERATED' | 'CRITICAL_DIVERGENCE';
    rateOfChangeText: string;
    physicalVelocity: string;
    qualitativeDescription: string;
  };

  // Stage 3: Projected State
  projectedState: {
    horizons: PrognosisHorizon[];
    criticalBoundaryHorizonMin: number | null;
    confidenceIntervalText: string;
  };

  // Stage 4: Degradation & RUL Margin
  rulMargin: {
    q05Hours: number;
    q50Hours: number;
    q95Hours: number;
    missionDemandHours: number;
    marginDeltaHours: number;
    marginStatus: 'HEALTHY_SURPLUS' | 'BUFFER_DEPLETED' | 'NEGATIVE_DEFICIT';
    failureDriver: string;
  };

  // Stage 5: Mission Consequence
  missionConsequence: {
    survivalProbability: number;
    operationalConsequence: string;
    flightEnvelopeStatus: string;
  };

  // Stage 6: Operational Recommendation
  recommendation: {
    actionTitle: string;
    detailedAction: string;
    authorityDeclaration: string;
  };
}

export function computePrognosisChain(mission: DeterministicMissionState): PrognosisChainData {
  const { scenarioId, timeSeconds, healthIndex, channels, pipelineResult } = mission;

  const missionDemandHours = 2.0; // standard reference patrol demand
  const q50 = pipelineResult.rul.q50_h;
  const q05 = pipelineResult.rul.q05_h;
  const q95 = pipelineResult.rul.q95_h;
  const marginDeltaHours = Math.round((q50 - missionDemandHours) * 10) / 10;

  let marginStatus: 'HEALTHY_SURPLUS' | 'BUFFER_DEPLETED' | 'NEGATIVE_DEFICIT' = 'HEALTHY_SURPLUS';
  if (marginDeltaHours < 0) {
    marginStatus = 'NEGATIVE_DEFICIT';
  } else if (marginDeltaHours < 10) {
    marginStatus = 'BUFFER_DEPLETED';
  }

  // 1. Current State
  const currentState = {
    healthIndex,
    riskTier: pipelineResult.risk.tier,
    governingComponent: pipelineResult.rul.component,
    anomalyMetricD2: Math.round(pipelineResult.residual.d2 * 10) / 10,
    keyMetrics: [
      { label: 'Cylinder Head Temp', value: `${channels.cht.current}`, unit: '°C', status: channels.cht.status },
      { label: 'Oil Pressure', value: `${channels.oilPressure.current}`, unit: 'bar', status: channels.oilPressure.status },
      { label: 'Coolant Temp', value: `${channels.coolantTemp.current}`, unit: '°C', status: channels.coolantTemp.status },
      { label: 'Core Vibration', value: `${channels.vibration.current.toFixed(2)}`, unit: 'g', status: channels.vibration.status },
    ],
  };

  // 2. Observed Trend
  let trendClassification: 'STABLE' | 'DEGRADING_ACCELERATED' | 'CRITICAL_DIVERGENCE' = 'STABLE';
  let rateOfChangeText = 'Steady-state nominal envelope (Δ < 0.05 units/min)';
  let physicalVelocity = '+0.02 °C/min CHT drift';
  let qualitativeDescription = 'Normal thermodynamic equilibrium maintained across all monitored galleys.';

  if (scenarioId === 'cascade') {
    if (timeSeconds < 35) {
      trendClassification = 'STABLE';
      rateOfChangeText = 'Climb phase nominal baseline';
      physicalVelocity = '+0.1 °C/s climb heat flux';
      qualitativeDescription = 'Thermal rejection balanced against ram-air velocity.';
    } else if (timeSeconds < 75) {
      trendClassification = 'DEGRADING_ACCELERATED';
      rateOfChangeText = 'Secondary thermal coupling active';
      physicalVelocity = '+0.42 °C/s Coolant · -0.035 bar/s Oil Pressure';
      qualitativeDescription = 'Accelerating coolant temperature divergence coupled with oil viscosity degradation.';
    } else {
      trendClassification = 'CRITICAL_DIVERGENCE';
      rateOfChangeText = 'Multi-tier mechanical cascade active';
      physicalVelocity = '+0.65 °C/s CHT · +0.015 g/s Vibration · -4.5 RPM/s';
      qualitativeDescription = 'Thermo-mechanical boundary failure: piston ring expansion friction drag causing RPM decay.';
    }
  } else if (scenarioId === 'thermal') {
    if (timeSeconds < 40) {
      trendClassification = 'STABLE';
      rateOfChangeText = 'Initial airflow boundary nominal';
      physicalVelocity = '+0.05 °C/s CHT drift';
      qualitativeDescription = 'Cooling loop absorbing initial heat flux.';
    } else {
      trendClassification = 'DEGRADING_ACCELERATED';
      rateOfChangeText = 'Continuous heat exchanger deficit';
      physicalVelocity = '+0.38 °C/s CHT · +0.32 °C/s Coolant';
      qualitativeDescription = 'Radiator ram-air dissipation reduced by 42%; cylinder heads entering thermal saturation.';
    }
  } else if (scenarioId === 'lubrication') {
    if (timeSeconds < 35) {
      trendClassification = 'STABLE';
      rateOfChangeText = 'Gallery delivery pressure steady';
      physicalVelocity = 'Nominal 4.6 bar';
      qualitativeDescription = 'Dry-sump circulation normal.';
    } else {
      trendClassification = 'CRITICAL_DIVERGENCE';
      rateOfChangeText = 'Scavenge volumetric loss';
      physicalVelocity = '-0.045 bar/s pressure collapse';
      qualitativeDescription = 'Progressive dry-sump starvation; hydrodynamic bearing boundary layer evaporating.';
    }
  } else if (scenarioId === 'sensor') {
    trendClassification = 'DEGRADING_ACCELERATED';
    rateOfChangeText = 'Observation-layer sensor discrepancy';
    physicalVelocity = '+1.4 °C/s raw CHT sensor drift (Decoupled)';
    qualitativeDescription = 'CHT channel residual z > 4.5 while coolant and oil temperatures remain perfectly stable.';
  }

  // 3. Projected State Horizons (+15m, +30m, +60m)
  const isCascadeLate = scenarioId === 'cascade' && timeSeconds >= 75;
  const isCascadeMid = scenarioId === 'cascade' && timeSeconds >= 45 && timeSeconds < 75;
  const isThermalLate = scenarioId === 'thermal' && timeSeconds >= 50;
  const isLubricationLate = scenarioId === 'lubrication' && timeSeconds >= 45;

  let horizons: PrognosisHorizon[];
  let criticalBoundaryHorizonMin: number | null = null;

  if (isCascadeLate) {
    criticalBoundaryHorizonMin = 6.5; // ~6.5 minutes to mechanical seizure
    horizons = [
      { horizonMinutes: 5, projectedHealth: 12, projectedChtCelsius: 168, projectedOilPressureBar: 1.4, projectedRiskTier: 'Critical' },
      { horizonMinutes: 15, projectedHealth: 0, projectedChtCelsius: 185, projectedOilPressureBar: 0.8, projectedRiskTier: 'Seizure Imminent' },
      { horizonMinutes: 30, projectedHealth: 0, projectedChtCelsius: 200, projectedOilPressureBar: 0.2, projectedRiskTier: 'Seizure Imminent' },
    ];
  } else if (isCascadeMid) {
    criticalBoundaryHorizonMin = 22;
    horizons = [
      { horizonMinutes: 15, projectedHealth: 48, projectedChtCelsius: 152, projectedOilPressureBar: 2.1, projectedRiskTier: 'Warning' },
      { horizonMinutes: 30, projectedHealth: 22, projectedChtCelsius: 165, projectedOilPressureBar: 1.6, projectedRiskTier: 'Critical' },
      { horizonMinutes: 60, projectedHealth: 5, projectedChtCelsius: 180, projectedOilPressureBar: 1.0, projectedRiskTier: 'Failure' },
    ];
  } else if (isThermalLate) {
    criticalBoundaryHorizonMin = 35;
    horizons = [
      { horizonMinutes: 15, projectedHealth: 62, projectedChtCelsius: 150, projectedOilPressureBar: 3.8, projectedRiskTier: 'Warning' },
      { horizonMinutes: 30, projectedHealth: 45, projectedChtCelsius: 158, projectedOilPressureBar: 3.4, projectedRiskTier: 'Warning' },
      { horizonMinutes: 60, projectedHealth: 28, projectedChtCelsius: 168, projectedOilPressureBar: 2.9, projectedRiskTier: 'Critical' },
    ];
  } else if (isLubricationLate) {
    criticalBoundaryHorizonMin = 14;
    horizons = [
      { horizonMinutes: 15, projectedHealth: 38, projectedChtCelsius: 135, projectedOilPressureBar: 1.6, projectedRiskTier: 'Critical' },
      { horizonMinutes: 30, projectedHealth: 15, projectedChtCelsius: 155, projectedOilPressureBar: 1.1, projectedRiskTier: 'Critical' },
      { horizonMinutes: 60, projectedHealth: 0, projectedChtCelsius: 180, projectedOilPressureBar: 0.5, projectedRiskTier: 'Failure' },
    ];
  } else {
    // Nominal / Mild
    horizons = [
      { horizonMinutes: 15, projectedHealth: 98, projectedChtCelsius: 108, projectedOilPressureBar: 4.6, projectedRiskTier: 'Nominal' },
      { horizonMinutes: 30, projectedHealth: 97, projectedChtCelsius: 109, projectedOilPressureBar: 4.5, projectedRiskTier: 'Nominal' },
      { horizonMinutes: 60, projectedHealth: 96, projectedChtCelsius: 110, projectedOilPressureBar: 4.5, projectedRiskTier: 'Nominal' },
    ];
  }

  // 4. Mission Consequence
  let flightEnvelopeStatus = 'Full operational envelope certified across all planned flight levels.';
  if (healthIndex < 40) {
    flightEnvelopeStatus = 'Propulsion margin depleted. Forced unpowered glide or immediate emergency landing vector required.';
  } else if (healthIndex < 70) {
    flightEnvelopeStatus = 'Climb ceiling restricted to 4,000 ft. Continuous full-throttle prohibited.';
  } else if (healthIndex < 85) {
    flightEnvelopeStatus = 'Thermal dissipation constrained. Power output derated to 75% MCP.';
  }

  return {
    scenarioId,
    timeSeconds,
    currentState,
    observedTrend: {
      trendClassification,
      rateOfChangeText,
      physicalVelocity,
      qualitativeDescription,
    },
    projectedState: {
      horizons,
      criticalBoundaryHorizonMin,
      confidenceIntervalText: `90% Credible Interval: [${q05}h – ${q95}h], Median Expectation: ${q50}h`,
    },
    rulMargin: {
      q05Hours: q05,
      q50Hours: q50,
      q95Hours: q95,
      missionDemandHours,
      marginDeltaHours,
      marginStatus,
      failureDriver: pipelineResult.rul.driver,
    },
    missionConsequence: {
      survivalProbability: Math.round(pipelineResult.risk.P_success * 100),
      operationalConsequence: mission.missionConsequence,
      flightEnvelopeStatus,
    },
    recommendation: {
      actionTitle: pipelineResult.risk.recommended_action.split(';')[0] || 'Maintain Profile',
      detailedAction: mission.recommendedAction,
      authorityDeclaration: 'Decision Authority: Flight Crew / Ground Controller · Advisory Tier · No direct actuator command',
    },
  };
}
