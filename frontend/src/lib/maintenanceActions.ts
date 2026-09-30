import type { MaintenanceActionOption } from '../types/maintenance';
import type { ScenarioId } from '../types/scenarios';

export const DETERMINISTIC_MAINTENANCE_ACTIONS: MaintenanceActionOption[] = [
  // 1. CASCADE FAILURE SCENARIO ACTIONS
  {
    id: 'act_cascade_clear_blockage',
    type: 'REPAIR',
    title: 'Clear Cowl Obstruction & Purge Radiator Core',
    description: 'Remove foreign debris obstructing ram-air intake cowl and pressure-flush coolant heat exchanger core to restore convective airflow.',
    targetComponentId: 'comp_cooling',
    targetComponentName: 'Hybrid Cooling System',
    applicableScenarios: ['cascade'],
    expectedEffects: [
      { parameter: 'Cooling Effectiveness', direction: 'up', detail: '+68% ram-air mass flow restored' },
      { parameter: 'Thermal Heat Flux', direction: 'down', detail: '-38°C coolant manifold reduction' },
      { parameter: 'Lubrication Thermal Stress', direction: 'down', detail: 'Oil bulk temp stabilized below 92°C' },
      { parameter: 'Bearing Seizure Risk', direction: 'down', detail: 'Hydrodynamic film boundary restored' },
      { parameter: 'Overall Engine Health', direction: 'up', detail: '+42% total system recovery' },
    ],
    reconciliationEffect: {
      healthDelta: 42,
      subsystemHealthDelta: { cooling: 65, cylinderCore: 48, lubrication: 52 },
      activeFaultResolved: true,
      resolvedNodeIds: ['cause_cooling_blockage', 'comp_cooling', 'evid_coolant_delta'],
      reducedNodeIds: ['state_thermal_saturation', 'state_oil_shear', 'state_bearing_starvation', 'risk_engine_seizure'],
      newRiskLevel: 'nominal',
      summaryResult: 'Radiator obstruction cleared; ram-air mass flow 1.38 kg/s restored; core ΔT nominal.',
    },
  },
  {
    id: 'act_cascade_flush_oil',
    type: 'REPLACE',
    title: 'Replenish Synthetic 15W-50 & Replace Oil Filter',
    description: 'Drain thermally sheared engine oil, replace micro-glass gallery filter cartridge, and recharge dry-sump tank with fresh un-aerated lubricant.',
    targetComponentId: 'comp_lubrication',
    targetComponentName: 'Dry-Sump Lubrication',
    applicableScenarios: ['cascade'],
    expectedEffects: [
      { parameter: 'Kinematic Oil Viscosity', direction: 'up', detail: '5.2 cSt restored to 17.8 cSt' },
      { parameter: 'Gallery Pressure Buffer', direction: 'up', detail: '+2.4 bar pressure increase' },
      { parameter: 'Bearing Boundary Friction', direction: 'down', detail: 'Parasitic drag reduced by 14 kW' },
      { parameter: 'Engine Health', direction: 'up', detail: '+22% hydrodynamic protection' },
    ],
    reconciliationEffect: {
      healthDelta: 22,
      subsystemHealthDelta: { lubrication: 45 },
      activeFaultResolved: false,
      resolvedNodeIds: ['state_oil_shear'],
      reducedNodeIds: ['state_bearing_starvation', 'state_parasitic_drag'],
      newRiskLevel: 'warning',
      summaryResult: 'Fresh 15W-50 recharged; gallery pressure restored to 4.2 bar; film wedge stable.',
    },
  },
  {
    id: 'act_cascade_borescope_inspection',
    type: 'INSPECT',
    title: 'Borescope Cylinder Inspection & Ring Gap Check',
    description: 'Insert micro-optical borescope through top spark plug port to assess cylinder wall cross-hatching and piston ring end-gap clearance.',
    targetComponentId: 'comp_cylinder',
    targetComponentName: 'Boxer Cylinder Pairs',
    applicableScenarios: ['cascade'],
    expectedEffects: [
      { parameter: 'Bore Scuffing Assessment', direction: 'stable', detail: 'Zero micro-welding detected on bore #1/#2' },
      { parameter: 'Piston Ring Clearance', direction: 'stable', detail: 'End gap verified at 0.32mm (spec: >0.25mm)' },
      { parameter: 'Combustion Chamber Seal', direction: 'up', detail: 'Compression ratio confirmed 10.5:1' },
    ],
    reconciliationEffect: {
      healthDelta: 10,
      subsystemHealthDelta: { cylinderCore: 15 },
      activeFaultResolved: false,
      resolvedNodeIds: [],
      reducedNodeIds: ['state_ring_scuff'],
      newRiskLevel: 'warning',
      summaryResult: 'Optical borescope inspection confirms cylinder liners intact; no adhesive metal transfer.',
    },
  },

  // 2. SENSOR ANOMALY SCENARIO ACTIONS
  {
    id: 'act_sensor_calibrate_tc',
    type: 'CALIBRATE',
    title: 'Zero-Point Recalibrate CHT Thermocouple Channel',
    description: 'Perform electrical zero-point cold-junction offset re-calibration and verify parity space against multi-channel RTD redundant cluster.',
    targetComponentId: 'sensor_cht_tc',
    targetComponentName: 'CHT Thermocouple',
    applicableScenarios: ['sensor'],
    expectedEffects: [
      { parameter: 'Parity Space Residual', direction: 'down', detail: 'Residual z-score: +4.8σ → 0.0σ' },
      { parameter: 'False Positive Flag', direction: 'down', detail: 'Synthetic bias (-47°C offset) removed' },
      { parameter: 'Thermocouple Reading', direction: 'stable', detail: 'Aligned to actual thermodynamic core (104°C)' },
      { parameter: 'Engine Diagnostic Health', direction: 'up', detail: 'Restored to 98% nominal' },
    ],
    reconciliationEffect: {
      healthDelta: 48,
      subsystemHealthDelta: { sensors: 60 },
      activeFaultResolved: true,
      resolvedNodeIds: ['cause_cht_drift', 'sensor_cht_tc', 'evid_cht_delta'],
      reducedNodeIds: [],
      newRiskLevel: 'nominal',
      summaryResult: 'Thermocouple cold junction re-zeroed; residual returned to parity space null vector.',
    },
  },
  {
    id: 'act_sensor_clear_fault_directive',
    type: 'CLEAR_FAULT',
    title: 'Disarm Parity Alarm & Authorize Mission Continuation',
    description: 'Acknowledge analytical isolation of channel fault and clear flight-control advisory to resume autonomous cruise waypoint schedule.',
    targetComponentId: 'sensor_cht_tc',
    targetComponentName: 'CHT Thermocouple',
    applicableScenarios: ['sensor'],
    expectedEffects: [
      { parameter: 'Autopilot Warning Interlock', direction: 'down', detail: 'False alert cleared' },
      { parameter: 'Mission Profile Status', direction: 'up', detail: 'Waypoint flight execution authorized' },
      { parameter: 'Flight Risk Level', direction: 'down', detail: 'Risk level downgraded to NOMINAL' },
    ],
    reconciliationEffect: {
      healthDelta: 40,
      subsystemHealthDelta: { sensors: 50 },
      activeFaultResolved: true,
      resolvedNodeIds: ['cause_cht_drift'],
      reducedNodeIds: [],
      newRiskLevel: 'nominal',
      summaryResult: 'False sensor alarm cleared; autopilot cruise interlock released; mission continues.',
    },
  },

  // 3. LUBRICATION CAVITATION SCENARIO ACTIONS
  {
    id: 'act_lube_deaerate_scavenge',
    type: 'CLEAN_RESTORE',
    title: 'De-aerate Oil Sump & Flush Scavenge Suction Screen',
    description: 'Purge entrained vapor pocketing in dry-sump scavenge inlet manifold and back-flush fine mesh suction strainer.',
    targetComponentId: 'comp_lubrication',
    targetComponentName: 'Dry-Sump Lubrication',
    applicableScenarios: ['lubrication'],
    expectedEffects: [
      { parameter: 'Scavenge Suction Pressure', direction: 'up', detail: '0.45 bar → 1.15 bar (cavitation collapsed)' },
      { parameter: 'Oil Gallery Pressure', direction: 'up', detail: '1.8 bar → 4.5 bar nominal delivery' },
      { parameter: 'Bearing Journal Vibration', direction: 'down', detail: 'High-frequency acoustic chatter ceased' },
      { parameter: 'Engine Lubrication Health', direction: 'up', detail: '+55% recovery' },
    ],
    reconciliationEffect: {
      healthDelta: 50,
      subsystemHealthDelta: { lubrication: 60 },
      activeFaultResolved: true,
      resolvedNodeIds: ['cause_oil_cavitation', 'comp_lubrication', 'evid_oil_press_sag'],
      reducedNodeIds: ['state_bearing_starvation', 'risk_engine_seizure'],
      newRiskLevel: 'nominal',
      summaryResult: 'Vapor aeration purged; scavenge pump restored to positive displacement; 4.5 bar verified.',
    },
  },
  {
    id: 'act_lube_replace_relief_valve',
    type: 'REPLACE',
    title: 'Replace High-Pressure Relief Spring & Cartridge',
    description: 'Swap bypass relief valve plunger assembly to eliminate pressure bleeding back into scavenge return chamber.',
    targetComponentId: 'comp_lubrication',
    targetComponentName: 'Dry-Sump Lubrication',
    applicableScenarios: ['lubrication'],
    expectedEffects: [
      { parameter: 'Bypass Leakage Rate', direction: 'down', detail: 'Zero leakage across seat' },
      { parameter: 'High-RPM Pressure Regulation', direction: 'up', detail: 'Regulated cleanly at 4.6 ± 0.2 bar' },
    ],
    reconciliationEffect: {
      healthDelta: 35,
      subsystemHealthDelta: { lubrication: 40 },
      activeFaultResolved: true,
      resolvedNodeIds: ['cause_oil_cavitation'],
      reducedNodeIds: ['comp_lubrication'],
      newRiskLevel: 'nominal',
      summaryResult: 'Relief valve cartridge replaced; regulated pressure holding firmly at 4.6 bar.',
    },
  },

  // 4. THERMAL SATURATION SCENARIO ACTIONS
  {
    id: 'act_thermal_deploy_cowl_flaps',
    type: 'REPAIR',
    title: 'Deploy Auxiliary Ram-Air Flaps & Enrich Combustion',
    description: 'Actuate auxiliary variable-geometry cowl exit flaps and enrich fuel mixture by +6% to leverage evaporative charge cooling.',
    targetComponentId: 'comp_cooling',
    targetComponentName: 'Hybrid Cooling System',
    applicableScenarios: ['thermal'],
    expectedEffects: [
      { parameter: 'Coolant Rejection Gradient', direction: 'up', detail: '+34% convective heat transfer' },
      { parameter: 'Cylinder Head Temperature', direction: 'down', detail: '-26°C peak CHT reduction' },
      { parameter: 'Thermal Saturation Margin', direction: 'up', detail: 'Operating buffer restored to 18°C' },
      { parameter: 'Engine Health Index', direction: 'up', detail: '+30% recovery' },
    ],
    reconciliationEffect: {
      healthDelta: 32,
      subsystemHealthDelta: { cooling: 45, cylinderCore: 35 },
      activeFaultResolved: true,
      resolvedNodeIds: ['cause_ambient_heat', 'comp_cooling'],
      reducedNodeIds: ['state_thermal_saturation'],
      newRiskLevel: 'nominal',
      summaryResult: 'Auxiliary cowl flaps open; mass flow increased; CHT stabilized at 102°C.',
    },
  },
];

export function getActionsForScenario(scenarioId: ScenarioId): MaintenanceActionOption[] {
  const filtered = DETERMINISTIC_MAINTENANCE_ACTIONS.filter((act) =>
    act.applicableScenarios.includes(scenarioId)
  );
  if (filtered.length > 0) return filtered;
  // Default fallback if scenario has no specialized actions
  return DETERMINISTIC_MAINTENANCE_ACTIONS.filter((act) => act.applicableScenarios.includes('cascade'));
}
