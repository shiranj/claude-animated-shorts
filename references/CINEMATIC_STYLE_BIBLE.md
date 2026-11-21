# Cinematic Animated Shorts — Visual Style Bible

Version 1.0. This document defines the new art direction while preserving the existing Remotion + Three.js production workflow.

## North star

Every scene should feel like a carefully art-directed frame from a premium stylized animated film: expressive characters, tactile materials, rich environments, deliberate composition, motivated lighting and cinematic camera language.

The target is stylized cinematic 3D, not photorealism and not generic children's explainer art. Quality must come from assets, modelling, materials, lighting, animation and composition. Post-processing should enhance a good scene, not disguise a weak one.

## Core principles

1. Distinctive, readable silhouettes. Characters and important props must remain recognisable at phone size.
2. Material richness. Surfaces should communicate wood, stone, fabric, leather, metal, glass, skin or foliage.
3. Layered depth. Compose foreground, subject plane and background deliberately.
4. Motivated light. Major light sources should have a reason in the world: sun, window, fire, lamp, screen or glowing object.
5. Emotional composition. Camera height, lens, negative space and subject placement reinforce the story beat.
6. Controlled stylisation. Simplified shapes are welcome; primitive placeholder geometry is not acceptable as final art.
7. Continuity. Characters, locations, props and time of day retain their identity across shots.

## Character direction

Use stylized 3D characters with appealing proportions, designed silhouettes, expressive eyes/brows/mouths and layered clothing materials. Hands and body language should support the narration.

Each recurring character needs:
- Stable asset ID and descriptive name.
- Front, three-quarter and side reference views.
- Height and proportion guide.
- Material and colour palette.
- Rig or documented animation capability.
- Supported expressions and body actions.
- Source URL, creator and exact licence in the asset manifest.

Prefer clear key poses and purposeful acting. Secondary motion (cloth, head follow-through, breathing, weight shift) must be subtle and motivated. Avoid floating feet, sliding contact and uncontrolled procedural wobble.

## Environment direction

Environments should tell part of the story before the character acts. Compose each location in three layers:

- Foreground: framing objects, silhouettes, particles or near-camera details.
- Midground: main action and readable props.
- Background: architecture, landscape, sky and atmospheric depth.

Use reusable modular assets plus a few story-specific hero assets. Avoid unrelated decorative clutter.

Check scale, perspective, contact, texture repetition, background detail and continuity across shots.

## Materials

Use PBR materials where appropriate. Prioritise base colour, roughness variation, visible normal detail and metallic response where relevant. Add subtle imperfections and edge wear, not random grunge everywhere.

Avoid high-frequency detail that disappears at 1080x1920 or shimmers during camera movement.

## Lighting and colour

Lighting is story-driven, not one fixed preset for every video. Suggested starting directions:

- Historical / nostalgic: amber key, warm stone and wood, cool blue-violet shadows.
- Science / discovery: deep blue environment, cyan accents, controlled neutral key.
- Danger / suspense: restrained low-key lighting, motivated red or amber practicals, readable shadows.
- Comedy / playful: brighter exposure, saturated accents, softer contrast and lively framing.
- Mystery / night: cool ambient fill, motivated warm pools and atmospheric depth.

Use a clear key/fill/rim relationship when needed. Preserve shadow detail. Use contact shadows. Volumetrics and bloom must be motivated and restrained. Avoid flat lighting, crushed blacks and excessive orange/teal grading.

## Camera language

Choose shots to communicate information:
- Establishing wide for geography and scale.
- Medium for action and interaction.
- Close-up for emotion, evidence and reveals.
- Insert / macro for important details.
- Low angle for scale or threat.
- High angle for vulnerability or geography.

Movement must have a reason: push-in for attention, tracking to follow action, orbit to reveal spatial relationships, crane to reveal scale. Whip pans are reserved for deliberate transitions. Locked framing is acceptable when the acting carries the shot.

Use eased motion, stable horizons unless a tilt is intentional, and avoid camera movement that competes with narration. Keep establishing shots readable; use shallow focus for motivated close-ups.

## Vertical composition

Master at 1080x1920 (9:16). Keep the main subject and action legible on a phone. Avoid essential information at extreme edges, tiny characters lost in wide environments, and compositions designed only for desktop preview. Check phone-size previews.

## Effects

Use effects only when physically or narratively motivated: dust, smoke, mist, rain, sparks, embers, debris, water and light shafts. Control density, scale and motion. Avoid generic floating particles, excessive flares, bloom, chromatic aberration, shake or grain.

## Free asset rule

Prefer assets explicitly free for commercial use, ideally CC0. Record the exact asset page, creator, licence and attribution requirements. A free download is not automatically unrestricted. Never use paid assets, ripped game/film assets or assets with unclear terms. See references/FREE_ASSET_POLICY.md.

## Performance profiles

- Preview: reduced DPR/resolution, cheaper effects and proxy assets where available.
- Standard: intended composition, production assets and moderate post-processing.
- Final: full output resolution, approved assets, final lighting, shadows, anti-aliasing and post effects.

Profiles must preserve timing, composition and animation. Only quality settings may change.

## Definition of done

A scene must have a clear focal subject and story beat; finished-looking assets; continuity; believable scale and contact; motivated lighting; clean vertical composition; no distracting flicker, clipping or texture shimmer; phone-size readability; and acceptable render time/memory use.

Do not promise feature-animation quality from primitive geometry or post-processing alone. Build the look incrementally with reusable assets and a tested pipeline.
