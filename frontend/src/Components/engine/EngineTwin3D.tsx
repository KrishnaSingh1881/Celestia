import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh, PointLight } from 'three';
import { useEngineStore } from '../../store/useEngineStore';
import { rpmToSpeed, thermalTarget, vibrationJitter } from './engineVisuals';

// Ported and adapted from a reference 3D model in this repo's sihaimodel-main
// baseline (a hand-built, primitive-based procedural model, not an external
// downloaded asset) — the sub-assembly decomposition below matches a real
// 4-cylinder horizontally-opposed, turbocharged, dry-sump, dual-ignition
// aero engine's documented architecture closely enough that this was judged
// more accurate than any downloadable stand-in model would be. Per explicit
// requirement, nothing in this file names any specific manufacturer — every
// label just says "Engine".
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
    color: '#94A3B8', transparent: true, opacity: 0.18, roughness: 0.2, metalness: 0.8,
    side: THREE.DoubleSide, depthWrite: false,
  },
} as const;

function mat(base: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { ...base, ...extra };
}

// ─── Animated flow streamline (oil/coolant/air flow visualization) ─────────
function FlowStreamline({
  points, color = '#38BDF8', speed = 1.0, active = true, size = 0.045,
}: {
  points: [number, number, number][]; color?: string; speed?: number; active?: boolean; size?: number;
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
  position, rotation, isLeft, pistonRef, rodRef, rockerRef, headMeshRef, sparkLightRef, cht, isCutaway, isSelected, onSelect,
}: {
  position: [number, number, number]; rotation: [number, number, number]; isLeft: boolean;
  pistonRef: React.RefObject<Group | null>; rodRef: React.RefObject<Group | null>; rockerRef: React.RefObject<Group | null>;
  headMeshRef: React.RefObject<Mesh | null>; sparkLightRef: React.RefObject<PointLight | null>;
  cht: number; isCutaway: boolean; isSelected: boolean; onSelect: (id: string) => void;
}) {
  const headThermalColor = useMemo(() => thermalTarget(cht, 105, 128, 142), [cht]);
  const thermalEmissive = cht > 105 ? Math.min((cht - 105) / 35, 1.2) : 0;

  return (
    <group position={position} rotation={rotation}>
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
        <mesh
          ref={headMeshRef}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onSelect('cylinder');
          }}
        >
          <boxGeometry args={[0.52, 1.22, 1.22]} />
          <meshPhysicalMaterial {...mat(MAT.billetAlu)} emissive={headThermalColor} emissiveIntensity={thermalEmissive} clearcoat={0.3} />
        </mesh>
        <mesh position={[isLeft ? -0.32 : 0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 1.1, 1.1]} />
          <meshPhysicalMaterial {...mat(MAT.engineBlack)} />
        </mesh>
        <mesh position={[isLeft ? -0.4 : 0.4, 0, 0]}>
          <boxGeometry args={[0.02, 0.28, 0.72]} />
          <meshPhysicalMaterial color={isSelected ? '#FF6B35' : '#CBD5E1'} metalness={0.92} roughness={0.2} />
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

      <mesh position={[isLeft ? -0.45 : 0.45, -0.38, 0.15]} rotation={[0.1, 0, isLeft ? 0.35 : -0.35]}>
        <cylinderGeometry args={[0.038, 0.038, 0.95, 10]} />
        <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
      </mesh>
      <mesh position={[isLeft ? -0.45 : 0.45, -0.38, -0.15]} rotation={[-0.1, 0, isLeft ? 0.35 : -0.35]}>
        <cylinderGeometry args={[0.038, 0.038, 0.95, 10]} />
        <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
      </mesh>
    </group>
  );
}

