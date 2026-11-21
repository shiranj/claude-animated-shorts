import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Skinned meshes taken from another glTF file that shares the character's skeleton (same bone names), for example a head, eyes, hair and
 * beard that come from a base-character kit. They are re-bound to this character's bones, so they follow the same animation.
 */
export type Extra = {
  gltf: GLTF;
  /** Which skinned meshes of that file to use, by name. */
  include: (meshName: string) => boolean;
  /** Keep only triangles above `minY` and within `maxAbsX` of the centre (bind pose). Used to take just the head and neck from a full-body mesh. */
  headOnly?: { minY: number; maxAbsX: number };
  /** Multiply the part's colour by this (the kit's hair texture is a grey palette meant to be tinted). The material is cloned, not changed. */
  tint?: string;
  /**
   * For a skinned mesh that is weighted to ONE bone (eyes, eyebrows): turn it into two solid pieces, one for each side of x = 0, named
   * `${name}_L` (x > 0) and `${name}_R` (x < 0). Each piece has a pivot at its centre, so a pose layer can rotate and move it (eye direction, eyebrows).
   */
  rigidSplit?: { bone: string };
  /** Adds morph targets (by name) to the part. `positions` are the bind-pose vertices. Return, for each name, one xyz offset per vertex. */
  morphs?: (positions: THREE.BufferAttribute) => Record<string, Float32Array>;
};

/** A solid piece cut from a skinned mesh (see `Extra.rigidSplit`). `pivot` sits at the piece's centre; `centre` is that point in bind space. */
export type RigidPart = { name: string; bone: string; frame: THREE.Group; pivot: THREE.Group; centre: THREE.Vector3; mesh: THREE.Mesh };

/** Everything a pose layer needs. Layers run after the animation clips have been applied for this frame. */
export type PoseContext = {
  frame: number;
  fps: number;
  /** Root of the cloned character. Call `root.updateWorldMatrix(true, true)` before reading world positions. */
  root: THREE.Object3D;
  bone: (name: string) => THREE.Bone | undefined;
  /** Local rotation of every bone in the bind pose. */
  rest: Map<string, THREE.Quaternion>;
  /** Rotation of every bone in model space in the bind pose. */
  restWorld: Map<string, THREE.Quaternion>;
  parts: Map<string, RigidPart>;
  /** Meshes (skinned parts) by name, for morph targets. */
  meshes: Map<string, THREE.Mesh>;
  /** Scale from model units to scene units. */
  scale: number;
};
/** Changes the pose after the clips are applied (look-at, hands, expressions ...). It must be a pure function of the context, so any frame can be rendered alone. */
export type PoseLayer = (ctx: PoseContext) => void;

const splitSide = (src: THREE.SkinnedMesh, side: 1 | -1) => {
  const pos = src.geometry.attributes.position as THREE.BufferAttribute, index = src.geometry.index!;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    if ((pos.getX(a) + pos.getX(b) + pos.getX(c)) * side > 0) kept.push(a, b, c);
  }
  // Re-index so the new geometry holds only the used vertices.
  const map = new Map<number, number>(), order: number[] = [];
  const idx = kept.map((v) => { if (!map.has(v)) { map.set(v, order.length); order.push(v); } return map.get(v)!; });
  const g = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const a = src.geometry.attributes[name] as THREE.BufferAttribute | undefined; if (!a) continue;
    const arr = new Float32Array(order.length * a.itemSize);
    order.forEach((v, k) => { for (let c = 0; c < a.itemSize; c++) arr[k * a.itemSize + c] = a.getComponent(v, c); });
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(idx);
  g.computeBoundingBox();
  return g;
};

