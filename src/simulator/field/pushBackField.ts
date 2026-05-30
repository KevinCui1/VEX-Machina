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
const WALL_TO_WALL = 140.5 // official inside wall-to-wall
const HALF = NOMINAL_INTERIOR / 2 // 72 — interior spans -72..+72

// Long Goal section lengths (verified from "Long Goal Specifications").
const LG_TOTAL = 48.79 // 1239.27 mm
const LG_ENCLOSED = 13.33 // enclosed center section (Game Manual)
const LG_OPEN = (LG_TOTAL - LG_ENCLOSED) / 2 // 17.73 — matches 450.29 mm spec
const LG_DEPTH = 5.53 // verified from Long Goal Specs: 140.53mm total cross-section

// Long Goal left/right centerline offset from field center.
// APPROXIMATE: from field-measurements.png reference, paired boundary features
// appear at ~20.33" and ~23.58" from center, giving midpoint ≈ 21.955".
// Goals run VERTICALLY (rotation=90°) along the Y axis, confirmed by both
// the field-top-view and object-placement Appendix A top-down images.
const LG_X_OFFSET = 21.955

// Center Goal (verified length from "Center Goal Specifications": 573.99 mm).
const CG_LENGTH = 22.6
const CG_SIDE = CG_LENGTH / Math.SQRT2 // diamond edge so tip-to-tip = length

// Loader footprint (verified-ish from "Loader Specifications": ⌀3.94 mouth,
// ~4.65 x 4.17 base). Position along the wall is APPROXIMATE.
const LOADER_W = 6
const LOADER_D = 5
const LOADER_MOUTH = 3.94
const LOADER_X_OFFSET = 54 // approximate: loaders sit near the corners

// Park Zone L dimensions (verified from "Park Zone Specifications").
const PZ_ALONG_X = 16.86 // 428.18 mm
const PZ_ALONG_Y = 18.87 // 479.35 mm
const PZ_STRIP = 2.0 // 50.80 mm

export const pushBackField: GameField = {
  meta: {
    game: 'Push Back',
    season: '2025-2026 VEX V5RC',
    orientation:
      'Audience view (manual / CAD top-down). +X = right, +Y = up toward Blue alliance station.',
    units: 'inches',
    notes: [
      'Origin is the geometric center of the 144" nominal interior (interior spans -72..+72).',
      'Official inside wall-to-wall is 140.5"; the 144" nominal (6 x 24" tiles) is used as the coordinate span.',
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
      source: 'Field Critical Specs (278-1501): ~140.5" inside wall-to-wall, 24" tiles.',
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
      corner: 'top-left',
      armAlongX: PZ_ALONG_X,
      armAlongY: PZ_ALONG_Y,
      stripWidth: PZ_STRIP,
      placement: {
        confidence: 'approximate',
        source: 'Park Zone Specifications (L geometry verified).',
        note: 'Corner assignment is approximate; dimensions are verified.',
      },
    },
    {
      id: 'park-red',
      alliance: 'red',
      corner: 'bottom-right',
      armAlongX: PZ_ALONG_X,
      armAlongY: PZ_ALONG_Y,
      stripWidth: PZ_STRIP,
      placement: {
        confidence: 'approximate',
        source: 'Park Zone Specifications (L geometry verified).',
        note: 'Corner assignment is approximate; dimensions are verified.',
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
      side: CG_SIDE,
      rotation: 45,
      placement: {
        confidence: 'approximate',
        source: 'Center Goal Specifications (length verified) + object-placement (central X).',
        note: 'Modeled as a 45°-rotated square at field center.',
      },
    },
    {
      id: 'center-goal-lower',
      label: 'LOWER',
      center: { x: 0, y: 0 },
      length: CG_LENGTH * 1.18, // lower reads slightly larger from above
      side: (CG_LENGTH * 1.18) / Math.SQRT2,
      rotation: 45,
      placement: {
        confidence: 'approximate',
        source: 'Center Goal Specifications (length verified) + object-placement (central X).',
        note: 'Upper/lower stack as a concentric pair; relative size approximate.',
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
