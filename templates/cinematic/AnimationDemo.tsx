import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { AnimatedCharacter, CharacterPlaceholder, type Extra } from "./AnimatedCharacter";
import { ENV_INTENSITY, ForestEnvironment, buildForestLayout } from "./ForestEnvironment";
import { makeLantern } from "./Lantern";
import { makeBackpack } from "./Backpack";
import { smoothTravel } from "./footLock";
import { ASSET_PATHS, loadGltf, useAsset } from "./useAsset";
import { Atmosphere, CameraRig, ContactShadow, SunLight, Vignette, type CameraPose } from "./SceneKit";
import { hangFromBone } from "./props";
import { buildMotion, clipWeightsFor, type ClipNames } from "./animation/motion";
import { createPerformance } from "./animation/performance";
import { clamp, ease, lerp } from "./animation/math";
import { DEMO_SCRIPT, DEMO_START, FLASH } from "./demoScript";
import { locoAt, locoChain, type CharacterScript, type TargetTable, type Vec3 } from "./animation/script";
import { mouthMorphs, applyMouth } from "./animation/mouth";

/* ------------------------------------------------------------------------------------------------
 * Animation demo, 14 s, 1080x1920, 30 fps.
 * The same traveller and forest as CinematicPOC, now directed by a typed script (see animation/script.ts):
 * walks and curves, stops, notices a glowing crystal, is startled, points at it, then smiles at the camera.
 * Nothing in the scene knows about the story; the story is only the SCRIPT below and the crystal prop.
 * ---------------------------------------------------------------------------------------------- */

