import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { AnimatedCharacter, CharacterPlaceholder, type ClipWeights, type Extra } from "./AnimatedCharacter";
import { ENV_INTENSITY, ForestEnvironment, buildForestLayout } from "./ForestEnvironment";
import { makeLantern } from "./Lantern";
import { makeBackpack } from "./Backpack";
import { computeTravel, smoothTravel } from "./footLock";
import { ASSET_PATHS, loadGltf, useAsset } from "./useAsset";
import { Atmosphere, CameraRig, ContactShadow, SunLight } from "./SceneKit";

/* ------------------------------------------------------------------------------------------------
 * Cinematic proof of concept, 10 s, 1080x1920, 30 fps.
 * A traveller walks a forest trail toward the camera at dawn, slows, and stops; the camera tracks backward,
 * then pushes in. Every value below is a pure function of the Remotion frame number.
 * ---------------------------------------------------------------------------------------------- */

const FPS = 30;
const FRAMES = 300;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- timeline ---------- */
const CHARACTER_HEIGHT = 1.75;
const WALK_UNTIL = 174;             // frame where the walk starts to blend into the idle (chosen by sweeping for the least foot sliding)
const STOP_BY = 210;                // frame where the traveller is standing still
const START_Z = -7;
const WALK_CLIP = "Walk_Loop";
const IDLE_CLIP = "Idle_Loop";
const HAIR_TINT = "#7a5236"; // the kit's hair texture is grey; this makes it a medium-dark brown
const FEET: [string, string] = ["foot_l", "foot_r"];

const walkWeight = (frame: number) => 1 - ease((frame - WALK_UNTIL) / (STOP_BY - WALK_UNTIL));
const clipWeights = (frame: number): ClipWeights => { const w = walkWeight(frame); return { [WALK_CLIP]: w, [IDLE_CLIP]: 1 - w }; };
const dawnAt = (frame: number) => ease((frame - 30) / 230);

/** Where the traveller is, as a function of the frame. Built from the animation itself (see footLock.ts) so planted feet do not slide. */
type TravelPath = { z: (frame: number) => number; camZ: (frame: number) => number };
const EST_SPEED = 0.88; // rough speed, only used to lay out the scenery before the animation has loaded
const estimatePath: TravelPath = (() => {
  const z = (f: number) => START_Z + (EST_SPEED / FPS) * (Math.min(f, WALK_UNTIL) + 0.5 * Math.max(0, Math.min(f, STOP_BY) - WALK_UNTIL));
  return { z, camZ: z };
})();
const pathFrom = (table: Float32Array): TravelPath => {
  const smooth = smoothTravel(table, 12);
  return { z: (f) => START_Z + table[clamp(Math.round(f), 0, table.length - 1)], camZ: (f) => START_Z + smooth[clamp(Math.round(f), 0, table.length - 1)] };
};

/* ---------- camera ---------- */
const cameraAt = (frame: number, path: TravelPath) => {
  const z = path.camZ(frame);
  const push = ease((frame - 195) / 105);
  const drift = ease(frame / FRAMES);
  const dist = lerp(4.7, 4.0, push);
  return {
    pos: new THREE.Vector3(lerp(1.05, 0.35, drift), lerp(1.3, 1.2, push), z + dist),
    look: new THREE.Vector3(lerp(-0.05, 0, drift), lerp(0.98, 0.95, push), z),
    fov: lerp(38, 35, push),
  };
};

/** True when something at (x, z) with this radius would sit between the camera and the traveller at any point in the shot. */
const blocksView = (x: number, z: number, radius: number) => {
  for (let f = 0; f <= FRAMES; f += 15) {
    const c = cameraAt(f, estimatePath).pos, tz = estimatePath.z(f);
    const dx = 0 - c.x, dz = tz - c.z;
    const u = clamp(((x - c.x) * dx + (z - c.z) * dz) / (dx * dx + dz * dz));
    if (Math.hypot(x - (c.x + u * dx), z - (c.z + u * dz)) < radius) return true;
  }
  return false;
};