/** Copy skinned meshes from `extra.gltf` onto the skeleton of `rig`. Solid pieces (`rigidSplit`) are returned; they are attached to their bones later. */
const adoptSkinned = (rig: THREE.Object3D, extra: Extra, parts: Map<string, RigidPart>, meshes: Map<string, THREE.Mesh>) => {
  const parent = rig.getObjectByName("Armature") ?? rig;
  extra.gltf.scene.traverse((o) => {
    const src = o as THREE.SkinnedMesh;
    if (!src.isSkinnedMesh || !extra.include(src.name)) return;
    const bones = src.skeleton.bones.map((b) => rig.getObjectByName(b.name) as THREE.Bone | undefined);
    if (bones.some((b) => !b)) { console.warn(`[cinematic] "${src.name}" uses bones this character does not have; skipped.`); return; }
    let geometry = src.geometry;
    if (extra.headOnly) {
      const { minY, maxAbsX } = extra.headOnly, pos = geometry.attributes.position as THREE.BufferAttribute, index = geometry.index!;
      const kept: number[] = [];
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        if ([a, b, c].every((v) => pos.getY(v) >= minY && Math.abs(pos.getX(v)) <= maxAbsX)) kept.push(a, b, c);
      }
      geometry = geometry.clone();
      geometry.setIndex(kept);
    }
    let material = src.material as THREE.Material;
    if (extra.rigidSplit) {
      if (extra.tint && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        material = material.clone();
        (material as THREE.MeshStandardMaterial).color.multiply(new THREE.Color(extra.tint));
      }
      for (const [suffix, side] of [["L", 1], ["R", -1]] as const) {
        const g = splitSide(src, side), centre = g.boundingBox!.getCenter(new THREE.Vector3());
        g.translate(-centre.x, -centre.y, -centre.z);
        const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
        const pivot = new THREE.Group(); pivot.position.copy(centre); pivot.add(mesh);
        const frame = new THREE.Group(); frame.add(pivot);
        parts.set(`${src.name}_${suffix}`, { name: `${src.name}_${suffix}`, bone: extra.rigidSplit.bone, frame, pivot, centre, mesh });
      }
      return;
    }
    if (extra.tint && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      material = material.clone();
      (material as THREE.MeshStandardMaterial).color.multiply(new THREE.Color(extra.tint));
    }
    let morphNames: string[] = [];
    if (extra.morphs) {
      geometry = geometry === src.geometry ? geometry.clone() : geometry;
      const set = extra.morphs(geometry.attributes.position as THREE.BufferAttribute);
      morphNames = Object.keys(set);
      geometry.morphAttributes.position = Object.values(set).map((a) => new THREE.BufferAttribute(a, 3));
      geometry.morphTargetsRelative = true;
    }
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = src.name;
    if (morphNames.length) {
      mesh.updateMorphTargets();
      morphNames.forEach((k, i) => { mesh.morphTargetDictionary![k] = i; });
    }
    meshes.set(src.name, mesh);
    mesh.bind(new THREE.Skeleton(bones as THREE.Bone[], src.skeleton.boneInverses), src.bindMatrix);
    parent.add(mesh);
  });
};

/** Blend weight per animation clip name for one frame, e.g. { Walking_A: 0.7, Idle_A: 0.3 }. Weights should sum to 1. */
export type ClipWeights = Record<string, number>;

/** `bindSpace`: the object is authored in the model's own bind-pose space (y up, metres); it is converted so it follows the bone. Otherwise it is placed in the bone's own space. */
export type Attachment = { bone: string; object: THREE.Object3D; bindSpace?: boolean };

type Props = {
  model: GLTF;
  /** Clips from the character file and/or separate animation files. Clips bind to bones by name. */
  animations: THREE.AnimationClip[];
  frame: number;
  fps: number;
  weights: ClipWeights;
  /** Standing height in scene units. The model is scaled so its bind-pose bounding box has this height, feet on y = 0. */
  height?: number;
  position?: [number, number, number];
  rotationY?: number;
  /** Objects parented to a bone (for example a lantern in a hand slot). Bone names use the glTF names, e.g. "handslot.l". */
  attachments?: Attachment[];
  /** Strength of image-based (HDRI) light on the character's standard materials. */
  envMapIntensity?: number;
  /** Return true for mesh names that should not be drawn (for example parts hidden under clothing). */
  hide?: (meshName: string) => boolean;
  /** Extra skinned parts from other files (head, hair ...). Keep this array stable (useMemo). */
  extras?: Extra[];
  /** Pose layers, run in order after the clips are applied (look-at, hands, expressions ...). Keep this array stable (useMemo). */
  layers?: PoseLayer[];
};

export const safeName = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n); // GLTFLoader strips "." from node names

/** Scale that makes the model's bind-pose bounding box `height` tall, and the y offset that puts its lowest point on y = 0. */
export const fitModel = (root: THREE.Object3D, height: number) => {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const scale = height / Math.max(box.max.y - box.min.y, 1e-6);
  return { scale, footOffset: -box.min.y * scale };
};

/**
 * A skinned, animated character whose pose is a pure function of `frame`.
 * `AnimationMixer.setTime()` resets every action to time 0 and then applies `time`, so nothing accumulates between frames:
 * rendering frame N on its own gives the same pose as rendering frames 0..N in order.
 */
