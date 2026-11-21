import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AnimatedCharacter, CharacterPlaceholder, type Attachment, type Extra } from "./AnimatedCharacter";
import { ENV_INTENSITY, ForestEnvironment, buildForestLayout } from "./ForestEnvironment";
import { loadGltf, useAsset } from "./useAsset";
import { CameraRig, ContactShadow, Vignette } from "./SceneKit";
import { PostFX, type PostSettings } from "./post";
import { LightRig, lightingAt, type Lighting, type LightingKey } from "./lighting";
import { evaluateCamera, type CameraState, type Shot } from "./camera/shots";
import { makeRefs } from "./camera/refs";
import { buildMotion, clipWeightsFor, type ClipNames, type Motion } from "./animation/motion";
import { createPerformance, type Performance } from "./animation/performance";
import { makeApplyMouth, type FaceProfile } from "./animation/mouth";
import { clamp } from "./animation/math";
import { locoAt, locoChain, type CharacterScript, type TargetTable, type Vec3 } from "./animation/script";

/* ------------------------------------------------------------------------------------------------
 * Story runtime: a typed description of a whole scene turned into frames.
 *
 *   StoryConfig = actors (each with its own CharacterScript) + shots (camera) + lighting keys + world objects.
 *
 * `useStory` loads the assets, builds every actor's foot-locked motion, and evaluates camera, lighting and actor states for a
 * frame. `<StoryCanvas>` renders it. Nothing here knows about a particular story: see StoryDemo.tsx for one.
 * Every value is a function of the frame number; actors do not share any changing state.
 * ---------------------------------------------------------------------------------------------- */

export type ActorSpec = {
  /** Unique name. Also the camera and look-at target name for this actor (feet position); `${id}.head` is its head. */
  id: string;
  /** Paths under public/. `head` and `hair` are for characters built from an outfit plus a separate head. */
  files: { model: string; head?: string; hair?: string[]; animations: string[] };
  height: number;
  clips: ClipNames;
  feet: [string, string];
  script: CharacterScript;
  /** Face landmarks of this character's head (see animation/mouth.ts). */
  face: FaceProfile;
  /** Builds the skinned extras (head, eyes, eyebrows, hair) from the loaded files. */
  extras: (g: { model: GLTF; head: GLTF | null; hair: GLTF[] }) => Extra[];
  /** Seed for blinking. Defaults to a number made from `id`, so characters differ. */
  blinkSeed?: number;
  /** Mesh names to hide (for example the eyes of a full-body model, when the solid eye pieces replace them). */
  hide?: (meshName: string) => boolean;
  /** Props held or worn by this actor. `update` runs each frame after the pose is set. */
  props?: () => { attachments: Attachment[]; update: (frame: number, look: Lighting) => void };
};

export type StoryConfig = {
  fps: number;
  frames: number;
  actors: ActorSpec[];
  shots: Shot[];
  lighting: LightingKey[];
  /** Named points that are not actors. May depend on where the actors end up (motions are given). */
  targets?: (motions: Record<string, Motion>) => TargetTable;
  /** Extra things in the world (a crystal, a campfire). Rendered inside the 3D scene. */
  world?: React.FC<{ frame: number; look: Lighting; motions: Record<string, Motion> }>;
  /** Keep this region free of trees: return true where a tree must not stand. */
  keepClear?: (x: number, z: number, radius: number) => boolean;
  /** Shadow map size. 2048 is the default. */
  shadowSize?: number;
  /** Optional post-processing (bloom, ambient occlusion). Off by default. */
  post?: PostSettings;
  /** Fade to black over the last N frames. */
  endFade?: number;
};

type ActorRuntime = {
  spec: ActorSpec;
  model: GLTF;
  clips: THREE.AnimationClip[];
  extras: Extra[];
  motion: Motion;
  performance: Performance;
  chain: ReturnType<typeof locoChain>;
  props: ReturnType<NonNullable<ActorSpec["props"]>> | null;
  attachments: Attachment[];
};

