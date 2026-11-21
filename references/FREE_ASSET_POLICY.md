# Free 3D Asset Sourcing and Licence Policy

The requirement is zero mandatory asset cost. The skill must not depend on paid subscriptions, paid downloads, paid APIs or commercial AI generation services.

## Preferred discovery sources

These are starting points, not blanket approval of every item. Check the individual asset page and retain licence evidence.

| Source | Useful content | Handling |
|---|---|---|
| https://polyhaven.com/ | HDRIs, textures, models | Prefer CC0 assets; record the asset page |
| https://ambientcg.com/ | PBR materials and textures | Prefer CC0 assets; record the asset page |
| https://kenney.nl/assets | Props, environments and some characters | Check the pack's stated licence |
| https://www.blender.org/ | Free open-source modelling and preparation software | Software, not an asset library |
| https://sketchfab.com/ | Model discovery | Inspect each model's licence and download terms |
| https://opengameart.org/ | Models, props, textures and audio | Check each item's individual licence |

A source being listed does not mean every asset on it is approved.

## Licence acceptance

Preferred order:
1. CC0 / public-domain dedication.
2. CC BY, if attribution is retained and displayed where required.
3. Other licences only after checking commercial use, modification, redistribution and share-alike requirements.

Do not use non-commercial-only licences for a project that may be monetised, no-derivatives licences when modification is needed, assets with missing/unclear terms, paid trials, subscription-only downloads or ripped game/film assets without permission.

When in doubt, skip the asset.

## Asset manifest

Every imported asset must have a machine-readable record. Suggested JSON shape:

{
  "id": "roman-stone-road-01",
  "name": "Roman stone road section",
  "category": "environment",
  "source": "Poly Haven",
  "assetPage": "VERIFIED_ASSET_PAGE_URL",
  "downloadUrl": "VERIFIED_DOWNLOAD_URL",
  "creator": "Creator name",
  "license": "CC0 1.0",
  "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
  "attributionRequired": false,
  "modifications": ["rescaled", "material adjusted"],
  "localPath": "public/assets/environments/roman-road/",
  "notes": "Verify the source page and licence before production use."
}

The example is a schema illustration only. Never use placeholder URLs as real asset references.

## Download and import workflow

1. Search for a specific visual need from the approved storyboard.
2. Inspect the individual asset page and licence.
3. Confirm it is free and suitable for the intended use.
4. Download only required formats and texture resolutions.
5. Optimise the model and textures for Three.js.
6. Add provenance and licence details to the manifest.
7. Create a preview thumbnail where practical.
8. Test in the actual vertical composition.

Do not download huge packs speculatively. Download assets needed for an approved scene or reusable library.

## Technical preparation

Prefer GLB / glTF. Check scale, orientation, polygon and material counts, texture sizes and paths, hidden objects, transparency, animation/rig compatibility and shadow behaviour. Remove unused content. Create LOD or proxy variants where useful.

## Attribution and provenance

Keep a project-level ASSET_CREDITS.md and asset manifest. Record creator and licence whenever required. Retain the original asset page URL, not only a direct download URL. Never claim CC0 or commercial rights without checking the current source terms.

## No-cost operation

The core pipeline must still work if online sources are unavailable. Support assets already in the project, user-provided assets with confirmed rights, manually downloaded free assets and procedural geometry for simple props/blocking.

Never silently substitute a paid resource or require an external account to complete the core render.
