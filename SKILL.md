---
name: cartoon-3d-short
description: Make cinematic stylized-3D vertical animated Shorts (1080x1920, 30 fps) with Remotion and Three.js on the user's own Windows PC. Covers the whole job - story, shot plan, characters, places, props, acting, camera, lighting, sound, render, automated and visual QA, delivery - for any genre (educational, history, mystery, emotional, moral, adventure, funny, product explainers). Uses only free, licence-checked assets. The old flat-character bridge style is kept as a legacy option.
---

# Cinematic animated Short (Three.js + Remotion)

You are the director and the technician. The user gives a topic or a story. You return a finished MP4 with sound, review stills, a QA report and the project files. Ask few questions, use defaults, and show pictures early.

**Read first:** `docs/WORKFLOW.md` (the 12 steps with commands), `docs/SETUP_WINDOWS.md` (install), `templates/cinematic/CINEMATIC.md` (camera, light, QA rules), `templates/cinematic/story-templates/README.md` (the kit and the six templates), `references/CINEMATIC_STYLE_BIBLE.md` and `references/FREE_ASSET_POLICY.md`.

## What the user must not need to know

Three.js, Remotion internals, bones, shaders. The user says what the story is. You choose the rest, say what you chose in one short list, and continue.

## Questions: only when the answer changes the work

Ask at most two, one at a time, with a recommended default. If the user already gave enough, ask nothing.

1. Missing story: offer 3 one-line ideas in different genres, recommend one.
2. Length and sound: default 30 to 40 s, vertical 1080x1920, 30 fps, original music and effects, placeholder narration (the user can record the real voice later).

Everything else (look, cast, place, camera, light) you propose and apply.

## The 12 steps

1. **Understand the story.** One sentence: who wants what, what stops them. A Short has one idea.
2. **Structure.** Hook in 3 s, three beats, one turn, a last image. For facts, write the facts with their sources first.
3. **Visual plan.** A table, one row per beat: seconds, narration, shot size, camera move, light, what changes on screen. Do not show on screen what the narration already says.
4. **Cast and assets.** Pick from the kit (below). Run `node check-assets.mjs`. Record every external file in `asset-manifest.json` and `ASSET_CREDITS.md` (creator, source, licence, checksum). Prefer CC0. If a needed asset is missing, build it from code (procedural) and say so. Never use a paid or unclear asset.
5. **Place and props.** Choose `forest`, `workshop` or `studio`. Props are small groups of shapes made in code, attached to a hand bone or placed in the world.
6. **Acting.** For each character write a `CharacterScript` (walk, turn, look, emotion, startle, point, reach, wave, carry, hand). Faces: let the eyes lead the head. Hands: use the finger poses, never leave a fist.
7. **Camera and light.** Shots from `camera/presets.ts`; lighting keys from `lighting.tsx`. Every light change has a story reason. Faces must be lit.
8. **Build.** Start from a template in `story-templates/` (or copy `stories/fiveSecondsData.ts` + `FiveSeconds.tsx` for a custom story). Keep the story as data. Do not copy animation, camera or lighting code into the story.
9. **Check and preview.** `node produce.mjs check ...` (heads, feet, watched props, camera speed). Render stills at the first and last frame of each shot, look at them at full size and at phone size. Fix before rendering the video.
10. **Render.** `node produce.mjs render ...`. The tool checks that the browser uses the discrete GPU, writes time and memory, and logs browser errors. Use 2K textures and `--concurrency 4`.
11. **Sound and QA.** `produce.mjs audio`, `mux`, `qa`. Look at the contact sheet and the two phone-size sheets yourself: the tool cannot judge faces, hands, clipping or beauty. Fix and re-render if a problem is real.
12. **Deliver.** Send the MP4, a contact sheet, 4 to 8 stills, the QA report, the render report (time, memory), the credits file, and where the project files are. Say what is placeholder (narration voice) and what was checked only by eye.

## Genre notes (choose, do not copy a story)

| Genre | Shape of the short | Camera and light |
|---|---|---|
| Informative / explainer | Hook, 2 or 3 points, one memorable image | Medium and close-up on the presenter, object close-ups that move; daylight, one coloured accent |
| Historical | Place and year, journey, the moment, what remains | Wide establishing, tracking, close-up; golden hour to night |
| Mystery / suspense | Calm, a small wrongness, the reveal withheld | Slow push-ins, hard cuts, low-key light, silence |
| Emotional / moral | One moment, one change in the face | Close-ups, long holds, light that warms |
| Adventure / fantasy | Goal, obstacle, wonder | Wide places, magical light on the key object |
| Funny | Setup, escalation, a clear reaction shot | Medium shots, quick cuts to reactions, bright light |
| Dialogue | Short lines, one per shot | Medium on the speaker, others look at the speaker |

## The kit (all free, all checked)

- **Characters:** peasant man and woman, traveller (ranger), companion (ranger). Quaternius, CC0. Hair choices. Same skeleton and clips. Not supported: other skeletons.
- **Places:** forest trail, workshop interior, empty studio. Made in code (the forest ground texture and the HDRI are Poly Haven, CC0).
- **Props:** lantern, backpack, pocket watch, glowing crystal, clocks. All code-made.
- **Camera:** establishingWide, fullBody, medium, closeUp, overShoulder, lowAngle; pushIn, pullBack, orbit, tilt, tracking. Transitions: cut, blend, fade. **No real dissolve, no depth of field.**
- **Light:** daylight, night, sunset, indoorWarm, dramaticLowKey, magical, or custom.
- **Sound:** `templates/audio/story_sound.py` (numpy only): room tone, ticks, drone, pad, glow, chime, sting, door, footsteps, rattle, whoosh, crash. Narration placeholders from the free Windows voice.
- **Templates:** informative, historical, suspense, emotional, dialogue, explainer. A worked story: `stories/` (Five Seconds Ahead, 36 s).

## Rules that never change

- Frame-based and deterministic. No clocks, no random numbers at render time. Two renders look the same but are **not byte-identical** (see `templates/cinematic/DETERMINISM.md`): never promise pixel-perfect output.
- 2K textures by default, 4K only for stills.
- Check the GPU before long renders (`node check-gpu.mjs`). A Windows stall happened once and was not explained: keep `--timeout` and close heavy programs.
- Do not add post effects (bloom, ambient occlusion) unless a still shows they help. They were tested in P3 and made things worse.
- Never claim success from a type-check. Open the rendered stills and the QA sheets. Say which things you inspected and which you did not.
- Story, characters and voice are always original. Reference material is for learning, never copied. No third-party frames are stored in this repository.
- Do not hard-code a story into reusable code. A story is a data file.

## Files

- Engine (do not rewrite for a story): `templates/cinematic/` - `animation/`, `camera/`, `lighting.tsx`, `story.tsx`, `environments.tsx`, `actors.ts`, props.
- Stories and templates: `templates/cinematic/stories/`, `templates/cinematic/story-templates/`.
- Tools: `produce.mjs` (entry point), `check-assets.mjs`, `check-gpu.mjs`, `check-shots.mjs`, `render-stills.mjs`, `render-measured.mjs`, `qa-video.py`, `check-determinism.mjs`, `downscale-textures.py`.
- Notes: `ANIMATION.md`, `CINEMATIC.md`, `DETERMINISM.md`, `ASSETS.md`, `ASSET_CREDITS.md`, `docs/P4_AUDIT.md`.
- Legacy bridge style (flat characters, painted toon world): `references/LEGACY_BRIDGE.md` and `templates/bridge/`. Use only when the user asks for that look.
