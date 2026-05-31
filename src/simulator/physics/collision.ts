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

  if (dist2 >= minDist * minDist) return

  let dist: number, nx: number, ny: number

  if (dist2 < 1e-6) {
    // Near-coincident: the separation axis is undefined, so derive a stable
    // spread direction from the block IDs. This ensures coincident blocks
    // always push apart consistently rather than staying permanently merged.
    const h = (a.id.charCodeAt(a.id.length - 1) * 73 +
               b.id.charCodeAt(b.id.length - 1) * 37) % 628
    const angle = h * 0.01  // maps 0–627 → 0–6.27 rad (full circle)
    nx = Math.cos(angle)
    ny = Math.sin(angle)
    dist = 0
  } else {
    dist = Math.sqrt(dist2)
    nx = dx / dist
    ny = dy / dist
  }

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

// ─── Robot OBB vs. oriented goal rectangle (OBB-OBB SAT) ────────────────────
//
// Generalization of resolveRobotGoalAABB for goals at any rotation angle.
// goalRotDeg: goal orientation in field CCW degrees (0 = long axis along +X).
// goalHalfL: half the goal length (along goal local X).
// goalHalfW: half the goal width (along goal local Y).
//
// The SAT uses 4 axes: goal local X, goal local Y, robot local X, robot local Y.

export function resolveRobotGoalOBB(
  rx: number, ry: number, heading: number,
  goalCx: number, goalCy: number, goalHalfL: number, goalHalfW: number,
  goalRotDeg: number,
): { x: number; y: number } | null {
  const goalRad  = (goalRotDeg  * Math.PI) / 180
  const robotRad = (heading     * Math.PI) / 180
  const cosG = Math.cos(goalRad),  sinG = Math.sin(goalRad)
  const cosR = Math.cos(robotRad), sinR = Math.sin(robotRad)

  const dx = rx - goalCx
  const dy = ry - goalCy

  // Projection of robot half-extents onto an arbitrary unit axis (nx, ny):
  //   RHW * |robot-fwd · axis| + RHH * |robot-lat · axis|
  const robotProj = (nx: number, ny: number) =>
    Math.abs( cosR * nx + sinR * ny) * RHW +
    Math.abs(-sinR * nx + cosR * ny) * RHH

  // Projection of goal half-extents onto an arbitrary unit axis:
  //   goalHalfL * |goal-fwd · axis| + goalHalfW * |goal-lat · axis|
  const goalProj = (nx: number, ny: number) =>
    Math.abs( cosG * nx + sinG * ny) * goalHalfL +
    Math.abs(-sinG * nx + cosG * ny) * goalHalfW

  const axes = [
    { nx:  cosG, ny:  sinG, ra: robotProj( cosG,  sinG), ga: goalHalfL },
    { nx: -sinG, ny:  cosG, ra: robotProj(-sinG,  cosG), ga: goalHalfW },
    { nx:  cosR, ny:  sinR, ra: RHW,                      ga: goalProj( cosR,  sinR) },
    { nx: -sinR, ny:  cosR, ra: RHH,                      ga: goalProj(-sinR,  cosR) },
  ]

  let minOverlap = Infinity
  let pushNx = 0, pushNy = 0, pushSign = 1

  for (const { nx, ny, ra, ga } of axes) {
    const proj    = dx * nx + dy * ny
    const overlap = ra + ga - Math.abs(proj)
    if (overlap <= 0) return null
    if (overlap < minOverlap) {
      minOverlap = overlap
      pushNx = nx; pushNy = ny
      pushSign = proj >= 0 ? 1 : -1
    }
  }

  return {
    x: rx + pushSign * pushNx * minOverlap,
    y: ry + pushSign * pushNy * minOverlap,
  }
}

// ─── Block circle vs. oriented goal rectangle ────────────────────────────────
//
// Used to make the lower center goal a solid obstacle for field balls.
// The ball is pushed outside the OBB by the penetration amount.

