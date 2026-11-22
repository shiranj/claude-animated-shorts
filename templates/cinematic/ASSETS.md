# Assets for the cinematic starter

The repository does **not** contain the 3D character, animations, textures or HDRI. They are free (CC0), but they are large binary files (about 70 MB in total), so you download them yourself and put them in your Remotion project's `public/` folder. Exact sources, creators, licences and checksums are in `asset-manifest.json`. Credits are in `ASSET_CREDITS.md`.

If a file is missing, nothing crashes: the scene shows a red placeholder figure (character) or flat colours (ground), and the browser console prints which file is missing. Run `node check-assets.mjs` to see what is missing.

## Folder layout

```
public/cinematic/
  characters/quaternius/
    Male_Ranger.gltf  Male_Ranger.bin
    T_Ranger_BaseColor.png  T_Ranger_Normal.png  T_Ranger_ORM.png
    T_Regular_Male_Dark_BaseColor.png  T_Regular_Male_Normal.png  T_Regular_Male_Roughness.png
    head/
      Superhero_Male_FullBody.gltf  Superhero_Male_FullBody.bin
      Hair_Beard.gltf  Hair_Beard.bin
      T_Eye_Brown.png  T_Eye_Normal.png  T_Eye_Normal_png.png
      T_Superhero_Male_Dark.png  T_Superhero_Male_Normal.png  T_Superhero_Male_Roughness.png
      T_Hair_1_BaseColor.png  T_Hair_1_Normal.png  T_Hair_1_Normal_png.png
  animations/UAL1_Standard.glb
  polyhaven/
    forrest_ground_03_diff_1k.jpg  forrest_ground_03_nor_gl_1k.jpg  forrest_ground_03_rough_1k.jpg
    spruit_dawn_1k.hdr
```

## 1. Character (Quaternius, CC0)

Download three free "Standard" packs. On each page click **Download Now** (itch.io is "name your own price") and save the Standard zip. Quaternius's own pages (quaternius.com/packs/...) link to the same files.

| Pack | Page | What we use |
|---|---|---|
| Modular Character Outfits - Fantasy [Standard] (about 263 MB) | https://quaternius.com/packs/modularcharacteroutfitsfantasy.html | The `Male_Ranger` outfit: hood, jerkin, belts, bracers, boots, pauldron, hands |
| Universal Base Characters [Standard] (about 129 MB) | https://quaternius.com/packs/universalbasecharacters.html | The head, eyes and eyebrows of `Superhero_Male`, and the `Hair_Beard` part. The outfit pack has no face. |
| Universal Animation Library [Standard] (about 16 MB) | https://quaternius.com/packs/universalanimationlibrary.html | 43 animation clips (we use `Walk_Loop` and `Idle_Loop`) |

All three share the same 65-bone "Universal" skeleton, so the clips and parts fit together. Unzip them and copy these files:

- From the outfit zip, folder `Exports/glTF (Godot-Unreal)/Outfits/`: `Male_Ranger.gltf`, `Male_Ranger.bin`, `T_Ranger_BaseColor.png`, `T_Ranger_Normal.png`, `T_Ranger_ORM.png`, `T_Regular_Male_Dark_BaseColor.png`, `T_Regular_Male_Normal.png`, `T_Regular_Male_Roughness.png` into `public/cinematic/characters/quaternius/`.
- From the base-characters zip, folder `Base Characters/Godot - UE/`: `Superhero_Male_FullBody.gltf`, `Superhero_Male_FullBody.bin`, `T_Eye_Brown.png`, `T_Eye_Normal.png`, `T_Superhero_Male_Dark.png`, `T_Superhero_Male_Normal.png`, `T_Superhero_Male_Roughness.png`, `T_Hair_1_BaseColor.png`, `T_Hair_1_Normal.png` into `public/cinematic/characters/quaternius/head/`. Also from `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/`: `Hair_Beard.gltf`, `Hair_Beard.bin`.
- The head file asks for two texture names that the zip spells differently. Make copies: `T_Eye_Normal.png` as `T_Eye_Normal_png.png`, and `T_Hair_1_Normal.png` as `T_Hair_1_Normal_png.png`, in the same `head/` folder.
- From the animation zip, `Unreal-Godot/UAL1_Standard.glb` (the one **without** `_RM`) into `public/cinematic/animations/`.

