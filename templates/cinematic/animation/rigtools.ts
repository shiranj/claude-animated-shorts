import * as THREE from "three";
import { clamp } from "./math";

/* ------------------------------------------------------------------------------------------------
 * Bone tools that work in world space, so they do not depend on how a particular rig orients its bones.
 * They read and write bone.quaternion only. Everything uses module-level temporaries: no allocation per frame.
 * ---------------------------------------------------------------------------------------------- */

const IDENTITY = new THREE.Quaternion();
// separate temporaries per function, so one tool never overwrites another's values
const dq1 = new THREE.Quaternion(), dq2 = new THREE.Quaternion(), dq3 = new THREE.Quaternion(), dv1 = new THREE.Vector3(), dv2 = new THREE.Vector3();
const cq = new THREE.Quaternion(), cv = new THREE.Vector3();
const ia = new THREE.Vector3(), ib = new THREE.Vector3(), ic = new THREE.Vector3(), id = new THREE.Vector3(), ip = new THREE.Vector3(), ie = new THREE.Vector3(), iu0 = new THREE.Vector3(), iu1 = new THREE.Vector3(), ir = new THREE.Vector3();
const iq = new THREE.Quaternion();
const av1 = new THREE.Vector3(), av2 = new THREE.Vector3(), av3 = new THREE.Vector3();
const axisTmp = new THREE.Vector3(), axisQ = new THREE.Quaternion();

/** Rotate a bone by a world-space rotation (applied about the bone's own joint). Updates the bone's children. */
export const applyWorldDelta = (bone: THREE.Object3D, delta: THREE.Quaternion, weight = 1) => {
  if (weight <= 0) return;
  const parent = bone.parent!;
  parent.updateWorldMatrix(true, false);
  parent.matrixWorld.decompose(dv1, dq1, dv2); // dq1 = parent world rotation
  dq2.copy(delta); if (weight < 1) dq2.slerp(IDENTITY, 1 - weight).normalize();
  // new local = P^-1 * delta * P * local
  dq3.copy(dq1).invert().multiply(dq2).multiply(dq1);
  bone.quaternion.premultiply(dq3);
  bone.updateWorldMatrix(false, true);
};

/** Rotate a bone by `angle` radians about a world-space axis (right-hand rule). */
export const rotateBoneWorld = (bone: THREE.Object3D, axis: THREE.Vector3, angle: number, weight = 1) => {
  if (!angle || weight <= 0) return;
  applyWorldDelta(bone, axisQ.setFromAxisAngle(axis, angle), weight);
};
/** Same as rotateBoneWorld, with the axis given as numbers. */
export const rotateBoneAxis = (bone: THREE.Object3D, ax: number, ay: number, az: number, angle: number, weight = 1) => {
  if (!angle || weight <= 0) return;
  applyWorldDelta(bone, axisQ.setFromAxisAngle(axisTmp.set(ax, ay, az), angle), weight);
};

/** Local rotation of a bone: its bind rotation turned by `angle` about its own x axis. Used for finger curls. */
export const setCurl = (bone: THREE.Object3D, rest: THREE.Quaternion, angle: number) => {
  bone.quaternion.copy(rest).multiply(cq.setFromAxisAngle(cv.set(1, 0, 0), angle));
  bone.updateMatrix();
};

/** World position of an object (matrices must be up to date). */
export const worldPos = (o: THREE.Object3D, out: THREE.Vector3) => out.setFromMatrixPosition(o.matrixWorld);

/**
 * Two-bone IK for an arm or leg: moves the chain upper -> lower -> end so that `end` reaches `target` (world space).
 * `pole` is a world direction that the elbow should bend toward. `weight` blends from the animated pose (0) to the solved pose (1).
 * Returns the distance from the end to the target after solving.
 */
export const solveTwoBone = (upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, weight: number) => {
  if (weight <= 0) return 0;
  upper.updateWorldMatrix(true, true);
  worldPos(upper, ia); worldPos(lower, ib); worldPos(end, ic);
  const l1 = ia.distanceTo(ib), l2 = ib.distanceTo(ic);
  id.copy(target).sub(ia);
  const dist = clamp(id.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
  id.normalize();
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  // elbow position: in the plane of the shoulder-target line and the pole direction
  ip.copy(pole).addScaledVector(id, -pole.dot(id));
  if (ip.lengthSq() < 1e-8) ip.set(0, -1, 0).addScaledVector(id, id.y); // pole parallel to the reach: use "down"
  ip.normalize();
  ie.copy(ia).addScaledVector(id, l1 * cosA).addScaledVector(ip, l1 * sinA);
  // 1) swing the upper bone so the elbow is where we want it
  iu0.copy(ib).sub(ia).normalize(); iu1.copy(ie).sub(ia).normalize();
  applyWorldDelta(upper, iq.setFromUnitVectors(iu0, iu1), weight);
  // 2) swing the lower bone so the hand reaches the target
  upper.updateWorldMatrix(true, true);
  worldPos(lower, ib); worldPos(end, ic);
  ir.copy(ia).addScaledVector(id, dist);
  iu0.copy(ic).sub(ib).normalize(); iu1.copy(ir).sub(ib).normalize();
  applyWorldDelta(lower, iq.setFromUnitVectors(iu0, iu1), weight);
  worldPos(end, ic);
  return ic.distanceTo(target);
};

/** Turn `bone` so that the direction from the bone to `tip` points along `dir` (world space, need not be normalised). */
export const aimBone = (bone: THREE.Object3D, tip: THREE.Object3D, dir: THREE.Vector3, weight = 1) => {
  bone.updateWorldMatrix(true, true);
  worldPos(bone, av1); worldPos(tip, av2);
  av2.sub(av1).normalize(); av3.copy(dir).normalize();
  applyWorldDelta(bone, axisQ.setFromUnitVectors(av2, av3), weight);
};