/* ---------- the shot ---------- */
const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const model = useAsset("character model", () => loadGltf(ASSET_PATHS.character));
  const animFiles = useAsset("animation files", () => Promise.all(ASSET_PATHS.animations.map(loadGltf)));
  const head = useAsset("head model", () => loadGltf(ASSET_PATHS.head));
  const hair = useAsset("hair parts", () => Promise.all(ASSET_PATHS.hairParts.map(loadGltf)));
  // Head, eyes and eyebrows from the base-character kit (full-body mesh cropped to head and neck), plus beard, all on the outfit's skeleton.
  const extras = useMemo<Extra[] | undefined>(() => {
    if (head.status !== "ready" || hair.status !== "ready") return undefined;
    return [
      { gltf: head.data, include: (n) => n === "SuperHero_Male", headOnly: { minY: 1.5, maxAbsX: 0.16 } },
      { gltf: head.data, include: (n) => n === "Eyes" || n === "Eyebrows", tint: HAIR_TINT },
      ...hair.data.map((g) => ({ gltf: g, include: () => true, tint: HAIR_TINT })),
    ];
  }, [head, hair]);
  const clips = useMemo(() => (animFiles.status === "ready" ? animFiles.data.flatMap((g) => g.animations) : []), [animFiles]);
  const layout = useMemo(() => buildForestLayout(blocksView), []);
  const lantern = useMemo(makeLantern, []);
  const backpack = useMemo(makeBackpack, []);
  const attachments = useMemo(() => [
    { bone: "hand_l", object: lantern.group },
    { bone: "spine_03", object: backpack, bindSpace: true },
  ], [lantern, backpack]);
  const weights = useMemo(() => clipWeights(frame), [frame]);

  const characterReady = model.status === "ready" && animFiles.status === "ready" && head.status !== "loading" && hair.status !== "loading";
  // Foot-locked travel table: built once from the clips actually used, so the feet never slide.
  const path = useMemo(() => {
    if (!characterReady) return estimatePath;
    return pathFrom(computeTravel({ model: model.data, animations: clips, weightsAt: clipWeights, fps: FPS, frames: FRAMES, height: CHARACTER_HEIGHT, feet: FEET }));
  }, [characterReady, model, clips]);

  const pathCamera = useMemo(() => (f: number) => cameraAt(f, path), [path]);
  const dawn = dawnAt(frame);
  const z = path.z(frame);

  useLayoutEffect(() => {
    lantern.setGlow(frame, lerp(1.1, 1.7, dawn));
    // Keep the lantern hanging straight down in world space whatever the hand does, with a small sway,
    // and cancel the bone's scale so the lantern is always its real size in metres.
    const parent = lantern.group.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      const q = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      lantern.group.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(frame * 0.11), 0, 0.07 * Math.sin(frame * 0.13 + 1))));
      lantern.group.scale.setScalar(1 / parent.getWorldScale(new THREE.Vector3()).x);
    }
  }, [lantern, frame, dawn, characterReady]);

  return (
    <>
      <CameraRig frame={frame} pose={pathCamera} />
      <Atmosphere dawn={dawn} />
      <SunLight dawn={dawn} subjectZ={path.camZ(frame)} />
      <hemisphereLight args={["#a9c6e8", "#3b4a30", lerp(0.35, 0.5, dawn)]} />
      {/* cool rim from behind-right and a warm front fill so the face never goes dark */}
      <directionalLight position={[5, 3, z - 8]} intensity={lerp(0.5, 1.0, dawn)} color="#9cc0ff" />
      <directionalLight position={[2.5, 2.2, z + 9]} intensity={lerp(0.5, 1.0, dawn)} color="#ffd9b4" />
      {characterReady ? <ContactShadow z={z} /> : null}
      <ForestEnvironment layout={layout} frame={frame} fps={FPS} dawn={dawn} subjectZ={z} />
      {characterReady ? (
        <AnimatedCharacter model={model.data} animations={clips} frame={frame} fps={FPS} weights={weights}
          height={CHARACTER_HEIGHT} position={[0, 0, z]} attachments={attachments} envMapIntensity={ENV_INTENSITY} extras={extras} />
      ) : model.status === "error" || animFiles.status === "error" ? (
        <CharacterPlaceholder position={[0, 0, z]} height={CHARACTER_HEIGHT} />
      ) : null}
    </>
  );
};

export const CinematicPOC: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#22364a" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        camera={{ position: [1, 1.2, -1.6], fov: 38, near: 0.1, far: 120 }}>
        <Scene frame={frame} />
      </ThreeCanvas>
      {/* gentle vignette: draws the eye to the traveller */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(8,10,18,0.42) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export const CINEMATIC_POC_CONFIG = { id: "CinematicPOC", durationInFrames: FRAMES, fps: FPS, width: 1080, height: 1920 };
