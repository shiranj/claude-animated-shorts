# Cinematic production (P3)

How to turn a story into a sequence of cinematic shots, check it, render it safely, and check the result. Everything is a function of the frame number, so any frame can be rendered alone.

## 1. A story is data

`StoryConfig` (see `story.tsx`) has: actors (each with its own `CharacterScript`), shots (camera), lighting keys, named targets, world objects. `StoryDemo.tsx` and `storyDemoData.ts` are a full example; `TwoCharacterTest.tsx` shows two actors.

```ts
shots: [
  shot("establishing", 0, 120, presets.establishingWide([0.4, 0, -6], { fit: 7.5 }), { end: pushIn(...), motion: "late" }),
  shot("tracking",   120, 232, presets.medium("traveller", { follow: "live", fit: 1.9 }), { transition: { type: "blend", frames: 54 } }),
  shot("reaction",   284, 350, presets.closeUp("traveller", { follow: "live", azimuth: -32 }), { transition: { type: "cut" } }),
],
lighting: [{ frame: 0, preset: "night" }, { frame: 250, preset: "magical", blend: 40 }, { frame: 400, preset: "sunset", blend: 90 }],
```

## 2. Camera (`camera/`)

A framing says where the camera stands relative to a focus (a character, an object or a fixed point): `fit` (metres of world that fit in the frame height, so the shot size does not depend on the lens), `azimuth` and `elevation` around the focus (`relative: true` measures from the way a character faces), `screen` (where the focus sits in the frame, -1 to 1; 0.33 is a third line; done as a lens shift, so the horizon stays level), `fov`. A shot can have an `end` framing: the camera moves between them (push-in, pull-back, orbit, tilt, pan). `follow: "live"` tracks a moving subject using a smoothed path; `"locked"` stays where the subject was when the shot began.

| Preset | Use |
|---|---|
| `establishingWide` | The place; subject small, lens slightly high, subject low and to one side. `fit` 6.5 to 7.5. |
| `fullBody` | Whole body, slightly below eye level. `fit` about 2.6 (about 4.6 for two people in 9:16). |
| `medium` | Waist up, for acting. `fit` about 1.5. |
| `closeUp` | Head and shoulders for a reaction. `fit` about 0.85. Keep it short. |
| `overShoulder(lookAt, subject)` | Camera behind the subject (behind the way it faces), looking at an object. Aim it at a point between the subject and the object, or one of them leaves the 9:16 frame. |
| `lowAngle` | Hero shot from below. |
| `pushIn`, `pullBack`, `orbit`, `tilt`, `tracking` | Change a framing to build the `end` of a shot. |

**Traps found while building the demo:** `focus.height` is *added* to the target's own height; a narrow 9:16 frame fits only about 0.56 x `fit` metres across, so two people 1.5 m apart need `fit` of 4 or more; a target seen from the side needs the camera aimed between the two things.

