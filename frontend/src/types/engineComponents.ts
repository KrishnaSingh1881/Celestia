import type { DeterministicMissionState } from '../lib/deterministicMission';

export type EngineComponentId =
  | 'cylinder'
  | 'crankcase'
  | 'gearbox'
  | 'lubrication'
  | 'cooling'
  | 'ignition';

export interface ComponentSensorInfo {
  name: string;
  type: string;
  channel: string;
  value: string;
  status: 'nominal' | 'warning' | 'critical' | 'sensor_fault';
}

export interface EngineComponentDetails {
  id: EngineComponentId;
  name: string;
  category: string;
  description: string;
  stateText: string;
  health: number;
  status: 'nominal' | 'warning' | 'critical' | 'sensor_fault';
  telemetry: Array<{ label: string; value: string; unit: string; delta: string; status: 'nominal' | 'warning' | 'critical' }>;
  sensors: ComponentSensorInfo[];
  upstreamDependencies: string[];
  downstreamEffects: string[];
}

export const ENGINE_COMPONENTS_LIST: Array<{ id: EngineComponentId; name: string; category: string }> = [
  { id: 'cylinder', name: 'Boxer Cylinder Pairs & Heads', category: 'Thermodynamic Core' },
  { id: 'crankcase', name: 'Split Crankcase & Crankshaft', category: 'Power Section' },
  { id: 'gearbox', name: 'Propeller Speed Reduction (PSRU)', category: 'Drivetrain' },
  { id: 'lubrication', name: 'Dry-Sump Scavenge & Pressure', category: 'Fluid Mechanics' },
  { id: 'cooling', name: 'Hybrid Liquid / Air Cooling', category: 'Thermal Management' },
  { id: 'ignition', name: 'Dual Electronic Injection & Spark', category: 'Combustion Control' },
];

