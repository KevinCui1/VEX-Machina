// ─────────────────────────────────────────────────────────────────────────────
// Push Back — official starting block layout.
//
// Coordinate system: field inches, origin = field center, +X right, +Y up.
// Red alliance = bottom (−Y), Blue alliance = top (+Y).
//
// Layout is defined on the RED side first, then mirrored to the BLUE side:
//   • Y coordinates are negated  (flip about y = 0 / autonomous line)
//   • Colors are swapped         (red ↔ blue)
//
// 30 blocks per alliance (12 in loaders + 18 on field) = 60 total.
// Preloads (2) and Match Load reserves (12) per alliance are not placed here.
// ─────────────────────────────────────────────────────────────────────────────

import type { PhysicsBlock } from './physicsTypes'
import { BLOCK_RADIUS } from './physicsTypes'

// ── Field geometry constants (must stay in sync with pushBackField.ts) ─────────
const FIELD_HALF = 72          // nominal interior half-span (inches)


// Park zone geometry (must match PZ_HEIGHT / PZ_INNER_INSET in pushBackField.ts)
const PZ_HEIGHT      = 16.86
const PZ_INNER_INSET = 2
const PZ_ARM_LEN     = PZ_HEIGHT - PZ_INNER_INSET  // 14.86" — straight-arm depth

const BR   = BLOCK_RADIUS   // circumradius ≈ 1.748"
const DIAM = BR * 2         // center-to-center distance when touching ≈ 3.496"

// ── Derived positions ──────────────────────────────────────────────────────────

// Loader: all 6 balls stacked at the same point in 'loader' state.
// They skip all physics (wall clamp, robot push, block-block) until dispensed.
// y = −70.6": just past the physics wall clamp (−70.252") but still inside the
// loader body, and far enough from the robot's wall-limit center (−65") that
// localX = 5.6 > 5.5 = INTAKE_ZONE_START when the robot faces the loader.
// In the top-down view only the last-rendered (blue) ball is visible.
const LOADER_Y = -70.6

// Park zone inner horizontal bar: at y = −(FIELD_HALF − PZ_ARM_LEN) in field coords.
// Balls sit just below (wall side of) this bar, touching it.
const PZ_INNER_BAR_Y  = -(FIELD_HALF - PZ_ARM_LEN) // −57.14"
const PZ_BALL_Y       = PZ_INNER_BAR_Y - BR         // ≈ −58.888"

// Long goal: balls sit in the OPEN SECTION of the goal, touching the white divider
// line between the open section and the enclosed center section.
// That divider is at y = −LG_ENCLOSED/2 = −6.665" (the white line surrounding y=0).
// Ball 1 touches the divider from the open-section side; ball 2 is directly behind.
// The goal is elevated so the robot intake can reach from the side.
const LG_ENCLOSED  = 13.33
const LG_DIVIDER_Y = -(LG_ENCLOSED / 2)       // −6.665" — white line at open/enclosed boundary
const LG_BALL_1_Y  = LG_DIVIDER_Y - BR + 24 / 5  // ≈ −3.613" — shifted 1/5 tile closer to divider
const LG_BALL_2_Y  = LG_BALL_1_Y  - DIAM         // ≈ −7.109" — directly behind

// ── Red-side positions ─────────────────────────────────────────────────────────
type Pos = { x: number; y: number; color: 'red' | 'blue'; state?: 'field' | 'loader' }

