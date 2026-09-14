import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type * as THREE from 'three';
import { useEngineStore } from '../../store/useEngineStore';
import { rpmToVisualSpeed, thermalColor } from './engineVisuals';

const GEAR_RATIO = 2.43; // Appendix A - PSRU reduction ratio

function CylinderPair({ side, chtColor }: { side: 1 | -1; chtColor: string }) {
  return (
    <group position={[0, 0, side * 0.55]}>
      {/* finned air-cooled barrel */}
      <mesh position={[0, 0, side * 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.7, 16]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* liquid-cooled head, thermally reactive */}
      <mesh position={[0, 0, side * 0.75]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.3, 16]} />
        <meshStandardMaterial color={chtColor} emissive={chtColor} emissiveIntensity={0.4} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function EngineScene() {
  const prediction = useEngineStore((s) => s.prediction);
  const crankRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Group>(null);
  const angleRef = useRef(0);

  const rpm = prediction ? (prediction.x_hat.omega_engine_rad_s ?? 0) * 60 / (2 * Math.PI) : 0;
  const cht = prediction?.y_hat.CHT ?? 300;
  const chtColor = thermalColor(cht, 350, 420, 460);

  useFrame((_state, delta) => {
    const omega = rpmToVisualSpeed(rpm);
    angleRef.current += omega * delta;
    if (crankRef.current) crankRef.current.rotation.z = angleRef.current;
    if (propRef.current) propRef.current.rotation.x = angleRef.current / GEAR_RATIO;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.0} />

      {/* crankcase */}
      <mesh>
        <boxGeometry args={[0.9, 0.5, 0.5]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* crankshaft, rotates at real engine speed */}
      <group ref={crankRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 1.0, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      <CylinderPair side={1} chtColor={chtColor} />
      <CylinderPair side={-1} chtColor={chtColor} />

      {/* propeller, rotates at crank/2.43 (PSRU) */}
      <group ref={propRef} position={[0.9, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.05, 1.4, 0.08]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.05, 1.4, 0.08]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>

      <Html position={[0, 0.6, 0]} center distanceFactor={8}>
        <div className="px-2 py-1 rounded bg-slate-900/80 text-white text-xs whitespace-nowrap">
          {rpm.toFixed(0)} rpm · CHT {cht.toFixed(0)} K
        </div>
      </Html>

      <OrbitControls enablePan={false} minDistance={2} maxDistance={6} />
    </>
  );
}

export default function EngineTwin3D() {
  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden h-full min-h-[320px]">
      <Canvas camera={{ position: [2.2, 1.4, 2.2], fov: 45 }}>
        <EngineScene />
      </Canvas>
    </div>
  );
}