// ─── Crankcase + crankshaft + camshaft ──────────────────────────────────────
function CrankcaseSection({
  isCutaway, crankRef, camRef, onSelect,
}: {
  isCutaway: boolean; crankRef: React.RefObject<Group | null>; camRef: React.RefObject<Group | null>; onSelect: (id: string) => void;
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
        <meshPhysicalMaterial color="#334155" metalness={0.95} roughness={0.25} />
      </mesh>
      {[-1.15, 1.15].flatMap((x) =>
        [0.65, -0.65].map((y, j) => (
          <mesh key={`${x}-${j}`} position={[x, y, -0.85]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.22, 14]} />
            <meshPhysicalMaterial {...mat(MAT.billetAlu)} />
          </mesh>
        )),
      )}

      <group ref={crankRef} position={[0, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 2.05, 20]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
        {[-0.62, -0.22, 0.22, 0.62].map((z, idx) => {
          const isFlipped = idx % 2 === 1;
          return (
            <group key={idx} position={[0, 0, z]}>
              <mesh position={[0, isFlipped ? -0.26 : 0.26, 0]}>
                <boxGeometry args={[0.62, 0.26, 0.12]} />
                <meshPhysicalMaterial {...mat(MAT.steelForged)} />
              </mesh>
              <mesh position={[0, isFlipped ? 0.32 : -0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.16, 16]} />
                <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
              </mesh>
            </group>
          );
        })}
      </group>

      <group ref={camRef} position={[0, -0.52, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 1.95, 16]} />
          <meshPhysicalMaterial {...mat(MAT.steelPolished)} />
        </mesh>
        {[-0.72, -0.52, -0.32, -0.12, 0.12, 0.32, 0.52, 0.72].map((z, i) => (
          <mesh key={i} position={[0, 0.04, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.11, 0.07, 14]} />
            <meshPhysicalMaterial {...mat(MAT.steelForged)} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── Propeller speed reduction gearbox ──────────────────────────────────────
function GearboxSubassembly({
  isCutaway, propRef, onSelect,
}: {
  isCutaway: boolean; propRef: React.RefObject<Group | null>; onSelect: (id: string) => void;
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
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i * Math.PI) / 3;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.038, 0.038, 0.09, 8]} />
              <meshPhysicalMaterial color="#1E293B" metalness={0.95} roughness={0.15} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ─── Dry-sump lubrication system ────────────────────────────────────────────
function LubricationSubassembly({ oilPressurePa, onSelect }: { oilPressurePa: number; onSelect: (id: string) => void }) {
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
    </group>
  );
}

// ─── Dual electronic ignition + injection ───────────────────────────────────
function IgnitionSubassembly({ onSelect }: { onSelect: (id: string) => void }) {
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
      <group position={[0, 0.45, -1.35]}>
        <mesh position={[-0.38, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.18]} />
          <meshPhysicalMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.38, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.18]} />
          <meshPhysicalMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Hybrid split cooling architecture ──────────────────────────────────────
function CoolingSubassembly({ rpm, onSelect }: { rpm: number; onSelect: (id: string) => void }) {
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
      {[-1.35, 1.35].map((x, i) => (
        <FlowStreamline key={i} points={[[x * 0.7, 0.3, 1.8], [x * 0.9, 0.1, 0.8], [x * 1.2, -0.2, -1.2]]} color="#e2e8f0" speed={normRpm * 2.2} active={active} size={0.032} />
      ))}
    </group>
  );
}

// ─── Sensor pin (needle + luminous beacon + HTML tooltip) ───────────────────
function SensorPin3D({
  position, label, value, unit, status,
}: {
  position: [number, number, number]; label: string; value: string; unit: string; status: 'nominal' | 'warning' | 'critical';
}) {
  const color = status === 'critical' ? '#EF4444' : status === 'warning' ? '#F59E0B' : '#003087';

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
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.055, 0.085, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 0.22, 0]} distanceFactor={7.5} center className="pointer-events-none select-none">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl shadow-md border backdrop-blur-md ${
            status === 'critical'
              ? 'bg-red-50 text-red-900 border-red-400'
              : status === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-400'
                : 'bg-white/95 text-gray-900 border-gray-200'
          }`}
          style={{ whiteSpace: 'nowrap' }}
        >
          <span className={`w-2 h-2 rounded-full ${status === 'critical' ? 'bg-red-500 animate-ping' : status === 'warning' ? 'bg-amber-500 animate-pulse' : 'bg-[#003087]'}`} />
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

const SUBSYSTEM_INFO: Record<string, { title: string; desc: string }> = {
  crankcase: {
    title: 'Power Section: Vertically-Split Crankcase',
    desc: 'High-strength cast aluminium crankcase split along the vertical plane, housing a multi-piece counterweighted crankshaft, a central camshaft, and hydraulic pushrod lifters.',
  },
  gearbox: {
    title: 'Propeller Speed Reduction Unit',
    desc: 'Front-mounted helical gear reduction at a fixed 2.43:1 ratio, with an integrated slipper clutch and torsional spring pack isolating propeller harmonics from the crankshaft.',
  },
  lubrication: {
    title: 'Dry-Sump Forced Lubrication',
    desc: 'Flat-bottomed block with no conventional oil pan — an external de-aerating tank, scavenge and pressure pumps, and a spin-on filter keep oil circulating under all attitudes.',
  },
  ignition: {
    title: 'Dual Electronic Fuel Injection & Ignition',
    desc: 'Twin intake runners feed electronic injectors per cylinder; redundant ECU lanes and dual spark plugs per head provide fail-safe combustion control.',
  },
  cooling: {
    title: 'Hybrid Split Cooling',
    desc: 'Air-cooled finned barrels paired with liquid-cooled heads, connected through a central coolant distribution manifold.',
  },
  cylinder: {
    title: 'Boxer Cylinder Pair',
    desc: 'Horizontally-opposed cylinders reciprocate in mirrored phase for primary dynamic balance; each head carries its own thermal sensor.',
  },
};

function EngineAssembly({
  isCutaway, showPins, selectedSubsystem, onSelectSubsystem,
}: {
  isCutaway: boolean; showPins: boolean; selectedSubsystem: string | null; onSelectSubsystem: (id: string) => void;
}) {
  const prediction = useEngineStore((s) => s.prediction);
  const connected = useEngineStore((s) => s.connected);

  const rpm = connected ? (prediction?.x_hat.omega_engine_rad_s ?? 0) * 60 / (2 * Math.PI) : 0;
  const cht = connected ? (prediction?.y_hat.CHT ?? 288.0) : 288.0; // Kelvin
  const chtCelsius = cht - 273.15;
  const oilPressurePa = connected ? (prediction?.y_hat.oil_pressure ?? 0) : 0;
  const egtK = connected ? (prediction?.y_hat.EGT_proxy ?? 0) : 0;
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

    // Idle mechanical jitter, scaled by rpm only (no vibration sensor channel
    // exists in this project's telemetry yet - this is cosmetic, not data-driven).
    if (groupRef.current && isRunning && !isAtRest) {
      const j = vibrationJitter(t, Math.min(rpm / 3000, 1.0), 0.012);
      groupRef.current.position.set(j.x, -0.1 + j.y, j.z);
    } else if (groupRef.current) {
      groupRef.current.position.set(0, -0.1, 0);
    }
  });

  return (
    <group ref={groupRef} scale={[1.15, 1.15, 1.15]} position={[0, -0.1, 0]}>
      <CrankcaseSection isCutaway={isCutaway} crankRef={crankRef} camRef={camRef} onSelect={onSelectSubsystem} />

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

      <GearboxSubassembly isCutaway={isCutaway} propRef={propRef} onSelect={onSelectSubsystem} />
      <LubricationSubassembly oilPressurePa={oilPressurePa} onSelect={onSelectSubsystem} />
      <IgnitionSubassembly onSelect={onSelectSubsystem} />
      <CoolingSubassembly rpm={rpm} onSelect={onSelectSubsystem} />

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
          <SensorPin3D
            position={[0, 1.45, 0]}
            label="Exhaust gas temp"
            value={(egtK - 273.15).toFixed(0)}
            unit="°C"
            status="nominal"
          />
        </group>
      )}
    </group>
  );
}

export default function EngineTwin3D() {
  const [isCutaway, setIsCutaway] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [selectedSubsystem, setSelectedSubsystem] = useState<string | null>(null);

  const connected = useEngineStore((s) => s.connected);
  const prediction = useEngineStore((s) => s.prediction);
  const rpm = connected ? Math.round((prediction?.x_hat.omega_engine_rad_s ?? 0) * 60 / (2 * Math.PI)) : 0;
  const propRpm = Math.round(rpm / ENGINE_SPECS.psruRatio);
  const cht = connected && prediction ? (prediction.y_hat.CHT - 273.15).toFixed(1) : '--';
  const oilP = connected && prediction ? (prediction.y_hat.oil_pressure / 1e5).toFixed(1) : '--';

  return (
    <div className="w-full h-[520px] lg:h-[580px] bg-gradient-to-b from-white via-slate-50 to-slate-100 border border-gray-200/90 rounded-3xl relative shadow-sm overflow-hidden select-none">
      <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}>
        <PerspectiveCamera makeDefault position={[3.6, 2.4, 4.6]} fov={44} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 9, 6]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0002} />
        <directionalLight position={[-6, 4, -4]} intensity={0.85} color="#FFF7ED" />
        <directionalLight position={[0, -4, 5]} intensity={0.35} color="#E0F2FE" />

        <EngineAssembly isCutaway={isCutaway} showPins={showPins} selectedSubsystem={selectedSubsystem} onSelectSubsystem={setSelectedSubsystem} />

        <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={7.5} blur={2.2} far={2.2} color="#003087" />
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

      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-black tracking-wider text-gray-900 uppercase">Engine · {ENGINE_SPECS.displacement} Boxer</span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md text-white shadow-xs" style={{ background: connected ? '#003087' : '#64748B' }}>
            {connected ? 'SYNCHRONIZED' : 'AT REST'}
          </span>
        </div>
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-gray-200/90 shadow-xs text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">Engine:</span>
            <span className="font-black text-gray-900 font-mono">{connected ? `${rpm.toLocaleString()} RPM` : '0 RPM'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">Prop (÷2.43):</span>
            <span className="font-black text-orange-600 font-mono">{connected ? `${propRpm.toLocaleString()} RPM` : '0 RPM'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">CHT:</span>
            <span className="font-black text-gray-900 font-mono">{cht}°C</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">Oil P:</span>
            <span className="font-black text-emerald-700 font-mono">{oilP} bar</span>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCutaway((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-md cursor-pointer border ${
              isCutaway ? 'bg-[#003087] text-white border-blue-600' : 'bg-white/95 text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isCutaway ? 'bg-cyan-400 animate-ping' : 'bg-gray-400'}`} />
            <span className="tracking-wide uppercase font-black text-[10px]">{isCutaway ? 'X-Ray: ON' : 'Solid View'}</span>
          </button>
          <button
            onClick={() => setShowPins((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-md cursor-pointer border ${
              showPins ? 'bg-orange-500 text-white border-orange-600' : 'bg-white/95 text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="tracking-wide uppercase font-black text-[10px]">Pins: {showPins ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {selectedSubsystem && SUBSYSTEM_INFO[selectedSubsystem] && (
          <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-blue-200 shadow-lg flex flex-col gap-1 max-w-[270px]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#003087]">Subsystem Inspector</span>
              <button onClick={() => setSelectedSubsystem(null)} className="text-gray-400 hover:text-gray-700 text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-gray-100">
                ✕
              </button>
            </div>
            <p className="text-xs font-black text-gray-900 leading-tight">{SUBSYSTEM_INFO[selectedSubsystem].title}</p>
            <p className="text-[10.5px] text-gray-600 leading-snug mt-0.5">{SUBSYSTEM_INFO[selectedSubsystem].desc}</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-20 font-mono text-[9px] text-gray-500 bg-white/90 backdrop-blur-md border border-gray-200 px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-xs">
        <div className="flex items-center gap-1 text-[#003087] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#003087]" />
          <span>ENGINE DIGITAL TWIN</span>
        </div>
        <span>· Click any subassembly to inspect</span>
        <span>· Drag to rotate</span>
        <span>· Scroll to zoom</span>
      </div>
    </div>
  );
}
