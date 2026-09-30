import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh, PointLight } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEngineStore } from '../../store/useEngineStore';
import { useMissionStore } from '../../store/useMissionStore';
import { rpmToSpeed, thermalTarget, vibrationJitter } from './engineVisuals';
import {
  getComponentDetails,
  type EngineComponentId,
} from '../../types/engineComponents';

const ENGINE_SPECS = {
  type: '4-Cylinder, 4-Stroke Horizontally-Opposed Boxer',
  displacement: '1,211 cm³',
  psruRatio: 2.43,
};

const MAT = {
  castAlu: { color: '#B0BAC4', metalness: 0.85, roughness: 0.46 },
  billetAlu: { color: '#D5DDE5', metalness: 0.94, roughness: 0.22, clearcoat: 0.2, clearcoatRoughness: 0.15 },
  steelPolished: { color: '#E8EEF4', metalness: 0.98, roughness: 0.08, clearcoat: 0.8 },
  steelForged: { color: '#8E9BA6', metalness: 0.9, roughness: 0.32 },
  anodizedFins: { color: '#1E252B', metalness: 0.35, roughness: 0.82 },
  engineBlack: { color: '#14181C', metalness: 0.25, roughness: 0.65 },
  brass: { color: '#CFA753', metalness: 0.92, roughness: 0.28 },
  orangeConduit: { color: '#FF6B35', metalness: 0.12, roughness: 0.42 },
  fuelRailBlue: { color: '#003087', metalness: 0.88, roughness: 0.28 },
  cutawayGlass: {
    color: '#94A3B8',
    transparent: true,
    opacity: 0.18,
    roughness: 0.2,
    metalness: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  },
} as const;

function mat(base: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { ...base, ...extra };
}