Each zip contains a `License.txt` that says CC0 1.0. Keep them with your project records. Credit "Quaternius" is optional.

## 2. Ground texture and HDRI (Poly Haven, CC0)

Pages: https://polyhaven.com/a/forrest_ground_03 and https://polyhaven.com/a/spruit_dawn. From a terminal inside your project (Git Bash, macOS or Linux; on Windows PowerShell use `curl.exe`):

```bash
mkdir -p public/cinematic/polyhaven && cd public/cinematic/polyhaven
B=https://dl.polyhaven.org/file/ph-assets
curl -L -O $B/Textures/jpg/1k/forrest_ground_03/forrest_ground_03_diff_1k.jpg
curl -L -O $B/Textures/jpg/1k/forrest_ground_03/forrest_ground_03_nor_gl_1k.jpg
curl -L -O $B/Textures/jpg/1k/forrest_ground_03/forrest_ground_03_rough_1k.jpg
curl -L -O $B/HDRIs/hdr/1k/spruit_dawn_1k.hdr
```

## 3. Check everything

From the folder that contains `public/`:

```bash
node check-assets.mjs
```

It lists each file as `OK` or `MISSING` and compares every file with its recorded checksum. The checksums were taken from the files used for the review renders; a different version of a pack may show a difference without being damaged.

## Optional: second character (only for `TwoCharacterTest`)

From the same two zips (both CC0): from the outfit zip, `Outfits/Female_Ranger.gltf`, `Female_Ranger.bin`, `T_Regular_Female_Dark_BaseColor.png`, `T_Regular_Female_Normal.png`, `T_Regular_Female_Roughness.png` into `public/cinematic/characters/quaternius/`. From the base-characters zip, `Base Characters/Godot - UE/`: `Superhero_Female_FullBody.gltf`, `.bin`, `T_Superhero_Female_Dark_BaseColor.png`, `T_Superhero_Female_Normal.png`, `T_Superhero_Female_Roughness.png`, `T_Hair_2_BaseColor.png`, `T_Hair_2_Normal.png`, and from `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/` `Hair_Buns.gltf`, `Hair_Buns.bin`, all into `public/cinematic/characters/quaternius/head/`. `node check-assets.mjs` lists them as optional.

## Optional: villagers (P4 story `FiveSeconds` and the story templates)

From the same two zips (both CC0). From the outfit zip, `Exports/glTF (Godot-Unreal)/Outfits/`: `Male_Peasant.gltf`, `Male_Peasant.bin`, `Female_Peasant.gltf`, `Female_Peasant.bin`, `T_Peasant_BaseColor.png`, `T_Peasant_Normal.png`, `T_Peasant_ORM.png`, into `public/cinematic/characters/quaternius/`. From the base-characters zip, `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/`: `Hair_SimpleParted.gltf`, `.bin`, `Hair_Long.gltf`, `.bin`, `T_Hair_1_BaseColor.png`, `T_Hair_1_Normal.png`, into `public/cinematic/characters/quaternius/head/`. (`T_Hair_2_*` and the head files come from the second-character step above.) Run `downscale-textures.py` again for 2K. `node check-assets.mjs` lists them as optional.

## Notes

- **2K textures are the default from P2.** After `check-assets.mjs`, run `python downscale-textures.py <copy of public/cinematic/characters> 2048`. Keep the 4K originals if you want them.

- Three character textures are 4096x4096. Each render tab decodes its own copy, and the full render used about 10 GB more memory than an idle PC. Running `python downscale-textures.py <copy of public/cinematic/characters> 2048` on a copy cut this to about 6 GB with no visible difference (mean change 1.5 of 255). The checker's checksums only match the original files, so run the checker before downscaling.
- The Standard base-character kit has only the "Superhero" bodies. We use only its head, so body proportions come from the outfit (Regular) body. The head and the outfit's hands use different "Dark" skin textures; the tones are close but not identical.
- Hair colour: the kit's hair texture is a grey palette meant to be tinted. `HAIR_TINT` in `CinematicPOC.tsx` makes it brown.
- To use another outfit or hairstyle from the same packs, change `ASSET_PATHS` in `useAsset.ts`. Check the bone-name match and the licence of anything new, and add it to `asset-manifest.json`.