const FPS = 30;
const FRAMES = 420;
const CHARACTER_HEIGHT = 1.75;
const START = DEMO_START;
const CLIPS: ClipNames = { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" };
const HAIR_TINT = "#7a5236";
const FEET: [string, string] = ["foot_l", "foot_r"];
const STOP_FRAME = 172;       // where the traveller stands once the walk has blended into the idle

/* ---------- crystal prop (generated in code) ---------- */
const crystalMat = new THREE.MeshStandardMaterial({ color: "#2f9fb8", emissive: "#1fb8d8", emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true });
const stoneMat = new THREE.MeshStandardMaterial({ color: "#4d4c46", roughness: 0.95, flatShading: true });
const crystalGlow = (frame: number) => 0.45 + 0.08 * Math.sin(frame * 0.17) + (frame >= FLASH ? 1.4 * Math.exp(-(frame - FLASH) / 22) + 0.35 * ease((frame - FLASH) / 20) : 0);

const Crystal: React.FC<{ position: Vec3; frame: number }> = ({ position, frame }) => {
  const light = useMemo(() => new THREE.PointLight("#5fe3f5", 1, 7, 1.6), []);
  useLayoutEffect(() => {
    const g = crystalGlow(frame);
    crystalMat.emissiveIntensity = 0.35 + g * 0.55;
    light.intensity = 0.4 + g * 2.2;
  }, [frame, light]);
  return (
    <group position={[position[0], 0, position[2]]} scale={1.15}>
      <mesh position={[0, 0.12, 0]} scale={[1, 0.7, 0.9]} castShadow receiveShadow material={stoneMat}><dodecahedronGeometry args={[0.34, 0]} /></mesh>
      <mesh position={[0, 0.62, 0]} rotation={[0, 0.5, 0.08]} castShadow material={crystalMat}><coneGeometry args={[0.15, 0.78, 6]} /></mesh>
      <mesh position={[0.14, 0.42, 0.05]} rotation={[0.1, 1, -0.45]} castShadow material={crystalMat}><coneGeometry args={[0.08, 0.42, 5]} /></mesh>
      <mesh position={[-0.12, 0.38, -0.04]} rotation={[-0.1, 2, 0.5]} castShadow material={crystalMat}><coneGeometry args={[0.07, 0.36, 5]} /></mesh>
      <primitive object={light} position={[0, 0.7, 0.05]} dispose={null} />
    </group>
  );
};

/* ---------- camera: keyframes, eased between ---------- */
type CamKey = { f: number; dist: number; y: number; lookY: number; fov: number; x: number; lookX: number };
const CAM: CamKey[] = [
  { f: 0, dist: 4.7, y: 1.3, lookY: 0.98, fov: 38, x: 1.05, lookX: -0.05 },
  { f: 125, dist: 4.3, y: 1.25, lookY: 1.0, fov: 37, x: 0.8, lookX: -0.1 },
  { f: 185, dist: 3.3, y: 1.3, lookY: 1.18, fov: 35, x: 0.7, lookX: -0.15 },
  { f: 245, dist: 3.0, y: 1.35, lookY: 1.25, fov: 34, x: 0.6, lookX: -0.2 },
  { f: 292, dist: 5.4, y: 1.5, lookY: 1.0, fov: 42, x: -0.1, lookX: -0.75 },
  { f: 358, dist: 3.1, y: 1.4, lookY: 1.22, fov: 34, x: 0.45, lookX: 0 },
  { f: 420, dist: 3.0, y: 1.4, lookY: 1.22, fov: 34, x: 0.35, lookX: 0 },
];
const camKey = (f: number): CamKey => {
  let i = 0; while (i < CAM.length - 2 && f >= CAM[i + 1].f) i++;
  const a = CAM[i], b = CAM[i + 1], t = ease((f - a.f) / (b.f - a.f));
  return { f, dist: lerp(a.dist, b.dist, t), y: lerp(a.y, b.y, t), lookY: lerp(a.lookY, b.lookY, t), fov: lerp(a.fov, b.fov, t), x: lerp(a.x, b.x, t), lookX: lerp(a.lookX, b.lookX, t) };
};
const cameraPose = (frame: number, cx: number, cz: number): CameraPose => {
  const k = camKey(frame);
  return { pos: new THREE.Vector3(cx + k.x, k.y, cz + k.dist), look: new THREE.Vector3(cx + k.lookX, k.lookY, cz), fov: k.fov };
};

const dawnAt = (frame: number) => ease(frame / 250);
// the corridor the traveller uses stays free of trees
const blocksView = (x: number, z: number, radius: number) => z > START[1] - 3 && z < 8 && Math.abs(x) < 2.6 + radius;

/* ---------- the shot ---------- */
/** Camera override (for close-ups while developing): gets the frame and the character's smoothed position. */
export type CameraOverride = (frame: number, cx: number, cz: number) => CameraPose;
export const DemoScene: React.FC<{ frame: number; camera?: CameraOverride; script?: CharacterScript }> = ({ frame, camera, script = DEMO_SCRIPT }) => {
  const model = useAsset("character model", () => loadGltf(ASSET_PATHS.character));
  const animFiles = useAsset("animation files", () => Promise.all(ASSET_PATHS.animations.map(loadGltf)));
  const head = useAsset("head model", () => loadGltf(ASSET_PATHS.head));
  const hair = useAsset("hair parts", () => Promise.all(ASSET_PATHS.hairParts.map(loadGltf)));
  const extras = useMemo<Extra[] | undefined>(() => {
    if (head.status !== "ready" || hair.status !== "ready") return undefined;
    return [
      { gltf: head.data, include: (n) => n === "SuperHero_Male", headOnly: { minY: 1.5, maxAbsX: 0.16 }, morphs: mouthMorphs },
      { gltf: head.data, include: (n) => n === "Eyes", rigidSplit: { bone: "Head" } },
      { gltf: head.data, include: (n) => n === "Eyebrows", rigidSplit: { bone: "Head" }, tint: HAIR_TINT },
      ...hair.data.map((g) => ({ gltf: g, include: () => true, tint: HAIR_TINT, morphs: mouthMorphs })),
    ];
  }, [head, hair]);
  const clips = useMemo(() => (animFiles.status === "ready" ? animFiles.data.flatMap((g) => g.animations) : []), [animFiles]);
  const layout = useMemo(() => buildForestLayout(blocksView), []);
  const lantern = useMemo(makeLantern, []);
  const backpack = useMemo(makeBackpack, []);
  const attachments = useMemo(() => [{ bone: "hand_l", object: lantern.group }, { bone: "spine_03", object: backpack, bindSpace: true }], [lantern, backpack]);
  const characterReady = model.status === "ready" && animFiles.status === "ready" && head.status !== "loading" && hair.status !== "loading";

  // Foot-locked motion for the whole script. Built once; the crystal and the camera are placed from it.
  const motion = useMemo(() => {
    const zero = new Float32Array(FRAMES + 1);
    if (!characterReady) return { x: zero.fill(START[0]), z: new Float32Array(FRAMES + 1).fill(START[1]), yaw: new Float32Array(FRAMES + 1) };
    return buildMotion({ script, model: model.data, animations: clips, clips: CLIPS, fps: FPS, frames: FRAMES, height: CHARACTER_HEIGHT, feet: FEET, targets: {} });
  }, [characterReady, model, clips, script]);
  const smooth = useMemo(() => ({ x: smoothTravel(motion.x, 12), z: smoothTravel(motion.z, 12) }), [motion]);

  // beside the path, to the traveller's right and a little ahead, on a raised stone so that it is easy to see
  const crystal = useMemo<Vec3>(() => [motion.x[STOP_FRAME] - 1.1, 0.8, motion.z[STOP_FRAME] + 0.6], [motion]);
  const targets = useMemo<TargetTable>(() => ({
    crystal: () => crystal,
    camera: (f) => { const p = cameraPose(f, smooth.x[Math.min(f, FRAMES)], smooth.z[Math.min(f, FRAMES)]).pos; return [p.x, p.y - 0.05, p.z]; },
  }), [crystal, smooth]);
  const performance = useMemo(() => createPerformance(script, { targets, motion }, { mouth: applyMouth }), [script, targets, motion]);
  const chain = useMemo(() => locoChain(script), [script]);
  const weights = useMemo(() => clipWeightsFor(locoAt(chain, frame), CLIPS), [chain, frame]);
  const pose = useMemo(() => (f: number) => (camera ?? cameraPose)(f, smooth.x[clamp(Math.round(f), 0, FRAMES)], smooth.z[clamp(Math.round(f), 0, FRAMES)]), [smooth, camera]);

  const i = clamp(Math.round(frame), 0, FRAMES), x = motion.x[i], z = motion.z[i], yaw = motion.yaw[i];
  const dawn = dawnAt(frame);

  useLayoutEffect(() => {
    lantern.setGlow(frame, lerp(1.1, 1.7, dawn));
    hangFromBone(lantern.group, frame);
  }, [lantern, frame, dawn, characterReady]);

  return (
    <>
      <CameraRig frame={frame} pose={pose} />
      <Atmosphere dawn={dawn} />
      <SunLight dawn={dawn} subjectZ={smooth.z[i]} subjectX={smooth.x[i]} />
      <hemisphereLight args={["#a9c6e8", "#3b4a30", lerp(0.35, 0.5, dawn)]} />
      <directionalLight position={[5, 3, z - 8]} intensity={lerp(0.5, 1.0, dawn)} color="#9cc0ff" />
      <directionalLight position={[2.5, 2.2, z + 9]} intensity={lerp(0.5, 1.0, dawn)} color="#ffd9b4" />
      {characterReady ? <ContactShadow x={x} z={z} /> : null}
      <ForestEnvironment layout={layout} frame={frame} fps={FPS} dawn={dawn} subjectZ={smooth.z[i]} />
      {characterReady ? <Crystal position={crystal} frame={frame} /> : null}
      {characterReady ? (
        <AnimatedCharacter model={model.data} animations={clips} frame={frame} fps={FPS} weights={weights} height={CHARACTER_HEIGHT}
          position={[x, 0, z]} rotationY={yaw} attachments={attachments} envMapIntensity={ENV_INTENSITY} extras={extras} layers={performance.layers} />
      ) : model.status === "error" || animFiles.status === "error" ? (
        <CharacterPlaceholder position={[x, 0, z]} height={CHARACTER_HEIGHT} />
      ) : null}
    </>
  );
};

export const AnimationDemo: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#22364a" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        camera={{ position: [1, 1.2, -1.6], fov: 38, near: 0.1, far: 120 }}>
        <DemoScene frame={frame} />
      </ThreeCanvas>
      <Vignette />
    </AbsoluteFill>
  );
};

export const ANIMATION_DEMO_CONFIG = { id: "AnimationDemo", durationInFrames: FRAMES, fps: FPS, width: 1080, height: 1920 };
