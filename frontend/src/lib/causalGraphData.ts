import type { DeterministicMissionState } from './deterministicMission';
import type {
  CausalNodeData,
  CausalEdgeData,
  CausalRegion,
  DiagnosticCandidate,
  PropagationStep,
  ReasoningStep,
} from '../types/causalGraph';

export const REGION_CONFIG: Record<
  CausalRegion,
  { label: string; index: number; color: string; desc: string }
> = {
  evidence: {
    label: 'EVIDENCE',
    index: 0,
    color: '#06b6d4', // Cyan
    desc: 'Analytical residuals & parity deviations',
  },
  root_causes: {
    label: 'ROOT CAUSES',
    index: 1,
    color: '#f43f5e', // Rose
    desc: 'Physical initiators & boundary faults',
  },
  subsystems: {
    label: 'SUBSYSTEMS / PHYSICAL',
    index: 2,
    color: '#38bdf8', // Sky
    desc: 'Thermodynamic & mechanical subassemblies',
  },
  sensors: {
    label: 'SENSORS',
    index: 3,
    color: '#34d399', // Emerald
    desc: 'Physical instrumentation transducers',
  },
  states: {
    label: 'STATES',
    index: 4,
    color: '#fbbf24', // Amber
    desc: 'Thermodynamic deviations & degradation',
  },
  risk_rollup: {
    label: 'RISK ROLL-UP',
    index: 5,
    color: '#e11d48', // Red
    desc: 'Engine power loss & mission consequences',
  },
};

// Structural causal relationships
interface BaseEdgeDefinition {
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  relationshipType: string;
  baseWeight: number;
}

const BASE_EDGE_DEFS: BaseEdgeDefinition[] = [
  // EVIDENCE -> ROOT CAUSES
  { source: 'evid_coolant_delta', target: 'cause_cooling_blockage', sourceLabel: 'Coolant ΔT Residual', targetLabel: 'Airflow Restriction', relationshipType: 'ANOMALY_TRIGGER', baseWeight: 0.92 },
  { source: 'evid_cht_delta', target: 'cause_cht_drift', sourceLabel: 'CHT Parity Residual', targetLabel: 'Thermocouple Drift', relationshipType: 'PARITY_MISMATCH', baseWeight: 0.95 },
  { source: 'evid_oil_press_sag', target: 'cause_oil_cavitation', sourceLabel: 'Oil Pressure Deficit', targetLabel: 'Scavenge Cavitation', relationshipType: 'HYDRAULIC_SIGNATURE', baseWeight: 0.88 },

  // ROOT CAUSES -> SUBSYSTEMS / PHYSICAL
  { source: 'cause_cooling_blockage', target: 'comp_cooling', sourceLabel: 'Airflow Restriction', targetLabel: 'Hybrid Cooling System', relationshipType: 'MASS_FLOW_CHOKE', baseWeight: 0.96 },
  { source: 'cause_ambient_heat', target: 'comp_cooling', sourceLabel: 'Ambient Saturation', targetLabel: 'Hybrid Cooling System', relationshipType: 'SINK_TEMP_REDUCTION', baseWeight: 0.84 },
  { source: 'cause_oil_cavitation', target: 'comp_lubrication', sourceLabel: 'Scavenge Cavitation', targetLabel: 'Dry-Sump Lubrication', relationshipType: 'PUMP_STARVATION', baseWeight: 0.94 },

  // ROOT CAUSES -> SENSORS (direct sensor bias)
  { source: 'cause_cht_drift', target: 'sensor_cht_tc', sourceLabel: 'Thermocouple Drift', targetLabel: 'CHT Thermocouple', relationshipType: 'JUNCTION_BIAS', baseWeight: 0.98 },

  // SUBSYSTEMS -> SENSORS
  { source: 'comp_cooling', target: 'sensor_coolant_rtd', sourceLabel: 'Hybrid Cooling System', targetLabel: 'Coolant RTD Probe', relationshipType: 'INSTRUMENTATION', baseWeight: 0.98 },
  { source: 'comp_cylinder', target: 'sensor_cht_tc', sourceLabel: 'Boxer Cylinder Pairs', targetLabel: 'CHT Thermocouple', relationshipType: 'THERMAL_SENSING', baseWeight: 0.97 },
  { source: 'comp_lubrication', target: 'sensor_oil_press', sourceLabel: 'Dry-Sump Lubrication', targetLabel: 'Oil Gallery Transducer', relationshipType: 'PRESSURE_SENSING', baseWeight: 0.98 },
  { source: 'comp_lubrication', target: 'sensor_oil_temp', sourceLabel: 'Dry-Sump Lubrication', targetLabel: 'Sump Oil Thermistor', relationshipType: 'THERMAL_SENSING', baseWeight: 0.98 },
  { source: 'comp_crankcase', target: 'sensor_vibe_accel', sourceLabel: 'Split Crankcase', targetLabel: 'Triaxial Accelerometer', relationshipType: 'VIBRATION_PICKUP', baseWeight: 0.98 },
  { source: 'comp_crankcase', target: 'sensor_optical_crank', sourceLabel: 'Split Crankcase', targetLabel: 'Crank Position Hall', relationshipType: 'SPEED_PICKUP', baseWeight: 0.99 },

  // SUBSYSTEMS -> STATES (Thermodynamic & Mechanical Deviations)
  { source: 'comp_cooling', target: 'state_thermal_saturation', sourceLabel: 'Hybrid Cooling System', targetLabel: 'Head Thermal Saturation', relationshipType: 'COOLING_COLLAPSE', baseWeight: 0.95 },
  { source: 'comp_cylinder', target: 'state_thermal_saturation', sourceLabel: 'Boxer Cylinder Pairs', targetLabel: 'Head Thermal Saturation', relationshipType: 'COMBUSTION_ACCUMULATION', baseWeight: 0.92 },
  { source: 'state_thermal_saturation', target: 'state_oil_shear', sourceLabel: 'Head Thermal Saturation', targetLabel: 'Oil Viscosity Breakdown', relationshipType: 'THERMAL_BLEED', baseWeight: 0.88 },
  { source: 'comp_lubrication', target: 'state_oil_shear', sourceLabel: 'Dry-Sump Lubrication', targetLabel: 'Oil Viscosity Breakdown', relationshipType: 'FLUID_SHEAR', baseWeight: 0.90 },
  { source: 'state_oil_shear', target: 'state_bearing_starvation', sourceLabel: 'Oil Viscosity Breakdown', targetLabel: 'Hydrodynamic Film Loss', relationshipType: 'WEDGE_COLLAPSE', baseWeight: 0.94 },
  { source: 'state_thermal_saturation', target: 'state_ring_scuff', sourceLabel: 'Head Thermal Saturation', targetLabel: 'Piston Ring End-Gap Close', relationshipType: 'THERMAL_EXPANSION', baseWeight: 0.86 },
  { source: 'state_bearing_starvation', target: 'comp_crankcase', sourceLabel: 'Hydrodynamic Film Loss', targetLabel: 'Split Crankcase', relationshipType: 'JOURNAL_METAL_CONTACT', baseWeight: 0.95 },
  { source: 'state_ring_scuff', target: 'comp_crankcase', sourceLabel: 'Piston Ring End-Gap Close', targetLabel: 'Split Crankcase', relationshipType: 'BORE_DRAG', baseWeight: 0.88 },
  { source: 'comp_crankcase', target: 'state_parasitic_drag', sourceLabel: 'Split Crankcase', targetLabel: 'Parasitic Friction Drag', relationshipType: 'TORQUE_DISSIPATION', baseWeight: 0.95 },

  // SUBSYSTEMS -> SUBSYSTEMS
  { source: 'comp_cooling', target: 'comp_cylinder', sourceLabel: 'Hybrid Cooling System', targetLabel: 'Boxer Cylinder Pairs', relationshipType: 'HEAD_WATER_JACKET', baseWeight: 0.90 },
  { source: 'comp_cylinder', target: 'comp_crankcase', sourceLabel: 'Boxer Cylinder Pairs', targetLabel: 'Split Crankcase', relationshipType: 'RECIPROCATING_THRUST', baseWeight: 0.85 },
  { source: 'comp_crankcase', target: 'comp_gearbox', sourceLabel: 'Split Crankcase', targetLabel: 'Prop Reduction Unit', relationshipType: 'SHAFT_COUPLING', baseWeight: 0.92 },

  // STATES -> RISK ROLL-UP
  { source: 'state_parasitic_drag', target: 'risk_power_deficit', sourceLabel: 'Parasitic Friction Drag', targetLabel: 'Propeller Power Deficit', relationshipType: 'DRAG_DECELERATION', baseWeight: 0.94 },
  { source: 'comp_gearbox', target: 'risk_power_deficit', sourceLabel: 'Prop Reduction Unit', targetLabel: 'Propeller Power Deficit', relationshipType: 'THRUST_LOSS', baseWeight: 0.92 },
  { source: 'risk_power_deficit', target: 'risk_climb_decay', sourceLabel: 'Propeller Power Deficit', targetLabel: 'Climb Ceiling Degradation', relationshipType: 'AERODYNAMIC_LIMIT', baseWeight: 0.92 },
  { source: 'state_bearing_starvation', target: 'risk_engine_seizure', sourceLabel: 'Hydrodynamic Film Loss', targetLabel: 'Catastrophic Journal Seizure', relationshipType: 'ADHESIVE_WEAR', baseWeight: 0.96 },
  { source: 'risk_engine_seizure', target: 'risk_emergency_rtb', sourceLabel: 'Catastrophic Journal Seizure', targetLabel: 'Mandatory Emergency RTB', relationshipType: 'CRITICAL_DIRECTIVE', baseWeight: 0.98 },
  { source: 'cause_cht_drift', target: 'risk_mission_continue', sourceLabel: 'Thermocouple Drift', targetLabel: 'Mission Continue (Isolated)', relationshipType: 'PARITY_CLEARANCE', baseWeight: 0.96 },
];

