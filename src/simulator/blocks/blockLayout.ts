// ─────────────────────────────────────────────────────────────────────────────
// Push Back Block layout — the single source of truth for all 88 Blocks.
//
// COUNTS (per alliance color):
//   18 field-start  — start in predetermined field positions
//   12 loader       — start inside Loaders
//   12 match-load   — reserved; enter play through Loaders during match
//    2 preload       — one per robot, placed on robot before match
//  ──────
//   44 per color × 2 colors = 88 total
//
// COORDINATE SYSTEM: field inches, origin = field center, +X right, +Y up
// (Blue alliance station = +Y side). Same system as pushBackField.ts.
//
// POSITION ACCURACY:
//   All field-start positions are APPROXIMATE, derived from visual inspection
//   of /reference-images/object-placement.png and /reference-images/field-top-view.png.
//   No verified CAD coordinates are available for individual Block positions.
//   Update positionNote to 'verified' once exact coordinates are confirmed.
//
//   The layout uses 180° rotational symmetry: rotating the field 180° and
//   swapping red ↔ blue should produce the same configuration. This matches
//   the expected Push Back starting layout structure.
// ─────────────────────────────────────────────────────────────────────────────

export type BlockColor = 'red' | 'blue'

/** Where the block originates in the official starting configuration. */
export type BlockCategory = 'field-start' | 'loader' | 'match-load' | 'preload'

/** Current location/status of a block. */
export type BlockState = 'on-field' | 'in-loader' | 'reserved' | 'as-preload'

export interface Block {
  id: string
  color: BlockColor
  category: BlockCategory
  state: BlockState
  /** Field-space position for on-field blocks. Undefined for reserved / preload. */
  fieldPosition?: { x: number; y: number }
  /** Which loader this block starts in (for loader-category blocks). */
  loaderId?: string
  positionNote: 'verified' | 'approximate'
}

// ─── Long Goal geometry (must match pushBackField.ts) ─────────────────────────
// Goals are VERTICAL, centered at x = ±LG_X, spanning y = ±LG_HALF_LEN.
const LG_X = 21.955
const LG_HALF_LEN = 48.79 / 2 // 24.395"
const LG_OPEN_LEN = (48.79 - 13.33) / 2 // 17.73" each open section
// Open section Y ranges (bottom open: y -24.395 to -6.665; top open: y 6.665 to 24.395)
const LG_BOTTOM_OPEN_START = -LG_HALF_LEN             // -24.395
const LG_BOTTOM_OPEN_END   = -LG_HALF_LEN + LG_OPEN_LEN // -6.665

// ─── Block size ───────────────────────────────────────────────────────────────
export const BLOCK_FLAT_TO_FLAT = 3.23  // verified from Block Specifications (82mm)

// ─── Helper to space N blocks evenly between two Y values ────────────────────
function ySpread(n: number, yMin: number, yMax: number): number[] {
  if (n === 1) return [(yMin + yMax) / 2]
  const step = (yMax - yMin) / (n + 1)
  return Array.from({ length: n }, (_, i) => yMin + step * (i + 1))
}

// ─── Build field-starting blocks with 180° rotational symmetry ───────────────
// Strategy: define 18 red block positions; each has a mirrored blue at (-x, -y).

function makeFieldStartPairs(): Block[] {
  // Each entry is a red block position; blue goes at the negated coordinates.
  // Comments annotate the visual region of each cluster.
  const redPositions: { x: number; y: number }[] = [
    // Left Long Goal — bottom open section (3 red blocks)
    { x: -LG_X, y: ySpread(3, LG_BOTTOM_OPEN_START + 1, LG_BOTTOM_OPEN_END - 1)[0] },
    { x: -LG_X, y: ySpread(3, LG_BOTTOM_OPEN_START + 1, LG_BOTTOM_OPEN_END - 1)[1] },
    { x: -LG_X, y: ySpread(3, LG_BOTTOM_OPEN_START + 1, LG_BOTTOM_OPEN_END - 1)[2] },

    // Right Long Goal — bottom open section (3 red blocks)
    { x:  LG_X, y: ySpread(3, LG_BOTTOM_OPEN_START + 1, LG_BOTTOM_OPEN_END - 1)[0] },
    { x:  LG_X, y: ySpread(3, LG_BOTTOM_OPEN_START + 1, LG_BOTTOM_OPEN_END - 1)[1] },
    { x:  LG_X, y: ySpread(3, LG_BOTTOM_OPEN_START + 1, LG_BOTTOM_OPEN_END - 1)[2] },

    // Lower-left corner — red territory (3 red blocks)
    { x: -55, y: -60 },
    { x: -47, y: -60 },
    { x: -55, y: -53 },

    // Upper-left corner — blue territory, red blocks (3 red blocks)
    // (Push Back mechanic: opposing alliance blocks in enemy territory)
    { x: -55, y:  60 },
    { x: -47, y:  60 },
    { x: -55, y:  53 },

    // Lower-left mid-field (2 red blocks)
    { x: -50, y: -36 },
    { x: -35, y: -45 },

    // Lower-right mid-field (2 red blocks)
    { x:  35, y: -45 },
    { x:  50, y: -36 },

    // Near autonomous line — red side (2 red blocks)
    { x: -35, y: -12 },
    { x:  35, y: -12 },

    // Lower center (2 red blocks)
    { x: -12, y: -50 },
    { x:  12, y: -50 },
  ]

  const blocks: Block[] = []
  redPositions.forEach((pos, i) => {
    const rId = `fs-r${String(i + 1).padStart(3, '0')}`
    const bId = `fs-b${String(i + 1).padStart(3, '0')}`
    blocks.push({
      id: rId,
      color: 'red',
      category: 'field-start',
      state: 'on-field',
      fieldPosition: { x: pos.x, y: pos.y },
      positionNote: 'approximate',
    })
    blocks.push({
      id: bId,
      color: 'blue',
      category: 'field-start',
      state: 'on-field',
      fieldPosition: { x: -pos.x, y: -pos.y },
      positionNote: 'approximate',
    })
  })
  return blocks
}

