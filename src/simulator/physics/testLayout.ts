// ─────────────────────────────────────────────────────────────────────────────
// PHYSICS TEST LAYOUT — Step 4 only.
//
// NOT the official Push Back starting configuration. Positions are chosen to
// exercise all required collision types quickly:
//
//   • Two blocks directly in the robot's forward path  → robot-block push
//   • A three-block cluster near the autonomous line  → block-block chain
//   • Two symmetrical offset blocks                   → multi-block interaction
//   • One block against the right perimeter           → wall bounce
//
// Robot starts at (0, −30) facing +Y (toward Blue alliance).
//
// Replace this file with the official field-start positions in a later step.
// ─────────────────────────────────────────────────────────────────────────────

import type { PhysicsBlock } from './physicsTypes'

export const TEST_BLOCK_COUNT = 8

export function makeTestBlocks(): PhysicsBlock[] {
  return [
    // ── In robot's forward path ─────────────────────────────────────────────
    { id: 'test-r001', color: 'red',  x:  0,  y: -16, vx: 0, vy: 0, state: 'field' },
    { id: 'test-b001', color: 'blue', x:  6,  y: -14, vx: 0, vy: 0, state: 'field' },

    // ── Three-block cluster — tests chain collision ─────────────────────────
    { id: 'test-r002', color: 'red',  x: -20, y:  -6, vx: 0, vy: 0, state: 'field' },
    { id: 'test-b002', color: 'blue', x: -14, y:  -6, vx: 0, vy: 0, state: 'field' },
    { id: 'test-r003', color: 'red',  x:  -8, y:  -6, vx: 0, vy: 0, state: 'field' },

    // ── Symmetrical mid-field pair ──────────────────────────────────────────
    { id: 'test-b003', color: 'blue', x:  28, y: -22, vx: 0, vy: 0, state: 'field' },
    { id: 'test-r004', color: 'red',  x: -28, y: -22, vx: 0, vy: 0, state: 'field' },

    // ── Near right perimeter — tests wall rebound ───────────────────────────
    { id: 'test-b004', color: 'blue', x:  63, y: -40, vx: 0, vy: 0, state: 'field' },
  ]
}
