"use client";

import { Suspense, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshDistortMaterial, Float, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Signature element: a slow-turning "molten gold" form — evokes a pour of
 * liquid gold caught mid-motion, rather than a generic floating-particle
 * hero. Distortion amplitude breathes on a sine cycle; the whole scene
 * tilts gently toward the cursor for a cinematic parallax read.
 */

function MoltenGold() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(t * 0.15) * 0.25;
      meshRef.current.rotation.y = t * 0.12;
    }
    if (materialRef.current) {
      materialRef.current.distort = 0.35 + Math.sin(t * 0.4) * 0.12;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
      <mesh ref={meshRef} scale={2.2}>
        <icosahedronGeometry args={[1, 6]} />
        <MeshDistortMaterial
          ref={materialRef}
          color="#C9A567"
          metalness={0.9}
          roughness={0.18}
          distort={0.35}
          speed={1.4}
          envMapIntensity={1.4}
        />
      </mesh>
    </Float>
  );
}

/** Tilts the whole rig toward the cursor for a subtle depth-of-field-driven parallax. */
function CursorRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  useFrame((state) => {
    if (!group.current) return;
    const targetX = (state.pointer.x * viewport.width) / 40;
    const targetY = (state.pointer.y * viewport.height) / 40;
    group.current.rotation.y += (targetX - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-targetY - group.current.rotation.x) * 0.04;
  });

  return <group ref={group}>{children}</group>;
}

export function Hero3DScene() {
  const dpr = useMemo<[number, number]>(() => [1, 1.75], []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas dpr={dpr} camera={{ position: [0, 0, 6], fov: 42 }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <pointLight position={[5, 5, 5]} intensity={40} color="#E4C989" />
          <pointLight position={[-5, -3, -5]} intensity={15} color="#4A1420" />

          <CursorRig>
            <MoltenGold />
            <Sparkles count={80} scale={7} size={2} speed={0.25} color="#C9A567" opacity={0.5} />
          </CursorRig>

          <EffectComposer>
            <Bloom
              intensity={0.65}
              luminanceThreshold={0.4}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <DepthOfField focusDistance={0.02} focalLength={0.04} bokehScale={3} />
            <Vignette eskil={false} offset={0.2} darkness={0.9} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
