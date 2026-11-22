# Story templates

A template is a function that returns a **StorySpec**: the whole short as plain data (size, length, cast with scripts, place, props, camera shots, lighting, sound). It does not contain animation, camera or lighting code. It only chooses values for the code that already exists (`animation/`, `camera/`, `lighting.tsx`, `story.tsx`). `StoryFromSpec.tsx` turns a spec into the scene.

## The six templates

| Template | Genre | Cast | Place | Light | Shots |
|---|---|---|---|---|---|
| `informative` | Educational, explainers | 1 presenter | studio | daylight | wide, medium, close-up, medium, wide; points at two spots |
| `historical` | History | 1 traveller (ranger) | forest | sunset to night | establishing, tracking, close-up, final wide |
| `suspense` | Mystery, suspense | 1 + a stranger who enters | workshop | lamp to low-key | quiet wide, medium, close-up, low angle on the door, medium |
| `emotional` | Emotional, moral | 2 villagers | studio | low-key to warm to sunset | two-shot, close-up of each, pull-back |
| `dialogue` | Dialogue, funny, drama | 3 (list of lines) | studio | indoor warm | wide, then a medium on the speaker for each line |
| `explainer` | Product or concept | 1 presenter + a glowing object | studio | daylight and magical | wide, object close-ups that orbit, medium, wide |

Every template takes the same options: `seconds` (default 30), `fps` (30), `width` (1080), `height` (1920). All times inside are fractions of the length, so changing `seconds` re-times the story. `dialogue` also takes `lines`, and sets its own length from them. Each spec has: `audio` (narration placeholders, sound beds and cues, in the format of `templates/audio/story_sound.py`), and `placeholders` (what you must replace).

## Use a template

```powershell
node produce.mjs check template:suspense                     # composition check on the default 30 s version
node produce.mjs spec suspense 24 > out\suspense-audio.json  # the sound/narration file, 24 s version
node produce.mjs stills index.ts T-Suspense 30,300,500 0.5   # every template is registered as a composition "T-<Name>"
```

In code:

```ts
import { suspense } from "./story-templates";
const spec = suspense({ seconds: 24, width: 1080, height: 1920 });   // vertical Short
const wide = suspense({ seconds: 24, width: 1920, height: 1080 });   // 16:9
```

To make your own story from a template: copy its file, rename it, change the cast, scripts, points, shots and lighting, and add it to `index.ts`. Keep it data only. If you need something new (a prop, a place), add it to the shared code once and use it from data.

## The kit (what you can choose from)

**Characters** (all CC0, same skeleton, same animation clips)

| Look | Description |
|---|---|
| `{ kit: "peasant", gender: "male" \| "female", hair, hairTint, beard?, height?, watch? }` | Villager outfits. Hair: `Hair_SimpleParted`, `Hair_Long`, `Hair_Buns`, `Hair_Buzzed` (check `ASSETS.md` for the files you have). |
| `{ kit: "traveller" }` | Bearded ranger with lantern and backpack. |
| `{ kit: "companion" }` | Female ranger with bun hair. |

**Places**: `forest` (trail, trees, light shafts), `workshop` (interior with window, clocks, shelves, counter, lamp, a door in the back wall at x 1.7 to 2.9), `studio` (empty floor and soft backdrop). Camera looks toward -z; characters face +z at yaw 0.

**Props**: lantern and backpack (traveller), pocket watch (`watch: true`, glow set by the story), glowing crystal (`props: [{ kind: "crystal", at }]`), the workshop clocks. A new prop is a small `THREE.Group` attached to a hand bone (see `Lantern.ts`, `PocketWatch.ts`, `props.ts`).

**Script actions** (`animation/script.ts`): `idle`, `walk`, `run`, `turn`, `look`, `emotion` (happy, sad, angry, fear, surprise), `startle`, `point`, `reach`, `wave`, `carry`, `hand` (finger pose: `relaxed`, `cupped`, `flat`, `open`, `fist`, `point`, `grip`, or single fingers).

**Camera** (`camera/presets.ts`): `establishingWide`, `fullBody`, `medium`, `closeUp`, `overShoulder`, `lowAngle`, plus `pushIn`, `pullBack`, `orbit`, `tilt`, `tracking`. Transitions: `cut`, `blend`, `fade`. No true dissolve.

**Lighting** (`lighting.tsx`): `daylight`, `night`, `sunset`, `indoorWarm`, `dramaticLowKey`, `magical`, or your own `Lighting` object. In the workshop, put the key light on the camera side (positive z) or the faces go dark.

## Limits found while testing

- All six templates pass the composition check at their default size, and each was rendered as a still, but only the P4 story `FiveSeconds` (which was built the same way) was rendered as a full video and checked by eye. See the P4 report.
- A new character kit with a different skeleton is not supported.
- The studio is empty on purpose. A real story needs props or a place.