// ─── Visual Selection Highlight Bracket ────────────────────────────────────
function SelectionHighlightBox({
  size = [1.2, 1.2, 1.2],
  position = [0, 0, 0],
  color = '#f59e0b',
}: {
  size?: [number, number, number];
  position?: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

// ─── Animated flow streamline (oil/coolant/air flow visualization) ─────────
function FlowStreamline({
  points,
  color = '#38BDF8',
  speed = 1.0,
  active = true,
  size = 0.045,
}: {
  points: [number, number, number][];
  color?: string;
  speed?: number;
  active?: boolean;
  size?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);

  useFrame((state) => {
    if (!meshRef.current || !active) return;
    const t = (state.clock.getElapsedTime() * speed * 0.4) % 1;
    const pos = curve.getPointAt(t);
    meshRef.current.position.copy(pos);
  });

  if (!active) return null;

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 20, 0.012, 6, false]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ─── Cylinder sub-assembly (finned air-cooled barrel + liquid-cooled head) ──
function CylinderSubassembly({
  position,
  rotation,
  isLeft,
  pistonRef,
  rodRef,
  rockerRef,
  headMeshRef,
  sparkLightRef,
  cht,
  isCutaway,
  isSelected,
  onSelect,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  isLeft: boolean;
  pistonRef: React.RefObject<Group | null>;
  rodRef: React.RefObject<Group | null>;
  rockerRef: React.RefObject<Group | null>;
  headMeshRef: React.RefObject<Mesh | null>;
  sparkLightRef: React.RefObject<PointLight | null>;
  cht: number;
  isCutaway: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const headThermalColor = useMemo(() => thermalTarget(cht, 105, 128, 142), [cht]);
  const thermalEmissive = cht > 105 ? Math.min((cht - 105) / 35, 1.2) : 0;

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect('cylinder');
      }}
    >
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.54, 0.54, 1.48, 28, 1, isCutaway, 0, isCutaway ? Math.PI * 1.3 : Math.PI * 2]} />
          <meshPhysicalMaterial {...mat(isCutaway ? MAT.cutawayGlass : MAT.castAlu)} side={THREE.DoubleSide} />
        </mesh>
        {[-0.52, -0.38, -0.24, -0.1, 0.04, 0.18, 0.32, 0.46].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.74, 0.74, 0.038, 28, 1, isCutaway, 0, isCutaway ? Math.PI * 1.3 : Math.PI * 2]} />
            <meshPhysicalMaterial {...mat(MAT.anodizedFins)} transparent={isCutaway} opacity={isCutaway ? 0.35 : 1.0} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {[[-0.42, 0.42], [0.42, 0.42], [-0.42, -0.42], [0.42, -0.42]].map(([y, z], idx) => (
          <mesh key={idx} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.032, 1.55, 8]} />
            <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
          </mesh>
        ))}
      </group>

      <group position={[isLeft ? -0.98 : 0.98, 0, 0]}>
        <mesh ref={headMeshRef} castShadow>
          <boxGeometry args={[0.52, 1.22, 1.22]} />
          <meshPhysicalMaterial
            {...mat(MAT.billetAlu)}
            emissive={isSelected ? '#f59e0b' : headThermalColor}
            emissiveIntensity={isSelected ? 0.6 : thermalEmissive}
            clearcoat={0.3}
          />
        </mesh>
        <mesh position={[isLeft ? -0.32 : 0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 1.1, 1.1]} />
          <meshPhysicalMaterial {...mat(MAT.engineBlack)} />
        </mesh>
        <mesh position={[isLeft ? -0.4 : 0.4, 0, 0]}>
          <boxGeometry args={[0.02, 0.28, 0.72]} />
          <meshPhysicalMaterial color={isSelected ? '#f59e0b' : '#CBD5E1'} metalness={0.92} roughness={0.2} />
        </mesh>
        <group ref={rockerRef} position={[isLeft ? -0.15 : 0.15, 0.25, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.32, 12]} />
            <meshPhysicalMaterial {...mat(MAT.steelForged)} />
          </mesh>
          <mesh position={[0, -0.06, 0.18]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.06, 0.14, 0.42]} />
            <meshPhysicalMaterial {...mat(MAT.steelForged)} />
          </mesh>
        </group>
        <mesh position={[0, 0.52, 0.28]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.075, 0.075, 0.28, 14]} />
          <meshPhysicalMaterial {...mat(MAT.brass)} />
        </mesh>
        <group position={[0, 0.44, -0.32]} rotation={[0.42, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.042, 0.042, 0.26, 12]} />
            <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.12, 10]} />
            <meshPhysicalMaterial {...mat(MAT.orangeConduit)} />
          </mesh>
        </group>
        <group position={[0, -0.44, -0.32]} rotation={[-0.42, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.042, 0.042, 0.26, 12]} />
            <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.12, 10]} />
            <meshPhysicalMaterial {...mat(MAT.orangeConduit)} />
          </mesh>
        </group>
        <pointLight ref={sparkLightRef} position={[0, 0, 0]} intensity={0} distance={1.8} color="#FFAA33" />
      </group>

      <group ref={pistonRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.49, 0.49, 0.44, 24]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
        {[-0.12, -0.04, 0.06].map((offset, ringIdx) => (
          <mesh key={ringIdx} position={[offset, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.505, 0.505, 0.018, 24]} />
            <meshPhysicalMaterial color="#334155" metalness={0.95} roughness={0.15} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.72, 16]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
        <group ref={rodRef}>
          <mesh position={[isLeft ? 0.5 : -0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.062, 0.088, 1.05, 12]} />
            <meshPhysicalMaterial {...mat(MAT.steelForged)} />
          </mesh>
          <mesh position={[isLeft ? 1.02 : -1.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.24, 16]} />
            <meshPhysicalMaterial {...mat(MAT.steelForged)} />
          </mesh>
        </group>
      </group>

      {/* Visual Highlight Wireframe when selected */}
      {isSelected && (
        <SelectionHighlightBox size={[2.2, 1.4, 1.4]} position={[isLeft ? -0.5 : 0.5, 0, 0]} color="#f59e0b" />
      )}
    </group>
  );
}

