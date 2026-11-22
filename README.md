# Claude Animated Shorts

A Claude Code skill that makes **cinematic stylized-3D vertical Shorts** (1080 x 1920, 30 fps) on your own Windows PC with Remotion and Three.js. You give a story or a topic. Claude plans the shots, cuts the cast, acts, lights and films it, adds sound, renders on your NVIDIA card, checks the video, and hands you the MP4.

Everything is free: CC0 characters, shapes and textures made in code, a numpy sound tool, and a free Windows voice for placeholder narration. No paid service is needed.

## What you get

- Story templates for six kinds of Short: informative, historical, suspense, emotional, dialogue, concept explainer.
- A camera system (presets, moves, cuts, blends, fades), six lighting looks, three places (forest, workshop, studio), props, acting (walk, look, emotions, gestures, hands) that are all plain data.
- Automatic checks: composition before rendering, GPU, assets and licences, video QA with phone-size sheets, render time and memory.
- One entry point: `node produce.mjs`.

Worked example: **Five Seconds Ahead** (36 s, two characters, workshop, four lighting looks, a pocket watch and a falling clock). Its story is a data file in `templates/cinematic/stories/`.

## Start here

| Read | For |
|---|---|
| [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md) | Install, assets, 2K textures, GPU check, first render, problems |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | The 12 steps from idea to final video, with commands |
| [SKILL.md](SKILL.md) | The instructions Claude follows |
| [templates/cinematic/story-templates/README.md](templates/cinematic/story-templates/README.md) | The six templates and the kit |
| [templates/cinematic/CINEMATIC.md](templates/cinematic/CINEMATIC.md) | Camera, lighting, safe rendering, QA |
| [templates/cinematic/DETERMINISM.md](templates/cinematic/DETERMINISM.md) | What is and is not repeatable |
| [docs/P4_AUDIT.md](docs/P4_AUDIT.md) | Architecture and technical debt report |

## Install the skill

1. Put this folder at `%USERPROFILE%\.claude\skills\cartoon-3d-short\` (clone it there, or unzip).
2. Follow `docs/SETUP_WINDOWS.md` once to make a project folder (`npm install`) and download the assets.
3. In Claude Code say: *"Use the cinematic animated short skill and make a 35 second short about ..."*

## What is in this repository

| Path | What it is |
|---|---|
| `SKILL.md` | The skill |
| `docs/` | Setup, workflow, audit, and the review images of each phase (`p0` to `p3`, `p4`) |
| `templates/cinematic/` | The system: animation, camera, lighting, story runtime, environments, tools, templates, stories |
| `templates/audio/` | `story_sound.py` (sound design and mix), `narration_sapi.ps1`, and the older bridge sound files |
| `templates/bridge/`, `templates/scripts/` | The legacy flat-character bridge style and its helpers |
| `references/` | Style bible, free-asset policy, written research reports, legacy bridge notes |

Not in this repository, on purpose: character and texture files (about 400 MB; download steps and checksums are in `templates/cinematic/ASSETS.md`), rendered videos, `node_modules`, and any third-party video frames.

## Licences

Code and documents: MIT (`LICENSE`). Assets: see `templates/cinematic/ASSET_CREDITS.md` and `asset-manifest.json`. Every external file is CC0 (Quaternius characters, Poly Haven ground and sky) with its creator, source, licence text location and checksum recorded. Everything else is generated in code.

## Limits (honest list)

No real dissolve between shots and no depth of field. Characters share one skeleton family. Pixels can differ by a tiny amount between two renders of the same frame (GPU), so files are not byte-identical. Hands and props clipping through bodies are not detected automatically. Tested on one PC (Windows 11, RTX 5060 Ti, 32 GB). The placeholder narration is robotic by design: record your own voice for the real video.
