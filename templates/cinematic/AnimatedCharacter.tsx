import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/** Blend weight per animation clip name for one frame, e.g. { Walking_A: 0.7, Idle_A: 0.3 }. Weights should sum to 1. */
export type ClipWeights = Record<string, number>;

export type Attachment = { bone: string; object: THREE.Object3D };

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
};

const safeName = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n); // GLTFLoader strips "." from node names

/**
 * A skinned, animated character whose pose is a pure function of `frame`.
 * `AnimationMixer.setTime()` resets every action to time 0 and then applies `time`, so nothing accumulates between frames:
 * rendering frame N on its own gives the same pose as rendering frames 0..N in order.
 */
export const AnimatedCharacter: React.FC<Props> = ({ model, animations, frame, fps, weights, height = 1.6, position = [0, 0, 0], rotationY = 0, attachments = [], envMapIntensity }) => {
  const rig = useMemo(() => {
    const root = cloneSkinned(model.scene);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // skinned bounds are from the bind pose, so never cull a posed character
      if (envMapIntensity !== undefined) {
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) (m as THREE.MeshStandardMaterial).envMapIntensity = envMapIntensity;
      }
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const scale = height / Math.max(box.max.y - box.min.y, 1e-6);
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of animations) {
      if (actions.has(clip.name)) continue;
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      actions.set(clip.name, action);
    }
    return { root, mixer, actions, scale, footOffset: -box.min.y * scale };
  }, [model, animations, height, envMapIntensity]);

  // Parent attachments to their bones once.
  useLayoutEffect(() => {
    const added: { parent: THREE.Object3D; object: THREE.Object3D }[] = [];
    for (const a of attachments) {
      const bone = rig.root.getObjectByName(safeName(a.bone));
      if (!bone) { console.warn(`[cinematic] Bone "${a.bone}" not found; attachment skipped.`); continue; }
      bone.add(a.object);
      added.push({ parent: bone, object: a.object });
    }
    return () => added.forEach(({ parent, object }) => parent.remove(object));
  }, [rig, attachments]);

  // Pose from the frame number only.
  useLayoutEffect(() => {
    for (const [name, action] of rig.actions) action.setEffectiveWeight(weights[name] ?? 0);
    rig.mixer.setTime(frame / fps);
  }, [rig, frame, fps, weights]);

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