import type { MaintenanceRecord } from '../types/maintenance';

export function buildCausalTopology(
  mission: DeterministicMissionState,
  appliedInterventions?: MaintenanceRecord[],
  forceBaseline = false,
): {
  nodes: CausalNodeData[];
  edges: CausalEdgeData[];
} {
  const { scenarioId, timeSeconds, channels, subsystemHealth } = mission;
  const isReconciled = !forceBaseline && mission.activeAlert.code.includes('RECONCILED');

  // Scenario-specific progression weights
  let coolingSeverity = 0.02;
  let ambientSeverity = 0.02;
  let cavitationSeverity = 0.02;
  let sensorFaultSeverity = 0.02;

  if (!isReconciled) {
    if (scenarioId === 'cascade') {
      if (timeSeconds >= 20) {
        coolingSeverity = Math.min((timeSeconds - 20) / 25, 1.0);
      }
    } else if (scenarioId === 'thermal') {
      if (timeSeconds >= 15) {
        ambientSeverity = Math.min((timeSeconds - 15) / 30, 0.95);
      }
    } else if (scenarioId === 'lubrication') {
      if (timeSeconds >= 20) {
        cavitationSeverity = Math.min((timeSeconds - 20) / 20, 0.98);
      }
    } else if (scenarioId === 'sensor') {
      if (timeSeconds >= 40) {
        sensorFaultSeverity = 0.98;
      }
    }
  }

  // 1. REGION 0: EVIDENCE
  const nodes: CausalNodeData[] = [
    {
      id: 'evid_coolant_delta',
      label: 'Coolant ΔT Residual',
      region: 'evidence',
      regionIndex: 0,
      subType: 'Residual Anomaly',
      functionDescription: 'Calculated deviation between physical RTD probe and closed-form thermal model expectation.',
      stateDescription:
        channels.coolantTemp.residual > 15
          ? `Thermal model departure: Δ +${channels.coolantTemp.residual}°C (z=${channels.coolantTemp.zScore}). Residual threshold tripped.`
          : 'Residual within 2σ nominal bounding interval.',
      health: channels.coolantTemp.residual > 20 ? 30 : channels.coolantTemp.residual > 5 ? 65 : 100,
      criticality: channels.coolantTemp.status,
      activation: channels.coolantTemp.residual > 20 ? 0.95 : channels.coolantTemp.residual > 5 ? 0.55 : 0.05,
      telemetry: [{ label: 'Coolant Residual', value: `+${channels.coolantTemp.residual}`, unit: '°C', delta: `z=${channels.coolantTemp.zScore}`, status: channels.coolantTemp.status }],
      evidence: `CUSUM detector tripped: cumulative drift +${channels.coolantTemp.residual}°C above continuous model baseline.`,
      upstreamDependencies: [],
      downstreamEffects: ['Airflow Restriction'],
    },
    {
      id: 'evid_cht_delta',
      label: 'CHT Parity Residual',
      region: 'evidence',
      regionIndex: 0,
      subType: 'Analytical Redundancy',
      functionDescription: 'Cross-channel parity space residual checking head temperature against coolant & EGT correlation.',
      stateDescription:
        scenarioId === 'sensor' && timeSeconds >= 40
          ? 'Parity space residual z=+4.8σ: single-channel divergence without thermodynamic correlation.'
          : channels.cht.residual > 15
          ? `Physically correlated CHT elevation: Δ +${channels.cht.residual}°C (z=${channels.cht.zScore}).`
          : 'Multi-channel thermodynamic parity verified.',
      health: scenarioId === 'sensor' && timeSeconds >= 40 ? 35 : channels.cht.status === 'critical' ? 35 : 100,
      criticality: scenarioId === 'sensor' && timeSeconds >= 40 ? 'sensor_fault' : channels.cht.status,
      activation: scenarioId === 'sensor' && timeSeconds >= 40 ? 0.98 : channels.cht.residual > 20 ? 0.92 : 0.05,
      telemetry: [{ label: 'CHT Residual', value: `+${channels.cht.residual}`, unit: '°C', delta: `z=${channels.cht.zScore}`, status: scenarioId === 'sensor' && timeSeconds >= 40 ? 'sensor_fault' : channels.cht.status }],
      evidence: scenarioId === 'sensor' && timeSeconds >= 40 ? 'Parity vector orthogonal to physical engine state.' : `Direct heat flux signature: +${channels.cht.residual}°C.`,
      upstreamDependencies: [],
      downstreamEffects: ['Thermocouple Drift'],
    },
    {
      id: 'evid_oil_press_sag',
      label: 'Oil Pressure Deficit',
      region: 'evidence',
      regionIndex: 0,
      subType: 'Hydraulic Residual',
      functionDescription: 'Normalized residual tracking oil gallery pressure relative to engine RPM and oil temperature.',
      stateDescription:
        channels.oilPressure.status === 'critical'
          ? `Severe pressure departure: ${channels.oilPressure.residual} bar (z=${channels.oilPressure.zScore}). Hydrodynamic buffer lost.`
          : channels.oilPressure.status === 'warning'
          ? `Pressure sag detected: ${channels.oilPressure.residual} bar.`
          : 'Gallery pressure tracking expected speed-governed curve.',
      health: channels.oilPressure.status === 'critical' ? 25 : channels.oilPressure.status === 'warning' ? 60 : 100,
      criticality: channels.oilPressure.status,
      activation: channels.oilPressure.status === 'critical' ? 0.95 : channels.oilPressure.status === 'warning' ? 0.5 : 0.05,
      telemetry: [{ label: 'Pressure Residual', value: `${channels.oilPressure.residual}`, unit: 'bar', delta: `z=${channels.oilPressure.zScore}`, status: channels.oilPressure.status }],
      evidence: `Transducer residual exceeds -3σ critical threshold (${channels.oilPressure.current} bar vs 4.5 bar expected).`,
      upstreamDependencies: [],
      downstreamEffects: ['Scavenge Cavitation'],
    },

    // 2. REGION 1: ROOT CAUSES
    {
      id: 'cause_cooling_blockage',
      label: 'Airflow Restriction',
      region: 'root_causes',
      regionIndex: 1,
      subType: 'Aerodynamic Restriction',
      functionDescription: 'Foreign object debris or cowl inlet shutter restriction choking ram-air mass flow through radiator.',
      stateDescription:
        coolingSeverity > 0.6
          ? 'Severe frontal radiator duct obstruction (>70% air mass flow reduction).'
          : coolingSeverity > 0.2
          ? 'Moderate ram-air boundary layer restriction.'
          : 'Radiator air ducting open; continuous ram-air mass flow nominal.',
      health: Math.round(100 - coolingSeverity * 70),
      criticality: coolingSeverity > 0.6 ? 'critical' : coolingSeverity > 0.3 ? 'warning' : 'nominal',
      activation: coolingSeverity,
      telemetry: [{ label: 'Ram-Air Mass Flow', value: coolingSeverity > 0.5 ? '0.38' : '1.42', unit: 'kg/s', delta: coolingSeverity > 0.5 ? '-73%' : '0%', status: coolingSeverity > 0.5 ? 'critical' : 'nominal' }],
      evidence: coolingSeverity > 0.5 ? 'Coolant ΔT across core collapsed to 2.4°C (nominal 18.0°C).' : 'Normal core thermal gradient.',
      upstreamDependencies: ['Coolant ΔT Residual'],
      downstreamEffects: ['Hybrid Cooling System'],
    },
    {
      id: 'cause_ambient_heat',
      label: 'Ambient Saturation',
      region: 'root_causes',
      regionIndex: 1,
      subType: 'Atmospheric Boundary',
      functionDescription: 'High ambient temperature condition exhausting thermal dissipation buffer of heat exchangers.',
      stateDescription: ambientSeverity > 0.4 ? 'Elevated atmospheric temperature reducing heat sink ΔT.' : 'Standard ISA atmospheric conditions.',
      health: Math.round(100 - ambientSeverity * 50),
      criticality: ambientSeverity > 0.5 ? 'warning' : 'nominal',
      activation: ambientSeverity,
      telemetry: [{ label: 'Ambient Temperature', value: ambientSeverity > 0.4 ? '+38.5' : '+15.0', unit: '°C', delta: ambientSeverity > 0.4 ? '+23.5°C' : '0.0°C', status: ambientSeverity > 0.4 ? 'warning' : 'nominal' }],
      evidence: ambientSeverity > 0.4 ? 'External convective cooling boundary margin eroded.' : 'Ambient within nominal envelope.',
      upstreamDependencies: [],
      downstreamEffects: ['Hybrid Cooling System'],
    },
    {
      id: 'cause_oil_cavitation',
      label: 'Scavenge Cavitation',
      region: 'root_causes',
      regionIndex: 1,
      subType: 'Hydraulic Flaw',
      functionDescription: 'Mechanical aeration or pressure relief bypass fault in dry-sump scavenge pump circuit.',
      stateDescription: cavitationSeverity > 0.4 ? 'Suction port vapor pocketing causing volumetric oil delivery collapse.' : 'Dry-sump scavenge pump drawing steady oil volume.',
      health: Math.round(100 - cavitationSeverity * 70),
      criticality: cavitationSeverity > 0.6 ? 'critical' : cavitationSeverity > 0.3 ? 'warning' : 'nominal',
      activation: cavitationSeverity,
      telemetry: [{ label: 'Suction Inlet Pressure', value: cavitationSeverity > 0.4 ? '0.45' : '1.10', unit: 'bar abs', delta: cavitationSeverity > 0.4 ? '-59%' : '0%', status: cavitationSeverity > 0.4 ? 'critical' : 'nominal' }],
      evidence: cavitationSeverity > 0.4 ? 'High frequency acoustic cavitation signature at scavenge housing.' : 'Nominal pump acoustics.',
      upstreamDependencies: ['Oil Pressure Deficit'],
      downstreamEffects: ['Dry-Sump Lubrication'],
    },
    {
      id: 'cause_cht_drift',
      label: 'Thermocouple Drift',
      region: 'root_causes',
      regionIndex: 1,
      subType: 'Instrumentation Failure',
      functionDescription: 'Cold-junction reference offset, shielding leakage, or physical thermocouple oxidation creating false positive.',
      stateDescription: sensorFaultSeverity > 0.5 ? 'Synthetic sensor bias applied without physical thermodynamic correlation.' : 'Thermocouple Seebeck voltage accurately calibrated.',
      health: sensorFaultSeverity > 0.5 ? 40 : 100,
      criticality: sensorFaultSeverity > 0.5 ? 'sensor_fault' : 'nominal',
      activation: sensorFaultSeverity,
      telemetry: [{ label: 'Seebeck Voltage', value: sensorFaultSeverity > 0.5 ? '6.12' : '4.24', unit: 'mV', delta: sensorFaultSeverity > 0.5 ? '+1.88 mV' : '0.0 mV', status: sensorFaultSeverity > 0.5 ? 'sensor_fault' : 'nominal' }],
      evidence: sensorFaultSeverity > 0.5 ? 'Zero correlation with coolant temperature (84°C) or EGT (710°C).' : 'Full multi-channel consistency.',
      upstreamDependencies: ['CHT Parity Residual'],
      downstreamEffects: ['CHT Thermocouple', 'Mission Continue (Isolated)'],
    },

    // 3. REGION 2: SUBSYSTEMS / PHYSICAL
    {
      id: 'comp_cooling',
      label: 'Hybrid Cooling System',
      region: 'subsystems',
      regionIndex: 2,
      subType: 'Thermal Management',
      functionDescription: 'Circulates 50/50 water-glycol through heads and routes air over finned cylinder barrels.',
      stateDescription:
        subsystemHealth.cooling < 60
          ? 'Thermal saturation boundary breached; coolant boiling imminent.'
          : subsystemHealth.cooling < 80
          ? 'Heat dissipation rate degrading below heat generation rate.'
          : 'Nominal coolant circulation and ram-air thermal rejection.',
      health: subsystemHealth.cooling,
      criticality: subsystemHealth.cooling < 60 ? 'critical' : subsystemHealth.cooling < 80 ? 'warning' : 'nominal',
      activation: (100 - subsystemHealth.cooling) / 100,
      telemetry: [{ label: 'Coolant Temp', value: `${channels.coolantTemp.current}`, unit: '°C', delta: `Δ +${channels.coolantTemp.residual}°C`, status: channels.coolantTemp.status }],
      evidence: `Coolant manifold reading ${channels.coolantTemp.current}°C (${channels.coolantTemp.status.toUpperCase()}).`,
      upstreamDependencies: ['Airflow Restriction', 'Ambient Saturation'],
      downstreamEffects: ['Coolant RTD Probe', 'Head Thermal Saturation', 'Boxer Cylinder Pairs'],
    },
    {
      id: 'comp_cylinder',
      label: 'Boxer Cylinder Pairs',
      region: 'subsystems',
      regionIndex: 2,
      subType: 'Thermodynamic Core',
      functionDescription: 'Opposed aluminium cylinders housing combustion chambers, valves, and reciprocating pistons.',
      stateDescription:
        subsystemHealth.cylinderCore < 50
          ? 'Thermal limit breach; ring clearance collapsed, cylinder head thermal distortion.'
          : subsystemHealth.cylinderCore < 75
          ? 'Thermal buffer depleted; elevated cylinder head wall temperatures.'
          : 'Nominal combustion chamber temperatures and structural clearances.',
      health: subsystemHealth.cylinderCore,
      criticality: subsystemHealth.cylinderCore < 50 ? 'critical' : subsystemHealth.cylinderCore < 75 ? 'warning' : 'nominal',
      activation: (100 - subsystemHealth.cylinderCore) / 100,
      telemetry: [
        { label: 'Cylinder Head Temp', value: `${channels.cht.current}`, unit: '°C', delta: `Δ +${channels.cht.residual}°C`, status: channels.cht.status },
        { label: 'Exhaust Gas Temp', value: `${channels.egt.current}`, unit: '°C', delta: `Δ +${channels.egt.residual}°C`, status: channels.egt.status },
      ],
      evidence: `CHT at ${channels.cht.current}°C with residual Δ+${channels.cht.residual}°C.`,
      upstreamDependencies: ['Hybrid Cooling System'],
      downstreamEffects: ['CHT Thermocouple', 'Head Thermal Saturation', 'Split Crankcase'],
    },
    {
      id: 'comp_lubrication',
      label: 'Dry-Sump Lubrication',
      region: 'subsystems',
      regionIndex: 2,
      subType: 'Fluid Mechanics',
      functionDescription: 'Pressurized multi-stage oil circuit delivering hydrodynamic lubricant to bearings and wrist pins.',
      stateDescription:
        subsystemHealth.lubrication < 50
          ? 'Boundary lubrication regime; hydrodynamic film collapsed across main bearings.'
          : subsystemHealth.lubrication < 80
          ? 'Oil gallery pressure sag and viscosity degradation under heat.'
          : 'Pressurized hydrodynamic fluid separation nominal.',
      health: subsystemHealth.lubrication,
      criticality: subsystemHealth.lubrication < 50 ? 'critical' : subsystemHealth.lubrication < 80 ? 'warning' : 'nominal',
      activation: (100 - subsystemHealth.lubrication) / 100,
      telemetry: [
        { label: 'Oil Pressure', value: `${channels.oilPressure.current}`, unit: 'bar', delta: `Δ ${channels.oilPressure.residual}b`, status: channels.oilPressure.status },
        { label: 'Oil Temperature', value: `${channels.oilTemp.current}`, unit: '°C', delta: `Δ +${channels.oilTemp.residual}°C`, status: channels.oilTemp.status },
      ],
      evidence: `Oil pressure at ${channels.oilPressure.current} bar (nominal 4.5 bar).`,
      upstreamDependencies: ['Scavenge Cavitation'],
      downstreamEffects: ['Oil Gallery Transducer', 'Sump Oil Thermistor', 'Oil Viscosity Breakdown'],
    },
    {
      id: 'comp_crankcase',
      label: 'Split Crankcase',
      region: 'subsystems',
      regionIndex: 2,
      subType: 'Power Section',
      functionDescription: 'Forged steel counterweighted crankshaft supported by split aluminium alloy main bearing saddles.',
      stateDescription:
        channels.vibration.status === 'critical'
          ? 'Micro-scuffing and high parasitic mechanical drag on crankshaft journals.'
          : channels.vibration.status === 'warning'
          ? 'Elevated torsional harmonic vibration from thermal asymmetry.'
          : 'Smooth rotational dynamics and rigid structural alignment.',
      health: channels.vibration.status === 'critical' ? 38 : channels.vibration.status === 'warning' ? 68 : 98,
      criticality: channels.vibration.status,
      activation: channels.vibration.status === 'critical' ? 0.94 : channels.vibration.status === 'warning' ? 0.45 : 0.05,
      telemetry: [
        { label: 'Crankshaft Vibration', value: `${channels.vibration.current.toFixed(2)}`, unit: 'g RMS', delta: `z=${channels.vibration.zScore}`, status: channels.vibration.status },
        { label: 'Engine Speed', value: `${channels.rpm.current}`, unit: 'RPM', delta: `Δ ${channels.rpm.residual}`, status: channels.rpm.status },
      ],
      evidence: `Vibration at ${channels.vibration.current.toFixed(2)}g (${channels.vibration.status.toUpperCase()}).`,
      upstreamDependencies: ['Boxer Cylinder Pairs', 'Hydrodynamic Film Loss', 'Piston Ring End-Gap Close'],
      downstreamEffects: ['Triaxial Accelerometer', 'Crank Position Hall', 'Parasitic Friction Drag', 'Prop Reduction Unit'],
    },
    {
      id: 'comp_gearbox',
      label: 'Prop Reduction Unit',
      region: 'subsystems',
      regionIndex: 2,
      subType: 'Drivetrain',
      functionDescription: 'Helical gear speed reduction unit (2.43:1 ratio) with torsional slipper clutch damper.',
      stateDescription:
        channels.rpm.status === 'critical'
          ? 'Propeller speed degraded; output shaft torque depressed by upstream core drag.'
          : 'Nominal 2.43:1 speed reduction maintaining propeller aerodynamic blade efficiency.',
      health: channels.rpm.status === 'critical' ? 58 : 96,
      criticality: channels.rpm.status,
      activation: channels.rpm.status === 'critical' ? 0.85 : channels.rpm.status === 'warning' ? 0.4 : 0.05,
      telemetry: [{ label: 'Propeller Shaft RPM', value: `${Math.round(channels.rpm.current / 2.43)}`, unit: 'RPM', delta: '÷2.43', status: channels.rpm.status }],
      evidence: `Propeller speed depressed to ${Math.round(channels.rpm.current / 2.43)} RPM.`,
      upstreamDependencies: ['Split Crankcase'],
      downstreamEffects: ['Propeller Power Deficit'],
    },

    // 4. REGION 3: SENSORS
    {
      id: 'sensor_coolant_rtd',
      label: 'Coolant RTD Probe',
      region: 'sensors',
      regionIndex: 3,
      subType: 'RTD Sensor',
      functionDescription: 'Dual-element platinum RTD immersed in water-pump discharge manifold.',
      stateDescription: `Manifold probe reporting ${channels.coolantTemp.current}°C (${channels.coolantTemp.status}).`,
      health: channels.coolantTemp.status === 'critical' ? 50 : channels.coolantTemp.status === 'warning' ? 75 : 100,
      criticality: channels.coolantTemp.status,
      activation: channels.coolantTemp.status === 'critical' ? 0.9 : channels.coolantTemp.status === 'warning' ? 0.5 : 0.05,
      telemetry: [{ label: 'Probe Reading', value: `${channels.coolantTemp.current}`, unit: '°C', delta: `Δ +${channels.coolantTemp.residual}°C`, status: channels.coolantTemp.status }],
      evidence: `Measured resistance: 144.2 Ω (corresponds to ${channels.coolantTemp.current}°C).`,
      upstreamDependencies: ['Hybrid Cooling System'],
      downstreamEffects: [],
    },
    {
      id: 'sensor_cht_tc',
      label: 'CHT Thermocouple',
      region: 'sensors',
      regionIndex: 3,
      subType: 'Thermocouple',
      functionDescription: 'Chromel-alumel grounded junction spark-plug ring thermocouple on cylinder head #1.',
      stateDescription:
        scenarioId === 'sensor' && timeSeconds >= 40
          ? 'Sensor fault flagged: 152°C reading violates multi-channel thermodynamic continuity.'
          : `Reading ${channels.cht.current}°C (${channels.cht.status}).`,
      health: scenarioId === 'sensor' && timeSeconds >= 40 ? 30 : channels.cht.status === 'critical' ? 50 : 100,
      criticality: scenarioId === 'sensor' && timeSeconds >= 40 ? 'sensor_fault' : channels.cht.status,
      activation: channels.cht.status === 'critical' || (scenarioId === 'sensor' && timeSeconds >= 40) ? 0.95 : 0.05,
      telemetry: [{ label: 'Thermocouple Reading', value: `${channels.cht.current}`, unit: '°C', delta: `Δ +${channels.cht.residual}°C`, status: scenarioId === 'sensor' && timeSeconds >= 40 ? 'sensor_fault' : channels.cht.status }],
      evidence: scenarioId === 'sensor' && timeSeconds >= 40 ? 'Sensor fault: Parity space residual magnitude z=+4.8 without coolant coupling.' : `Direct physical heat signature: ${channels.cht.current}°C.`,
      upstreamDependencies: ['Boxer Cylinder Pairs', 'Thermocouple Drift'],
      downstreamEffects: [],
    },
    {
      id: 'sensor_oil_press',
      label: 'Oil Gallery Transducer',
      region: 'sensors',
      regionIndex: 3,
      subType: 'Piezoresistive Transducer',
      functionDescription: 'Wheatstone bridge piezoresistive silicon diaphragm measuring engine oil gallery pressure.',
      stateDescription: `Gallery pressure measured at ${channels.oilPressure.current} bar (${channels.oilPressure.status}).`,
      health: channels.oilPressure.status === 'critical' ? 45 : channels.oilPressure.status === 'warning' ? 70 : 100,
      criticality: channels.oilPressure.status,
      activation: channels.oilPressure.status === 'critical' ? 0.92 : channels.oilPressure.status === 'warning' ? 0.5 : 0.05,
      telemetry: [{ label: 'Transducer Output', value: `${channels.oilPressure.current}`, unit: 'bar', delta: `Δ ${channels.oilPressure.residual}b`, status: channels.oilPressure.status }],
      evidence: `Transducer output voltage dropped to ${((channels.oilPressure.current / 6) * 4 + 0.5).toFixed(2)}V.`,
      upstreamDependencies: ['Dry-Sump Lubrication'],
      downstreamEffects: [],
    },
    {
      id: 'sensor_oil_temp',
      label: 'Sump Oil Thermistor',
      region: 'sensors',
      regionIndex: 3,
      subType: 'NTC Thermistor',
      functionDescription: 'Negative temperature coefficient thermistor probe mounted in dry-sump oil tank base.',
      stateDescription: `Sump oil temperature measured at ${channels.oilTemp.current}°C (${channels.oilTemp.status}).`,
      health: channels.oilTemp.status === 'critical' ? 50 : channels.oilTemp.status === 'warning' ? 75 : 100,
      criticality: channels.oilTemp.status,
      activation: channels.oilTemp.status === 'critical' ? 0.88 : channels.oilTemp.status === 'warning' ? 0.45 : 0.05,
      telemetry: [{ label: 'NTC Resistance', value: `${channels.oilTemp.current}`, unit: '°C', delta: `Δ +${channels.oilTemp.residual}°C`, status: channels.oilTemp.status }],
      evidence: `Thermistor resistance decreased to 312 Ω (nominal 820 Ω at 80°C).`,
      upstreamDependencies: ['Dry-Sump Lubrication'],
      downstreamEffects: [],
    },
    {
      id: 'sensor_optical_crank',
      label: 'Crank Position Hall',
      region: 'sensors',
      regionIndex: 3,
      subType: 'Hall Sensor',
      functionDescription: 'High-speed 60-2 trigger wheel optical/Hall-effect crank pulse sensor providing precise RPM.',
      stateDescription: `Engine speed measured at ${channels.rpm.current} RPM (${channels.rpm.status}).`,
      health: channels.rpm.status === 'critical' ? 60 : 100,
      criticality: channels.rpm.status,
      activation: channels.rpm.status === 'critical' ? 0.9 : channels.rpm.status === 'warning' ? 0.4 : 0.05,
      telemetry: [{ label: 'Pulse Frequency', value: `${channels.rpm.current}`, unit: 'RPM', delta: `Δ ${channels.rpm.residual}`, status: channels.rpm.status }],
      evidence: `Crank trigger frequency degraded from 5500 RPM nominal baseline to ${channels.rpm.current} RPM.`,
      upstreamDependencies: ['Split Crankcase'],
      downstreamEffects: [],
    },
    {
      id: 'sensor_vibe_accel',
      label: 'Triaxial Accelerometer',
      region: 'sensors',
      regionIndex: 3,
      subType: 'MEMS Accelerometer',
      functionDescription: 'Case-mounted high-bandwidth piezoelectric crystal sensing radial and torsional shock harmonics.',
      stateDescription: `Vibration acceleration measured at ${channels.vibration.current.toFixed(2)}g (${channels.vibration.status}).`,
      health: channels.vibration.status === 'critical' ? 40 : 100,
      criticality: channels.vibration.status,
      activation: channels.vibration.status === 'critical' ? 0.95 : channels.vibration.status === 'warning' ? 0.45 : 0.05,
      telemetry: [{ label: 'Vibration Signal', value: `${channels.vibration.current.toFixed(2)}`, unit: 'g RMS', delta: `z=${channels.vibration.zScore}`, status: channels.vibration.status }],
      evidence: `High frequency spectrum shows prominent peaks at 183 Hz (2nd engine order harmonic).`,
      upstreamDependencies: ['Split Crankcase'],
      downstreamEffects: [],
    },

    // 5. REGION 4: STATES (Physical Deviations & Secondary Failure Mechanisms)
    {
      id: 'state_thermal_saturation',
      label: 'Head Thermal Saturation',
      region: 'states',
      regionIndex: 4,
      subType: 'Thermodynamic State',
      functionDescription: 'Thermal boundary saturation where cylinder head heat generation exceeds heat exchanger dissipation.',
      stateDescription:
        channels.coolantTemp.current >= 115
          ? 'Phase change boiling at cylinder exhaust bridge; heat transferred directly to oil passages.'
          : channels.coolantTemp.current >= 98
          ? 'Thermal buffer depleted; coolant operating outside optimal 80-90°C band.'
          : 'Coolant circulation nominal; ram-air radiator dissipating thermal combustion flux.',
      health: channels.coolantTemp.current >= 115 ? 28 : channels.coolantTemp.current >= 98 ? 62 : 100,
      criticality: channels.coolantTemp.current >= 115 ? 'critical' : channels.coolantTemp.current >= 98 ? 'warning' : 'nominal',
      activation: channels.coolantTemp.current >= 115 ? 0.96 : channels.coolantTemp.current >= 98 ? 0.52 : 0.05,
      telemetry: [{ label: 'Thermal Bleed Flux', value: channels.coolantTemp.current >= 115 ? '14.8' : '1.2', unit: 'kW', delta: channels.coolantTemp.current >= 115 ? '+1130%' : '0%', status: channels.coolantTemp.current >= 115 ? 'critical' : 'nominal' }],
      evidence: 'Rapid oil temperature escalation coupled to coolant saturation spike.',
      upstreamDependencies: ['Hybrid Cooling System', 'Boxer Cylinder Pairs'],
      downstreamEffects: ['Oil Viscosity Breakdown', 'Piston Ring End-Gap Close'],
    },
    {
      id: 'state_oil_shear',
      label: 'Oil Viscosity Breakdown',
      region: 'states',
      regionIndex: 4,
      subType: 'Fluid State',
      functionDescription: 'Kinematic viscosity thinning below SAE 15W-50 minimum hydrodynamic boundary rating under thermal stress.',
      stateDescription:
        channels.oilTemp.current >= 120
          ? 'Kinematic viscosity collapsed to 5.2 cSt (nominal 18.5 cSt); severe oil foam aeration.'
          : channels.oilTemp.current >= 105
          ? 'Viscosity thinning to 11.4 cSt; elevated thermal shearing.'
          : 'Kinematic viscosity stable at 17.8 cSt with adequate film boundary strength.',
      health: channels.oilTemp.current >= 120 ? 32 : channels.oilTemp.current >= 105 ? 68 : 100,
      criticality: channels.oilTemp.current >= 120 ? 'critical' : channels.oilTemp.current >= 105 ? 'warning' : 'nominal',
      activation: channels.oilTemp.current >= 120 ? 0.94 : channels.oilTemp.current >= 105 ? 0.48 : 0.05,
      telemetry: [{ label: 'Kinematic Viscosity', value: channels.oilTemp.current >= 120 ? '5.2' : '17.8', unit: 'cSt', delta: channels.oilTemp.current >= 120 ? '-71%' : '0%', status: channels.oilTemp.current >= 120 ? 'critical' : 'nominal' }],
      evidence: 'Viscosity breakdown directly correlates to gallery pressure collapse.',
      upstreamDependencies: ['Head Thermal Saturation', 'Dry-Sump Lubrication'],
      downstreamEffects: ['Hydrodynamic Film Loss'],
    },
    {
      id: 'state_bearing_starvation',
      label: 'Hydrodynamic Film Loss',
      region: 'states',
      regionIndex: 4,
      subType: 'Tribological State',
      functionDescription: 'Collapse of pressurized hydrodynamic fluid wedge separating spinning crankshaft journals from bearing shells.',
      stateDescription:
        channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical'
          ? 'Full fluid film loss; metal-to-metal boundary contact across main journal #2 and #3.'
          : 'Continuous fluid film separation across all crankshaft main and rod bearings.',
      health: channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical' ? 18 : 98,
      criticality: channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical' ? 'critical' : 'nominal',
      activation: channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical' ? 0.98 : 0.05,
      telemetry: [{ label: 'Minimum Film Thickness', value: channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical' ? '0.4' : '4.8', unit: 'μm', delta: channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical' ? '-92%' : '0%', status: channels.oilPressure.current < 2.0 && channels.vibration.status === 'critical' ? 'critical' : 'nominal' }],
      evidence: 'Hydrodynamic film thickness dropped below peak surface roughness asperities.',
      upstreamDependencies: ['Oil Viscosity Breakdown'],
      downstreamEffects: ['Split Crankcase', 'Catastrophic Journal Seizure'],
    },
    {
      id: 'state_ring_scuff',
      label: 'Piston Ring End-Gap Close',
      region: 'states',
      regionIndex: 4,
      subType: 'Mechanical Clearance',
      functionDescription: 'Thermal growth closing reciprocating piston ring end-gaps, leading to bore scuffing.',
      stateDescription:
        channels.cht.current >= 142 && scenarioId !== 'sensor'
          ? 'Piston ring end-gap closure (0.04mm); ring scuffing against cylinder barrel.'
          : 'Piston ring end-gaps nominal (0.35mm); full reciprocating seal maintained.',
      health: channels.cht.current >= 142 && scenarioId !== 'sensor' ? 30 : 98,
      criticality: channels.cht.current >= 142 && scenarioId !== 'sensor' ? 'critical' : 'nominal',
      activation: channels.cht.current >= 142 && scenarioId !== 'sensor' ? 0.88 : 0.05,
      telemetry: [{ label: 'Piston Ring End Gap', value: channels.cht.current >= 142 && scenarioId !== 'sensor' ? '0.04' : '0.35', unit: 'mm', delta: channels.cht.current >= 142 && scenarioId !== 'sensor' ? '-88%' : '0%', status: channels.cht.current >= 142 && scenarioId !== 'sensor' ? 'critical' : 'nominal' }],
      evidence: 'Thermal growth calculations indicate ring binding risk under prolonged >140°C CHT.',
      upstreamDependencies: ['Head Thermal Saturation'],
      downstreamEffects: ['Split Crankcase'],
    },
    {
      id: 'state_parasitic_drag',
      label: 'Parasitic Friction Drag',
      region: 'states',
      regionIndex: 4,
      subType: 'Mechanical Drag',
      functionDescription: 'Kinetic power dissipation converting shaft rotational torque into adhesive friction heat.',
      stateDescription:
        channels.rpm.status === 'critical'
          ? 'Parasitic friction torque absorbing 18.5 kW of engine shaft power; 680 RPM lost.'
          : 'Mechanical internal friction within normal 4-stroke boundary limits (<2.5 kW).',
      health: channels.rpm.status === 'critical' ? 35 : 98,
      criticality: channels.rpm.status,
      activation: channels.rpm.status === 'critical' ? 0.95 : channels.rpm.status === 'warning' ? 0.45 : 0.05,
      telemetry: [{ label: 'Parasitic Drag Power', value: channels.rpm.status === 'critical' ? '18.5' : '2.1', unit: 'kW', delta: channels.rpm.status === 'critical' ? '+780%' : '0%', status: channels.rpm.status }],
      evidence: `RPM sag to ${channels.rpm.current} without throttle reduction proves heavy mechanical drag.`,
      upstreamDependencies: ['Split Crankcase'],
      downstreamEffects: ['Propeller Power Deficit'],
    },

    // 6. REGION 5: RISK ROLL-UP
    {
      id: 'risk_power_deficit',
      label: 'Propeller Power Deficit',
      region: 'risk_rollup',
      regionIndex: 5,
      subType: 'Power Degradation',
      functionDescription: 'Loss of available propeller aerodynamic shaft power due to internal core drag.',
      stateDescription:
        channels.rpm.status === 'critical' || channels.rpm.status === 'warning'
          ? 'Net thrust output dropped by 18-24%; airspeed decaying towards minimum stall margin.'
          : 'Full rated propeller aerodynamic thrust available across entire flight envelope.',
      health: channels.rpm.status === 'critical' ? 48 : channels.rpm.status === 'warning' ? 72 : 98,
      criticality: channels.rpm.status,
      activation: channels.rpm.status === 'critical' ? 0.92 : channels.rpm.status === 'warning' ? 0.45 : 0.05,
      telemetry: [{ label: 'Net Thrust Output', value: channels.rpm.status === 'critical' ? '310' : '480', unit: 'N', delta: channels.rpm.status === 'critical' ? '-35%' : '0%', status: channels.rpm.status }],
      evidence: 'Propeller RPM deficit directly limits climb performance.',
      upstreamDependencies: ['Parasitic Friction Drag', 'Prop Reduction Unit'],
      downstreamEffects: ['Climb Ceiling Degradation'],
    },
    {
      id: 'risk_climb_decay',
      label: 'Climb Ceiling Degradation',
      region: 'risk_rollup',
      regionIndex: 5,
      subType: 'Flight Envelope Risk',
      functionDescription: 'Reduction in maximum altitude maintainable under single-engine thrust deficit.',
      stateDescription:
        channels.rpm.status === 'critical'
          ? 'UAV incapable of maintaining cruise altitude at current weight; positive climb rate lost.'
          : 'Full UAV climb performance envelope and service ceiling available.',
      health: channels.rpm.status === 'critical' ? 38 : 100,
      criticality: channels.rpm.status,
      activation: channels.rpm.status === 'critical' ? 0.94 : channels.rpm.status === 'warning' ? 0.4 : 0.05,
      telemetry: [{ label: 'Vertical Speed Capacity', value: channels.rpm.status === 'critical' ? '-0.8' : '+3.4', unit: 'm/s', delta: channels.rpm.status === 'critical' ? 'Deficit' : 'Nominal', status: channels.rpm.status }],
      evidence: 'Engine speed deficit results in altitude decay unless nose-down attitude commanded.',
      upstreamDependencies: ['Propeller Power Deficit'],
      downstreamEffects: [],
    },
    {
      id: 'risk_engine_seizure',
      label: 'Catastrophic Journal Seizure',
      region: 'risk_rollup',
      regionIndex: 5,
      subType: 'Catastrophic Risk',
      functionDescription: 'Immediate danger of complete rotational locking from bearing friction weld.',
      stateDescription:
        channels.vibration.status === 'critical'
          ? 'Severe bearing material smearing; catastrophic engine seizure imminent within 10-15 minutes.'
          : 'Zero metal-to-metal wear; hydrodynamic journal surface polish intact.',
      health: channels.vibration.status === 'critical' ? 20 : 100,
      criticality: channels.vibration.status,
      activation: channels.vibration.status === 'critical' ? 0.98 : 0.05,
      telemetry: [{ label: 'Cumulative Journal Wear', value: channels.vibration.status === 'critical' ? '84.0' : '0.4', unit: 'μm', delta: channels.vibration.status === 'critical' ? 'Severe' : 'Nominal', status: channels.vibration.status }],
      evidence: 'High-amplitude accelerometer signature indicates irregular metal-to-metal contact.',
      upstreamDependencies: ['Hydrodynamic Film Loss'],
      downstreamEffects: ['Mandatory Emergency RTB'],
    },
    {
      id: 'risk_emergency_rtb',
      label: 'Mandatory Emergency RTB',
      region: 'risk_rollup',
      regionIndex: 5,
      subType: 'Operational Directive',
      functionDescription: 'Immediate operational recovery directive to prevent aircraft hull loss.',
      stateDescription:
        channels.vibration.status === 'critical' || channels.oilPressure.status === 'critical'
          ? 'EMERGENCY: Immediate RTB execution required to prevent total engine seizure in flight.'
          : 'No abort or emergency directives active.',
      health: channels.vibration.status === 'critical' || channels.oilPressure.status === 'critical' ? 18 : 100,
      criticality: channels.vibration.status === 'critical' || channels.oilPressure.status === 'critical' ? 'critical' : 'nominal',
      activation: channels.vibration.status === 'critical' || channels.oilPressure.status === 'critical' ? 0.99 : 0.05,
      telemetry: [{ label: 'Action Directive', value: channels.vibration.status === 'critical' ? 'EXECUTE RTB' : 'STANDBY', unit: '', delta: '', status: channels.vibration.status === 'critical' ? 'critical' : 'nominal' }],
      evidence: 'RUL estimate collapsed below required return flight duration.',
      upstreamDependencies: ['Catastrophic Journal Seizure'],
      downstreamEffects: [],
    },
    {
      id: 'risk_mission_continue',
      label: 'Mission Continue (Isolated)',
      region: 'risk_rollup',
      regionIndex: 5,
      subType: 'Operational Directive',
      functionDescription: 'Operational clearance to proceed with primary mission profile after isolating sensor false alarm.',
      stateDescription:
        scenarioId === 'sensor' && timeSeconds >= 40
          ? 'Primary mission objective cleared to continue; ignore CHT thermocouple alarm.'
          : 'Standard mission profile execution.',
      health: 100,
      criticality: 'nominal',
      activation: scenarioId === 'sensor' && timeSeconds >= 40 ? 0.95 : 0.05,
      telemetry: [{ label: 'Mission Status', value: 'CLEARED CONTINUE', unit: '', delta: 'Nominal Core', status: 'nominal' }],
      evidence: 'Sensor fault isolated with 99.4% confidence; zero engine mechanical risk.',
      upstreamDependencies: ['Thermocouple Drift'],
      downstreamEffects: [],
    },
  ];

  // Map for fast node lookups
  const nodeMap = new Map<string, CausalNodeData>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Compute dynamic edge weights and attention
  const edges: CausalEdgeData[] = BASE_EDGE_DEFS.map((def) => {
    const sNode = nodeMap.get(def.source);
    const tNode = nodeMap.get(def.target);

    // Dynamic attention weight formula: structural coupling * source activation * target activation
    const sAct = sNode ? sNode.activation : 0.05;
    const tAct = tNode ? tNode.activation : 0.05;
    const active = sAct > 0.28 && tAct > 0.25;

    // Attention scales with active evidence and component stress
    let dynamicAttention = Math.min(
      0.99,
      Math.max(0.12, def.baseWeight * 0.4 + (sAct + tAct) * 0.4)
    );

    let deltaTrend: 'up' | 'down' | 'steady' = 'steady';
    if (active) {
      dynamicAttention = Math.min(0.99, def.baseWeight * 0.35 + (sAct + tAct) * 0.45);
      deltaTrend = 'up';
    } else if (sAct < 0.1 && tAct < 0.1) {
      deltaTrend = 'down';
    }

    return {
      id: `${def.source}->${def.target}`,
      source: def.source,
      target: def.target,
      sourceLabel: def.sourceLabel,
      targetLabel: def.targetLabel,
      relationshipType: def.relationshipType,
      baseWeight: def.baseWeight,
      attention: parseFloat(dynamicAttention.toFixed(2)),
      deltaTrend,
      active,
    };
  });

  // Reconcile graph visually if interventions were applied or state is reconciled
  if (!forceBaseline && (isReconciled || (appliedInterventions && appliedInterventions.length > 0))) {
    const resolvedSet = new Set<string>();
    const reducedSet = new Set<string>();
    (appliedInterventions ?? []).forEach((rec) => {
      rec.action.reconciliationEffect.resolvedNodeIds.forEach((id) => resolvedSet.add(id));
      rec.action.reconciliationEffect.reducedNodeIds.forEach((id) => reducedSet.add(id));
    });

    nodes.forEach((n) => {
      if (resolvedSet.has(n.id)) {
        n.criticality = 'nominal';
        n.health = 96;
        n.activation = 0.05;
        n.reconciliationStatus = 'reconciled';
        n.stateDescription = `[RECONCILED] ${n.stateDescription}`;
      } else if (reducedSet.has(n.id)) {
        if (n.criticality === 'critical') n.criticality = 'warning';
        n.activation = Math.min(0.35, n.activation);
        if (n.region === 'risk_rollup' || n.id.startsWith('risk_')) {
          n.reconciliationStatus = 'reduced';
          n.stateDescription = `[REDUCED] ${n.stateDescription}`;
        } else {
          n.reconciliationStatus = 'stabilized';
          n.stateDescription = `[STABILIZED] ${n.stateDescription}`;
        }
      } else if (n.criticality === 'critical' || n.criticality === 'warning' || n.activation > 0.45) {
        n.reconciliationStatus = 'remaining';
      }
    });

    edges.forEach((e) => {
      if (resolvedSet.has(e.source) || resolvedSet.has(e.target)) {
        e.active = false;
        e.attention = 0.18;
        e.deltaTrend = 'down';
      } else if (reducedSet.has(e.source) || reducedSet.has(e.target)) {
        e.active = false;
        e.attention = Math.min(e.attention, 0.22);
        e.deltaTrend = 'down';
      }
    });
  }

  return { nodes, edges };
}

