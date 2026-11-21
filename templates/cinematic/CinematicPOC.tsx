import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { AnimatedCharacter, CharacterPlaceholder, type ClipWeights } from "./AnimatedCharacter";
import { ENV_INTENSITY, ForestEnvironment, buildForestLayout } from "./ForestEnvironment";
import { ASSET_PATHS, loadGltf, useAsset } from "./useAsset";

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
const CHARACTER_HEIGHT = 1.6;
const WALK_SPEED = 0.45;            // scene units per second while walking (measured from the Walking_A stance foot, scaled to height)
const WALK_UNTIL = 185;             // frame where the traveller starts to slow
const STOP_BY = 225;                // frame where the traveller is standing still
const START_Z = -6;
const WALK_CLIP = "Walking_A";
const IDLE_CLIP = "Idle_A";

const walkWeight = (frame: number) => 1 - ease((frame - WALK_UNTIL) / (STOP_BY - WALK_UNTIL));
const clipWeights = (frame: number): ClipWeights => { const w = walkWeight(frame); return { [WALK_CLIP]: w, [IDLE_CLIP]: 1 - w }; };

/** Traveller position along the trail. Summed from frame 0 each time, so it never depends on render order. */
const travellerZ = (frame: number) => {
  let z = START_Z;
  for (let f = 0; f < frame; f++) z += (WALK_SPEED * walkWeight(f)) / FPS;
  return z;
};

const dawnAt = (frame: number) => ease((frame - 30) / 230);

/* ---------- camera ---------- */
const cameraAt = (frame: number) => {
  const z = travellerZ(frame);
  const push = ease((frame - 190) / 110);
  const dist = lerp(4.4, 3.8, push);
  const drift = ease(frame / FRAMES);
  return {
    pos: new THREE.Vector3(lerp(1.0, 0.3, drift), lerp(1.2, 1.05, push), z + dist),
    look: new THREE.Vector3(lerp(-0.05, 0, drift), lerp(0.95, 0.9, push), z),
    fov: lerp(38, 36, push),
  };
};

/** True when something at (x, z) with this radius would sit between the camera and the traveller at any point in the shot. */
const blocksView = (x: number, z: number, radius: number) => {
  for (let f = 0; f <= FRAMES; f += 15) {
    const c = cameraAt(f).pos, tz = travellerZ(f);
    const dx = 0 - c.x, dz = tz - c.z;
    const u = clamp(((x - c.x) * dx + (z - c.z) * dz) / (dx * dx + dz * dz));
    if (Math.hypot(x - (c.x + u * dx), z - (c.z + u * dz)) < radius) return true;
  }
  return false;
};

/* ---------- lantern: a small procedural prop held in the left hand ---------- */
const lanternGold = new THREE.MeshStandardMaterial({ color: "#c98d3a", roughness: 0.35, metalness: 0.7, envMapIntensity: ENV_INTENSITY });
const lanternGlass = new THREE.MeshStandardMaterial({ color: "#e89442", emissive: "#ff8a20", emissiveIntensity: 1.6, roughness: 0.4 });
const glowTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d")!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
})();
const shadowTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d")!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,0.85)"); r.addColorStop(0.55, "rgba(0,0,0,0.35)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
})();
const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: "#ff9a3c", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 });

/** The lantern hangs from the hand: its top ring is at the group origin, and the pieces hang below it. */
const makeLantern = () => {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -0.31;
  group.add(body);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; body.add(m); return m; };
  add(new THREE.BoxGeometry(0.2, 0.26, 0.2), lanternGlass, 0);
  add(new THREE.BoxGeometry(0.25, 0.04, 0.25), lanternGold, -0.15);
  add(new THREE.BoxGeometry(0.25, 0.04, 0.25), lanternGold, 0.15);
  add(new THREE.ConeGeometry(0.16, 0.1, 4), lanternGold, 0.22).rotation.y = Math.PI / 4;
  add(new THREE.TorusGeometry(0.07, 0.014, 6, 14), lanternGold, 0.31);
  const halo = new THREE.Sprite(glowMaterial);
  halo.scale.setScalar(1.25);
  body.add(halo);
  const light = new THREE.PointLight("#ffb454", 4, 7, 2);
  body.add(light);
  return { group, body, light };
};