export function resolveBlockGoalOBB(
  b: PhysicsBlock,
  goalCx: number, goalCy: number, goalHalfL: number, goalHalfW: number,
  goalRotDeg: number,
): void {
  const rad  = (goalRotDeg * Math.PI) / 180
  const cosG = Math.cos(rad), sinG = Math.sin(rad)

  const dx = b.x - goalCx
  const dy = b.y - goalCy

  // Block center in goal local frame
  const localX =  dx * cosG + dy * sinG
  const localY = -dx * sinG + dy * cosG

  // Closest point on goal AABB (in local frame) to block center
  const cpX = Math.max(-goalHalfL, Math.min(goalHalfL, localX))
  const cpY = Math.max(-goalHalfW, Math.min(goalHalfW, localY))

  const sepX = localX - cpX
  const sepY = localY - cpY
  const dist2 = sepX * sepX + sepY * sepY

  if (dist2 >= BLOCK_RADIUS * BLOCK_RADIUS) return

  let nwX: number, nwY: number, overlap: number

  if (dist2 < 1e-6) {
    // Block center inside goal — eject through nearest face
    const dL = goalHalfL - Math.abs(localX)
    const dW = goalHalfW - Math.abs(localY)
    let elx = 0, ely = 0
    if (dL <= dW) { elx = localX >= 0 ? 1 : -1 }
    else          { ely = localY >= 0 ? 1 : -1 }
    nwX    =  elx * cosG - ely * sinG
    nwY    =  elx * sinG + ely * cosG
    overlap = (dL <= dW ? dL : dW) + BLOCK_RADIUS + 0.1
    b.x = goalCx + nwX * (dL <= dW ? goalHalfL : goalHalfW) + nwX * (BLOCK_RADIUS + 0.1)
    b.y = goalCy + nwY * (dL <= dW ? goalHalfL : goalHalfW) + nwY * (BLOCK_RADIUS + 0.1)
    b.vx = nwX * 10; b.vy = nwY * 10
    return
  }

  const dist = Math.sqrt(dist2)
  overlap = BLOCK_RADIUS - dist
  const nlX = sepX / dist, nlY = sepY / dist

  // Back to world frame
  nwX = nlX * cosG - nlY * sinG
  nwY = nlX * sinG + nlY * cosG

  b.x += nwX * overlap
  b.y += nwY * overlap

  // Reflect velocity component along push normal (low restitution, like wall)
  const vn = b.vx * nwX + b.vy * nwY
  if (vn < 0) {
    b.vx -= (1 + 0.15) * vn * nwX
    b.vy -= (1 + 0.15) * vn * nwY
  }
}

// ─── Robot OBB vs. axis-aligned goal rectangle (SAT) ────────────────────────
//
// The long goals are axis-aligned rectangles (vertical bars) in field space.
// The robot is an OBB that can be at any heading. We use the 4-axis Separating
// Axis Theorem (world X, world Y, robot local X, robot local Y) to find the
// minimum penetration depth and push the robot out along that axis.
//
// Returns the corrected robot position, or null if there is no collision.

export function resolveRobotGoalAABB(
  rx: number, ry: number, heading: number,
  goalCx: number, goalCy: number, goalHalfW: number, goalHalfH: number,
): { x: number; y: number } | null {
  const rad  = (heading * Math.PI) / 180
  const cosH = Math.cos(rad)
  const sinH = Math.sin(rad)

  // Vector from goal center to robot center.
  const dx = rx - goalCx
  const dy = ry - goalCy

  let minOverlap = Infinity
  let pushNx = 0, pushNy = 0, pushSign = 1

  // Each axis: {nx,ny} is the unit normal; ra = robot projection; ga = goal projection.
  const axes = [
    // World X
    { nx: 1, ny: 0,
      ra: Math.abs(cosH) * RHW + Math.abs(sinH) * RHH,
      ga: goalHalfW },
    // World Y
    { nx: 0, ny: 1,
      ra: Math.abs(sinH) * RHW + Math.abs(cosH) * RHH,
      ga: goalHalfH },
    // Robot local X (forward)
    { nx: cosH, ny: sinH,
      ra: RHW,
      ga: Math.abs(cosH) * goalHalfW + Math.abs(sinH) * goalHalfH },
    // Robot local Y (lateral)
    { nx: -sinH, ny: cosH,
      ra: RHH,
      ga: Math.abs(sinH) * goalHalfW + Math.abs(cosH) * goalHalfH },
  ]

  for (const { nx, ny, ra, ga } of axes) {
    const proj    = dx * nx + dy * ny
    const overlap = ra + ga - Math.abs(proj)
    if (overlap <= 0) return null  // separating axis found — no collision
    if (overlap < minOverlap) {
      minOverlap = overlap
      pushNx   = nx
      pushNy   = ny
      pushSign = proj >= 0 ? 1 : -1
    }
  }

  return {
    x: rx + pushSign * pushNx * minOverlap,
    y: ry + pushSign * pushNy * minOverlap,
  }
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

  // Block center is inside or very near the robot box — eject through the nearest wall.
  // We find which of the four robot walls (front, back, left, right) the block center
  // is closest to and eject through that face. This prevents the old "always eject forward"
  // behavior from shooting back-half blocks toward the robot's front when the robot is
  // backed into a goal — those should go backward, not forward.
  if (dist2 < 1e-8) {
    const dFront = RHW - localX   // dist to  front wall (+localX face)
    const dBack  = RHW + localX   // dist to  back  wall (-localX face)
    const dRight = RHH - localY   // dist to  right wall (+localY face)
    const dLeft  = RHH + localY   // dist to  left  wall (-localY face)
    const minD   = Math.min(dFront, dBack, dRight, dLeft)
    let elx = 0, ely = 0, ext = 0
    if      (dFront <= minD) { elx =  1; ext = RHW }
    else if (dBack  <= minD) { elx = -1; ext = RHW }
    else if (dRight <= minD) { ely =  1; ext = RHH }
    else                     { ely = -1; ext = RHH }
    const ewx = elx * cosH - ely * sinH
    const ewy = elx * sinH + ely * cosH
    block.x = rx + ewx * (ext + BLOCK_RADIUS + 0.1)
    block.y = ry + ewy * (ext + BLOCK_RADIUS + 0.1)
    block.vx = ewx * 30
    block.vy = ewy * 30
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