export type Story = {
  ready: boolean;
  failed: boolean;
  actors: ActorRuntime[];
  motions: Record<string, Motion>;
  smooth: Record<string, { x: Float32Array; z: Float32Array }>;
  camera: CameraState;
  look: Lighting;
  layout: ReturnType<typeof buildForestLayout>;
};

const ZERO = (n: number, v = 0) => new Float32Array(n + 1).fill(v);
const FALLBACK_CAMERA: CameraState = { pos: new THREE.Vector3(1, 1.3, -2), look: new THREE.Vector3(0, 1, -7), fov: 36, roll: 0, fade: { opacity: 0, color: "#000" }, shot: 0 };

/** Load everything and evaluate the story at `frame`. Call from a component outside the 3D canvas. */
export const useStory = (cfg: StoryConfig, frame: number): Story => {
  // One set of loaders per actor. The number of actors never changes for a given story, so the hook order is stable.
  const loaded = cfg.actors.map((spec) => {
    const model = useAsset(spec.files.model, () => loadGltf(spec.files.model));
    const head = useAsset(`${spec.id}:head:${spec.files.head ?? "-"}`, () => (spec.files.head ? loadGltf(spec.files.head) : Promise.resolve(null)));
    const hair = useAsset(`${spec.id}:hair:${(spec.files.hair ?? []).join(",")}`, () => Promise.all((spec.files.hair ?? []).map(loadGltf)));
    const anims = useAsset(`${spec.id}:anims:${spec.files.animations.join(",")}`, () => Promise.all(spec.files.animations.map(loadGltf)));
    return { spec, model, head, hair, anims };
  });
  const ready = loaded.every((l) => l.model.status === "ready" && l.anims.status === "ready" && l.head.status !== "loading" && l.hair.status !== "loading");
  const failed = loaded.some((l) => l.model.status === "error" || l.anims.status === "error");
  const layout = useMemo(() => buildForestLayout(cfg.keepClear ?? (() => false)), [cfg]);

  // Phase 1: motions (need no actor-to-actor targets). Phase 2: full target table, performances, camera.
  const built = useMemo(() => {
    if (!ready) return null;
    const stage1 = cfg.targets ? cfg.targets({}) : {};
    const motions: Record<string, Motion> = {};
    const rts = loaded.map((l) => {
      const spec = l.spec, model = (l.model as { data: GLTF }).data;
      const clips = (l.anims as { data: GLTF[] }).data.flatMap((g) => g.animations);
      const motion = buildMotion({ script: spec.script, model, animations: clips, clips: spec.clips, fps: cfg.fps, frames: cfg.frames, height: spec.height, feet: spec.feet, targets: stage1 });
      motions[spec.id] = motion;
      const extras = spec.extras({ model, head: l.head.status === "ready" ? l.head.data : null, hair: l.hair.status === "ready" ? l.hair.data : [] });
      const props = spec.props ? spec.props() : null;
      return { spec, model, clips, extras, motion, chain: locoChain(spec.script), props, attachments: props?.attachments ?? [] };
    });
    const targets: TargetTable = { ...(cfg.targets ? cfg.targets(motions) : {}) };
    for (const r of rts) {
      const m = r.motion, h = r.spec.height * 0.93;
      targets[r.spec.id] = (f) => { const i = clamp(Math.round(f), 0, cfg.frames); return [m.x[i], 0, m.z[i]]; };
      targets[`${r.spec.id}.head`] = (f) => { const i = clamp(Math.round(f), 0, cfg.frames); return [m.x[i], h, m.z[i]]; };
    }
    const actors: ActorRuntime[] = rts.map((r) => ({ ...r, performance: createPerformance(r.spec.script, { targets, motion: r.motion }, { mouth: makeApplyMouth(r.spec.face), blinkSeed: r.spec.blinkSeed ?? [...r.spec.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) }) }));
    const { refs } = makeRefs(motions, targets, cfg.frames);
    return { actors, motions, refs, smooth: makeRefs(motions, targets, cfg.frames).smooth };
  }, [ready, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const camera = useMemo(() => (built ? evaluateCamera(cfg.shots, frame, built.refs) : FALLBACK_CAMERA), [built, cfg, frame]);
  const look = useMemo(() => lightingAt(cfg.lighting, frame), [cfg, frame]);
  return { ready, failed, actors: built?.actors ?? [], motions: built?.motions ?? {}, smooth: built?.smooth ?? {}, camera, look, layout };
};

/* ---------- the 3D scene ---------- */
const ActorView: React.FC<{ a: ActorRuntime; frame: number; fps: number; frames: number; look: Lighting }> = ({ a, frame, fps, frames, look }) => {
  const i = clamp(Math.round(frame), 0, frames);
  const x = a.motion.x[i], z = a.motion.z[i], yaw = a.motion.yaw[i];
  const weights = useMemo(() => clipWeightsFor(locoAt(a.chain, frame), a.spec.clips), [a, frame]);
  useLayoutEffect(() => { a.props?.update(frame, look); }, [a, frame, look]);
  return (
    <>
      <ContactShadow x={x} z={z} />
      <AnimatedCharacter model={a.model} animations={a.clips} frame={frame} fps={fps} weights={weights} height={a.spec.height}
        position={[x, 0, z]} rotationY={yaw} attachments={a.attachments} envMapIntensity={ENV_INTENSITY} extras={a.extras} hide={a.spec.hide} layers={a.performance.layers} />
    </>
  );
};

const StoryScene: React.FC<{ cfg: StoryConfig; story: Story; frame: number }> = ({ cfg, story, frame }) => {
  const World = cfg.world;
  const main = story.actors[0];
  const i = clamp(Math.round(frame), 0, cfg.frames);
  const subject = useMemo<[number, number, number]>(() => (main ? [story.smooth[main.spec.id].x[i], 0, story.smooth[main.spec.id].z[i]] : [0, 0, -7]), [main, story.smooth, i]);
  const pose = useMemo(() => () => ({ pos: story.camera.pos, look: story.camera.look, fov: story.camera.fov }), [story.camera]);
  return (
    <>
      <CameraRig frame={frame} pose={pose} deps={story.camera} />
      <LightRig look={story.look} subject={subject} shadowSize={cfg.shadowSize} />
      <ForestEnvironment layout={story.layout} frame={frame} fps={cfg.fps} dawn={story.look.shafts} subjectZ={subject[2]} />
      {story.ready ? <>{World ? <World frame={frame} look={story.look} motions={story.motions} /> : null}{story.actors.map((a) => <ActorView key={a.spec.id} a={a} frame={frame} fps={cfg.fps} frames={cfg.frames} look={story.look} />)}</> : null}
      {story.failed ? <CharacterPlaceholder position={[0, 0, -7]} /> : null}
    </>
  );
};

/** The whole shot as a Remotion component: 3D canvas, fade overlay, vignette. */
export const StoryCanvas: React.FC<{ cfg: StoryConfig; frame: number }> = ({ cfg, frame }) => {
  const story = useStory(cfg, frame);
  const endFade = cfg.endFade ? clamp((frame - (cfg.frames - cfg.endFade)) / cfg.endFade) : 0;
  const fadeOpacity = Math.max(story.camera.fade.opacity, endFade);
  return (
    <AbsoluteFill style={{ backgroundColor: "#22364a" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        camera={{ position: [1, 1.2, -1.6], fov: 38, near: 0.1, far: 120 }}>
        <StoryScene cfg={cfg} story={story} frame={frame} />
        {cfg.post ? <PostFX settings={cfg.post} /> : null}
      </ThreeCanvas>
      <Vignette />
      {fadeOpacity > 0.001 ? <AbsoluteFill style={{ backgroundColor: endFade > story.camera.fade.opacity ? "#000000" : story.camera.fade.color, opacity: fadeOpacity, pointerEvents: "none" }} /> : null}
    </AbsoluteFill>
  );
};
