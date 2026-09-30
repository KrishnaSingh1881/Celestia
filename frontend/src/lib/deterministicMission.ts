import { intermediatePoint, initialBearingDeg, haversineDistanceKm } from './geo';
import { PRESET_ROUTES, type MissionRoute } from '../types/mission';
import type { PipelineResult, Prediction, Residual, Diagnosis, RUL, Risk } from '../types/contracts';
import type { ScenarioId } from '../types/scenarios';
import type { MaintenanceRecord } from '../types/maintenance';

export interface TelemetryChannelState {
  current: number;
  expected: number;
  residual: number;
  zScore: number;
  unit: string;
  flagged: boolean;
  status: 'nominal' | 'warning' | 'critical';
}

export interface DeterministicMissionState {
  timeSeconds: number;
  totalDurationSeconds: number;
  progress: number;
  phase: 'Climb' | 'Cruise Patrol' | 'Descent / Recovery';
  scenarioId: ScenarioId;

  // Kinematics & Geo
  uavPosition: { lat: number; lon: number };
  headingDeg: number;
  altitudeFt: number;
  airspeedKmh: number;
  totalDistanceKm: number;
  remainingDistanceKm: number;

  // Environmental Context
  environment: {
    ambientTempC: number;
    ambientPressureHpa: number;
    windSpeedKts: number;
    windDirectionDeg: number;
  };

  // Engine Internals & Visuals
  rpm: number;
  propRpm: number;
  chtCelsius: number;
  oilPressureBar: number;
  coolantTempCelsius: number;
  oilTempCelsius: number;
  mapKpa: number;
  egtCelsius: number;
  vibrationG: number;
  fuelFlowGs: number;

  // Engineering Telemetry Channels with baselines and z-scores
  channels: {
    rpm: TelemetryChannelState;
    cht: TelemetryChannelState;
    oilPressure: TelemetryChannelState;
    coolantTemp: TelemetryChannelState;
    oilTemp: TelemetryChannelState;
    map: TelemetryChannelState;
    egt: TelemetryChannelState;
    vibration: TelemetryChannelState;
  };

  // Health & Subsystem breakdown
  healthIndex: number; // 0 - 100
  subsystemHealth: {
    cylinderCore: number;
    cooling: number;
    lubrication: number;
    sensors: number;
  };

  // Full Pipeline Contracts
  pipelineResult: PipelineResult;

  // Active Alerts & Mission Consequence
  activeAlert: {
    active: boolean;
    level: 'nominal' | 'advisory' | 'warning' | 'critical';
    code: string;
    title: string;
    message: string;
    subsystem: string;
  };
  currentEvent: string;
  missionConsequence: string;
  recommendedAction: string;
}

