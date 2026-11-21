import * as THREE from "three";

/* ------------------------------------------------------------------------------------------------
 * Prop helpers. A prop is any THREE.Object3D that is attached to a hand bone (see the `attachments` prop of AnimatedCharacter).
 * Call one of these after the pose is set (in a layout effect that depends on the frame).
 * ---------------------------------------------------------------------------------------------- */

const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), swing = new THREE.Quaternion();

/**
 * Make a prop that is parented to a bone hang straight down in world space, with a small sway, and keep its real size in metres
 * (the bone is scaled by the character's fit scale). Use it for lanterns, bags, keys on a chain: things that hang.
 * The sway is a pure function of the frame.
 */
export const hangFromBone = (prop: THREE.Object3D, frame: number, sway = 1) => {
  const parent = prop.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  parent.getWorldQuaternion(q).invert();
  swing.setFromEuler(e.set(0.05 * sway * Math.sin(frame * 0.11), 0, 0.07 * sway * Math.sin(frame * 0.13 + 1)));
  prop.quaternion.copy(q).multiply(swing);
  prop.scale.setScalar(1 / parent.getWorldScale(s).x);
};

/** Keep a stiff prop (a staff, a tool) at its authored size in metres while it follows the bone's rotation. */
export const keepRealSize = (prop: THREE.Object3D) => {
  const parent = prop.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  prop.scale.setScalar(1 / parent.getWorldScale(s).x);
};