// Helpers for upstream and downstream graph traversal
export function getUpstreamNodeIds(
  nodeId: string,
  edges: CausalEdgeData[],
  visited = new Set<string>(),
): Set<string> {
  const incoming = edges.filter((e) => e.target === nodeId);
  for (const edge of incoming) {
    if (!visited.has(edge.source)) {
      visited.add(edge.source);
      getUpstreamNodeIds(edge.source, edges, visited);
    }
  }
  return visited;
}

export function getDownstreamNodeIds(
  nodeId: string,
  edges: CausalEdgeData[],
  visited = new Set<string>(),
): Set<string> {
  const outgoing = edges.filter((e) => e.source === nodeId);
  for (const edge of outgoing) {
    if (!visited.has(edge.target)) {
      visited.add(edge.target);
      getDownstreamNodeIds(edge.target, edges, visited);
    }
  }
  return visited;
}

// Generate diagnostic candidates for the analytical drawer
export function getDiagnosticCandidates(
  _selectedNode: CausalNodeData,
  mission: DeterministicMissionState,
): DiagnosticCandidate[] {
  const { scenarioId, timeSeconds, channels } = mission;

  if (scenarioId === 'cascade') {
    return [
      {
        causeId: 'cause_cooling_blockage',
        name: 'Cooling Loop Airflow Restriction',
        confidencePercent: timeSeconds >= 20 ? 94 : 12,
        supportingEvidence: [
          `Coolant manifold departure +${channels.coolantTemp.residual}°C (z=${channels.coolantTemp.zScore})`,
          'Ram-air convective heat rejection collapsed to 27% baseline',
          'Sequential downstream thermal transfer into dry-sump oil matrix',
        ],
        status: timeSeconds >= 20 ? 'critical' : 'nominal',
      },
      {
        causeId: 'cause_ambient_heat',
        name: 'Atmospheric Thermal Saturation',
        confidencePercent: 18,
        supportingEvidence: ['Ambient ISA temperature +15°C within standard operating envelope'],
        status: 'nominal',
      },
      {
        causeId: 'cause_oil_cavitation',
        name: 'Scavenge Pump Mechanical Cavitation',
        confidencePercent: timeSeconds >= 50 ? 76 : 10,
        supportingEvidence: [
          'Secondary symptom induced by oil thermal breakdown and foam aeration',
        ],
        status: timeSeconds >= 50 ? 'warning' : 'nominal',
      },
    ];
  } else if (scenarioId === 'sensor') {
    return [
      {
        causeId: 'cause_cht_drift',
        name: 'K-Type Thermocouple Junction Drift',
        confidencePercent: timeSeconds >= 40 ? 99 : 10,
        supportingEvidence: [
          'CHT reads 152°C while coolant remains 84°C and EGT is 710°C (thermodynamically disjoint)',
          'Parity space residual z=+4.8σ isolated to single electrical channel',
          'Physical engine vibration (0.12g) and oil pressure (4.5 bar) 100% nominal',
        ],
        status: timeSeconds >= 40 ? 'sensor_fault' : 'nominal',
      },
    ];
  } else if (scenarioId === 'thermal') {
    return [
      {
        causeId: 'cause_ambient_heat',
        name: 'Extreme Ambient Thermal Saturation',
        confidencePercent: 88,
        supportingEvidence: [
          'Ambient temperature +38.5°C exhausting heat sink convective delta',
          'Symmetric CHT and coolant temperature rise without oil pressure collapse',
        ],
        status: 'warning',
      },
    ];
  } else if (scenarioId === 'lubrication') {
    return [
      {
        causeId: 'cause_oil_cavitation',
        name: 'Dry-Sump Scavenge Pump Cavitation',
        confidencePercent: 92,
        supportingEvidence: [
          'Sudden oil pressure drop below 2.0 bar with cool cylinder heads (98°C)',
          'High frequency acoustic cavitation signature at scavenge housing',
        ],
        status: 'critical',
      },
    ];
  }

  return [
    {
      causeId: 'nominal_equilibrium',
      name: 'All Causal Chains Nominal',
      confidencePercent: 99,
      supportingEvidence: ['Zero analytical residual threshold violations across all 8 telemetry channels'],
      status: 'nominal',
    },
  ];
}