const RED_SIDE: Pos[] = [

  // ── 1. Red left loader (x = −54) ─────────────────────────────────────────
  // 6 blocks in 'loader' state — immune to all physics until dispensed one-by-one.
  // Stacked at the same point; top-down view shows only the blue top ball.
  // Reverse-order dispense (last index first) → blue balls come out first.
  { x: -54, y: LOADER_Y, color: 'red',  state: 'loader' },  // #1 bottom
  { x: -54, y: LOADER_Y, color: 'red',  state: 'loader' },  // #2
  { x: -54, y: LOADER_Y, color: 'red',  state: 'loader' },  // #3
  { x: -54, y: LOADER_Y, color: 'blue', state: 'loader' },  // #4
  { x: -54, y: LOADER_Y, color: 'blue', state: 'loader' },  // #5
  { x: -54, y: LOADER_Y, color: 'blue', state: 'loader' },  // #6 top — visible

  // ── 2. Red right loader (x = +54) ────────────────────────────────────────
  { x:  54, y: LOADER_Y, color: 'red',  state: 'loader' },
  { x:  54, y: LOADER_Y, color: 'red',  state: 'loader' },
  { x:  54, y: LOADER_Y, color: 'red',  state: 'loader' },
  { x:  54, y: LOADER_Y, color: 'blue', state: 'loader' },
  { x:  54, y: LOADER_Y, color: 'blue', state: 'loader' },
  { x:  54, y: LOADER_Y, color: 'blue', state: 'loader' },  // visible

  // ── 3. Red park zone — 4 blue balls touching the inner horizontal bar ─────
  // Inner horizontal bar at y ≈ −57.14"; ball centres at y ≈ −58.888".
  // 4 balls symmetric about x = 0; x-tile-line (x = 0) runs between #2 and #3.
  { x: -3 * BR, y: PZ_BALL_Y, color: 'blue' },  // #1 – leftmost
  { x:     -BR, y: PZ_BALL_Y, color: 'blue' },  // #2
  { x:      BR, y: PZ_BALL_Y, color: 'blue' },  // #3
  { x:  3 * BR, y: PZ_BALL_Y, color: 'blue' },  // #4 – rightmost

  // ── 4a. Corner cluster — bottom-left area ─────────────────────────────────
  // Reference corner: 2 tiles right & 2 tiles up from bottom-left = (−24, −24).
  { x: -24,       y: -24,        color: 'red' },  // at corner
  { x: -24,       y: -24 + DIAM, color: 'red' },  // directly above
  { x: -24 + DIAM, y: -24,       color: 'red' },  // directly to the right

  // ── 4b. Corner cluster — bottom-right area (reflected) ───────────────────
  { x:  24,       y: -24,        color: 'red' },
  { x:  24,       y: -24 + DIAM, color: 'red' },
  { x:  24 - DIAM, y: -24,       color: 'red' },  // to the left (mirrored)

  // ── 5a. Near-wall blue pair — left side ───────────────────────────────────
  // 1 tile up from bottom-left corner → tile-line y = −48 between the two balls.
  { x: -(FIELD_HALF - BR), y: -48 - BR, color: 'blue' },  // below y = −48
  { x: -(FIELD_HALF - BR), y: -48 + BR, color: 'blue' },  // above y = −48

  // ── 5b. Near-wall blue pair — right side ─────────────────────────────────
  { x:  (FIELD_HALF - BR), y: -48 - BR, color: 'blue' },
  { x:  (FIELD_HALF - BR), y: -48 + BR, color: 'blue' },

  // ── 6a. Under left long goal (centre x = −48) ────────────────────────────
  // Balls sit inside the goal body, touching the bottom white line from inside.
  // The goal is elevated, so the robot intake can reach from the side.
  { x: -48, y: LG_BALL_1_Y, color: 'red' },  // touching inner bottom line
  { x: -48, y: LG_BALL_2_Y, color: 'red' },  // directly behind (further in)

  // ── 6b. Under right long goal (centre x = +48) ───────────────────────────
  { x:  48, y: LG_BALL_1_Y, color: 'red' },
  { x:  48, y: LG_BALL_2_Y, color: 'red' },
]

// ── Mirror to blue side ────────────────────────────────────────────────────────
// Flip Y (about the autonomous line at y = 0) and swap red ↔ blue.
const BLUE_SIDE: Pos[] = RED_SIDE.map(p => ({
  x: p.x,
  y: -p.y,
  color: p.color === 'red' ? 'blue' : 'red',
  state: p.state,  // preserve 'loader' state for mirrored loader balls
}))

const ALL_POSITIONS: Pos[] = [...RED_SIDE, ...BLUE_SIDE]

export const TEST_BLOCK_COUNT = ALL_POSITIONS.length  // 60

export function makeTestBlocks(): PhysicsBlock[] {
  return ALL_POSITIONS.map(({ x, y, color, state }, i) => ({
    id: `block-${i}`,
    color,
    x,
    y,
    vx: 0,
    vy: 0,
    state: (state ?? 'field') as PhysicsBlock['state'],
  }))
}
