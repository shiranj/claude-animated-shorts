import React from "react";
import { useCurrentFrame } from "remotion";
import { StoryCanvas, type StoryConfig, type ActorSpec } from "../story";
import { peasantActor, travellerActor, companionActor } from "../actors";
import { CrystalProp } from "../CrystalProp";
import { TEMPLATES, pointTargets, type StorySpec } from "./index";

/* Turns a StorySpec (plain data) into the real scene, and registers one Remotion composition for each template.
 * Nothing about the story lives here: only the mapping from data to the existing actors, props and runtime. */

export const specToConfig = (s: StorySpec): StoryConfig => {
  const actors: ActorSpec[] = s.cast.map((c) => {
    const base = c.look.kit === "traveller" ? travellerActor(c.script, c.id) : c.look.kit === "companion" ? companionActor(c.script, c.id)
      : peasantActor({ id: c.id, script: c.script, gender: c.look.gender, hair: c.look.hair, hairTint: c.look.hairTint, beard: c.look.beard, height: c.look.height, watchGlow: c.look.watch ? () => 0 : undefined });
    return { ...base, appear: c.appear ?? base.appear };
  });
  const props = s.props ?? [];
  return {
    fps: s.fps, frames: s.frames, width: s.width, height: s.height, environment: s.environment,
    actors, targets: () => pointTargets(s.points), shots: s.shots, lighting: s.lighting, endFade: s.endFade,
    world: props.length ? ({ frame }) => <>{props.map((p, i) => <CrystalProp key={i} position={p.at} frame={frame} flashFrame={p.flashFrame ?? -1} />)}</> : undefined,
  };
};

export const SpecStory: React.FC<{ spec: StorySpec }> = ({ spec }) => {
  const cfg = React.useMemo(() => specToConfig(spec), [spec]);
  return <StoryCanvas cfg={cfg} frame={useCurrentFrame()} />;
};

/** One composition per template, with the default options (30 s, 1080 x 1920, 30 fps). */
export const templateCompositions = Object.entries(TEMPLATES).map(([name, make]) => {
  const spec = make();
  return { id: spec.id, name, spec, durationInFrames: spec.frames, fps: spec.fps, width: spec.width, height: spec.height };
});