export const AnimatedCharacter: React.FC<Props> = ({ model, animations, frame, fps, weights, height = 1.6, position = [0, 0, 0], rotationY = 0, attachments = [], envMapIntensity, hide, extras, layers }) => {
  const rig = useMemo(() => {
    const root = cloneSkinned(model.scene);
    const parts = new Map<string, RigidPart>(), meshes = new Map<string, THREE.Mesh>();
    for (const e of extras ?? []) adoptSkinned(root, e, parts, meshes);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (hide?.(mesh.name)) { mesh.visible = false; return; }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // skinned bounds are from the bind pose, so never cull a posed character
      if (envMapIntensity !== undefined) {
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) (m as THREE.MeshStandardMaterial).envMapIntensity = envMapIntensity;
      }
    });
    const { scale, footOffset } = fitModel(root, height);
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of animations) {
      if (actions.has(clip.name)) continue;
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      actions.set(clip.name, action);
    }
    const inverseBind = new Map<string, THREE.Matrix4>(); // bone name -> inverse of its bind-pose matrix, in model space
    const bones = new Map<string, THREE.Bone>(), rest = new Map<string, THREE.Quaternion>(), restWorld = new Map<string, THREE.Quaternion>();
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (!b.isBone) return;
      inverseBind.set(b.name, b.matrixWorld.clone().invert());
      bones.set(b.name, b); rest.set(b.name, b.quaternion.clone());
      const q = new THREE.Quaternion(); b.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); restWorld.set(b.name, q);
    });
    // Bones that no clip animates would keep a layer's changes from the previous frame; they are reset to rest before the layers run.
    const tracked = new Set<string>();
    for (const clip of animations) for (const t of clip.tracks) tracked.add(t.name.split(".")[0]);
    const untracked = [...bones.keys()].filter((n) => !tracked.has(n));
    return { root, mixer, actions, scale, footOffset, inverseBind, parts, meshes, bones, rest, restWorld, untracked };
  }, [model, animations, height, envMapIntensity, hide, extras]);

  // Parent attachments to their bones once.
  useLayoutEffect(() => {
    const added: { parent: THREE.Object3D; object: THREE.Object3D }[] = [];
    for (const a of attachments) {
      const bone = rig.root.getObjectByName(safeName(a.bone));
      if (!bone) { console.warn(`[cinematic] Bone "${a.bone}" not found; attachment skipped.`); continue; }
      if (a.bindSpace) rig.inverseBind.get(bone.name)?.decompose(a.object.position, a.object.quaternion, a.object.scale);
      bone.add(a.object);
      added.push({ parent: bone, object: a.object });
    }
    return () => added.forEach(({ parent, object }) => parent.remove(object));
  }, [rig, attachments]);

  // Solid face pieces (eyes, eyebrows) go on their bones, placed in bind space like bind-space attachments.
  useLayoutEffect(() => {
    const added: { parent: THREE.Object3D; object: THREE.Object3D }[] = [];
    for (const p of rig.parts.values()) {
      const bone = rig.bones.get(safeName(p.bone));
      if (!bone) { console.warn(`[cinematic] Bone "${p.bone}" not found; "${p.name}" skipped.`); continue; }
      rig.inverseBind.get(bone.name)?.decompose(p.frame.position, p.frame.quaternion, p.frame.scale);
      bone.add(p.frame);
      added.push({ parent: bone, object: p.frame });
    }
    return () => added.forEach(({ parent, object }) => parent.remove(object));
  }, [rig]);

  const ctx = useMemo<PoseContext>(() => ({
    frame: 0, fps: 30, root: rig.root, scale: rig.scale, rest: rig.rest, restWorld: rig.restWorld, parts: rig.parts, meshes: rig.meshes,
    bone: (n) => rig.bones.get(safeName(n)),
  }), [rig]);

  // Pose from the frame number only: clips first, then the layers.
  useLayoutEffect(() => {
    for (const [name, action] of rig.actions) action.setEffectiveWeight(weights[name] ?? 0);
    rig.mixer.setTime(frame / fps);
    if (!layers?.length) return;
    for (const n of rig.untracked) rig.bones.get(n)!.quaternion.copy(rig.rest.get(n)!);
    ctx.frame = frame; ctx.fps = fps;
    rig.root.updateWorldMatrix(true, true);
    for (const layer of layers) layer(ctx);
  }, [rig, ctx, frame, fps, weights, layers]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, rig.footOffset, 0]} scale={rig.scale}>
        <primitive object={rig.root} dispose={null} />
      </group>
    </group>
  );
};

/** Shown instead of the character when the GLB is missing, so a missing download is obvious and nothing crashes. */
export const CharacterPlaceholder: React.FC<{ position?: [number, number, number]; height?: number }> = ({ position = [0, 0, 0], height = 1.6 }) => (
  <group position={position}>
    <mesh position={[0, height * 0.36, 0]}><capsuleGeometry args={[height * 0.16, height * 0.4, 6, 12]} /><meshStandardMaterial color="#d03c3c" /></mesh>
    <mesh position={[0, height * 0.86, 0]}><sphereGeometry args={[height * 0.14, 16, 12]} /><meshStandardMaterial color="#d03c3c" /></mesh>
  </group>
);