// Generate propagation forecast steps for the analytical drawer
export function getPropagationSteps(
  selectedNode: CausalNodeData,
  mission: DeterministicMissionState,
): PropagationStep[] {
  const { scenarioId, timeSeconds } = mission;

  if (scenarioId === 'cascade') {
    return [
      {
        componentId: 'comp_cooling',
        componentName: 'Hybrid Cooling System',
        timeToImpactSeconds: timeSeconds < 20 ? Math.round(20 - timeSeconds) : 0,
        mechanism: 'Ram-air core choking → Coolant boiling at exhaust bridges',
        severity: timeSeconds >= 20 ? 'critical' : 'nominal',
      },
      {
        componentId: 'comp_lubrication',
        componentName: 'Dry-Sump Lubrication',
        timeToImpactSeconds: timeSeconds < 45 ? Math.round(45 - timeSeconds) : 0,
        mechanism: 'Excess head heat transfers to oil → Viscosity drops to 5.2 cSt',
        severity: timeSeconds >= 45 ? 'critical' : 'warning',
      },
      {
        componentId: 'comp_crankcase',
        componentName: 'Split Crankcase & Crankshaft',
        timeToImpactSeconds: timeSeconds < 75 ? Math.round(75 - timeSeconds) : 0,
        mechanism: 'Hydrodynamic fluid film collapse → Boundary metal scuffing & vibration surge',
        severity: timeSeconds >= 75 ? 'critical' : 'nominal',
      },
      {
        componentId: 'risk_emergency_rtb',
        componentName: 'Emergency RTB Recovery',
        timeToImpactSeconds: timeSeconds < 80 ? Math.round(80 - timeSeconds) : 0,
        mechanism: 'Shaft friction drag drops cruise RPM (-680 RPM) → Climb rate negative',
        severity: timeSeconds >= 75 ? 'critical' : 'nominal',
      },
    ];
  }

  return [
    {
      componentId: selectedNode.id,
      componentName: selectedNode.label,
      timeToImpactSeconds: null,
      mechanism: selectedNode.stateDescription,
      severity: selectedNode.criticality,
    },
  ];
}

