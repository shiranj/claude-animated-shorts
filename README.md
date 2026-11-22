# Claude Animated Shorts

The free Claude skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It creates vertical animated Shorts with a cinematic stylized-3D art direction: expressive characters, rich layered environments, motivated lighting, deliberate camera work, narration-synchronised animation and original sound. Everything is rendered with Three.js inside Remotion on your own PC. The original flat-character / painted-toon bridge look remains available as a legacy style.

Proven on **The Bridge That Fell for a Song**, a 67 s short about the 1831 Broughton bridge.

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the full pipeline, every rule, every fix, and the final look values |
| `templates/bridge/` | The full source of the bridge short: world, characters, ink, lens blur, grade, story/camera |
| `templates/audio/` | The synthesized sound: SFX, march music, the mix with ducking and loudness |
| `templates/scripts/` | Stills, side-by-side sheets, shot merge and frame-by-frame QA helpers |
| `references/CINEMATIC_STYLE_BIBLE.md` | Default cinematic visual direction for new projects |
| `references/FREE_ASSET_POLICY.md` | Free asset sources, licence checks and asset provenance rules |
| `docs/CINEMATIC_PIPELINE.md` | Cinematic production architecture and phased implementation |
| `references/STYLE_BIBLE.md` | Original bridge-style research, retained for legacy projects |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |

## Install
1. Copy this folder to `~/.claude/skills/cartoon-3d-short/` (clone it there, or download the ZIP).
2. You need [Remotion](https://www.remotion.dev/) with `@remotion/three`, plus Node, Python 3 and ffmpeg.
3. In Claude Code, say: *"Use the cinematic animated short skill and make a short about …"*. The default style is cinematic stylized 3D. Ask explicitly for the original bridge style when you want the legacy flat-character look.

Claude then follows `SKILL.md`: topic and facts, then script, then voice, then the shot plan in `story.ts`, then stills, then renders. Agents check your frames against the reports and the frames, and you get the final 2K render and sound mix.

## Notes
- Set `REMOTION_TMP` to a folder on a big drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder.
- Story, characters and voice should always be your own. Use the references for the look, not the content.

## License
The code and docs are MIT (see `LICENSE`). No third-party video frames are included.
