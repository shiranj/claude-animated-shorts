# Character animation system (P2)

A story describes what a character does as a **typed list of actions on a frame timeline**. The system turns that list into a pose for every frame. It is not tied to one story, and every value is a pure function of the Remotion frame number, so any frame can be rendered alone.

## Write a story

```ts
import type { CharacterScript } from "./animation/script";

export const SCRIPT: CharacterScript = {
  start: { x: 0, z: -7, yaw: 0 },            // metres, degrees (0 = facing +z)
  actions: [
    { type: "walk",    from: 32,  to: 130 },                      // idle blends into a walk, then back to idle
    { type: "turn",    from: 60,  to: 140, yaw: -20 },            // curve to the right while walking
    { type: "carry",   hand: "left", from: 0, to: 420 },          // hold a lantern low, relaxed grip
    { type: "look",    from: 176, to: 350, at: { target: "crystal" } },
    { type: "startle", from: 226, to: 266 },                      // jolt + surprised face
    { type: "point",   from: 280, to: 350, hand: "right", at: "crystal" },
    { type: "emotion", emotion: "happy", from: 302, to: 416 },
  ],
};
```

Actions of different kinds run side by side. Movement actions (`idle`, `walk`, `run`) follow each other and blend. Angles are degrees; `+yaw` is to the character's left, `+pitch` is up. Names in `at` come from a target table you give the scene: `{ crystal: (frame) => [x, y, z] }`. A target can move.

| Action | What it does |
|---|---|
| `idle`, `walk`, `run` | Clip blending. The distance walked comes from the planted foot (`footLock.ts`), so feet do not skate. |
| `turn` | Eases the body heading. Walking while turning gives a curved path. `toward` faces a target. |
| `look` | Eyes lead, then neck and head follow after `lag` frames. Use `{ target }` or `{ yaw, pitch }`. |
| `emotion` | `happy`, `sad`, `angry`, `fear`, `surprise`: face and posture. Several can overlap. |
| `startle` | A sudden reaction: upper body snaps back, shoulders jump, arms lift, face reacts, then it settles. |
| `point`, `reach`, `wave` | Arm gestures by two-bone IK. `reach` opens the hand and closes it near the end. |
| `carry` | Holds a prop low and steady. The prop is attached to the hand bone. |

## How it fits together

| File | Role |
|---|---|
| `animation/script.ts` | The types and `evaluate()`: script + frame -> `FrameState`. Pure. |
| `animation/motion.ts` | `buildMotion()`: foot-locked position and heading for every frame. Built once. |
| `animation/performance.ts` | `createPerformance()`: the pose layers (posture, gaze, arms, hands, face). |
| `animation/hands.ts` | Finger poses (open, relaxed, point, grip, fist). |
| `animation/face.ts`, `animation/mouth.ts` | Eyes, eyelids, eyebrows, mouth. |
| `animation/rigtools.ts` | World-space bone rotation, two-bone IK, aim. No per-rig axis knowledge. |
| `AnimatedCharacter.tsx` | Plays clips, then runs `layers` (new `PoseLayer` prop), and holds the solid face pieces. |
| `props.ts` | `hangFromBone()` for lanterns and bags. |
| `SceneKit.tsx` | Shared contact shadow, camera, sky, sun, vignette. |
| `AnimationDemo.tsx`, `demoScript.ts` | The 14 s demo and its script. |

Order each frame: clips (`AnimationMixer.setTime`) -> bones no clip animates are reset to rest -> posture -> gaze -> arms -> fingers -> face. Nothing is kept between frames.

## Use it in a scene

```tsx
const motion = useMemo(() => buildMotion({ script, model, animations, clips, fps, frames, height, feet, targets }), [...]);
const performance = useMemo(() => createPerformance(script, { targets, motion }, { mouth: applyMouth }), [...]);
<AnimatedCharacter ... weights={clipWeightsFor(locoAt(chain, frame), CLIPS)} position={[x, 0, z]} rotationY={yaw} layers={performance.layers} extras={extras} />
```

`extras` needs the face pieces: `{ include: n => n === "Eyes", rigidSplit: { bone: "Head" } }`, the same for `Eyebrows`, and `morphs: mouthMorphs` on the head and the beard. See `AnimationDemo.tsx`.

## Faces, hands and props: what was found

- **No blend shapes, no jaw bone.** The head is one mesh. Eyes and eyebrows are separate meshes weighted only to the head bone, so they are cut into left and right solid pieces. Eyes turn toward the target, eyebrows move and tilt. Eyelids are two small skin-coloured shells that roll down for a blink (seeded, so the same frame always blinks the same). The mouth uses three morph targets made in code from the head vertices (`jaw`, `smile`, `lid`), applied to the beard too. A small dark shape shows the inside of the mouth. Wide eyes lift the upper-lid skin.
- **The fist problem.** Every clip in the Universal Animation Library holds the fingers in a tight fist (about 77 degrees at each joint). The hand layer sets the fingers itself after the clips, about each joint's x axis.
- **The lantern** is held with a loose grip, the hand follows the torso with IK, and the lantern hangs straight down in world space with a small sway.

## A second character (P3)

Face landmarks live in a `FaceProfile` (`animation/mouth.ts`), one per head: lip height, mouth corner x, eye x, upper and lower lid heights. To measure them for a new head, print the front (x near 0) profile of its head mesh by height: the nose tip is the largest z, the lips are the next bump below it, and the eye pieces' bounding box gives the eye height. `TRAVELLER_FACE` and `COMPANION_FACE` (in `actors.ts`) are two examples. Each actor also has its own blink seed, so two characters do not blink together. The Quaternius Female Ranger, Superhero Female head and Buns hair work with the same clips, layers and face code (see `TwoCharacterTest`).

## Limits

- No turn-in-place clip exists in the library. A turn while standing rotates the body without stepping. Turns are best made while walking.
- Foot drift is not zero in the blends: see README for numbers. Standing is exactly still.
- Arm gestures use IK. The hand twist (palm direction) is not controlled.
- The mouth is approximate: no speech shapes. At full-body distance only brows, eyes, head and body read clearly.
- Mouth and eyelid values are tuned for this one head. Another head needs new landmarks in `mouth.ts`.
- Two characters were tested in one 6 s scene (P3). Their motion, layers, face rigs and blink schedules are separate. More than two, or characters from other kits (different skeletons), were not tested.