// ─── Crankcase + crankshaft + camshaft ──────────────────────────────────────
function CrankcaseSection({
  isCutaway,
  crankRef,
  camRef,
  isSelected,
  onSelect,
}: {
  isCutaway: boolean;
  crankRef: React.RefObject<Group | null>;
  camRef: React.RefObject<Group | null>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect('crankcase');
      }}
    >
      <group position={[isCutaway ? -0.45 : 0, 0, 0]}>
        <mesh position={[-0.62, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 1.62, 2.15]} />
          <meshPhysicalMaterial {...mat(isCutaway ? MAT.cutawayGlass : MAT.castAlu)} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position={[isCutaway ? 0.45 : 0, 0, 0]}>
        <mesh position={[0.62, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 1.62, 2.15]} />
          <meshPhysicalMaterial {...mat(MAT.castAlu)} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.03, 1.66, 2.18]} />
        <meshPhysicalMaterial color={isSelected ? '#f59e0b' : '#334155'} metalness={0.95} roughness={0.25} />
      </mesh>

      <group ref={crankRef} position={[0, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 2.05, 20]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
      </group>

      <group ref={camRef} position={[0, -0.48, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 1.95, 14]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
      </group>

      {isSelected && (
        <SelectionHighlightBox size={[1.5, 1.8, 2.3]} position={[0, 0, 0]} color="#f59e0b" />
      )}
    </group>
  );
}

// ─── Propeller speed reduction gearbox ──────────────────────────────────────
function GearboxSubassembly({
  isCutaway,
  propRef,
  isSelected,
  onSelect,
}: {
  isCutaway: boolean;
  propRef: React.RefObject<Group | null>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <group
      position={[0, 0.18, 1.38]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect('gearbox');
      }}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.48, 0.68, 0.65, 24, 1, isCutaway, 0, isCutaway ? Math.PI * 1.35 : Math.PI * 2]} />
        <meshPhysicalMaterial {...mat(isCutaway ? MAT.cutawayGlass : MAT.billetAlu)} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.07, 24]} />
        <meshPhysicalMaterial {...mat(MAT.castAlu)} />
      </mesh>
      <group ref={propRef} position={[0, 0, 0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.14, 28]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
        <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.18, 20]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
      </group>

      {isSelected && (
        <SelectionHighlightBox size={[1.2, 1.2, 1.1]} position={[0, 0, 0.1]} color="#f59e0b" />
      )}
    </group>
  );
}

// ─── Dry-sump lubrication system ────────────────────────────────────────────
function LubricationSubassembly({
  oilPressurePa,
  isSelected,
  onSelect,
}: {
  oilPressurePa: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const oilPressureBar = oilPressurePa / 1e5;
  const flowSpeed = Math.min(Math.max(oilPressureBar, 1.0), 5.0) / 3.8;
  const active = oilPressureBar > 0.8;

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect('lubrication');
      }}
    >
      <mesh position={[0, -0.83, 0]}>
        <boxGeometry args={[2.1, 0.05, 2.05]} />
        <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
      </mesh>
      <group position={[0.42, -0.68, 0.95]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.26, 0.28, 16]} />
          <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
        </mesh>
      </group>
      <group position={[1.85, -0.15, -0.25]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.34, 0.34, 1.25, 20]} />
          <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
        </mesh>
        <mesh position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.12, 14]} />
          <meshPhysicalMaterial color="#FF6B35" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
      <group position={[-0.85, -0.58, -0.75]} rotation={[0.3, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.46, 18]} />
          <meshPhysicalMaterial color="#111827" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      <FlowStreamline points={[[1.85, -0.65, -0.25], [1.55, -0.78, 0.45], [0.95, -0.72, 0.85], [0.42, -0.68, 0.95]]} color="#F59E0B" speed={flowSpeed} active={active} />
      <FlowStreamline points={[[0.42, -0.68, 0.95], [-0.2, -0.8, 0.2], [-0.6, -0.75, -0.4], [-0.85, -0.58, -0.75]]} color="#F59E0B" speed={flowSpeed} active={active} />

      {isSelected && (
        <SelectionHighlightBox size={[1.0, 1.5, 1.0]} position={[1.85, -0.15, -0.25]} color="#f59e0b" />
      )}
    </group>
  );
}

