# Cinematic Shorts Production Architecture

## Goal

Upgrade visual quality without discarding the proven Remotion + Three.js foundation. This remains a Claude Code skill: it instructs an agent how to plan, build, render, inspect and deliver a short. It is not a new rendering framework and must not require paid services.

## High-level flow

1. Script and factual research.
2. Scene breakdown and narration timing.
3. Visual direction and continuity planning.
4. Asset selection / creation and licence recording.
5. Three.js scene construction.
6. Remotion timeline, audio and final composition.
7. Still-frame review and automated QA.
8. Final render and delivery.

## Responsibilities

### Story director
Identify the visual purpose of each narration beat. Produce a scene list with shot size, action, location, mood and transition. Avoid literal repetition when narration already explains the visible action. Tie timing to word timings where available.

### Art director
Apply references/CINEMATIC_STYLE_BIBLE.md. Set a story-specific treatment. Define character, environment, prop, palette and lighting continuity. Reject generic placeholder scenes as final output.

### Asset manager
Search approved free sources or reuse existing assets. Verify each individual licence. Record provenance in the asset manifest and ASSET_CREDITS.md. Prepare and optimise GLB/glTF assets. Provide proxy assets for previews where useful.

### Scene builder
Use React Three Fiber / Three.js for 3D scene composition. Reuse shared character, environment, material, lighting and camera components. Keep story logic separate from reusable rendering systems. Use procedural geometry for simple objects, not as a substitute for every hero asset.

### Remotion editor
Own the video timeline, sequencing, voice synchronisation, audio layers and final output. Preserve deterministic frame-based animation. Avoid wall-clock timers and non-deterministic animation in render components.

### Quality controller
Render representative stills before a full render. Inspect visual quality at full-frame and phone-size scale. Run TypeScript and existing QA scripts. Check clipping, flicker, aliasing, shadows, broken textures, frozen/black/white frames, audio clipping and duration mismatch.

## Target project organisation

Adapt to the existing repository; do not move working files without need.

references/
  CINEMATIC_STYLE_BIBLE.md
  FREE_ASSET_POLICY.md
  STYLE_BIBLE.md (original research retained as historical reference)

docs/
  CINEMATIC_PIPELINE.md

templates/
  bridge/ (existing proven example, preserved)
  cinematic/ (future reusable starter, only after proof of concept)

public/assets/
  characters/
  environments/
  props/
  materials/
  hdri/

asset-manifest.json
ASSET_CREDITS.md

These are target paths, not a mandate to reorganise the repository in phase one.

## Rendering profiles

- Preview: low DPR / smaller render scale, lower-cost shadows and effects, proxy assets where available.
- Standard: intended composition and production assets with moderate effects.
- Final: target resolution, approved lighting and post-processing, final anti-aliasing and audio.

Profiles preserve frame timing and composition. They may change quality settings only.

## Implementation phases

### Phase 1 — Art direction and governance
Add the cinematic style bible, free-asset/licence policy and pipeline document. Update the skill entry point to use them while preserving the existing workflow.

### Phase 2 — Asset and scene foundation
Inspect the actual Remotion project before coding against assumptions. Establish the asset manifest and credits workflow. Build one reusable character import path and one environment import path. Establish preview / standard / final profiles.

### Phase 3 — Proof of concept
Create a 10-second vertical scene with one character, one environment, a camera move and a motivated lighting change. Use only free assets or original procedural content. Render stills and a short MP4. Review quality, render time, memory use and asset continuity.

### Phase 4 — Integration
Turn proven components into reusable templates. Update SKILL.md, README and relevant examples. Keep the original bridge short as a legacy example. Do not delete the old workflow unless a tested replacement exists.

## Constraints

- Preserve deterministic frame-based rendering.
- Preserve the bridge template and existing QA scripts.
- Avoid dependencies until their value is clear.
- Prefer open-source tools and assets with clear commercial-use permissions.
- Never invent asset URLs, licences or capabilities.
- Do not claim a scene is cinematic merely because it uses bloom, fog or depth of field.
- Prioritise asset quality, composition, lighting and acting.