Transitions: `cut`, `blend` (the camera glides from the previous shot's last pose; keep it above about 40 frames when the camera travels several metres), `fade` (through a colour). A real two-picture dissolve is **not** implemented: it needs two renders per frame. Use `fade` or `blend`.

**Check it before rendering:** `node check-shots.mjs storyDemoData.ts` projects every actor's head and feet through the camera on every frame (safe area 86 % x 90 % of the frame), reports heads at the edge, actors behind the camera, feet cut off in full-body shots, head size in pixels and the fastest camera move. Exit code 2 = problems. Actors that walk in on purpose can set `visible: [from, to]`. Over-the-shoulder shots are checked on the thing looked at.

## 3. Lighting (`lighting.tsx`)

Presets are plain data: `daylight`, `night`, `sunset` (the approved P1.1 forest look), `indoorWarm`, `dramaticLowKey`, `magical`. `lightingAt(keys, frame)` blends from preset to preset. `<LightRig>` applies sky, fog, ambient, key (the only shadow caster, it follows the subject), rim, fill and exposure. `practical` scales lights that belong to props (the lantern).

**Post-processing (`post.tsx`, off by default).** Bloom and SSAO were tested on two frames (see `docs/p3-results/p3_postprocessing_compare.jpg`). Neither is turned on: bloom washed the whole grade toward beige and darkened the night even with matching ACES tone mapping, and SSAO added visible noise dots around the hood and the foliage. The cost per still was within noise (about 3.7 to 4.2 s). The code is there for a story that wants to tune it; the stock look needs no post-processing.

## 4. Rendering safely on Windows

1. **Check the GPU first:** `node check-gpu.mjs`. It must say NVIDIA (or another discrete card). On this PC the render browser uses the RTX 5060 Ti. If it says Intel, set chrome.exe to High performance in Windows Settings > System > Display > Graphics.
2. **Render with the measuring tool:** `node render-measured.mjs index.ts StoryDemo out/story.mp4 --concurrency 4`. It runs the GPU check, counts only its own processes (Node, Chrome, FFmpeg), writes `out/story.mp4.report.json` (time, peak memory, samples) and `out/story.mp4.log` (browser errors and warnings). `--timeout` sets the per-frame wait in ms.
3. **Use `--concurrency 4`.** Measured on this PC (20 logical cores), 540 frames: 2 tabs 90 s / 3.0 GB, 4 tabs 88 s / 4.3 GB, 6 tabs 88 s / 5.6 GB, 10 tabs 89 s / 8.2 GB. More tabs did not make it faster, only larger: the GPU is the limit. Each tab loads its own copy of the textures.
4. **2K textures** (`downscale-textures.py`) are the default. Keep 4K only for a still.
5. **Do not render while other heavy GPU work runs.** An earlier P2 run stalled Windows; there is no code cause that was found, but the GPU check and `--timeout` make a stall easier to see.
6. NVIDIA hardware encoding exists in Remotion (`hardwareAcceleration`), but Remotion switches it off when `--crf` is used, and encoding is not the bottleneck. It was not adopted.

## 5. Check the video (`qa-video.py`)

`python qa-video.py out/story.mp4 out/qa --frames 540 --cuts 232,284 --fades 450,540 --shot-check out/shot-check.json --render-report out/story.mp4.report.json`

It checks: the file exists and decodes; resolution, frame rate, frame count, codec; black, white, very dark and very bright frames; frozen frames; large jumps between frames (listed cuts and fades are expected); the composition issues from `check-shots`; and it writes `contact-sheet.jpg`, two phone-size sheets (360 x 640), and `qa-report.md` / `.json`. It was tested on a synthetic bad video (wrong size, black, frozen and white frames were all caught). It **cannot** judge beauty, expression readability or clipping of hands and props: look at the phone-size sheets.

## 6. Two characters

`actors.ts` has `travellerActor` and `companionActor` (Quaternius Female Ranger outfit + Superhero Female head + Buns hair, all CC0). Each actor carries its own face landmarks (`FaceProfile`), hair tint, props and blink seed; the animation code is the same. To add a character: measure its face landmarks (see ANIMATION.md), write an `ActorSpec`, and give it an `id`. `TwoCharacterTest` is a 6 s proof (walk in, look, startle, wave).

## 7. Added in P4

- **Places:** `StoryConfig.environment` is `"forest"` (default), `"workshop"` or `"studio"` (`environments.tsx`, all made in code). `width` and `height` set the frame size and the lens aspect, so a 16:9 story works the same way (the composition check uses them too).
- **Actors that enter:** `ActorSpec.appear: [from, to]` draws an actor only in those frames, so someone can come in through a door without standing in it before.
- **Hands:** finger poses are per joint (no claw), with `relaxed`, `cupped`, `flat`, `open`, `fist`, `point`, `grip`. The script action `{ type: "hand", hand, pose }` sets a pose by name or by single fingers.
- **Composition check (`check-shots.mjs`)** now also reports: watched props (`watch: [{ name, frames }]` in the story data) that leave the safe area, camera speed above a limit (6 m/s by default, `maxCameraSpeed`), a face that may be too small on a phone, a subject low in a tight shot or far to the side (warnings). An actor's `visible` can be a list of ranges: close-ups of someone else leave an actor out on purpose. `SHOT_POSITIONS=1` prints where the actors stand every 60 frames.
- **Repeatability:** see [DETERMINISM.md](DETERMINISM.md).
- **Entry point:** `node produce.mjs` (doctor, check, stills, render, audio, mux, qa, spec). `produce.mjs mux` normalises the sound to about -16 LUFS.
- **Templates:** [story-templates/README.md](story-templates/README.md).