// ─── Dual electronic ignition + injection ───────────────────────────────────
function IgnitionSubassembly({
  isSelected,
  onSelect,
}: {
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect('ignition');
      }}
    >
      <group position={[0, 0.95, 0]}>
        <mesh position={[-0.85, 0, 0]} rotation={[0, 0, -0.25]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 1.85, 16]} />
          <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
        </mesh>
        <mesh position={[0.85, 0, 0]} rotation={[0, 0, 0.25]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 1.85, 16]} />
          <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
        </mesh>
      </group>
      <mesh position={[-0.98, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 1.75, 12]} />
        <meshPhysicalMaterial {...mat(MAT.fuelRailBlue)} />
      </mesh>
      <mesh position={[0.98, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 1.75, 12]} />
        <meshPhysicalMaterial {...mat(MAT.fuelRailBlue)} />
      </mesh>

      {isSelected && (
        <SelectionHighlightBox size={[2.4, 0.8, 2.0]} position={[0, 0.85, 0]} color="#f59e0b" />
      )}
    </group>
  );
}

// ─── Hybrid split cooling architecture ──────────────────────────────────────
function CoolingSubassembly({
  rpm,
  isSelected,
  onSelect,
}: {
  rpm: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const normRpm = Math.max(rpm, 100) / 4800;
  const active = rpm > 100;

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect('cooling');
      }}
    >
      <group position={[0, -0.65, -1.25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.28, 0.32, 16]} />
          <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
        </mesh>
      </group>
      <group position={[0, 0.78, -0.15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.38, 14]} />
          <meshPhysicalMaterial {...mat(MAT.brass)} />
        </mesh>
      </group>
      {[[-0.7, 0.15, 0.85, 0.45], [0.7, 0.15, 0.85, 0.45], [-0.7, -0.15, 0.85, -0.45], [0.7, -0.15, 0.85, -0.45]].map(
        ([x1, , x2, z2], i) => (
          <FlowStreamline
            key={i}
            points={[[0, 0.78, -0.15], [x1, 0.82, z2 > 0 ? 0.15 : -0.3], [x2, 0.6, z2]]}
            color="#06b6d4"
            speed={normRpm * 1.5}
            active={active}
          />
        ),
      )}

      {isSelected && (
        <SelectionHighlightBox size={[1.8, 1.2, 2.2]} position={[0, 0.1, -0.4]} color="#06b6d4" />
      )}
    </group>
  );
}

