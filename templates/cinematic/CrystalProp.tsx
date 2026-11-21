import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { ease } from "./animation/math";

/* A glowing crystal on a stone, generated in code. It flares once at `flashFrame` (a story event) and then glows steadily.
 * Materials are shared by all instances; only the intensity changes, as a function of the frame. */

const crystalMat = new THREE.MeshStandardMaterial({ color: "#2f9fb8", emissive: "#1fb8d8", emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true });
const stoneMat = new THREE.MeshStandardMaterial({ color: "#4d4c46", roughness: 0.95, flatShading: true });

export const crystalGlow = (frame: number, flashFrame: number) =>
  0.45 + 0.08 * Math.sin(frame * 0.17) + (frame >= flashFrame ? 1.4 * Math.exp(-(frame - flashFrame) / 22) + 0.35 * ease((frame - flashFrame) / 20) : 0);

export const CrystalProp: React.FC<{ position: [number, number, number]; frame: number; flashFrame: number; scale?: number }> = ({ position, frame, flashFrame, scale = 1.15 }) => {
  const light = useMemo(() => new THREE.PointLight("#5fe3f5", 1, 7, 1.6), []);
  useLayoutEffect(() => {
    const g = crystalGlow(frame, flashFrame);
    crystalMat.emissiveIntensity = 0.35 + g * 0.55;
    light.intensity = 0.4 + g * 2.2;
  }, [frame, flashFrame, light]);
  return (
    <group position={[position[0], 0, position[2]]} scale={scale}>
      <mesh position={[0, 0.12, 0]} scale={[1, 0.7, 0.9]} castShadow receiveShadow material={stoneMat}><dodecahedronGeometry args={[0.34, 0]} /></mesh>
      <mesh position={[0, 0.62, 0]} rotation={[0, 0.5, 0.08]} castShadow material={crystalMat}><coneGeometry args={[0.15, 0.78, 6]} /></mesh>
      <mesh position={[0.14, 0.42, 0.05]} rotation={[0.1, 1, -0.45]} castShadow material={crystalMat}><coneGeometry args={[0.08, 0.42, 5]} /></mesh>
      <mesh position={[-0.12, 0.38, -0.04]} rotation={[-0.1, 2, 0.5]} castShadow material={crystalMat}><coneGeometry args={[0.07, 0.36, 5]} /></mesh>
      <primitive object={light} position={[0, 0.7, 0.05]} dispose={null} />
    </group>
  );
};