// Smooth deterministic transition helper: maps input x in [edge0, edge1] to [0, 1] using Hermite interpolation
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function computeDeterministicMissionState(
  scenarioId: ScenarioId,
  timeSeconds: number,
  route: MissionRoute = PRESET_ROUTES[0],
  totalDurationSeconds = 120,
  appliedInterventions: MaintenanceRecord[] = [],
): DeterministicMissionState {
  const t = Math.max(0, Math.min(totalDurationSeconds, timeSeconds));
  const progress = t / totalDurationSeconds;

  // Flight Phase
  let phase: 'Climb' | 'Cruise Patrol' | 'Descent / Recovery';
  if (t < 25) {
    phase = 'Climb';
  } else if (t < 95) {
    phase = 'Cruise Patrol';
  } else {
    phase = 'Descent / Recovery';
  }

  // Kinematics along Route
  const totalDistanceKm = haversineDistanceKm(route.source, route.destination);
  const remainingDistanceKm = totalDistanceKm * (1 - progress);
  const uavPosition = intermediatePoint(route.source, route.destination, progress);
  const headingDeg = initialBearingDeg(route.source, route.destination);

  // Altitude (planned flight profile)
  let altitudeFt: number;
  if (t < 25) {
    altitudeFt = Math.round(smoothstep(0, 25, t) * 8000);
  } else if (t < 95) {
    // Steady cruise with slight deterministic atmospheric undulation
    altitudeFt = Math.round(8000 + Math.sin(t * 0.12) * 25);
  } else {
    altitudeFt = Math.round(8000 - smoothstep(95, 120, t) * 6500);
  }

  // Airspeed (km/h)
  let baseAirspeed = 150;
  if (t < 25) {
    baseAirspeed = 120 + 30 * smoothstep(0, 25, t);
  } else if (t > 95) {
    baseAirspeed = 150 - 35 * smoothstep(95, 120, t);
  }

  // Environmental context based on altitude
  const ambientTempC = Math.round((15 - (altitudeFt / 1000) * 1.98) * 10) / 10;
  const ambientPressureHpa = Math.round(1013.25 * Math.pow(1 - 2.25577e-5 * (altitudeFt * 0.3048), 5.25588));
  const windSpeedKts = 14;
  const windDirectionDeg = 245;

  // Nominal Engine Baselines
  let baseRpm = 2500;
  let baseMap = 98.0; // kPa
  if (phase === 'Climb') {
    baseRpm = 2700;
    baseMap = 101.5;
  } else if (phase === 'Descent / Recovery') {
    baseRpm = 2100;
    baseMap = 74.0;
  }

  const baseCht = 108.0; // °C
  const baseCoolant = 82.0; // °C
  const baseOilPressure = 4.6; // bar
  const baseOilTemp = 85.0; // °C
  const baseEgt = 720.0; // °C
  const baseVibration = 0.08; // g
  const baseFuelFlow = 18.2; // g/s

  // Scenario-specific perturbations
  let chtCelsius = baseCht;
  let coolantTempCelsius = baseCoolant;
  let oilPressureBar = baseOilPressure;
  let oilTempCelsius = baseOilTemp;
  let rpm = baseRpm;
  let egtCelsius = baseEgt;
  let vibrationG = baseVibration;
  let mapKpa = baseMap;
  let fuelFlowGs = baseFuelFlow;

  let currentEvent = 'Corridor Patrol Transit — Engine Systems Nominal';
  let missionConsequence = 'Nominal operational status. Full operational envelope available.';
  let recommendedAction = 'Maintain scheduled surveillance waypoint transit.';

  let activeAlert = {
    active: false,
    level: 'nominal' as 'nominal' | 'advisory' | 'warning' | 'critical',
    code: 'SYS_NOMINAL',
    title: 'All Subsystems Nominal',
    message: 'Telemetric and residual deviations remain within normal 1.5-sigma bounds.',
    subsystem: 'Core',
  };

  let healthIndex = 99;
  let cylinderHealth = 99;
  let coolingHealth = 99;
  let lubricationHealth = 99;
  let sensorHealth = 99;

  let topCause = 'healthy';
  let topCauseProbability = 0.98;
  let evidenceList: string[] = ['All observable channels within 1.5 standard deviations'];
  let riskTier: 'Nominal' | 'Watch' | 'Advisory' | 'Caution' | 'Warning' | 'Critical' = 'Nominal';
  let pSuccess = 0.99;
  let rulQ50 = 850;
  let rulDriver = 'Engine Operating Hours';
  let rulComponent = 'Engine Core';

  // -------------------------------------------------------------
  // Scenario 1: Nominal Patrol
  // -------------------------------------------------------------
  if (scenarioId === 'nominal') {
    healthIndex = Math.round(99 - progress * 1.5);
    cylinderHealth = 99;
    coolingHealth = 98;
    lubricationHealth = 99;
    sensorHealth = 100;

    currentEvent = 'Standard Reconnaissance Envelope — All Parameters Locked';
    missionConsequence = 'Full flight clearance. No thermal or mechanical stress detected.';
    recommendedAction = 'Continue automated waypoint plan.';
  }

  // -------------------------------------------------------------
  // Scenario 2: Thermal Degradation
  // -------------------------------------------------------------
  else if (scenarioId === 'thermal') {
    // Airflow restriction ramps from t=30 to t=120
    const faultFrac = smoothstep(30, 110, t);
    coolantTempCelsius = baseCoolant + faultFrac * 36.0; // up to 118°C
    chtCelsius = baseCht + faultFrac * 40.0; // up to 148°C
    oilTempCelsius = baseOilTemp + faultFrac * 22.0; // up to 107°C
    oilPressureBar = baseOilPressure - faultFrac * 0.7; // slight drop due to thermal thinning
    egtCelsius = baseEgt + faultFrac * 75.0;

    coolingHealth = Math.round(98 - faultFrac * 65);
    cylinderHealth = Math.round(99 - faultFrac * 45);
    lubricationHealth = Math.round(99 - faultFrac * 20);
    healthIndex = Math.round(99 - faultFrac * 42);

    if (t >= 45 && t < 75) {
      activeAlert = {
        active: true,
        level: 'advisory',
        code: 'WARN_COOLING_DEGRADE',
        title: 'Cooling Capacity Advisory',
        message: 'Coolant temperature elevated (+18°C above schedule); heat rejection efficiency degrading.',
        subsystem: 'Cooling',
      };
      currentEvent = 'Ram-Air Radiator Ingress Obstruction Developing';
      missionConsequence = 'Thermal margin narrowing. Engine climb throttle restricted.';
      recommendedAction = 'Throttle back to 65% power; monitor CHT trend.';
      topCause = 'cooling_system_degradation';
      topCauseProbability = 0.74;
      evidenceList = ['Coolant temperature residual z=+2.8', 'CHT rising with nominal fuel flow'];
      riskTier = 'Advisory';
      pSuccess = 0.82;
      rulQ50 = 85;
      rulDriver = 'Cylinder Thermal Fatigue';
      rulComponent = 'Radiator / Coolant Line';
    } else if (t >= 75) {
      activeAlert = {
        active: true,
        level: 'warning',
        code: 'CRIT_CHT_EXCEEDED',
        title: 'Cylinder Head Thermal Limit Exceeded',
        message: 'CHT 146°C exceeds maximum continuous limit (142°C); thermal saturation imminent.',
        subsystem: 'Cylinders',
      };
      currentEvent = 'Continuous Thermal Envelope Exceeded — Head Distortion Risk';
      missionConsequence = 'Risk of valve guide binding and cylinder head micro-cracking.';
      recommendedAction = 'Execute descent to lower ambient air and initiate RTB vector.';
      topCause = 'cooling_system_degradation';
      topCauseProbability = 0.94;
      evidenceList = ['CHT residual z=+4.3', 'Coolant temp residual z=+3.9', 'Exhaust temperature elevated'];
      riskTier = 'Warning';
      pSuccess = 0.58;
      rulQ50 = 24;
      rulDriver = 'Thermal Valve Seizure Margin';
      rulComponent = 'Boxer Cylinder Head';
    }
  }

  // -------------------------------------------------------------
  // Scenario 3: Lubrication Degradation
  // -------------------------------------------------------------
  else if (scenarioId === 'lubrication') {
    const faultFrac = smoothstep(25, 105, t);
    oilPressureBar = baseOilPressure - faultFrac * 2.85; // down to 1.75 bar (critical)
    oilTempCelsius = baseOilTemp + faultFrac * 42.0; // up to 127°C
    chtCelsius = baseCht + faultFrac * 18.0; // frictional heating
    vibrationG = baseVibration + faultFrac * 0.18;

    lubricationHealth = Math.round(99 - faultFrac * 70);
    cylinderHealth = Math.round(99 - faultFrac * 35);
    healthIndex = Math.round(99 - faultFrac * 46);

    if (t >= 40 && t < 70) {
      activeAlert = {
        active: true,
        level: 'warning',
        code: 'WARN_OIL_PRESSURE_SAG',
        title: 'Dry-Sump Gallery Pressure Low',
        message: 'Oil pressure sagged to 2.4 bar (normal minimum 2.8 bar); scavenge efficiency loss.',
        subsystem: 'Lubrication',
      };
      currentEvent = 'Scavenge Pump Volumetric Wear Detected';
      missionConsequence = 'Hydrodynamic lubrication film margin reduced across journal bearings.';
      recommendedAction = 'Limit RPM transitions; prepare alternate recovery airfields.';
      topCause = 'oil_pump_wear';
      topCauseProbability = 0.81;
      evidenceList = ['Oil pressure residual z=-3.2', 'Oil temperature residual z=+2.4'];
      riskTier = 'Caution';
      pSuccess = 0.74;
      rulQ50 = 36;
      rulDriver = 'Journal Bearing Boundary Friction';
      rulComponent = 'Dry Sump Oil Pump';
    } else if (t >= 70) {
      activeAlert = {
        active: true,
        level: 'critical',
        code: 'CRIT_OIL_STARVATION',
        title: 'Critical Oil Pressure Depletion',
        message: 'Oil pressure 1.8 bar below critical safety boundary (< 2.0 bar); bearing wipe risk.',
        subsystem: 'Lubrication',
      };
      currentEvent = 'Main Crankshaft Bearing Boundary Lubrication Threshold Crossed';
      missionConsequence = 'Severe hydrodynamic breakdown; catastrophic crankshaft seizure risk in < 20 min.';
      recommendedAction = 'Immediate engine throttle minimization and emergency landing commanded.';
      topCause = 'oil_pump_wear';
      topCauseProbability = 0.96;
      evidenceList = ['Oil pressure residual z=-4.8', 'Oil temperature z=+4.1', 'Acoustic/vibration surge'];
      riskTier = 'Critical';
      pSuccess = 0.42;
      rulQ50 = 8.5;
      rulDriver = 'Main Journal Seizure Margin';
      rulComponent = 'Crankshaft Main Bearings';
    }
  }

  // -------------------------------------------------------------
  // Scenario 4: Sensor Anomaly
  // -------------------------------------------------------------
  else if (scenarioId === 'sensor') {
    const faultFrac = smoothstep(35, 75, t);
    // Sensor reading drifts erratically high, but actual engine temperatures remain nominal!
    const sensorSpike = faultFrac * (52.0 + Math.sin(t * 0.8) * 12.0);
    chtCelsius = baseCht + sensorSpike; // measured value exhibits anomalous drift
    // Coolant and oil stay clean nominal
    coolantTempCelsius = baseCoolant;
    oilPressureBar = baseOilPressure;
    oilTempCelsius = baseOilTemp;

    sensorHealth = Math.round(100 - faultFrac * 68);
    healthIndex = Math.round(99 - faultFrac * 14); // Physical health is safe; sensor health degraded

    if (t >= 42) {
      activeAlert = {
        active: true,
        level: 'advisory',
        code: 'ANOMALY_SENSOR_DECOUPLED',
        title: 'CHT Thermocouple Drift Detected',
        message: 'CHT sensor indicates 164°C, but coolant and exhaust temperatures remain perfectly nominal.',
        subsystem: 'Sensors',
      };
      currentEvent = 'Sensor Bias Discrepancy — Synthetic State Estimator Engaged';
      missionConsequence = 'Physical engine integrity nominal; primary CHT channel flagged as uncalibrated.';
      recommendedAction = 'Ignore raw CHT reading; reference synthetic Kalman state estimation.';
      topCause = 'sensor_nuisance_cht';
      topCauseProbability = 0.91;
      evidenceList = ['CHT residual z=+4.7', 'Decoupled from coolant temperature (z=0.1)', 'GLR test tripped'];
      riskTier = 'Advisory';
      pSuccess = 0.93;
      rulQ50 = 810;
      rulDriver = 'Instrumentation Redundancy Depletion';
      rulComponent = 'CHT Thermocouple Sensor';
    }
  }

  // -------------------------------------------------------------
  // Scenario 5: Cascading Failure (DEFAULT)
  // -------------------------------------------------------------
  else if (scenarioId === 'cascade') {
    // Stage 1 (t=0..30s): Nominal Climb & Cruise
    if (t < 30) {
      healthIndex = 99;
      currentEvent = 'Climb Profile Nominal — Full Subsystem Synchronization';
      missionConsequence = 'Operating within certified boundary conditions.';
      recommendedAction = 'Maintain planned climb profile to 8,000 ft.';
    }
    // Stage 2 (t=30..55s): Initial Cooling Ingress Loss
    else if (t < 55) {
      const stageFrac = smoothstep(30, 55, t);
      coolantTempCelsius = baseCoolant + stageFrac * 24.0; // 82 -> 106°C
      chtCelsius = baseCht + stageFrac * 22.0; // 108 -> 130°C
      egtCelsius = baseEgt + stageFrac * 35.0;

      coolingHealth = Math.round(98 - stageFrac * 35);
      healthIndex = Math.round(99 - stageFrac * 18); // 99 -> 81

      activeAlert = {
        active: true,
        level: 'advisory',
        code: 'STAGE_1_COOLANT_RESTRICTION',
        title: 'Initial Cooling Loop Thermal Elevation',
        message: 'Coolant temperature 104°C (+22°C above nominal baseline); ram-air effectiveness impaired.',
        subsystem: 'Cooling',
      };
      currentEvent = 'Stage 1: Primary Heat Exchanger Airflow Restriction Ingress';
      missionConsequence = 'Cooling loop approaching thermal saturation buffer.';
      recommendedAction = 'Monitor thermal gradient; limit continuous full-throttle operation.';
      topCause = 'cooling_system_degradation';
      topCauseProbability = 0.79;
      evidenceList = ['Coolant temperature residual z=+3.1', 'CHT temperature creeping above cruise schedule'];
      riskTier = 'Advisory';
      pSuccess = 0.86;
      rulQ50 = 72;
      rulDriver = 'Cooling Margin Dissipation';
      rulComponent = 'Coolant Heat Exchanger';
    }
    // Stage 3 (t=55..80s): Thermal-Lubrication Cascade
    else if (t < 80) {
      const stageFrac = smoothstep(55, 80, t);
      coolantTempCelsius = 106.0 + stageFrac * 12.0; // 106 -> 118°C
      chtCelsius = 130.0 + stageFrac * 16.0; // 130 -> 146°C
      oilTempCelsius = baseOilTemp + stageFrac * 38.0; // 85 -> 123°C
      oilPressureBar = baseOilPressure - stageFrac * 2.2; // 4.6 -> 2.4 bar
      egtCelsius = baseEgt + 35.0 + stageFrac * 45.0;

      coolingHealth = Math.round(63 - stageFrac * 25);
      lubricationHealth = Math.round(98 - stageFrac * 48);
      cylinderHealth = Math.round(98 - stageFrac * 32);
      healthIndex = Math.round(81 - stageFrac * 26); // 81 -> 55

      activeAlert = {
        active: true,
        level: 'warning',
        code: 'STAGE_2_THERMAL_OIL_COUPLING',
        title: 'Cascade Stage 2: Oil Viscosity Breakdown',
        message: 'Overheated oil gallery (121°C) induced thermal thinning; oil pressure plummeted to 2.4 bar.',
        subsystem: 'Lubrication',
      };
      currentEvent = 'Stage 2: Coupled Thermal-Lubrication Cascade Triggered';
      missionConsequence = 'Lubrication film collapse in progress; journal and ring friction surging.';
      recommendedAction = 'Initiate precautionary RTB vector; reduce engine power demand.';
      topCause = 'thermal_oil_coupling';
      topCauseProbability = 0.89;
      evidenceList = [
        'Coolant temp z=+4.1',
        'Oil temp z=+3.6',
        'Oil pressure residual z=-3.4',
        'Cross-channel causal coupling detected',
      ];
      riskTier = 'Caution';
      pSuccess = 0.61;
      rulQ50 = 21;
      rulDriver = 'Coupled Lubrication Film Collapse';
      rulComponent = 'Oil Sump / Piston Rings';
    }
    // Stage 4 (t=80..120s): Full Core Mechanical Cascade & Sag
    else {
      const stageFrac = smoothstep(80, 120, t);
      coolantTempCelsius = 118.0 + stageFrac * 8.0; // up to 126°C
      chtCelsius = 146.0 + stageFrac * 14.0; // up to 160°C (extreme critical)
      oilTempCelsius = 123.0 + stageFrac * 12.0; // up to 135°C
      oilPressureBar = 2.4 - stageFrac * 0.75; // down to 1.65 bar (starvation)
      rpm = baseRpm - stageFrac * 420.0; // mechanical drag induces RPM sag down to 2080 RPM!
      vibrationG = baseVibration + stageFrac * 0.38; // surge to 0.46g!
      egtCelsius = baseEgt + 80.0 + stageFrac * 30.0;
      baseAirspeed -= stageFrac * 35.0; // airspeed drops

      coolingHealth = Math.max(12, Math.round(38 - stageFrac * 24));
      lubricationHealth = Math.max(10, Math.round(50 - stageFrac * 38));
      cylinderHealth = Math.max(15, Math.round(66 - stageFrac * 48));
      healthIndex = Math.max(14, Math.round(55 - stageFrac * 38)); // drops to ~17%

      activeAlert = {
        active: true,
        level: 'critical',
        code: 'STAGE_3_MECHANICAL_CASCADE',
        title: 'Cascade Stage 3: Imminent Mechanical Seizure',
        message: 'Severe friction drag causing RPM sag (-400 RPM), high vibration (0.44g), and CHT thermal runaway.',
        subsystem: 'Cylinders',
      };
      currentEvent = 'Stage 3: Full Multi-Tier Cascade Active — Piston Ring Binding Risk';
      missionConsequence = 'Critical propulsion failure imminent (< 5 minutes). Complete mission abort mandatory.';
      recommendedAction = 'Immediate engine idling and emergency recovery glide path execution.';
      topCause = 'cascading_core_failure';
      topCauseProbability = 0.98;
      evidenceList = [
        'Multi-subsystem alarm: CHT > 155°C, Coolant > 120°C, Oil P < 1.8 bar',
        'Vibration residual z=+4.9',
        'Mechanical drag RPM sag observed without throttle input change',
      ];
      riskTier = 'Critical';
      pSuccess = 0.22;
      rulQ50 = 3.2;
      rulDriver = 'Coupled Thermo-Mechanical Seizure Margin';
      rulComponent = 'Engine Boxer Core Assembly';
    }
  }

  // Apply Deterministic Maintenance Interventions if present
  if (appliedInterventions && appliedInterventions.length > 0) {
    for (const record of appliedInterventions) {
      const act = record.action;
      if (act.reconciliationEffect.activeFaultResolved) {
        if (scenarioId === 'cascade' || scenarioId === 'thermal') {
          // Recover cooling loop & thermal cascade
          coolantTempCelsius = baseCoolant + 1.2;
          chtCelsius = baseCht + 2.0;
          oilTempCelsius = baseOilTemp + 2.5;
          oilPressureBar = baseOilPressure - 0.1;
          vibrationG = baseVibration + 0.01;
          rpm = baseRpm;
          coolingHealth = 94;
          cylinderHealth = 91;
          lubricationHealth = 90;
          healthIndex = 92;

          activeAlert = {
            active: false,
            level: 'nominal',
            code: 'STATE_RECONCILED',
            title: 'Digital Twin Reconciled — Thermal Cascade Resolved',
            message: `Maintenance verified: ${act.title}. Thermal equilibrium and cooling flow restored to nominal schedule.`,
            subsystem: 'Cooling / Power Core',
          };
          currentEvent = `Maintenance Reconciled: ${act.title}`;
          missionConsequence = 'Nominal propulsion restored. Full mission flight schedule maintained.';
          recommendedAction = 'Continue planned mission waypoint sequence; monitor nominal telemetry.';
          topCause = 'nominal';
          topCauseProbability = 0.05;
          riskTier = 'Nominal';
          pSuccess = 0.96;
          rulQ50 = 340;
          rulDriver = 'Standard Duty Cycle Wear';
          rulComponent = 'UAV Engine Core';
        } else if (scenarioId === 'sensor') {
          chtCelsius = baseCht;
          sensorHealth = 98;
          healthIndex = 98;
          activeAlert = {
            active: false,
            level: 'nominal',
            code: 'SENSOR_RECONCILED',
            title: 'Sensor Channel Parity Reconciled',
            message: `${act.title} verified. CHT parity residual returned to zero; synthetic estimation disarmed.`,
            subsystem: 'Sensors',
          };
          currentEvent = 'Sensor Channel Re-calibrated & Verified';
          missionConsequence = 'Instrumentation 100% operational; autonomous flight continues.';
          recommendedAction = 'Maintain planned waypoint sequence.';
          topCause = 'nominal';
          topCauseProbability = 0.05;
          riskTier = 'Nominal';
          pSuccess = 0.98;
          rulQ50 = 850;
        } else if (scenarioId === 'lubrication') {
          oilPressureBar = baseOilPressure;
          oilTempCelsius = baseOilTemp + 1.5;
          lubricationHealth = 93;
          healthIndex = 93;
          activeAlert = {
            active: false,
            level: 'nominal',
            code: 'LUBE_RECONCILED',
            title: 'Lubrication Hydraulics Reconciled',
            message: `${act.title} complete. Gallery pressure restored to 4.5 bar; cavitation collapsed.`,
            subsystem: 'Lubrication',
          };
          currentEvent = 'Dry-Sump Lubrication Circuit Reconciled';
          missionConsequence = 'Hydrodynamic journal film restored. Mission continuation nominal.';
          recommendedAction = 'Resume normal operational envelope.';
          topCause = 'nominal';
          topCauseProbability = 0.05;
          riskTier = 'Nominal';
          pSuccess = 0.95;
          rulQ50 = 420;
        }
      } else {
        // Partial reconciliation (e.g. oil flush or borescope inspection)
        healthIndex = Math.min(95, healthIndex + act.reconciliationEffect.healthDelta);
        if (act.reconciliationEffect.subsystemHealthDelta.lubrication) {
          lubricationHealth = Math.min(95, lubricationHealth + act.reconciliationEffect.subsystemHealthDelta.lubrication);
          oilPressureBar = Math.min(baseOilPressure, oilPressureBar + 1.2);
        }
        if (act.reconciliationEffect.subsystemHealthDelta.cylinderCore) {
          cylinderHealth = Math.min(95, cylinderHealth + act.reconciliationEffect.subsystemHealthDelta.cylinderCore);
        }
      }
    }
  }

  // Round all state telemetry variables to clean engineering precision (max 1-2 decimal places)
  rpm = Math.round(rpm * 10) / 10;
  chtCelsius = Math.round(chtCelsius * 10) / 10;
  oilPressureBar = Math.round(oilPressureBar * 100) / 100;
  coolantTempCelsius = Math.round(coolantTempCelsius * 10) / 10;
  oilTempCelsius = Math.round(oilTempCelsius * 10) / 10;
  mapKpa = Math.round(mapKpa * 10) / 10;
  egtCelsius = Math.round(egtCelsius * 10) / 10;
  vibrationG = Math.round(vibrationG * 100) / 100;
  fuelFlowGs = Math.round(fuelFlowGs * 10) / 10;

  // Derived visual values
  const propRpm = Math.round(rpm / 2.43); // PSRU ratio 2.43
  const omegaEngineRadS = Math.round(((rpm * 2 * Math.PI) / 60) * 100) / 100;
  const airspeedKmh = Math.max(70, Math.round(baseAirspeed));

  // Compute Telemetry Channels with expected baselines, residuals, and z-scores
  const makeChannel = (
    current: number,
    expected: number,
    sigma: number,
    unit: string,
    warnZ = 2.0,
    critZ = 3.5,
  ): TelemetryChannelState => {
    const residual = Math.round((current - expected) * 100) / 100;
    const zScore = Math.round((residual / sigma) * 100) / 100;
    const absZ = Math.abs(zScore);
    const status: 'nominal' | 'warning' | 'critical' =
      absZ >= critZ ? 'critical' : absZ >= warnZ ? 'warning' : 'nominal';
    return {
      current: Math.round(current * 100) / 100,
      expected: Math.round(expected * 100) / 100,
      residual,
      zScore,
      unit,
      flagged: absZ >= warnZ,
      status,
    };
  };

  const channels = {
    rpm: makeChannel(rpm, baseRpm, 45, 'RPM', 2.0, 3.5),
    cht: makeChannel(chtCelsius, baseCht, 3.8, '°C', 2.0, 3.5),
    oilPressure: makeChannel(oilPressureBar, baseOilPressure, 0.25, 'bar', 2.0, 3.5),
    coolantTemp: makeChannel(coolantTempCelsius, baseCoolant, 2.5, '°C', 2.0, 3.5),
    oilTemp: makeChannel(oilTempCelsius, baseOilTemp, 3.0, '°C', 2.0, 3.5),
    map: makeChannel(mapKpa, baseMap, 1.8, 'kPa', 2.0, 3.5),
    egt: makeChannel(egtCelsius, baseEgt, 15.0, '°C', 2.0, 3.5),
    vibration: makeChannel(vibrationG, baseVibration, 0.03, 'g', 2.0, 3.5),
  };

  // Build PipelineResult contract mirroring simengine contracts
  const pipelinePrediction: Prediction = {
    y_hat: {
      MAP: mapKpa,
      CHT: chtCelsius + 273.15, // in Kelvin for y_hat
      coolant_temp: coolantTempCelsius + 273.15,
      oil_pressure: oilPressureBar * 1e5, // Pa
      oil_temp: oilTempCelsius + 273.15,
      EGT_proxy: egtCelsius + 273.15,
      rpm: rpm,
    },
    x_hat: {
      omega_engine_rad_s: omegaEngineRadS,
      p_intake_Pa: mapKpa * 1000,
      T_coolant_K: coolantTempCelsius + 273.15,
    },
    theta_hat: {
      radiator_eff: coolingHealth / 100,
      pump_vol_eff: lubricationHealth / 100,
    },
    P_diag: {},
  };

  const pipelineResidual: Residual = {
    r: {
      MAP: channels.map.residual,
      CHT: channels.cht.residual,
      coolant_temp: channels.coolantTemp.residual,
      oil_pressure: channels.oilPressure.residual * 1e5,
      oil_temp: channels.oilTemp.residual,
      EGT_proxy: channels.egt.residual,
      rpm: channels.rpm.residual,
    },
    z: {
      MAP: channels.map.zScore,
      CHT: channels.cht.zScore,
      coolant_temp: channels.coolantTemp.zScore,
      oil_pressure: channels.oilPressure.zScore,
      oil_temp: channels.oilTemp.zScore,
      EGT_proxy: channels.egt.zScore,
      rpm: channels.rpm.zScore,
    },
    d2: Math.max(0, channels.cht.zScore ** 2 + channels.coolantTemp.zScore ** 2 + channels.oilPressure.zScore ** 2),
    S_diag: {},
    flags: {
      MAP: channels.map.flagged,
      CHT: channels.cht.flagged,
      coolant_temp: channels.coolantTemp.flagged,
      oil_pressure: channels.oilPressure.flagged,
      oil_temp: channels.oilTemp.flagged,
      EGT_proxy: channels.egt.flagged,
      rpm: channels.rpm.flagged,
    },
  };

  const pipelineDiagnosis: Diagnosis = {
    hypotheses: [
      {
        cause: topCause,
        probability: topCauseProbability,
        evidence: evidenceList,
      },
    ],
  };

  const pipelineRul: RUL = {
    component: rulComponent,
    q05_h: Math.round(rulQ50 * 0.72),
    q50_h: rulQ50,
    q95_h: Math.round(rulQ50 * 1.35),
    driver: rulDriver,
  };

  const pipelineRisk: Risk = {
    P_success: pSuccess,
    tier: riskTier,
    recommended_action: recommendedAction,
    authority: 'Crew / Ground Operator · Advisory Tier',
    health_index: healthIndex,
  };

  const pipelineResult: PipelineResult = {
    t,
    prediction: pipelinePrediction,
    residual: pipelineResidual,
    diagnosis: pipelineDiagnosis,
    rul: pipelineRul,
    risk: pipelineRisk,
  };

  return {
    timeSeconds: t,
    totalDurationSeconds,
    progress,
    phase,
    scenarioId,

    uavPosition,
    headingDeg,
    altitudeFt,
    airspeedKmh,
    totalDistanceKm,
    remainingDistanceKm,

    environment: {
      ambientTempC,
      ambientPressureHpa,
      windSpeedKts,
      windDirectionDeg,
    },

    rpm,
    propRpm,
    chtCelsius,
    oilPressureBar,
    coolantTempCelsius,
    oilTempCelsius,
    mapKpa,
    egtCelsius,
    vibrationG,
    fuelFlowGs,

    channels,

    healthIndex,
    subsystemHealth: {
      cylinderCore: cylinderHealth,
      cooling: coolingHealth,
      lubrication: lubricationHealth,
      sensors: sensorHealth,
    },

    pipelineResult,

    activeAlert,
    currentEvent,
    missionConsequence,
    recommendedAction,
  };
}