export function getComponentDetails(
  id: EngineComponentId,
  mission: DeterministicMissionState,
): EngineComponentDetails {
  const { scenarioId, timeSeconds, channels, subsystemHealth } = mission;

  switch (id) {
    case 'cylinder': {
      const chtVal = channels.cht.current;
      const isOverheat = chtVal >= 142;
      const isWarning = chtVal >= 128;
      const isSensorFault = scenarioId === 'sensor' && timeSeconds >= 40;

      let stateText = 'Continuous 4-stroke combustion; balanced opposed reciprocating mass.';
      if (isSensorFault) {
        stateText = 'Physical core operating nominally; primary thermocouple indicates synthetic sensor bias.';
      } else if (isOverheat) {
        stateText = 'Thermal limit breach (>142°C); imminent valve seat distortion & piston ring binding.';
      } else if (isWarning) {
        stateText = 'Thermal saturation boundary reached; cylinder head thermal buffer depleted.';
      }

      const status: 'nominal' | 'warning' | 'critical' | 'sensor_fault' = isSensorFault
        ? 'sensor_fault'
        : isOverheat
        ? 'critical'
        : isWarning
        ? 'warning'
        : 'nominal';

      return {
        id,
        name: 'Boxer Cylinder Pairs & Heads',
        category: 'Thermodynamic Core',
        description:
          'Four horizontally-opposed, air-cooled finned aluminium barrels with liquid-cooled cylinder heads. Opposed pistons reciprocate in mirrored phase for inherent primary dynamic balance.',
        stateText,
        health: subsystemHealth.cylinderCore,
        status,
        telemetry: [
          { label: 'Cylinder Head Temp', value: `${channels.cht.current}`, unit: '°C', delta: `Δ +${channels.cht.residual}°C`, status: channels.cht.status },
          { label: 'Exhaust Gas Temp', value: `${channels.egt.current}`, unit: '°C', delta: `Δ +${channels.egt.residual}°C`, status: channels.egt.status },
          { label: 'Induction Pressure', value: `${channels.map.current}`, unit: 'kPa', delta: `Δ ${channels.map.residual}`, status: channels.map.status },
        ],
        sensors: [
          { name: 'CHT-1..4 Thermocouples', type: 'K-Type Grounded Junction', channel: 'CHT', value: `${channels.cht.current}°C`, status: isSensorFault ? 'sensor_fault' : channels.cht.status },
          { name: 'EGT Differential Probe', type: 'Inconel Sheathed Thermocouple', channel: 'EGT_proxy', value: `${channels.egt.current}°C`, status: channels.egt.status },
        ],
        upstreamDependencies: [
          'Hybrid Liquid Cooling Circuit (Head heat rejection)',
          'Dry-Sump Lubrication Gallery (Piston ring & wrist pin oiling)',
          'Dual EFI Fuel Rail (Stoichiometric air-fuel mixture)',
        ],
        downstreamEffects: [
          'Connecting rod thrust onto main crankshaft journals',
          'Torsional vibration harmonics transmitted to reduction gearbox',
          'Exhaust thermal energy expansion to turbocharger / ambient',
        ],
      };
    }

    case 'crankcase': {
      const isFriction = scenarioId === 'cascade' && timeSeconds >= 75;
      const status = isFriction ? 'critical' : mission.healthIndex < 70 ? 'warning' : 'nominal';
      const stateText = isFriction
        ? 'Severe torsional vibration surge (0.44g) and mechanical drag causing RPM sag.'
        : 'Symmetric vertically-split aluminium casing maintaining structural crankshaft alignment.';

      return {
        id,
        name: 'Split Crankcase & Crankshaft',
        category: 'Power Section',
        description:
          'High-strength vertically-split cast aluminium casing housing a multi-piece forged steel counterweighted crankshaft, central camshaft, and hydraulic roller lifters.',
        stateText,
        health: isFriction ? 38 : subsystemHealth.cylinderCore,
        status,
        telemetry: [
          { label: 'Engine Speed', value: `${channels.rpm.current}`, unit: 'RPM', delta: `Δ ${channels.rpm.residual}`, status: channels.rpm.status },
          { label: 'Crankshaft Vibration', value: `${channels.vibration.current.toFixed(2)}`, unit: 'g RMS', delta: `z=${channels.vibration.zScore}`, status: channels.vibration.status },
        ],
        sensors: [
          { name: 'Optical Crank Position', type: 'Redundant Hall-Effect Sensor', channel: 'rpm', value: `${channels.rpm.current} RPM`, status: channels.rpm.status },
          { name: 'Triaxial Accelerometer', type: 'MEMS Piezoelectric Sensor', channel: 'vibration', value: `${channels.vibration.current.toFixed(2)} g`, status: channels.vibration.status },
        ],
        upstreamDependencies: [
          'Opposed cylinder connecting rod combustion impulses',
          'Pressurized oil delivery through internal cross-drilled crank galleries',
        ],
        downstreamEffects: [
          'Direct drive input into Propeller Speed Reduction Unit (PSRU)',
          'Internal gear drive for camshaft and dry-sump oil pump',
        ],
      };
    }

    case 'gearbox': {
      const rpm = channels.rpm.current;
      const propRpm = Math.round(rpm / 2.43);
      const isSag = channels.rpm.status === 'warning' || channels.rpm.status === 'critical';

      return {
        id,
        name: 'Propeller Speed Reduction Unit (PSRU)',
        category: 'Drivetrain',
        description:
          'Front-mounted helical reduction gearbox at fixed 2.43:1 ratio with an integrated torsional vibration damper and slipper clutch to decouple propeller aerodynamic inertia.',
        stateText: isSag
          ? 'Propeller shaft speed depressed due to upstream core mechanical drag.'
          : 'Nominal 2.43:1 speed reduction maintaining optimal propeller aerodynamic blade efficiency.',
        health: isSag ? 62 : 98,
        status: isSag ? 'warning' : 'nominal',
        telemetry: [
          { label: 'Propeller Speed', value: `${propRpm}`, unit: 'RPM', delta: '÷ 2.43', status: channels.rpm.status },
          { label: 'Drive Harmonic Vibration', value: `${channels.vibration.current.toFixed(2)}`, unit: 'g', delta: `z=${channels.vibration.zScore}`, status: channels.vibration.status },
        ],
        sensors: [
          { name: 'Prop Shaft Tachometer', type: 'Magnetic Reluctance Pickup', channel: 'prop_rpm', value: `${propRpm} RPM`, status: channels.rpm.status },
        ],
        upstreamDependencies: [
          'Crankshaft front flange rotational torque',
          'Lubrication mist / splash feed from main front journal gallery',
        ],
        downstreamEffects: [
          'Variable-pitch / fixed-pitch propeller aerodynamic thrust delivery',
          'Airframe tractor/pusher mounting load transfer',
        ],
      };
    }

    case 'lubrication': {
      const p = channels.oilPressure.current;
      const isCritical = p < 2.0;
      const isWarning = p < 2.8;

      let stateText = 'Pressurized dry-sump circulation maintaining full hydrodynamic bearing separation.';
      if (isCritical) {
        stateText = 'Boundary lubrication failure; oil gallery starvation across main crankshaft bearings.';
      } else if (isWarning) {
        stateText = 'Oil pressure degraded; volumetric scavenge pump cavitation and viscosity thinning.';
      }

      return {
        id,
        name: 'Dry-Sump Lubrication System',
        category: 'Fluid Mechanics',
        description:
          'Dry-sump architecture featuring a remote de-aerating oil tank, dual-stage trochoid scavenge and pressure pumps, an oil cooler heat exchanger, and full-flow spin-on filter.',
        stateText,
        health: subsystemHealth.lubrication,
        status: isCritical ? 'critical' : isWarning ? 'warning' : 'nominal',
        telemetry: [
          { label: 'Oil Pressure', value: `${channels.oilPressure.current}`, unit: 'bar', delta: `Δ ${channels.oilPressure.residual}b`, status: channels.oilPressure.status },
          { label: 'Oil Temperature', value: `${channels.oilTemp.current}`, unit: '°C', delta: `Δ +${channels.oilTemp.residual}°C`, status: channels.oilTemp.status },
        ],
        sensors: [
          { name: 'Gallery Pressure Transducer', type: 'Piezoresistive Strain Gauge', channel: 'oil_pressure', value: `${channels.oilPressure.current} bar`, status: channels.oilPressure.status },
          { name: 'Sump Oil Thermistor', type: 'NTC Resistance Temperature Detector', channel: 'oil_temp', value: `${channels.oilTemp.current}°C`, status: channels.oilTemp.status },
        ],
        upstreamDependencies: [
          'Camshaft-driven mechanical oil pump gear rotation',
          'Heat exchange airflow through external oil cooler matrix',
        ],
        downstreamEffects: [
          'Hydrodynamic fluid wedge on crankshaft and camshaft journals',
          'Piston under-crown oil spray cooling for thermal relief',
        ],
      };
    }

    case 'cooling': {
      const c = channels.coolantTemp.current;
      const isCritical = c >= 115;
      const isWarning = c >= 98;

      let stateText = 'Coolant circulation nominal; ram-air radiator dissipating thermal combustion flux.';
      if (isCritical) {
        stateText = 'Severe thermal saturation; coolant boiling threshold breached with zero thermal reserve.';
      } else if (isWarning) {
        stateText = 'Reduced heat rejection efficiency; coolant operating outside optimal 80-90°C band.';
      }

      return {
        id,
        name: 'Hybrid Liquid / Air Cooling System',
        category: 'Thermal Management',
        description:
          'Split cooling concept: ram-air airflow dissipates heat from finned cylinder barrels, while an integrated water pump circulates 50/50 glycol through critical cylinder heads and an expansion manifold.',
        stateText,
        health: subsystemHealth.cooling,
        status: isCritical ? 'critical' : isWarning ? 'warning' : 'nominal',
        telemetry: [
          { label: 'Coolant Temperature', value: `${channels.coolantTemp.current}`, unit: '°C', delta: `Δ +${channels.coolantTemp.residual}°C`, status: channels.coolantTemp.status },
          { label: 'Cylinder Head Temp', value: `${channels.cht.current}`, unit: '°C', delta: `Δ +${channels.cht.residual}°C`, status: channels.cht.status },
        ],
        sensors: [
          { name: 'Coolant Manifold Probe', type: 'Dual-Element RTD Probe', channel: 'coolant_temp', value: `${channels.coolantTemp.current}°C`, status: channels.coolantTemp.status },
        ],
        upstreamDependencies: [
          'Mechanical water pump driven by crankshaft front gear',
          'Radiator air ducting and ram-air vehicle airspeed',
        ],
        downstreamEffects: [
          'Combustion chamber thermal equilibrium in cylinder heads',
          'Secondary cooling coupling to dry-sump oil matrix',
        ],
      };
    }

    case 'ignition': {
      return {
        id,
        name: 'Dual Electronic Injection & Ignition',
        category: 'Combustion Control',
        description:
          'Twin intake manifolds with electronic multi-port fuel injection, dual electronic control units (ECU Lane A / Lane B), and dual spark plugs per cylinder for combustion redundancy.',
        stateText: 'Dual-lane electronic fuel metering synchronized with crank angle position.',
        health: 99,
        status: 'nominal',
        telemetry: [
          { label: 'Manifold Pressure', value: `${channels.map.current}`, unit: 'kPa', delta: `Δ ${channels.map.residual}`, status: channels.map.status },
          { label: 'Exhaust Proxy', value: `${channels.egt.current}`, unit: '°C', delta: `Δ +${channels.egt.residual}°C`, status: channels.egt.status },
        ],
        sensors: [
          { name: 'Intake MAP Sensor', type: 'Micro-Machined Silicon Piezoresistive', channel: 'MAP', value: `${channels.map.current} kPa`, status: channels.map.status },
          { name: 'Dual Spark Discharge Coil', type: 'Capacitive Discharge Ignition Unit', channel: 'spark_rate', value: '4× Synchronized', status: 'nominal' },
        ],
        upstreamDependencies: [
          'Electrical 28V DC bus power from internal stator alternator',
          'Low-pressure fuel lift pump delivery (3.0 bar feed rail)',
        ],
        downstreamEffects: [
          'Combustion flame front propagation inside cylinder chambers',
          'Exhaust gas discharge mass flow and acoustic signature',
        ],
      };
    }
  }
}