// ─── Sensor pin (needle + luminous beacon + HTML tooltip) ───────────────────
function SensorPin3D({
  position,
  label,
  value,
  unit,
  status,
}: {
  position: [number, number, number];
  label: string;
  value: string;
  unit: string;
  status: 'nominal' | 'warning' | 'critical' | 'sensor_fault';
}) {
  const color =
    status === 'critical'
      ? '#ef4444'
      : status === 'warning'
      ? '#f59e0b'
      : status === 'sensor_fault'
      ? '#a855f7'
      : '#10b981';

  return (
    <group position={position}>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.004, 0.16, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Html position={[0, 0.22, 0]} distanceFactor={7.5} center className="pointer-events-none select-none">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl shadow-lg border backdrop-blur-md ${
            status === 'critical'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500'
              : status === 'warning'
              ? 'bg-amber-950/90 text-amber-200 border-amber-500'
              : status === 'sensor_fault'
              ? 'bg-purple-950/90 text-purple-200 border-purple-500'
              : 'bg-slate-950/90 text-slate-100 border-slate-800'
          }`}
          style={{ whiteSpace: 'nowrap' }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[8px] font-black uppercase tracking-wider opacity-75">{label}</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-mono text-[11px] font-black">{value}</span>
              <span className="text-[9px] font-bold opacity-75">{unit}</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Camera Controller for Presets ──────────────────────────────────────────
function CameraPresetController({ preset }: { preset: 'iso' | 'front' | 'left' | 'right' | 'top' }) {
  const { camera } = useThree();
  const controlsRef = useThree((state) => state.controls as OrbitControlsImpl | null);

  useEffect(() => {
    let targetPos: [number, number, number] = [3.6, 2.4, 4.6];
    if (preset === 'front') targetPos = [0, 0.5, 5.2];
    else if (preset === 'left') targetPos = [-5.2, 0.8, 0.2];
    else if (preset === 'right') targetPos = [5.2, 0.8, 0.2];
    else if (preset === 'top') targetPos = [0.1, 6.0, 0.1];

    camera.position.set(...targetPos);
    if (controlsRef) {
      controlsRef.target.set(0, 0.05, 0);
      controlsRef.update();
    }
  }, [preset, camera, controlsRef]);

  return null;
}

function EngineAssembly({
  isCutaway,
  showPins,
  selectedSubsystem,
  onSelectSubsystem,
}: {
  isCutaway: boolean;
  showPins: boolean;
  selectedSubsystem: string | null;
  onSelectSubsystem: (id: string) => void;
}) {
  const prediction = useEngineStore((s) => s.prediction);
  const connected = useEngineStore((s) => s.connected);

  const rpm = connected ? ((prediction?.x_hat.omega_engine_rad_s ?? 0) * 60) / (2 * Math.PI) : 0;
  const cht = connected ? prediction?.y_hat.CHT ?? 288.0 : 288.0;
  const chtCelsius = cht - 273.15;
  const oilPressurePa = connected ? prediction?.y_hat.oil_pressure ?? 0 : 0;
  const isRunning = connected && rpm > 100;

  const groupRef = useRef<Group>(null);
  const crankRef = useRef<Group>(null);
  const camRef = useRef<Group>(null);
  const propRef = useRef<Group>(null);
  const pistonRefs = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)];
  const rodRefs = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)];
  const rockerRefs = [useRef<Group>(null), useRef<Group>(null), useRef<Group>(null), useRef<Group>(null)];
  const sparkRefs = [useRef<PointLight>(null), useRef<PointLight>(null), useRef<PointLight>(null), useRef<PointLight>(null)];
  const headMeshRefs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)];

  const animState = useRef({ crankAngle: 0, visualSpeed: 0 });

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const s = animState.current;
    const targetSpeed = isRunning ? rpmToSpeed(rpm) : 0;
    s.visualSpeed += (targetSpeed - s.visualSpeed) * Math.min(delta * 4.0, 1);
    if (s.visualSpeed > 0.001) s.crankAngle += delta * s.visualSpeed;
    const ca = s.crankAngle;
    const isAtRest = s.visualSpeed <= 0.005;

    if (crankRef.current) crankRef.current.rotation.z = isAtRest ? 0 : ca;
    if (camRef.current) camRef.current.rotation.z = isAtRest ? 0 : -ca * 0.5;
    if (propRef.current) propRef.current.rotation.z = isAtRest ? 0 : ca / ENGINE_SPECS.psruRatio;

    const stroke = isAtRest ? 0 : 0.44;
    if (pistonRefs[0].current) pistonRefs[0].current.position.x = isAtRest ? 0 : -Math.sin(ca) * stroke;
    if (pistonRefs[1].current) pistonRefs[1].current.position.x = isAtRest ? 0 : Math.sin(ca) * stroke;
    if (pistonRefs[2].current) pistonRefs[2].current.position.x = isAtRest ? 0 : -Math.sin(ca + Math.PI) * stroke;
    if (pistonRefs[3].current) pistonRefs[3].current.position.x = isAtRest ? 0 : Math.sin(ca + Math.PI) * stroke;

    const rodAng = isAtRest ? 0 : Math.cos(ca) * 0.19;
    if (rodRefs[0].current) rodRefs[0].current.rotation.y = rodAng;
    if (rodRefs[1].current) rodRefs[1].current.rotation.y = -rodAng;
    if (rodRefs[2].current) rodRefs[2].current.rotation.y = -rodAng;
    if (rodRefs[3].current) rodRefs[3].current.rotation.y = rodAng;

    const rockerAng = isAtRest ? 0 : Math.sin(ca * 0.5) * 0.22;
    rockerRefs.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.x = isAtRest ? 0 : i % 2 === 0 ? rockerAng : -rockerAng;
    });

    if (isRunning && !isAtRest) {
      const sparkPulse = (phase: number) => Math.max(0, Math.sin(ca * 0.5 + phase)) ** 8 * 2.2;
      const phases = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      sparkRefs.forEach((ref, idx) => {
        if (ref.current) ref.current.intensity = 0.1 + sparkPulse(phases[idx]);
      });
    } else {
      sparkRefs.forEach((ref) => {
        if (ref.current) ref.current.intensity = 0;
      });
    }

    if (groupRef.current && isRunning && !isAtRest) {
      const j = vibrationJitter(t, Math.min(rpm / 3000, 1.0), 0.012);
      groupRef.current.position.set(j.x, -0.1 + j.y, j.z);
    } else if (groupRef.current) {
      groupRef.current.position.set(0, -0.1, 0);
    }
  });

  return (
    <group ref={groupRef} scale={[1.15, 1.15, 1.15]} position={[0, -0.1, 0]}>
      <CrankcaseSection
        isCutaway={isCutaway}
        crankRef={crankRef}
        camRef={camRef}
        isSelected={selectedSubsystem === 'crankcase'}
        onSelect={onSelectSubsystem}
      />

      {[
        { pos: [-1.48, 0.24, 0.58] as [number, number, number], rot: [0, 0, 0] as [number, number, number], isLeft: true },
        { pos: [1.48, 0.24, 0.58] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number], isLeft: false },
        { pos: [-1.48, -0.2, -0.58] as [number, number, number], rot: [0, 0, 0] as [number, number, number], isLeft: true },
        { pos: [1.48, -0.2, -0.58] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number], isLeft: false },
      ].map((cyl, idx) => (
        <CylinderSubassembly
          key={idx}
          position={cyl.pos}
          rotation={cyl.rot}
          isLeft={cyl.isLeft}
          pistonRef={pistonRefs[idx]}
          rodRef={rodRefs[idx]}
          rockerRef={rockerRefs[idx]}
          headMeshRef={headMeshRefs[idx]}
          sparkLightRef={sparkRefs[idx]}
          cht={chtCelsius}
          isCutaway={isCutaway}
          isSelected={selectedSubsystem === 'cylinder'}
          onSelect={onSelectSubsystem}
        />
      ))}

      <GearboxSubassembly
        isCutaway={isCutaway}
        propRef={propRef}
        isSelected={selectedSubsystem === 'gearbox'}
        onSelect={onSelectSubsystem}
      />
      <LubricationSubassembly
        oilPressurePa={oilPressurePa}
        isSelected={selectedSubsystem === 'lubrication'}
        onSelect={onSelectSubsystem}
      />
      <IgnitionSubassembly
        isSelected={selectedSubsystem === 'ignition'}
        onSelect={onSelectSubsystem}
      />
      <CoolingSubassembly
        rpm={rpm}
        isSelected={selectedSubsystem === 'cooling'}
        onSelect={onSelectSubsystem}
      />

      {showPins && (
        <group>
          <SensorPin3D
            position={[0, 0.82, 1.48]}
            label="Prop shaft (÷2.43)"
            value={Math.round(rpm / ENGINE_SPECS.psruRatio).toLocaleString()}
            unit="RPM"
            status="nominal"
          />
          <SensorPin3D
            position={[-1.9, 0.72, 0.6]}
            label="Cylinder head temp"
            value={chtCelsius.toFixed(1)}
            unit="°C"
            status={chtCelsius >= 142 ? 'critical' : chtCelsius >= 128 ? 'warning' : 'nominal'}
          />
          <SensorPin3D
            position={[1.85, 0.85, -0.25]}
            label="Dry sump oil"
            value={(oilPressurePa / 1e5).toFixed(1)}
            unit="bar"
            status={oilPressurePa < 2.0e5 ? 'critical' : oilPressurePa < 2.8e5 ? 'warning' : 'nominal'}
          />
        </group>
      )}
    </group>
  );
}

interface EngineTwin3DProps {
  height?: number | string;
  selectedSubsystem?: string | null;
  onSelectSubsystem?: (id: string | null) => void;
  showInspectorCard?: boolean;
}

export default function EngineTwin3D({
  height = 520,
  selectedSubsystem: propSelected,
  onSelectSubsystem: propOnSelect,
  showInspectorCard = true,
}: EngineTwin3DProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [isCutaway, setIsCutaway] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'front' | 'left' | 'right' | 'top'>('iso');

  const selectedSubsystem = propSelected !== undefined ? propSelected : internalSelected;
  const onSelectSubsystem = propOnSelect ?? setInternalSelected;

  const connected = useEngineStore((s) => s.connected);
  const prediction = useEngineStore((s) => s.prediction);
  const missionState = useMissionStore((s) => s.missionState);

  const rpm = connected ? Math.round(((prediction?.x_hat.omega_engine_rad_s ?? 0) * 60) / (2 * Math.PI)) : 0;
  const propRpm = Math.round(rpm / ENGINE_SPECS.psruRatio);
  const cht = connected && prediction ? (prediction.y_hat.CHT - 273.15).toFixed(1) : '--';
  const oilP = connected && prediction ? (prediction.y_hat.oil_pressure / 1e5).toFixed(1) : '--';

  // Details for selected component
  const componentDetails = useMemo(() => {
    if (!selectedSubsystem) return null;
    return getComponentDetails(selectedSubsystem as EngineComponentId, missionState);
  }, [selectedSubsystem, missionState]);

  return (
    <div
      className="w-full bg-gradient-to-b from-[#0b0f17] via-[#0d131f] to-[#111827] border border-slate-800 rounded-2xl relative shadow-lg overflow-hidden select-none"
      style={{ height }}
    >
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}>
        <PerspectiveCamera makeDefault position={[3.6, 2.4, 4.6]} fov={44} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 9, 6]} intensity={1.9} castShadow shadow-bias={-0.0002} />
        <directionalLight position={[-6, 4, -4]} intensity={0.85} color="#FFF7ED" />
        <directionalLight position={[0, -4, 5]} intensity={0.35} color="#E0F2FE" />

        <CameraPresetController preset={cameraPreset} />

        <EngineAssembly
          isCutaway={isCutaway}
          showPins={showPins}
          selectedSubsystem={selectedSubsystem}
          onSelectSubsystem={onSelectSubsystem}
        />

        <ContactShadows position={[0, -1.35, 0]} opacity={0.55} scale={7.5} blur={2.2} far={2.2} color="#000000" />
        <OrbitControls
          enableZoom
          enablePan
          autoRotate={!selectedSubsystem && rpm > 0}
          autoRotateSpeed={0.65}
          maxPolarAngle={Math.PI / 2 + 0.05}
          minDistance={1.8}
          maxDistance={9.0}
          target={[0, 0.05, 0]}
        />
      </Canvas>

      {/* Top Left HUD Pill */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-md">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[10px] font-black tracking-wider text-slate-100 uppercase">
            Modular Digital Twin · {ENGINE_SPECS.displacement} Boxer
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md text-slate-950 shadow-xs" style={{ background: connected ? '#10b981' : '#64748B' }}>
            {connected ? 'SYNCHRONIZED' : 'AT REST'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-md text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Engine:</span>
            <span className="font-black text-slate-100 font-mono">{connected ? `${rpm.toLocaleString()} RPM` : '0 RPM'}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Prop (÷2.43):</span>
            <span className="font-black text-amber-400 font-mono">{connected ? `${propRpm.toLocaleString()} RPM` : '0 RPM'}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">CHT:</span>
            <span className={`font-black font-mono ${Number(cht) > 140 ? 'text-rose-400 animate-pulse' : Number(cht) > 125 ? 'text-amber-400' : 'text-slate-100'}`}>
              {cht}°C
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Oil P:</span>
            <span className={`font-black font-mono ${Number(oilP) < 2.0 ? 'text-rose-400 animate-pulse' : Number(oilP) < 2.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {oilP} bar
            </span>
          </div>
        </div>
      </div>

      {/* Top Right Controls & Viewpoint Presets */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          {/* Camera View Presets */}
          <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
            {(['iso', 'front', 'left', 'right', 'top'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setCameraPreset(p)}
                className={`px-2 py-0.5 rounded-lg uppercase transition-colors cursor-pointer ${
                  cameraPreset === p ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Set camera view to ${p}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsCutaway((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md backdrop-blur-md cursor-pointer border ${
              isCutaway ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950/85 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isCutaway ? 'bg-slate-950 animate-ping' : 'bg-slate-500'}`} />
            <span className="tracking-wide uppercase font-black text-[10px]">{isCutaway ? 'X-Ray: ON' : 'Solid View'}</span>
          </button>

          <button
            onClick={() => setShowPins((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md backdrop-blur-md cursor-pointer border ${
              showPins ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-950/85 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className="tracking-wide uppercase font-black text-[10px]">Pins: {showPins ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Detailed Component Inspector Overlay (when component is selected) */}
        {showInspectorCard && componentDetails && (
          <div className="bg-slate-950/95 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/50 shadow-2xl flex flex-col gap-2 max-w-[320px] text-left">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                  {componentDetails.category}
                </span>
              </div>
              <button
                onClick={() => onSelectSubsystem(null)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-slate-800 cursor-pointer"
                title="Deselect component"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-xs font-black text-slate-100">{componentDetails.name}</div>
              <p className="text-[10px] text-slate-300 mt-1 leading-snug">{componentDetails.stateText}</p>
            </div>

            {/* Component Health & Status */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px]">
              <span className="text-slate-400 font-bold uppercase">Subsystem Health:</span>
              <span
                className={`font-mono font-black ${
                  componentDetails.health >= 80 ? 'text-emerald-400' : componentDetails.health >= 50 ? 'text-amber-400' : 'text-rose-400 animate-pulse'
                }`}
              >
                {componentDetails.health}%
              </span>
            </div>

            {/* Live Telemetry Readings for this component */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Associated Telemetry:</span>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                {componentDetails.telemetry.map((t, idx) => (
                  <div key={idx} className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between">
                    <span className="text-slate-400 truncate">{t.label}:</span>
                    <span className="font-bold text-slate-100">{t.value} {t.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upstream / Downstream Dependencies */}
            <div className="text-[9px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
              <div>
                <strong className="text-slate-300">Downstream Impact:</strong>{' '}
                {componentDetails.downstreamEffects[0]}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar Info */}
      <div className="absolute bottom-3 left-3 z-20 font-mono text-[9px] text-slate-400 bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-md">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>ENGINE DIGITAL TWIN</span>
        </div>
        <span>· Click subassembly or use inspector to highlight</span>
        <span>· Preset buttons shift angle</span>
        <span>· Drag to rotate · Scroll to zoom</span>
      </div>
    </div>
  );
}