// ─── Loader blocks ────────────────────────────────────────────────────────────
// 6 blocks per loader × 4 loaders = 24 total (12 red + 12 blue)
// Loader positions match pushBackField.ts (x=±54, top wall y=72, bottom y=-72)
const LOADER_X = 54
const LOADER_Y = 72

function makeLoaderBlocks(): Block[] {
  const blocks: Block[] = []
  const loaderDefs = [
    { id: 'loader-blue-left',  color: 'blue' as BlockColor, x: -LOADER_X, y:  LOADER_Y },
    { id: 'loader-blue-right', color: 'blue' as BlockColor, x:  LOADER_X, y:  LOADER_Y },
    { id: 'loader-red-left',   color: 'red'  as BlockColor, x: -LOADER_X, y: -LOADER_Y },
    { id: 'loader-red-right',  color: 'red'  as BlockColor, x:  LOADER_X, y: -LOADER_Y },
  ]

  loaderDefs.forEach((ld) => {
    for (let i = 0; i < 6; i++) {
      const alliance = ld.color === 'red' ? 'r' : 'b'
      const loaderShort = ld.id.replace('loader-', '').replace('-left', 'L').replace('-right', 'R').replace('blue', 'bl').replace('red', 'rd')
      blocks.push({
        id: `ld-${loaderShort}-${i + 1}`,
        color: ld.color,
        category: 'loader',
        state: 'in-loader',
        fieldPosition: { x: ld.x, y: ld.y },
        loaderId: ld.id,
        positionNote: 'approximate',
      })
      void alliance
    }
  })
  return blocks
}

// ─── Match Load reserves ──────────────────────────────────────────────────────
function makeMatchLoads(): Block[] {
  const blocks: Block[] = []
  for (let i = 0; i < 12; i++) {
    blocks.push({
      id: `ml-r${String(i + 1).padStart(3, '0')}`,
      color: 'red',
      category: 'match-load',
      state: 'reserved',
      positionNote: 'verified', // not placed on field, no position needed
    })
    blocks.push({
      id: `ml-b${String(i + 1).padStart(3, '0')}`,
      color: 'blue',
      category: 'match-load',
      state: 'reserved',
      positionNote: 'verified',
    })
  }
  return blocks
}

// ─── Preloads ─────────────────────────────────────────────────────────────────
function makePreloads(): Block[] {
  return [
    { id: 'pl-r001', color: 'red',  category: 'preload', state: 'as-preload', positionNote: 'approximate' },
    { id: 'pl-r002', color: 'red',  category: 'preload', state: 'as-preload', positionNote: 'approximate' },
    { id: 'pl-b001', color: 'blue', category: 'preload', state: 'as-preload', positionNote: 'approximate' },
    { id: 'pl-b002', color: 'blue', category: 'preload', state: 'as-preload', positionNote: 'approximate' },
  ]
}

// ─── Full starting layout ─────────────────────────────────────────────────────
const STARTING_LAYOUT: Block[] = [
  ...makeFieldStartPairs(),
  ...makeLoaderBlocks(),
  ...makeMatchLoads(),
  ...makePreloads(),
]

/**
 * Returns a deep copy of the official starting layout.
 * Call this to initialise or reset Block state.
 */
export function makeStartingLayout(): Block[] {
  return STARTING_LAYOUT.map((b) => ({ ...b, fieldPosition: b.fieldPosition ? { ...b.fieldPosition } : undefined }))
}

// ─── Counts for quick inspection ─────────────────────────────────────────────
export const BLOCK_COUNTS = {
  total: 88,
  redTotal: 44,
  blueTotal: 44,
  fieldStart: 36,    // 18 red + 18 blue
  loaderStart: 24,   // 12 red + 12 blue (6 per loader × 4 loaders)
  matchLoads: 24,    // 12 red + 12 blue (reserved)
  preloads: 4,       // 2 red + 2 blue
} as const
