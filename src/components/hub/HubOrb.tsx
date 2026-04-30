import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function WireOrb() {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const { mouse } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    if (!group.current || !inner.current) return;
    target.current.x += (mouse.y * 0.6 - target.current.x) * 0.05;
    target.current.y += (mouse.x * 0.6 - target.current.y) * 0.05;
    group.current.rotation.x = target.current.x;
    group.current.rotation.y += delta * 0.15 + (target.current.y - group.current.rotation.y) * 0.02;
    inner.current.rotation.x -= delta * 0.25;
    inner.current.rotation.z += delta * 0.18;
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshBasicMaterial
          color={new THREE.Color("hsl(217, 91%, 60%)")}
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>
      <mesh rotation={[0.5, 0.3, 0]}>
        <icosahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial
          color={new THREE.Color("hsl(217, 91%, 70%)")}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color={new THREE.Color("hsl(217, 91%, 55%)")}
          emissive={new THREE.Color("hsl(217, 91%, 60%)")}
          emissiveIntensity={0.8}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
    </group>
  );
}

export function HubOrb({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 3]} intensity={1.2} color="hsl(217, 91%, 65%)" />
        <pointLight position={[-3, -2, 2]} intensity={0.6} color="hsl(217, 91%, 75%)" />
        <Suspense fallback={null}>
          <WireOrb />
        </Suspense>
      </Canvas>
    </div>
  );
}
