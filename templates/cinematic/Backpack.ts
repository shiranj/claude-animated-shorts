import * as THREE from "three";
import { ENV_INTENSITY } from "./ForestEnvironment";

/* ------------------------------------------------------------------------------------------------
 * A traveller's backpack, authored in metres in the model's bind-pose space (y up, +z forward, back of the torso at about z = -0.21).
 * Attach it with { bone: "spine_03", object: group, bindSpace: true } so it follows the spine.
 * Leather pack with a flap and buckled straps, a rolled blanket on top, a side pouch, and two shoulder straps.
 * ---------------------------------------------------------------------------------------------- */

const leather = new THREE.MeshStandardMaterial({ color: "#6a4527", roughness: 0.72, metalness: 0, envMapIntensity: ENV_INTENSITY });
const leatherDark = new THREE.MeshStandardMaterial({ color: "#3f2a19", roughness: 0.8, envMapIntensity: ENV_INTENSITY });
const canvas = new THREE.MeshStandardMaterial({ color: "#b9a37a", roughness: 0.95, envMapIntensity: ENV_INTENSITY });
const brass = new THREE.MeshStandardMaterial({ color: "#a37c35", roughness: 0.4, metalness: 0.85, envMapIntensity: ENV_INTENSITY * 1.5 });

/** A box with rounded edges: a subdivided box whose vertices are pushed out from an inner box by the radius. */
const roundedBox = (w: number, h: number, d: number, r: number, seg = 5) => {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3(), inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(THREE.MathUtils.clamp(v.x, -inner.x, inner.x), THREE.MathUtils.clamp(v.y, -inner.y, inner.y), THREE.MathUtils.clamp(v.z, -inner.z, inner.z));
    const dir = v.clone().sub(c); if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(r);
    p.setXYZ(i, c.x + dir.x, c.y + dir.y, c.z + dir.z);
  }
  g.computeVertexNormals();
  return g;
};

const packGeo = roundedBox(0.3, 0.4, 0.15, 0.04);
const flapGeo = roundedBox(0.31, 0.15, 0.16, 0.03);
const pouchGeo = roundedBox(0.09, 0.14, 0.07, 0.02, 3);
const rollGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.34, 14);
const strapFlatGeo = roundedBox(0.032, 0.2, 0.012, 0.004, 2);
const buckleGeo = new THREE.BoxGeometry(0.03, 0.026, 0.01);

// Shoulder straps: the part over the shoulder is hidden under the hood; only the chest section shows.
const strapCurve = (side: number) => new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.1 * side, 1.4, -0.28), new THREE.Vector3(0.12 * side, 1.49, -0.2), new THREE.Vector3(0.13 * side, 1.5, -0.05),
  new THREE.Vector3(0.14 * side, 1.46, 0.07), new THREE.Vector3(0.145 * side, 1.36, 0.125), new THREE.Vector3(0.15 * side, 1.24, 0.11),
]);

export const makeBackpack = () => {
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  };
  add(packGeo, leather, 0, 1.3, -0.3);
  add(flapGeo, leatherDark, 0, 1.46, -0.3);
  add(pouchGeo, leather, 0.17, 1.2, -0.28);
  add(pouchGeo, leather, -0.17, 1.2, -0.28);
  add(rollGeo, canvas, 0, 1.55, -0.3).rotation.z = Math.PI / 2; // rolled blanket across the top
  for (const x of [-0.1, 0.1]) { // straps that hold the roll
    const m = add(strapFlatGeo, leatherDark, x, 1.46, -0.382); m.scale.set(1, 1.6, 1);
    m.rotation.x = 0;
    add(buckleGeo, brass, x, 1.43, -0.383);
  }
  for (const side of [-1, 1]) { // shoulder straps
    const tube = new THREE.Mesh(new THREE.TubeGeometry(strapCurve(side), 28, 0.019, 6), leatherDark);
    tube.scale.set(1, 1, 1); tube.castShadow = true; tube.receiveShadow = true; group.add(tube);
  }
  return group;
};
