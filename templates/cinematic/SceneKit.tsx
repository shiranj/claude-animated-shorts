import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { clamp } from "./animation/math";

/* Shared scene pieces: contact shadow, camera, sky and fog, dawn sun, vignette. Used by the cinematic shots. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
void clamp;

export type CameraPose = { pos: THREE.Vector3; look: THREE.Vector3; fov: number };

const shadowTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d")!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,0.85)"); r.addColorStop(0.55, "rgba(0,0,0,0.35)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
})();
/** Soft dark disc under the feet: grounds the character the way ambient occlusion would. */
export const ContactShadow: React.FC<{ z: number; x?: number }> = ({ z, x = 0 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} renderOrder={2}>
    <planeGeometry args={[1.0, 0.75]} />
    <meshBasicMaterial map={shadowTexture} transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-4} fog={false} />
  </mesh>
);

/* ---------- rigs: scene and camera state are set in layout effects, not during render ---------- */
/** Puts the camera at `pose`. Pass a new `pose` object (or change `frame`) to move it. */
export const CameraRig: React.FC<{ frame: number; pose: (frame: number) => CameraPose; deps?: unknown }> = ({ frame, pose, deps }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const c = pose(frame);
    camera.position.copy(c.pos);
    camera.fov = c.fov;
    camera.lookAt(c.look);
    camera.updateProjectionMatrix();
  }, [camera, frame, pose, deps]);
  return null;
};

const NIGHT_SKY = new THREE.Color("#22364a"), DAWN_SKY = new THREE.Color("#f0b98a");
const NIGHT_FOG = new THREE.Color("#2b4256"), DAWN_FOG = new THREE.Color("#e2b48e");
export const Atmosphere: React.FC<{ dawn: number }> = ({ dawn }) => {
  const scene = useThree((s) => s.scene);
  const bg = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog("#2b4256", 4, 30), []);
  useLayoutEffect(() => {
    bg.copy(NIGHT_SKY).lerp(DAWN_SKY, dawn);
    fog.color.copy(NIGHT_FOG).lerp(DAWN_FOG, dawn);
    scene.background = bg;
    scene.fog = fog;
  }, [scene, bg, fog, dawn]);
  return null;
};

/** Low dawn sun behind the traveller (backlight, rim on hair and cape). The shadow camera follows the traveller. */
const SUN_OFFSET = new THREE.Vector3(-5, 4.2, -9);
export const SunLight: React.FC<{ dawn: number; subjectZ: number; subjectX?: number }> = ({ dawn, subjectZ, subjectX = 0 }) => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffbd82", 3);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.03;
    l.shadow.camera.left = -7; l.shadow.camera.right = 7; l.shadow.camera.top = 7; l.shadow.camera.bottom = -7;
    l.shadow.camera.near = 0.5; l.shadow.camera.far = 40;
    return l;
  }, []);
  useLayoutEffect(() => {
    light.position.set(subjectX + SUN_OFFSET.x, SUN_OFFSET.y, subjectZ + SUN_OFFSET.z);
    light.target.position.set(subjectX, 0, subjectZ);
    light.target.updateMatrixWorld();
    light.intensity = lerp(1.2, 3.4, dawn);
    light.color.set("#8fb0d4").lerp(new THREE.Color("#ffbd82"), dawn);
  }, [light, dawn, subjectZ, subjectX]);
  return <><primitive object={light} dispose={null} /><primitive object={light.target} dispose={null} /></>;
};


/** Gentle vignette over the canvas: draws the eye to the subject. */
export const Vignette: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(8,10,18,0.42) 100%)", pointerEvents: "none" }} />
);