/** Soft dark disc under the feet: grounds the character the way ambient occlusion would. */
const ContactShadow: React.FC<{ z: number }> = ({ z }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]} renderOrder={2}>
    <planeGeometry args={[1.15, 0.85]} />
    <meshBasicMaterial map={shadowTexture} transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-4} fog={false} />
  </mesh>
);

/* ---------- rigs: scene and camera state are set in layout effects, not during render ---------- */
const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const c = cameraAt(frame);
    camera.position.copy(c.pos);
    camera.fov = c.fov;
    camera.lookAt(c.look);
    camera.updateProjectionMatrix();
  }, [camera, frame]);
  return null;
};

const NIGHT_SKY = new THREE.Color("#22364a"), DAWN_SKY = new THREE.Color("#f0b98a");
const NIGHT_FOG = new THREE.Color("#2b4256"), DAWN_FOG = new THREE.Color("#e2b48e");
const Atmosphere: React.FC<{ dawn: number }> = ({ dawn }) => {
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
const SunLight: React.FC<{ dawn: number; subjectZ: number }> = ({ dawn, subjectZ }) => {
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
    light.position.set(SUN_OFFSET.x, SUN_OFFSET.y, subjectZ + SUN_OFFSET.z);
    light.target.position.set(0, 0, subjectZ);
    light.target.updateMatrixWorld();
    light.intensity = lerp(1.2, 3.4, dawn);
    light.color.set("#8fb0d4").lerp(new THREE.Color("#ffbd82"), dawn);
  }, [light, dawn, subjectZ]);
  return <><primitive object={light} dispose={null} /><primitive object={light.target} dispose={null} /></>;
};

/* ---------- the shot ---------- */
const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const model = useAsset("character model", () => loadGltf(ASSET_PATHS.character));
  const animFiles = useAsset("animation files", () => Promise.all(ASSET_PATHS.animations.map(loadGltf)));
  const clips = useMemo(() => (animFiles.status === "ready" ? animFiles.data.flatMap((g) => g.animations) : []), [animFiles]);
  const layout = useMemo(() => buildForestLayout(blocksView), []);
  const lantern = useMemo(makeLantern, []);
  const attachments = useMemo(() => [{ bone: "handslot.l", object: lantern.group }], [lantern]);
  const weights = useMemo(() => clipWeights(frame), [frame]);

  const dawn = dawnAt(frame);
  const z = travellerZ(frame);
  const characterReady = model.status === "ready" && animFiles.status === "ready";

  useLayoutEffect(() => {
    lantern.light.intensity = lerp(3.5, 5.5, dawn) * (1 + 0.06 * Math.sin(frame * 0.7) + 0.04 * Math.sin(frame * 1.9));
    // Keep the lantern hanging straight down in world space whatever the hand does, with a small sway.
    const parent = lantern.group.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      const q = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      lantern.group.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(frame * 0.11), 0, 0.07 * Math.sin(frame * 0.13 + 1))));
    }
  }, [lantern, frame, dawn, characterReady]);

  return (
    <>
      <CameraRig frame={frame} />
      <Atmosphere dawn={dawn} />
      <SunLight dawn={dawn} subjectZ={z} />
      <hemisphereLight args={["#a9c6e8", "#3b4a30", lerp(0.35, 0.5, dawn)]} />
      {/* cool rim from behind-right and a warm front fill so the face never goes dark */}
      <directionalLight position={[5, 3, z - 8]} intensity={lerp(0.5, 1.0, dawn)} color="#9cc0ff" />
      <directionalLight position={[2.5, 2.2, z + 9]} intensity={lerp(0.3, 0.7, dawn)} color="#ffd9b4" />
      {characterReady ? <ContactShadow z={z} /> : null}
      <ForestEnvironment layout={layout} frame={frame} fps={FPS} dawn={dawn} subjectZ={z} />
      {characterReady ? (
        <AnimatedCharacter model={model.data} animations={clips} frame={frame} fps={FPS} weights={weights}
          height={CHARACTER_HEIGHT} position={[0, 0, z]} attachments={attachments} envMapIntensity={ENV_INTENSITY} />
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
