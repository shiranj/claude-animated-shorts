import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ActorSpec } from "./story";
import { makeLantern } from "./Lantern";
import { makeBackpack } from "./Backpack";
import { makePocketWatch } from "./PocketWatch";
import { hangFromBone } from "./props";
import { makeMouthMorphs, TRAVELLER_FACE, type FaceProfile } from "./animation/mouth";
import { ASSET_PATHS } from "./useAsset";
import type { CharacterScript } from "./animation/script";

/* Ready-made actors. An ActorSpec says which files make up a character, which face landmarks it has, and which props it carries.
 * The story only adds an id and a script. Character-specific settings stay here, so the animation code stays generic. */

const CLIPS = { idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop" };
const FEET: [string, string] = ["foot_l", "foot_r"];
const HAIR_TINT = "#7a5236";

/** The bearded traveller (Quaternius Male Ranger outfit + Superhero Male head + beard) with a lantern in the left hand and a backpack. */
export const travellerActor = (script: CharacterScript, id = "traveller"): ActorSpec => ({
  id,
  files: { model: ASSET_PATHS.character, head: ASSET_PATHS.head, hair: [...ASSET_PATHS.hairParts], animations: [...ASSET_PATHS.animations] },
  height: 1.75, clips: CLIPS, feet: FEET, script, face: TRAVELLER_FACE,
  extras: ({ head, hair }) => {
    if (!head) return [];
    const morphs = makeMouthMorphs(TRAVELLER_FACE);
    return [
      { gltf: head, include: (n) => n === "SuperHero_Male", headOnly: { minY: 1.5, maxAbsX: 0.16 }, morphs },
      { gltf: head, include: (n) => n === "Eyes", rigidSplit: { bone: "Head" } },
      { gltf: head, include: (n) => n === "Eyebrows", rigidSplit: { bone: "Head" }, tint: HAIR_TINT },
      ...hair.map((g: GLTF) => ({ gltf: g, include: () => true, tint: HAIR_TINT, morphs })),
    ];
  },
  props: () => {
    const lantern = makeLantern(), backpack = makeBackpack();
    return {
      attachments: [{ bone: "hand_l", object: lantern.group }, { bone: "spine_03", object: backpack, bindSpace: true }],
      update: (frame, look) => { lantern.setGlow(frame, 0.3 + 1.4 * look.practical); hangFromBone(lantern.group, frame); },
    };
  },
});

/** Face landmarks of the Quaternius "Superhero Female" head (metres, bind pose), measured the same way as the male head. */
export const COMPANION_FACE: FaceProfile = { lipY: 1.59, cornerX: 0.023, frontZ: 0.097, frontZSkin: 0.09, eyeX: 0.032, upperLidY: 1.665, lowerLidY: 1.646, cheekY: 1.607 };
const Q = "cinematic/characters/quaternius/";

/** A second character: Female Ranger outfit (same family as the traveller's), Superhero Female head and eyebrows, Buns hairstyle. No props. All CC0. */
export const companionActor = (script: CharacterScript, id = "companion"): ActorSpec => ({
  id,
  files: { model: `${Q}Female_Ranger.gltf`, head: `${Q}head/Superhero_Female_FullBody.gltf`, hair: [`${Q}head/Hair_Buns.gltf`], animations: [...ASSET_PATHS.animations] },
  height: 1.68, clips: CLIPS, feet: FEET, script, face: COMPANION_FACE,
  extras: ({ head, hair }) => {
    if (!head) return [];
    const morphs = makeMouthMorphs(COMPANION_FACE), tint = "#8a4b2a";
    return [
      { gltf: head, include: (n) => n === "Superhero_Female", headOnly: { minY: 1.45, maxAbsX: 0.16 }, morphs },
      { gltf: head, include: (n) => n === "Eyes", rigidSplit: { bone: "Head" } },
      { gltf: head, include: (n) => n === "Eyebrows", rigidSplit: { bone: "Head" }, tint },
      ...hair.map((g: GLTF) => ({ gltf: g, include: () => true, tint, morphs })),
    ];
  },
});

export type { FaceProfile };

/* ---------- Peasant outfits (second pack of the same family, same skeleton) ---------- */
export type PeasantOptions = {
  id: string;
  script: CharacterScript;
  gender: "male" | "female";
  /** Hairstyle part (file name without folder): Hair_SimpleParted, Hair_Long, Hair_Buns, Hair_Buzzed ... */
  hair: string;
  hairTint: string;
  height?: number;
  /** Glow of a pocket watch held in the right hand, as a function of the frame (0 = plain watch). Leave out for no watch. */
  watchGlow?: (frame: number) => number;
  beard?: boolean;
  blinkSeed?: number;
  appear?: [number, number];
};

/** A villager: Male or Female Peasant outfit, Superhero head and eyebrows, a hairstyle and an optional pocket watch. All CC0. */
export const peasantActor = (o: PeasantOptions): ActorSpec => {
  const male = o.gender === "male", face = male ? TRAVELLER_FACE : COMPANION_FACE, headFile = male ? "Superhero_Male_FullBody" : "Superhero_Female_FullBody";
  return {
    id: o.id,
    files: { model: `${Q}${male ? "Male" : "Female"}_Peasant.gltf`, head: `${Q}head/${headFile}.gltf`, hair: [`${Q}head/${o.hair}.gltf`, ...(o.beard ? [`${Q}head/Hair_Beard.gltf`] : [])], animations: [...ASSET_PATHS.animations] },
    height: o.height ?? (male ? 1.75 : 1.68), clips: CLIPS, feet: FEET, script: o.script, face, blinkSeed: o.blinkSeed, appear: o.appear,
    extras: ({ head, hair }) => {
      if (!head) return [];
      const morphs = makeMouthMorphs(face);
      return [
        { gltf: head, include: (n) => n === (male ? "SuperHero_Male" : "Superhero_Female"), headOnly: { minY: male ? 1.5 : 1.45, maxAbsX: 0.16 }, morphs },
        { gltf: head, include: (n) => n === "Eyes", rigidSplit: { bone: "Head" } },
        { gltf: head, include: (n) => n === "Eyebrows", rigidSplit: { bone: "Head" }, tint: o.hairTint },
        ...hair.map((g: GLTF) => ({ gltf: g, include: () => true, tint: o.hairTint, morphs })),
      ];
    },
    props: o.watchGlow ? () => {
      const watch = makePocketWatch(), glow = o.watchGlow!;
      return { attachments: [{ bone: "hand_r", object: watch.group }], update: (frame) => { watch.setGlow(frame, glow(frame)); hangFromBone(watch.group, frame, 0.8); } };
    } : undefined,
  };
};