// Generate the 5-phase Reasoning Trace
export function getReasoningTrace(
  mission: DeterministicMissionState,
): ReasoningStep[] {
  const { scenarioId, channels } = mission;

  if (scenarioId === 'cascade') {
    return [
      {
        phase: 'Anomaly Detection',
        summary: `Residual threshold tripped on Coolant Temp (z=${channels.coolantTemp.zScore}) and CHT (z=${channels.cht.zScore}).`,
        detail: 'CUSUM parity detector identified statistically significant upward thermal acceleration without commanded throttle increase.',
        confidence: 0.98,
      },
      {
        phase: 'Candidate Generation',
        summary: 'Generated 3 hypothesis candidates: Radiator Duct Choke, Scavenge Cavitation, Ambient Heat.',
        detail: 'Bayesian causal network instantiated candidate nodes based on prior failure modes and current flight envelope.',
        confidence: 0.92,
      },
      {
        phase: 'Root Cause Isolation',
        summary: 'Isolated Cooling Airflow Restriction as primary initiator with 94% posterior probability.',
        detail: 'Oil pressure decline lagged coolant surge by 25s, proving thermal cross-coupling rather than primary hydraulic failure.',
        confidence: 0.94,
      },
      {
        phase: 'Propagation Forecast',
        summary: 'Cascade vector active: Cooling → Lubrication → Crankcase Journal Scuffing.',
        detail: 'Predicted hydrodynamic wedge collapse at t=75s leading to 0.44g vibration surge and parasitic power deficit.',
        confidence: 0.91,
      },
      {
        phase: 'Operational Synthesis',
        summary: 'Execute immediate Emergency RTB vector. RUL margin exhausted.',
        detail: 'Shaft parasitic torque will cause engine seizure within 12 minutes unless throttle is retarded and recovery initiated.',
        confidence: 0.96,
      },
    ];
  } else if (scenarioId === 'sensor') {
    return [
      {
        phase: 'Anomaly Detection',
        summary: 'Single-channel residual anomaly detected on CHT-1 (152°C, z=+4.8σ).',
        detail: 'Residual magnitude exceeds 3.5σ alarm threshold while all other 7 engine channels remain nominal.',
        confidence: 0.99,
      },
      {
        phase: 'Candidate Generation',
        summary: 'Evaluated CHT Thermocouple Drift vs True Combustion Chamber Overheat.',
        detail: 'Thermodynamic model requires coolant manifold elevation to exceed 105°C if cylinder head is truly at 152°C.',
        confidence: 0.98,
      },
      {
        phase: 'Root Cause Isolation',
        summary: 'Confirmed K-Type Thermocouple Junction Drift. Physical engine nominal.',
        detail: 'Coolant RTD reads 84°C and EGT is 710°C; head overheat physically impossible under current mass flow.',
        confidence: 0.99,
      },
      {
        phase: 'Propagation Forecast',
        summary: 'Zero physical propagation risk. Instrumentation-only defect.',
        detail: 'Physical bearings, pistons, and reduction gears operate with 100% healthy hydrodynamic separation.',
        confidence: 0.99,
      },
      {
        phase: 'Operational Synthesis',
        summary: 'Clearance granted: Continue primary mission profile.',
        detail: 'Operator advised to ignore CHT raw gauge alarm; redundant health indices remain at 99%.',
        confidence: 0.99,
      },
    ];
  }

  return [
    {
      phase: 'Anomaly Detection',
      summary: 'All telemetry channels within strict 2σ nominal bounding intervals.',
      detail: 'Parity space residuals, vibration acceleration, and fluid temperatures within optimal operational envelope.',
      confidence: 0.99,
    },
    {
      phase: 'Candidate Generation',
      summary: 'No active fault hypotheses generated.',
      detail: 'Causal activation network operating in quiescent baseline state.',
      confidence: 0.99,
    },
    {
      phase: 'Root Cause Isolation',
      summary: 'Physical powertrain operating at 99% health index.',
      detail: 'Continuous closed-loop stoichiometry and balanced reciprocating dynamics confirmed.',
      confidence: 0.99,
    },
    {
      phase: 'Propagation Forecast',
      summary: 'Zero active degradation vectors. RUL exceeds 850 operating hours.',
      detail: 'Wear rates follow standard empirical Weibull hazard rates.',
      confidence: 0.99,
    },
    {
      phase: 'Operational Synthesis',
      summary: 'Proceed with planned waypoint navigation.',
      detail: 'Autonomous flight control envelope nominal.',
      confidence: 0.99,
    },
  ];
}
