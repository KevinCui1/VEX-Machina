// ─────────────────────────────────────────────────────────────────────────────
// Physics types for Step 4 — Basic Block Physics and Pushing.
//
// PhysicsBlock extends the visual block data with velocity for the physics
// loop. Only on-field blocks that participate in simulation use this type.
//
// Coordinate system: field inches, origin = field center, +X right, +Y up.
// Velocities are inches per second.
// ─────────────────────────────────────────────────────────────────────────────

export interface PhysicsBlock {
  id: string
  color: 'red' | 'blue'
  x: number    // field inches, center
  y: number    // field inches, center
  vx: number   // velocity x, inches/sec
  vy: number   // velocity y, inches/sec
  /**
   * 'field'  — loose on the floor; full physics apply.
   * 'held'   — attached to robot; carried each frame, skips all collision.
   * 'loader' — stored in a wall loader; immune to all physics until dispensed.
   */
  state: 'field' | 'held' | 'loader'
}

// Physical block size: 3.23" flat-to-flat (verified from Block Specifications).
// Circumradius = flat-to-flat/2 / cos(π/8) ≈ 1.748" — used as physics collision
// radius so blocks collide exactly when their octagonal outlines touch.
export const BLOCK_FLAT_TO_FLAT = 3.23
export const BLOCK_INNER_R = BLOCK_FLAT_TO_FLAT / 2          // 1.615" flat-to-axis
export const BLOCK_RADIUS  = BLOCK_INNER_R / Math.cos(Math.PI / 8) // ≈ 1.748" circumradius

// Minimum separation before two blocks are considered touching.
export const BLOCK_MIN_DIST = BLOCK_RADIUS * 2  // ≈ 3.496"
