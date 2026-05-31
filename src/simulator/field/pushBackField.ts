// ─────────────────────────────────────────────────────────────────────────────
// VEX V5RC 2025-2026 "Push Back" — centralized static field configuration.
//
// EVERY static field measurement and placement lives here. Rendering components
// must read from this object and must NOT hardcode field positions. To support
// other games later, create a sibling file exporting another `GameField`.
//
// Coordinate system: inches, origin = field center, +X = audience-right,
// +Y = up/away (toward the Blue alliance station). See FIELD_REFERENCE.md.
//
// VERIFIED vs APPROXIMATE:
//   - Element *sizes* are largely VERIFIED from the official CAD specification
//     drawings in /reference-images.
//   - Element *positions / orientations* are APPROXIMATE: the two official
//     top-down drawings are rotated 90° relative to each other, so exact
//     placement was inferred and is flagged accordingly. These are easy to
//     correct here once unambiguous CAD coordinates are available.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameField } from './types'

// Field shell constants (verified from "Field Critical Specs (278-1501)").
const TILES_PER_SIDE = 6
const TILE_SIZE = 24 // inches; 6 * 24 = 144 nominal
const NOMINAL_INTERIOR = TILES_PER_SIDE * TILE_SIZE // 144
const WALL_TO_WALL = 140.43 // official inside wall-to-wall (user coordinate system: 0..140.43)
const HALF = NOMINAL_INTERIOR / 2 // 72 — nominal render span, interior tiles span -72..+72
// Actual field half-width for placement using real inch coordinates.
// User coordinate system: (0,0) = bottom-left corner of usable field area.
// Conversion: internal = user - FIELD_ACTUAL_HALF  (X axis)
//             internal = user - FIELD_ACTUAL_HALF  (Y axis, +Y up)
const FIELD_ACTUAL_HALF = WALL_TO_WALL / 2 // 70.215

// Long Goal section lengths (verified from "Long Goal Specifications").
const LG_TOTAL = 48.79 // 1239.27 mm
const LG_ENCLOSED = 13.33 // enclosed center section (Game Manual)
const LG_OPEN = (LG_TOTAL - LG_ENCLOSED) / 2 // 17.73 — matches 450.29 mm spec
const LG_DEPTH = 5.4 // user-specified width (cross-section of the goal)

// Long Goal left/right centerline offset from field center.
// Placed at the midline of the tile one step outward from center (tile 24"–48"
// from center, midpoint = 36").  Goals run VERTICALLY (rotation=90°) along Y.
const LG_X_OFFSET = 48

// Center Goal (verified length from "Center Goal Specifications": 573.99 mm).
const CG_LENGTH = 22.6
const CG_UPPER_WIDTH = 5.53 // user-specified
const CG_LOWER_WIDTH = 4.15 // user-specified

// Loader footprint (verified-ish from "Loader Specifications": ⌀3.94 mouth,
// ~4.65 x 4.17 base). Position along the wall is APPROXIMATE.
const LOADER_W = 6
const LOADER_D = 5
const LOADER_MOUTH = 3.94
const LOADER_X_OFFSET = 54 // approximate: loaders sit near the corners

// Park Zone dimensions (verified from field specifications).
// User coords: outer X spans 60.77..79.64 (centered at field center X = 70.215).
// Width = 79.64 - 60.77 = 18.87" along the wall (X axis).
// Height = 16.86" into the field from the wall (Y axis).
// Inner layer: 2" inset on the three exposed sides (left, right, interior-facing).
const PZ_WIDTH  = 18.87 // along X (wall direction)
const PZ_HEIGHT = 16.86 // into field from wall
const PZ_INNER_INSET = 2 // inner layer inset on 3 exposed sides

