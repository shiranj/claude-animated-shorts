import React from "react";
import { useCurrentFrame } from "remotion";
import { StoryCanvas, type StoryConfig } from "./story";
import { companionActor, travellerActor } from "./actors";
import { COMPANION, FPS, FRAMES, LIGHTING_KEYS, SHOTS, TRAVELLER_2, targets } from "./twoCharacterData";

/* Two characters in one scene (compatibility test). Each actor has its own script, motion, performance layers, face landmarks and blink schedule. */
export const TWO_CHARACTER_TEST: StoryConfig = {
  fps: FPS, frames: FRAMES,
  actors: [travellerActor(TRAVELLER_2), companionActor(COMPANION)],
  targets, shots: SHOTS, lighting: LIGHTING_KEYS,
  keepClear: (x, z, r) => z > -14 && z < 9 && Math.abs(x) < 3.2 + r,
};
export const TwoCharacterTest: React.FC = () => <StoryCanvas cfg={TWO_CHARACTER_TEST} frame={useCurrentFrame()} />;
export const TWO_CHARACTER_CONFIG = { id: "TwoCharacterTest", durationInFrames: FRAMES, fps: FPS, width: 1080, height: 1920 };
