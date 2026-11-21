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
 * The landmarks below are for the Quaternius "Superhero Male" head in its bind pose (metres). Another head needs new values.
 * ---------------------------------------------------------------------------------------------- */

const LIP_Y = 1.628, CORNER_X = 0.026, FRONT_Z = 0.095;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const EYE_X = 0.031, UPPER_LID_Y = 1.707;

export const mouthMorphs = (pos: THREE.BufferAttribute): Record<string, Float32Array> => {
  const jaw = new Float32Array(pos.count * 3), smile = new Float32Array(pos.count * 3), lid = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // jaw: the lower face, not the neck and not the back of the head
    const wJaw = smooth(LIP_Y + 0.006, LIP_Y - 0.022, y) * smooth(1.55, 1.585, y) * Math.exp(-((x / 0.075) ** 2)) * smooth(-0.01, 0.05, z);
    jaw[i * 3 + 1] = -0.017 * wJaw; jaw[i * 3 + 2] = -0.004 * wJaw;
    // smile: around each mouth corner
    const side = x >= 0 ? 1 : -1;
    const r2 = ((x - side * CORNER_X) ** 2 + (y - LIP_Y) ** 2 + ((z - 0.088) * 0.6) ** 2) / 0.016 ** 2;
    const wS = Math.exp(-r2) * smooth(0.0, 0.04, z);
    const wCheek = Math.exp(-(((x - side * 0.04) ** 2 + (y - 1.645) ** 2) / 0.03 ** 2)) * smooth(0.02, 0.06, z);
    smile[i * 3] = side * 0.0042 * wS; smile[i * 3 + 1] = 0.0095 * wS + 0.003 * wCheek; smile[i * 3 + 2] = -0.0012 * wS;
    // lid: the skin above and below each eye opening. +1 lifts the upper lid (wide eyes), -1 lowers it (narrowed eyes)
    const ex = x - side * EYE_X, wUp = Math.exp(-((ex / 0.016) ** 2 + ((y - UPPER_LID_Y) / 0.007) ** 2)) * smooth(0.04, 0.08, z);
    const wLow = Math.exp(-((ex / 0.014) ** 2 + ((y - 1.689) / 0.005) ** 2)) * smooth(0.04, 0.08, z);
    lid[i * 3 + 1] = 0.0045 * wUp - 0.0016 * wLow; lid[i * 3 + 2] = -0.0004 * wUp;
  }
  return { jaw, smile, lid };
};

const cavities = new WeakMap<object, THREE.Mesh>();
const cavityTexture = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d")!, r = g.createRadialGradient(32, 30, 2, 32, 32, 31);
  r.addColorStop(0, "rgba(18,5,6,1)"); r.addColorStop(0.7, "rgba(30,9,10,1)"); r.addColorStop(0.9, "rgba(48,16,15,0.75)"); r.addColorStop(1, "rgba(60,22,20,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const cavityMat = new THREE.MeshBasicMaterial({ map: cavityTexture, transparent: true, depthWrite: false, fog: false });

/** Sets the mouth morphs and the inside-of-the-mouth shape for the face parameters of this frame. */
export const applyMouth = (ctx: PoseContext, p: FaceParams) => {
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
  cavity.position.set(0, LIP_Y - 0.0015 - halfH, FRONT_Z + 0.0045);
};