export const pushBackField: GameField = {
  meta: {
    game: 'Push Back',
    season: '2025-2026 VEX V5RC',
    orientation:
      'Audience view (manual / CAD top-down). +X = right, +Y = up toward Blue alliance station.',
    units: 'inches',
    notes: [
      'User coordinate system: (0,0) = bottom-left corner of usable field, (140.43, 140.43) = top-right corner.',
      'Internal rendering uses center-origin (+Y up); conversion: internal = user - 70.215.',
      'Nominal tile grid is 6 × 24" = 144" (internal spans -72..+72); actual wall-to-wall is 140.43".',
      'Element SIZES are mostly verified from CAD specs; element POSITIONS/ORIENTATIONS are approximate (flagged per element).',
      'Blue alliance station = top (+Y), Red alliance station = bottom (-Y). Confirm against official FO-1 before treating as final.',
    ],
  },

  shell: {
    nominalInteriorSize: NOMINAL_INTERIOR,
    wallToWall: WALL_TO_WALL,
    tilesPerSide: TILES_PER_SIDE,
    tileSize: TILE_SIZE,
    wallThickness: 2, // ~1.27" real; widened slightly for legibility
    shellSource: {
      confidence: 'verified',
      source: 'Field Critical Specs (278-1501): 140.43" inside wall-to-wall, 24" tiles (144" nominal).',
      note: 'Wall thickness widened from 1.27" to 2" for top-down legibility.',
    },
  },

  allianceStations: [
    {
      id: 'station-blue',
      alliance: 'blue',
      side: 'top',
      label: 'BLUE ALLIANCE',
      thickness: 16,
      placement: {
        confidence: 'approximate',
        source: 'Object Placement top view (blue band on one side).',
        note: 'Side assignment (Blue = top) inferred; verify against FO-1.',
      },
    },
    {
      id: 'station-red',
      alliance: 'red',
      side: 'bottom',
      label: 'RED ALLIANCE',
      thickness: 16,
      placement: {
        confidence: 'approximate',
        source: 'Object Placement top view (red band opposite blue).',
        note: 'Side assignment (Red = bottom) inferred; verify against FO-1.',
      },
    },
  ],

  parkZones: [
    {
      id: 'park-blue',
      alliance: 'blue',
      // User coords: x=60.77..79.64, y=123.57..140.43 (top wall).
      // Internal: center.x = 0, center.y = FIELD_ACTUAL_HALF - PZ_HEIGHT/2 = 61.785
      center: { x: 0, y: FIELD_ACTUAL_HALF - PZ_HEIGHT / 2 },
      width: PZ_WIDTH,
      height: PZ_HEIGHT,
      innerInset: PZ_INNER_INSET,
      placement: {
        confidence: 'verified',
        source: 'Park Zone Specifications. User coords: x=60.77..79.64, y=123.57..140.43. Wall-to-wall=140.43".',
        note: 'Blue = top wall. Width=18.87" (x span), Height=16.86" (into field). Inner layer 2" inset on 3 exposed sides.',
      },
    },
    {
      id: 'park-red',
      alliance: 'red',
      // User coords: x=60.77..79.64, y=0..16.86 (bottom wall).
      // Internal: center.x = 0, center.y = -(FIELD_ACTUAL_HALF - PZ_HEIGHT/2) = -61.785
      center: { x: 0, y: -(FIELD_ACTUAL_HALF - PZ_HEIGHT / 2) },
      width: PZ_WIDTH,
      height: PZ_HEIGHT,
      innerInset: PZ_INNER_INSET,
      placement: {
        confidence: 'verified',
        source: 'Park Zone Specifications. User coords: x=60.77..79.64, y=0..16.86. Wall-to-wall=140.43".',
        note: 'Red = bottom wall. Width=18.87" (x span), Height=16.86" (into field). Inner layer 2" inset on 3 exposed sides.',
      },
    },
  ],

  loaders: [
    {
      id: 'loader-blue-left',
      alliance: 'blue',
      center: { x: -LOADER_X_OFFSET, y: HALF },
      width: LOADER_W,
      depth: LOADER_D,
      mouthDiameter: LOADER_MOUTH,
      rotation: 0,
      placement: {
        confidence: 'approximate',
        source: 'Loader Specifications (size) + object-placement (near corners).',
        note: 'Along-wall position approximate.',
      },
    },
    {
      id: 'loader-blue-right',
      alliance: 'blue',
      center: { x: LOADER_X_OFFSET, y: HALF },
      width: LOADER_W,
      depth: LOADER_D,
      mouthDiameter: LOADER_MOUTH,
      rotation: 0,
      placement: {
        confidence: 'approximate',
        source: 'Loader Specifications (size) + object-placement (near corners).',
        note: 'Along-wall position approximate.',
      },
    },
    {
      id: 'loader-red-left',
      alliance: 'red',
      center: { x: -LOADER_X_OFFSET, y: -HALF },
      width: LOADER_W,
      depth: LOADER_D,
      mouthDiameter: LOADER_MOUTH,
      rotation: 180,
      placement: {
        confidence: 'approximate',
        source: 'Loader Specifications (size) + object-placement (near corners).',
        note: 'Along-wall position approximate.',
      },
    },
    {
      id: 'loader-red-right',
      alliance: 'red',
      center: { x: LOADER_X_OFFSET, y: -HALF },
      width: LOADER_W,
      depth: LOADER_D,
      mouthDiameter: LOADER_MOUTH,
      rotation: 180,
      placement: {
        confidence: 'approximate',
        source: 'Loader Specifications (size) + object-placement (near corners).',
        note: 'Along-wall position approximate.',
      },
    },
  ],

  longGoals: [
    {
      id: 'long-goal-left',
      center: { x: -LG_X_OFFSET, y: 0 },
      length: LG_TOTAL,
      depth: LG_DEPTH,
      rotation: 90,
      sections: { openStart: LG_OPEN, enclosedCenter: LG_ENCLOSED, openEnd: LG_OPEN },
      placement: {
        confidence: 'approximate',
        source: 'Long Goal Specifications (sizes verified) + field-measurements.png + object-placement top view.',
        note: 'Vertical orientation (rotation=90°) confirmed by field-top-view and object-placement images. X offset ~21.955" from paired boundary features in field-measurements.png.',
      },
    },
    {
      id: 'long-goal-right',
      center: { x: LG_X_OFFSET, y: 0 },
      length: LG_TOTAL,
      depth: LG_DEPTH,
      rotation: 90,
      sections: { openStart: LG_OPEN, enclosedCenter: LG_ENCLOSED, openEnd: LG_OPEN },
      placement: {
        confidence: 'approximate',
        source: 'Long Goal Specifications (sizes verified) + field-measurements.png + object-placement top view.',
        note: 'Vertical orientation (rotation=90°) confirmed by field-top-view and object-placement images. X offset ~21.955" from paired boundary features in field-measurements.png.',
      },
    },
  ],

  centerGoals: [
    {
      id: 'center-goal-upper',
      label: 'UPPER',
      center: { x: 0, y: 0 },
      length: CG_LENGTH,
      width: CG_UPPER_WIDTH,
      rotation: 45,
      hasAlignmentTriangles: true,
      allowUnderPassage: true,
      placement: {
        confidence: 'approximate',
        source: 'Center Goal Specifications (length 22.6" verified). Width 5.53" user-specified.',
        note: 'Runs upper-right ↔ lower-left (positive slope, rotation=45°). Elevated — balls slide under, outtaked balls captured inside.',
      },
    },
    {
      id: 'center-goal-lower',
      label: 'LOWER',
      center: { x: 0, y: 0 },
      length: CG_LENGTH,
      width: CG_LOWER_WIDTH,
      rotation: -45,
      hasAlignmentTriangles: false,
      allowUnderPassage: false,
      placement: {
        confidence: 'approximate',
        source: 'Center Goal Specifications (length 22.6" verified). Width 4.15" user-specified.',
        note: 'Runs upper-left ↔ lower-right (negative slope, rotation=-45°). Solid floor — balls cannot pass under.',
      },
    },
  ],

  tapeLines: [
    {
      id: 'autonomous-line',
      label: 'Autonomous Line',
      from: { x: -HALF, y: 0 },
      to: { x: HALF, y: 0 },
      double: true,
      placement: {
        confidence: 'approximate',
        source: 'Object-placement / field spec (center tape line).',
        note: 'Drawn across field center dividing the alliance halves; exact path approximate.',
      },
    },
  ],
}
