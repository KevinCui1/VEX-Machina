# Push Back Field Reference (Step 1 — Static Field Foundation)

This document records the coordinate system, orientation, and the
verified-vs-approximate status of every measurement used by the static field
renderer. All geometry lives in [`field/pushBackField.ts`](./field/pushBackField.ts);
nothing in the rendering code (`FieldView.tsx`) hardcodes positions.

> **Scope:** Step 1 renders a *static* field only. There is no physics, no
> robot, no Blocks, no Loader/scoring/de-scoring logic, and no match state.

---

## Coordinate system

- **Units:** inches. 1 SVG user unit = 1 inch.
- **Origin:** geometric center of the field interior.
- **Axes:** `+X` = audience's right, `+Y` = up / away (toward the Blue alliance
  station). This is the manual / CAD top-down convention.
- **Interior span:** the nominal interior is `144"` (6 × 24" tiles), so the
  interior spans `-72 .. +72` on both axes.
- **Rotations:** stored in degrees, **counter-clockwise**, about an element's
  center. The single conversion to SVG's Y-down / CW space happens in
  [`field/geometry.ts`](./field/geometry.ts) (`toSvg`, `toSvgRotation`) — the
  rest of the code thinks in field space with +Y up.

## Field orientation

**Audience view (manual / CAD top-down).**

- Blue alliance station = **top** (`+Y`); Red alliance station = **bottom**
  (`-Y`).
- This assignment is **inferred** from the object-placement top view (one
  colored band per side) and should be confirmed against the official **FO-1**
  diagram before being treated as final. The coordinate math is symmetric, so
  flipping the assignment later is a one-line change in the config.

## Sources used

All images live in `/reference-images` (official VEX Push Back CAD specification
sheets):

| Sheet | Used for |
| --- | --- |
| Field Reference Specifications (top view) | overall layout, element symmetry |
| Object Placement (top view) | orientation, element positions |
| Object Placement Reference (perspective) | 3D relationships |
| Field Critical Specs (278-1501) | wall-to-wall, tile size, wall thickness |
| Long Goal Specifications | long-goal length + section lengths |
| Center Goal Specifications | center-goal length |
| Park Zone Specifications | park-zone L dimensions |
| Loader Specifications | loader mouth + footprint |

Primary priority order follows `CLAUDE.md §1` (Game Manual → Field CAD →
assembly → screenshots → user images → assumptions).

---

## Verified measurements (from official CAD spec sheets)

| Measurement | Value | Source |
| --- | --- | --- |
| Inside wall-to-wall | **140.5"** | Field Critical Specs (278-1501) |
| Foam tile size | **24"** (6 × 6) | Field Critical Specs |
| Wall thickness (real) | 1.27" | Field Critical Specs |
| Long Goal total length | **48.79"** (1239.27 mm) | Long Goal Specifications |
| Long Goal open section (each) | **17.73"** (450.29 mm) | Long Goal Specifications |
| Long Goal enclosed center | **13.33"** | Game Manual (`CLAUDE.md §7`) |
| Center Goal length | **22.6"** (573.99 mm) | Center Goal Specifications |
| Park Zone arm (along wall) | **16.86"** (428.18 mm) | Park Zone Specifications |
| Park Zone arm (down side) | **18.87"** (479.35 mm) | Park Zone Specifications |
| Park Zone strip width | **2.0"** (50.80 mm) | Park Zone Specifications |
| Loader mouth diameter | **3.94"** (⌀100 mm) | Loader Specifications |

Note: the renderer uses the **144" nominal** interior (6 × 24" tiles) as the
coordinate span and widens the drawn wall to **2"** for legibility. The
**140.5"** official value is recorded in the config (`shell.wallToWall`) and
should be used wherever true clearances matter later.

## Approximate measurements (positions / orientations — NOT yet CAD-exact)

The two official top-down drawings are rotated **90° relative to each other**,
which made goal/loader orientation ambiguous. The following were inferred and
are flagged `confidence: 'approximate'` in the config. Each is trivial to
correct in `pushBackField.ts` once unambiguous CAD coordinates are available.

| Element | What's approximate | Reasoning |
| --- | --- | --- |
| Long Goals | Horizontal orientation; `Y` offset = ±36" | Object-placement shows horizontal goals in upper/lower thirds; spec symmetry suggested ~±23.5". `±36` matches the image best. |
| Center Goals | Modeled as concentric 45° squares at center; relative size of the two | Object-placement shows a central "X"; only lengths are verified. |
| Loaders | Along-wall position (`X = ±54"`); footprint w/d | Image shows loaders near the corners; only the mouth diameter is verified. |
| Park Zones | Which corner each alliance occupies (Blue top-left, Red bottom-right) | Only the L dimensions are verified; corner assignment is a guess. |
| Alliance Stations | Side assignment (Blue top / Red bottom); band thickness | Inferred from colored bands; verify against FO-1. |
| Autonomous Line | Drawn across center (`y = 0`) as a double tape line | Center tape line seen in images; exact path/orientation unconfirmed. |

## How to refine later

1. Obtain exact object coordinates from the official Field CAD or Appendix A
   object-placement diagram.
2. Edit the corresponding entry in `pushBackField.ts` (center / rotation /
   size).
3. Flip the `confidence` field to `'verified'` and update the `source` note.

No rendering code needs to change — `FieldView.tsx` reads everything from the
config.
