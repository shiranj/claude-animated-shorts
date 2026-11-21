import * as THREE from "three";
import type { PoseContext } from "../AnimatedCharacter";
import type { FaceParams } from "./face";
import { clamp } from "./math";

/* ------------------------------------------------------------------------------------------------
 * Mouth. The head mesh has a closed mouth and no jaw bone, so two morph targets are made in code from the head's own vertices
 * (and the beard's, so the beard follows):
 *   jaw   - the lower face drops and moves back a little
 *   smile - the mouth corners go up and out (a negative value gives a frown)
 * When the mouth opens, a small dark shape behind the lips shows the inside of the mouth.
 * The landmarks live in a FaceProfile (metres, bind pose), one per head, so a second character brings its own.
 * ---------------------------------------------------------------------------------------------- */

/** Landmarks of one head in its bind pose, in metres. Measure them from the head mesh (see ANIMATION.md). */
export type FaceProfile = {
  /** Height of the closed lips, and x of each mouth corner. */
  lipY: number; cornerX: number;
  /** Z of the front of the lips (where the dark mouth shape is drawn). */
  frontZ: number; frontZSkin: number;
  /** x of each eye centre and the heights of the upper and lower lid edges. */
  eyeX: number; upperLidY: number; lowerLidY: number;
  /** Height of the cheek bulge used for smiling. */
  cheekY: number;
};
export const TRAVELLER_FACE: FaceProfile = { lipY: 1.628, cornerX: 0.026, frontZ: 0.095, frontZSkin: 0.088, eyeX: 0.031, upperLidY: 1.707, lowerLidY: 1.689, cheekY: 1.645 };

const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Makes the `morphs` function for AnimatedCharacter's Extra: jaw, smile and lid morph targets for a head. */
export const makeMouthMorphs = (P: FaceProfile) => (pos: THREE.BufferAttribute): Record<string, Float32Array> => {
  const jaw = new Float32Array(pos.count * 3), smile = new Float32Array(pos.count * 3), lid = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // jaw: the lower face, not the neck and not the back of the head
    const wJaw = smooth(P.lipY + 0.006, P.lipY - 0.022, y) * smooth(P.lipY - 0.078, P.lipY - 0.043, y) * Math.exp(-((x / 0.075) ** 2)) * smooth(-0.01, 0.05, z);
    jaw[i * 3 + 1] = -0.017 * wJaw; jaw[i * 3 + 2] = -0.004 * wJaw;
    // smile: around each mouth corner
    const side = x >= 0 ? 1 : -1;
    const r2 = ((x - side * P.cornerX) ** 2 + (y - P.lipY) ** 2 + ((z - P.frontZSkin) * 0.6) ** 2) / 0.016 ** 2;
    const wS = Math.exp(-r2) * smooth(0.0, 0.04, z);
    const wCheek = Math.exp(-(((x - side * 0.04) ** 2 + (y - P.cheekY) ** 2) / 0.03 ** 2)) * smooth(0.02, 0.06, z);
    smile[i * 3] = side * 0.0042 * wS; smile[i * 3 + 1] = 0.0095 * wS + 0.003 * wCheek; smile[i * 3 + 2] = -0.0012 * wS;
    // lid: the skin above and below each eye opening. +1 lifts the upper lid (wide eyes), -1 lowers it (narrowed eyes)
    const ex = x - side * P.eyeX, wUp = Math.exp(-((ex / 0.016) ** 2 + ((y - P.upperLidY) / 0.007) ** 2)) * smooth(0.04, 0.08, z);
    const wLow = Math.exp(-((ex / 0.014) ** 2 + ((y - P.lowerLidY) / 0.005) ** 2)) * smooth(0.04, 0.08, z);
    lid[i * 3 + 1] = 0.0045 * wUp - 0.0016 * wLow; lid[i * 3 + 2] = -0.0004 * wUp;
  }
  return { jaw, smile, lid };
};
export const mouthMorphs = makeMouthMorphs(TRAVELLER_FACE);

const cavities = new WeakMap<object, THREE.Mesh>();
const cavityTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d")!, r = g.createRadialGradient(32, 30, 2, 32, 32, 31);
  r.addColorStop(0, "rgba(18,5,6,1)"); r.addColorStop(0.7, "rgba(30,9,10,1)"); r.addColorStop(0.9, "rgba(48,16,15,0.75)"); r.addColorStop(1, "rgba(60,22,20,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const cavityMat = new THREE.MeshBasicMaterial({ map: cavityTexture, transparent: true, depthWrite: false, fog: false });

/** Makes the function that sets the mouth morphs and the inside-of-the-mouth shape for the face parameters of a frame. */
export const makeApplyMouth = (P: FaceProfile) => (ctx: PoseContext, p: FaceParams) => {
  for (const mesh of ctx.meshes.values()) {
    const d = mesh.morphTargetDictionary; if (!d || !mesh.morphTargetInfluences) continue;
    if ("jaw" in d) mesh.morphTargetInfluences[d.jaw] = p.jaw;
    if ("smile" in d) mesh.morphTargetInfluences[d.smile] = p.smile;
    if ("lid" in d) mesh.morphTargetInfluences[d.lid] = (p.lidEdge - 35) / 22;
  }
  let cavity = cavities.get(ctx.root);
  if (!cavity) {
    const frame = ctx.parts.get("Eyes_L")?.frame; // the head's bind-space frame
    if (!frame) return;
    cavity = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cavityMat);
    cavity.frustumCulled = false; cavity.renderOrder = 3;
    frame.add(cavity); cavities.set(ctx.root, cavity);
  }
  const open = clamp(p.jaw - 0.05, 0, 1);
  cavity.visible = open > 0.01;
  const halfH = 0.0125 * open, halfW = 0.0095 + 0.004 * open;
  cavity.scale.set(halfW, Math.max(halfH, 1e-4), 1);
  cavity.position.set(0, P.lipY - 0.0015 - halfH, P.frontZ + 0.0045);
};
export const applyMouth = makeApplyMouth(TRAVELLER_FACE);
