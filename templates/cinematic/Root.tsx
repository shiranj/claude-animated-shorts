import React from "react";
import { Composition } from "remotion";
import { CinematicPOC, CINEMATIC_POC_CONFIG as C } from "./CinematicPOC";
import { AnimationDemo, ANIMATION_DEMO_CONFIG as D } from "./AnimationDemo";
import { StoryDemo, STORY_DEMO_CONFIG as S } from "./StoryDemo";
import { TwoCharacterTest, TWO_CHARACTER_CONFIG as T } from "./TwoCharacterTest";
import { FiveSeconds, FIVE_SECONDS_CONFIG as F } from "./stories/FiveSeconds";
import { SpecStory, templateCompositions } from "./story-templates/StoryFromSpec";

/** Minimal Remotion root for testing the cinematic starter on its own.
 *  In a real project, copy only the <Composition> into your existing Root.tsx. */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id={C.id} component={CinematicPOC} durationInFrames={C.durationInFrames} fps={C.fps} width={C.width} height={C.height} />
    <Composition id={D.id} component={AnimationDemo} durationInFrames={D.durationInFrames} fps={D.fps} width={D.width} height={D.height} />
    <Composition id={S.id} component={StoryDemo} durationInFrames={S.durationInFrames} fps={S.fps} width={S.width} height={S.height} />
    <Composition id={T.id} component={TwoCharacterTest} durationInFrames={T.durationInFrames} fps={T.fps} width={T.width} height={T.height} />
    <Composition id={F.id} component={FiveSeconds} durationInFrames={F.durationInFrames} fps={F.fps} width={F.width} height={F.height} />
    {templateCompositions.map((t) => <Composition key={t.id} id={t.id} component={SpecStory} defaultProps={{ spec: t.spec }} durationInFrames={t.durationInFrames} fps={t.fps} width={t.width} height={t.height} />)}
  </>
);
