import React from "react";
import { useCurrentFrame } from "remotion";
import { StoryCanvas, type StoryConfig } from "./story";
import { travellerActor } from "./actors";
import { CrystalProp } from "./CrystalProp";
import { FLASH, FPS, FRAMES, LIGHTING_KEYS, SHOTS, STOPPED, TRAVELLER, targets } from "./storyDemoData";

/* ------------------------------------------------------------------------------------------------
 * P3 cinematic demo, 18 s, 1080x1920, 30 fps. "The crystal on the trail."
 * Six shots: wide establishing, medium tracking, over-the-shoulder, close-up reaction, medium with a prop interaction (the lantern
 * is lifted to look closer), final wide composition. Three lighting looks: night, magical, sunset.
 * The story itself (script, shots, lighting) is plain data in storyDemoData.ts. This file only adds the actor and the crystal.
 * ---------------------------------------------------------------------------------------------- */

export const STORY_DEMO: StoryConfig = {
  fps: FPS, frames: FRAMES,
  actors: [travellerActor(TRAVELLER)],
  targets,
  keepClear: (x, z, r) => z > -14 && z < 9 && Math.abs(x) < 2.6 + r,
  world: ({ frame, motions }) => {
    const t = motions.traveller;
    return <CrystalProp position={[t.x[STOPPED] - 1.1, 0.8, t.z[STOPPED] + 0.6]} frame={frame} flashFrame={FLASH} />;
  },
  shots: SHOTS,
  lighting: LIGHTING_KEYS,
  endFade: 24,
};

export const StoryDemo: React.FC = () => <StoryCanvas cfg={STORY_DEMO} frame={useCurrentFrame()} />;
export const STORY_DEMO_CONFIG = { id: "StoryDemo", durationInFrames: FRAMES, fps: FPS, width: 1080, height: 1920 };
