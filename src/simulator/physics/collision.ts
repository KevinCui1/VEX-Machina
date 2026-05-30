// ─────────────────────────────────────────────────────────────────────────────
// Collision resolution helpers — Step 4.
//
// Three resolver types:
//   resolveBlockWall   — block circle vs. field perimeter (axis-aligned)
//   resolveBlockBlock  — block circle vs. block circle (equal-mass elastic)
//   resolveRobotBlock  — robot OBB vs. block circle (robot is authoritative)
//
// All coordinates field inches, +Y up. Velocities are inches/sec.
// ─────────────────────────────────────────────────────────────────────────────

import type { PhysicsBlock } from './physicsTypes'
import { BLOCK_RADIUS } from './physicsTypes'
import { FIELD_HALF, ROBOT_H, ROBOT_W } from '../robot/robotTypes'

// How much normal velocity a block retains after hitting a wall.
// Low value → block barely bounces off foam-covered metal perimeter.
const RESTITUTION_WALL = 0.15

// Fraction of relative normal velocity retained in block-block collision.
const RESTITUTION_BLOCK = 0.35

// Robot half-extents match robotTypes constants.
const RHW = ROBOT_W / 2  // 7"
const RHH = ROBOT_H / 2  // 7"

// ─── Block vs. field perimeter ────────────────────────────────────────────────

export function resolveBlockWall(b: PhysicsBlock): void {
  const lo = -FIELD_HALF + BLOCK_RADIUS
  const hi =  FIELD_HALF - BLOCK_RADIUS

  if (b.x < lo) { b.x = lo; if (b.vx < 0) b.vx = -b.vx * RESTITUTION_WALL }
  if (b.x > hi) { b.x = hi; if (b.vx > 0) b.vx = -b.vx * RESTITUTION_WALL }
  if (b.y < lo) { b.y = lo; if (b.vy < 0) b.vy = -b.vy * RESTITUTION_WALL }
  if (b.y > hi) { b.y = hi; if (b.vy > 0) b.vy = -b.vy * RESTITUTION_WALL }
}

// ─── Block vs. block ──────────────────────────────────────────────────────────

export function resolveBlockBlock(a: PhysicsBlock, b: PhysicsBlock): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist2 = dx * dx + dy * dy
  const minDist = BLOCK_RADIUS * 2

  if (dist2 >= minDist * minDist || dist2 < 1e-8) return

  const dist = Math.sqrt(dist2)
  const nx = dx / dist
  const ny = dy / dist

  // Push overlapping pair apart symmetrically.
  const half = (minDist - dist) * 0.5
  a.x -= nx * half;  a.y -= ny * half
  b.x += nx * half;  b.y += ny * half

  // 1D elastic collision along the contact normal (equal mass).
  const relVn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
  if (relVn >= 0) return  // already separating

  const j = -(1 + RESTITUTION_BLOCK) * relVn * 0.5
  a.vx -= j * nx;  a.vy -= j * ny
  b.vx += j * nx;  b.vy += j * ny
}

// ─── Robot OBB vs. block circle ───────────────────────────────────────────────
// The robot is treated as an oriented bounding box (same half-extents as visual
// chassis). The block is a circle of radius BLOCK_RADIUS.
//
// Algorithm:
//   1. Express block center in robot local frame (front = +localX, left = +localY).
//   2. Find the closest point on the robot AABB [-RHW, RHW] × [-RHH, RHH].
//   3. If the gap between block center and closest point < BLOCK_RADIUS → collision.
//   4. Push block out along the gap normal; transfer robot velocity to block.
//
// robotVx / robotVy: robot's velocity in world space during this frame.
// The robot itself is not pushed back — it is authoritative.

export function resolveRobotBlock(
  rx: number, ry: number,
  heading: number,         // degrees CCW from +X
  robotVx: number, robotVy: number,
  block: PhysicsBlock,
): void {
  const rad = (heading * Math.PI) / 180
  const cosH = Math.cos(rad)
  const sinH = Math.sin(rad)

  // Block center relative to robot center, in world frame.
  const wx = block.x - rx
  const wy = block.y - ry

  // Rotate into robot local frame.
  const localX =  wx * cosH + wy * sinH
  const localY = -wx * sinH + wy * cosH

  // Closest point on robot AABB to block center.
  const cpX = Math.max(-RHW, Math.min(RHW, localX))
  const cpY = Math.max(-RHH, Math.min(RHH, localY))

  // Separation vector (block center → closest point, in local frame).
  const sepX = localX - cpX
  const sepY = localY - cpY
  const dist2 = sepX * sepX + sepY * sepY

  if (dist2 >= BLOCK_RADIUS * BLOCK_RADIUS) return  // no contact

  // Block center is inside or very near the robot box — eject forward.
  if (dist2 < 1e-8) {
    block.x = rx + cosH * (RHW + BLOCK_RADIUS + 0.1)
    block.y = ry + sinH * (RHW + BLOCK_RADIUS + 0.1)
    block.vx = cosH * 30
    block.vy = sinH * 30
    return
  }

  const dist = Math.sqrt(dist2)
  const overlap = BLOCK_RADIUS - dist

  // Separation normal in local frame, then back to world frame.
  const nlX = sepX / dist
  const nlY = sepY / dist
  const nwX = nlX * cosH - nlY * sinH
  const nwY = nlX * sinH + nlY * cosH

  // Push block out by the overlap amount.
  block.x += nwX * overlap
  block.y += nwY * overlap

  // Transfer robot velocity component along push normal.
  // Only accelerates block if robot is faster in this direction.
  const robotVn  = robotVx * nwX + robotVy * nwY
  const blockVn  = block.vx * nwX + block.vy * nwY
  if (robotVn > blockVn) {
    const gain = (robotVn - blockVn) * 0.85
    block.vx += nwX * gain
    block.vy += nwY * gain
  }
}
