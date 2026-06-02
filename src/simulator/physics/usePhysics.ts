// ─────────────────────────────────────────────────────────────────────────────
// usePhysics — unified rAF physics loop for Step 4 + Step 5.
//
// Manages robot movement (arcade drive), block physics, and the frontal rake
// intake mechanism in a single requestAnimationFrame loop so all state is
// consistent within each frame.
//
// Physics model:
//   • Robot  — arcade drive, OBB boundary clamping, authoritative vs. blocks.
//   • Blocks (state:'field') — Coulomb friction, circle-circle and OBB-circle
//              collision resolution, field-perimeter clamping.
//   • Blocks (state:'held') — positioned at fixed slots relative to robot each
//              frame; skip all collision and friction.
//
// Controls:
//   W / ↑   forward        A / ←   turn left
//   S / ↓   backward       D / →   turn right
//   R       reset scene (robot + test blocks, clears held blocks)
//   Space   activate intake (hold to keep active)
//   LMB     activate intake (hold to keep active)
//   X       release held blocks through the REAR outtake (long goals / upper center goal)
//   C       release held blocks through the FRONT outtake (lower center goal only)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ROBOT,
  FIELD_HALF,
  INTAKE_CAPACITY,
  INTAKE_FRONT_OFFSET,
  INTAKE_HALF_H,
  MOVE_SPEED,
  RAKE_REACH,
  ROBOT_HALF,
  ROBOT_W,
  TURN_RATE,
} from '../robot/robotTypes'
import type { RobotState } from '../robot/robotTypes'
import { makeTestBlocks } from './testLayout'
import type { PhysicsBlock } from './physicsTypes'
import { BLOCK_RADIUS } from './physicsTypes'
import { resolveBlockBlock, resolveBlockWall, resolveRobotBlock, resolveRobotGoalAABB, resolveRobotGoalOBB } from './collision'

// Robot center boundary: keep the body fully inside the field.
const BOUND = FIELD_HALF - ROBOT_HALF  // 65"

// Coulomb friction applied to sliding blocks each frame.
const FRICTION = 80  // inches / sec²

// Blocks slower than this are considered at rest to prevent micro-jitter.
const REST_SPEED = 0.25  // inches / sec

// Block-block collision iterations per frame.
const ITERS = 3

// Robot half-width used for intake zone check (matches collision.ts RHW).
const RHW = ROBOT_W / 2   // 7"

// ── Scatter constants ─────────────────────────────────────────────────────────
// Velocity kick (in/s) added to blocks that exit raised goals so they spread
// out naturally instead of travelling in a perfectly straight line.
const SCATTER_LONG_V   = 12    // random ±6 in/s lateral kick for long goal exits
const SCATTER_CG_V     = 12    // random ±6 in/s perpendicular for upper center goal exits
const SCATTER_DELAY_MS = 220   // ms delay before scatter fires for lower center goal
const SCATTER_LOWER_V  = 9     // in/s scatter magnitude for lower center goal (post-delay)


// Long Goal AABB colliders — must match pushBackField.ts (LG_X_OFFSET=48, LG_DEPTH=5.4, LG_TOTAL=48.79).
// Goals are vertical: half-width along X = depth/2, half-height along Y = length/2.
const LONG_GOAL_COLLIDERS = [
  { cx: -48, cy: 0, hw: 2.7, hh: 24.395 },
  { cx:  48, cy: 0, hw: 2.7, hh: 24.395 },
] as const

// Long Goal channel physics — same dimensions as colliders.
// Blocks in 'goal' state are confined to these bounds. They can exit only by
// travelling past the ±hh open ends. Wall friction zeroes vx each frame.
const LONG_GOAL_PHYSICS = [
  { id: 'long-goal-left',  cx: -48, cy: 0, hw: 2.7, hh: 24.395 },
  { id: 'long-goal-right', cx:  48, cy: 0, hw: 2.7, hh: 24.395 },
] as const

// Returns the goal that contains a given (x,y) point, or null.
function getGoalAtPoint(x: number, y: number): typeof LONG_GOAL_PHYSICS[number] | null {
  for (const g of LONG_GOAL_PHYSICS) {
    if (Math.abs(x - g.cx) <= g.hw && Math.abs(y - g.cy) <= g.hh) return g
  }
  return null
}

// Center Goal OBB colliders — match pushBackField.ts (CG_LENGTH=22.6, widths user-specified).
// Upper: rotation=45°, length=22.6, width=5.53. Lower: rotation=-45°, width=4.15.
// Both centered at origin.
const CG_UPPER_HALF_L = 11.3     // CG_LENGTH / 2
const CG_UPPER_HALF_W = 2.765    // CG_UPPER_WIDTH / 2
const CG_LOWER_HALF_L = 11.3
const CG_LOWER_HALF_W = 2.075    // CG_LOWER_WIDTH / 2
const CG_UPPER_ROT    = 45       // degrees CCW
const CG_LOWER_ROT    = -45

// Pre-computed trig for center goal length-axis directions.
// Upper goal (rot=45°):  length axis = (cos45°, sin45°) = (SQRT1_2,  SQRT1_2)
// Lower goal (rot=-45°): length axis = (cos-45°,sin-45°) = (SQRT1_2, -SQRT1_2)
const CG_COS   = Math.SQRT1_2   // shared cosine magnitude (|cos(±45°)|)
const CG_U_SIN =  Math.SQRT1_2  // sin(45°)
const CG_L_SIN = -Math.SQRT1_2  // sin(-45°)

// Proximity scoring constants for center goals.
// When X/C is pressed, scoring succeeds if the robot center is within this
// radius of the goal center AND heading is within HDG_TOL of a valid approach.
const CG_SCORE_RADIUS = 20   // ": robot center must be within this of (0,0)
const CG_SCORE_HDG    = 50   // °: heading tolerance for approach angle

// Center Goal physics channels — both goals score balls along their diagonal axis.
const CENTER_GOAL_UPPER = {
  id: 'center-goal-upper', cx: 0, cy: 0,
  halfL: CG_UPPER_HALF_L, halfW: CG_UPPER_HALF_W,
  cosG: CG_COS, sinG: CG_U_SIN,
  rot: CG_UPPER_ROT,
} as const

const CENTER_GOAL_LOWER = {
  id: 'center-goal-lower', cx: 0, cy: 0,
  halfL: CG_LOWER_HALF_L, halfW: CG_LOWER_HALF_W,
  cosG: CG_COS, sinG: CG_L_SIN,
  rot: CG_LOWER_ROT,
} as const

// Returns true when point is inside the lower center goal OBB.
function isInsideLowerCenterGoal(px: number, py: number): boolean {
  const lx =  px * CG_COS + py * CG_L_SIN
  const ly = -px * CG_L_SIN + py * CG_COS
  return Math.abs(lx) <= CG_LOWER_HALF_L && Math.abs(ly) <= CG_LOWER_HALF_W
}

// ── Center goal channel helpers ───────────────────────────────────────────────
//
// cgReLock: after generic resolveBlockBlock, re-project a center-goal block
// back onto its diagonal axis and check/process exit through either open end.
//
// delayed=true  → block came from lower center goal; mark scatterAt instead of
//                 applying immediate scatter (balls travel straighter longer).
// delayed=false → block came from upper center goal; apply perpendicular scatter
//                 right away so the block doesn't continue in a straight line.
function cgReLock(
  b: PhysicsBlock, halfL: number, cosG: number, sinG: number,
  now: number, delayed: boolean,
): void {
  const lx = b.x * cosG + b.y * sinG
  b.x = lx * cosG;  b.y = lx * sinG
  const vlx = b.vx * cosG + b.vy * sinG
  b.vx = vlx * cosG; b.vy = vlx * sinG
  if (Math.abs(lx) > halfL) {
    b.state  = 'field'; b.goalId = undefined
    const sign = lx > 0 ? 1 : -1
    b.x = sign * (halfL + BLOCK_RADIUS + 0.1) * cosG
    b.y = sign * (halfL + BLOCK_RADIUS + 0.1) * sinG
    b.vx = sign * Math.max(Math.abs(vlx), 8) * cosG
    b.vy = sign * Math.max(Math.abs(vlx), 8) * sinG
    if (delayed) {
      b.scatterAt = now + SCATTER_DELAY_MS
    } else {
      // Immediate perpendicular scatter — ball drops to the floor level.
      const perpScatter = (Math.random() - 0.5) * SCATTER_CG_V
      b.vx += perpScatter * (-sinG)
      b.vy += perpScatter * cosG
    }
  }
}

// cgChainPush: immediate cascade-push of all siblings in the same center goal
// when a new block is outtaked in — same pattern as the long goal chain push.
function cgChainPush(
  ob: PhysicsBlock,
  allBlocks: PhysicsBlock[],
  halfL: number, cosG: number, sinG: number,
  now: number, delayed: boolean,
): void {
  const SPACING = BLOCK_RADIUS * 2 + 0.2
  const obL  = ob.x * cosG + ob.y * sinG
  const obVl = ob.vx * cosG + ob.vy * sinG
  if (obVl === 0) return

  const getL  = (bl: PhysicsBlock) => bl.x * cosG + bl.y * sinG
  const getVl = (bl: PhysicsBlock) => bl.vx * cosG + bl.vy * sinG
  const setL  = (bl: PhysicsBlock, l: number) => { bl.x = l * cosG; bl.y = l * sinG }
  const setVl = (bl: PhysicsBlock, vl: number) => { bl.vx = vl * cosG; bl.vy = vl * sinG }

  const siblings = allBlocks.filter(
    bl => bl.state === 'goal' && bl.goalId === ob.goalId && bl.id !== ob.id
  )

  if (obVl > 0) {
    siblings.sort((a, b) => getL(a) - getL(b))
    let floor = obL + SPACING
    for (const bl of siblings) {
      if (getL(bl) < floor) { setL(bl, floor); if (getVl(bl) < obVl) setVl(bl, obVl) }
      floor = getL(bl) + SPACING
    }
  } else {
    siblings.sort((a, b) => getL(b) - getL(a))
    let ceil = obL - SPACING
    for (const bl of siblings) {
      if (getL(bl) > ceil) { setL(bl, ceil); if (getVl(bl) > obVl) setVl(bl, obVl) }
      ceil = getL(bl) - SPACING
    }
  }

  // Immediately exit siblings pushed past an open end.
  for (const bl of siblings) {
    const blL = getL(bl)
    if (Math.abs(blL) > halfL) {
      bl.state = 'field'; bl.goalId = undefined
      const sign = blL > 0 ? 1 : -1
      setL(bl, sign * (halfL + BLOCK_RADIUS + 0.1))
      const blVl = getVl(bl)
      setVl(bl, sign * Math.max(Math.abs(blVl), 8))
      if (delayed) {
        bl.scatterAt = now + SCATTER_DELAY_MS
      } else {
        const perpScatter = (Math.random() - 0.5) * SCATTER_CG_V
        bl.vx += perpScatter * (-sinG)
        bl.vy += perpScatter * cosG
      }
    }
  }
}

// Loader AABB colliders — match pushBackField.ts (LOADER_X_OFFSET=54, LOADER_W=6, LOADER_D=5, HALF=72).
// Loaders sit at the top/bottom field edges (y=±72). hw = width/2, hh = depth/2.
const LOADER_COLLIDERS = [
  { cx: -54, cy:  72, hw: 3, hh: 2.5 },
  { cx:  54, cy:  72, hw: 3, hh: 2.5 },
  { cx: -54, cy: -72, hw: 3, hh: 2.5 },
  { cx:  54, cy: -72, hw: 3, hh: 2.5 },
] as const

// Park Zone "speed bump" constants — robot slows briefly as each axle crosses the
// inner boundary tape line of a Park Zone (simulates bumping over the raised edge).
// Coordinates match pushBackField.ts: FIELD_ACTUAL_HALF=70.215, PZ_HEIGHT=16.86, PZ_WIDTH=18.87.
const PZ_INNER_Y      = 70.215 - 16.86           // 53.355" — inner boundary (field-facing edge)
const PZ_X_HALF       = 18.87 / 2                // 9.435"  — park zone half-width
const PZ_X_TRIGGER    = PZ_X_HALF + ROBOT_HALF   // 16.435" — X gate for horizontal border checks
// Horizontal border thresholds (|y|): front/rear axle crossing the inner tape line
const PZ_THRESH_NEAR  = PZ_INNER_Y - ROBOT_HALF  // 46.355" — front axle at inner tape
const PZ_THRESH_FAR   = PZ_INNER_Y + ROBOT_HALF  // 60.355" — rear axle at inner tape
// Vertical border thresholds (|x|): front/rear axle crossing the side tape lines
const PZ_X_THRESH_NEAR = PZ_X_HALF - ROBOT_HALF  //  2.435" — front axle at vertical tape
const PZ_X_THRESH_FAR  = PZ_X_HALF + ROBOT_HALF  // 16.435" — rear axle at vertical tape
const PZ_STUCK_MS     = 200

// Held-block interior physics constants.
const HELD_FRICTION     = 150   // inches / sec² — higher than field friction
const HELD_RESTITUTION  = 0.50  // energy kept after each wall bounce
const HELD_LIMIT        = ROBOT_HALF - BLOCK_RADIUS  // ≈ 5.25" from robot center

// ─── Public interface ────────────────────────────────────────────────────────

export interface UsePhysicsResult {
  robot: RobotState
  physicsBlocks: PhysicsBlock[]
  resetScene: () => void
  heldKeys: ReadonlySet<string>
  intakeActive: boolean
  heldIds: string[]
}

// ─────────────────────────────────────────────────────────────────────────────

export function usePhysics(
  intakeCapacity = INTAKE_CAPACITY,
  moveSpeed      = MOVE_SPEED,
  turnRate       = TURN_RATE,
): UsePhysicsResult {
  // Keep hot-configurable values accessible inside the rAF loop without recreating the loop.
  const capacityRef  = useRef(intakeCapacity)
  const moveSpeedRef = useRef(moveSpeed)
  const turnRateRef  = useRef(turnRate)
  useEffect(() => { capacityRef.current  = intakeCapacity }, [intakeCapacity])
  useEffect(() => { moveSpeedRef.current = moveSpeed      }, [moveSpeed])
  useEffect(() => { turnRateRef.current  = turnRate       }, [turnRate])
  // ── Physics refs (mutated every frame, never trigger re-renders) ──────────
  const robotRef   = useRef<RobotState>({ ...DEFAULT_ROBOT })
  const blocksRef  = useRef<PhysicsBlock[]>(makeTestBlocks())
  const keysRef    = useRef<Set<string>>(new Set())

  // ── Intake refs ───────────────────────────────────────────────────────────
  const heldIdsRef              = useRef<string[]>([])
  const mouseDownRef            = useRef(false)
  const lastOuttakeTimeRef      = useRef<number>(Number.NEGATIVE_INFINITY)
  const lastFrontOuttakeTimeRef = useRef<number>(Number.NEGATIVE_INFINITY)
  const lastLoaderDispenseRef   = useRef<number>(Number.NEGATIVE_INFINITY)

  // ── Previous robot velocity — used to compute inertial delta for held blocks
  const prevRobotVxRef = useRef(0)
  const prevRobotVyRef = useRef(0)

  // ── Park Zone crossing state ──────────────────────────────────────────────
  const parkZoneStuckUntilRef = useRef(0)
  const prevRobotYForPZRef    = useRef(DEFAULT_ROBOT.y)
  const prevRobotXForPZRef    = useRef(DEFAULT_ROBOT.x)

  // ── React state — written by rAF loop, read by renderer ───────────────────
  const [renderState, setRenderState] = useState<{
    robot: RobotState
    physicsBlocks: PhysicsBlock[]
    intakeActive: boolean
    heldIds: string[]
  }>(() => ({
    robot: { ...DEFAULT_ROBOT },
    physicsBlocks: makeTestBlocks(),
    intakeActive: false,
    heldIds: [],
  }))
  const [heldKeys, setHeldKeys] = useState<ReadonlySet<string>>(new Set())

  // (outtake is handled sequentially inside the physics loop)

  // ── Scene reset ───────────────────────────────────────────────────────────
  const resetScene = useCallback(() => {
    heldIdsRef.current = []
    lastOuttakeTimeRef.current      = Number.NEGATIVE_INFINITY
    lastFrontOuttakeTimeRef.current = Number.NEGATIVE_INFINITY
    lastLoaderDispenseRef.current   = Number.NEGATIVE_INFINITY
    parkZoneStuckUntilRef.current = 0
    prevRobotYForPZRef.current    = DEFAULT_ROBOT.y
    prevRobotXForPZRef.current    = DEFAULT_ROBOT.x
    const freshRobot  = { ...DEFAULT_ROBOT }
    const freshBlocks = makeTestBlocks()
    robotRef.current  = freshRobot
    blocksRef.current = freshBlocks
    setRenderState({
      robot: { ...freshRobot },
      physicsBlocks: freshBlocks.map(b => ({ ...b })),
      intakeActive: false,
      heldIds: [],
    })
  }, [])

  // ── Keyboard listeners ────────────────────────────────────────────────────
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key === ' ' ? ' ' : e.key.toLowerCase()

      if (key === 'r') { resetScene(); return }

      // Prevent page scroll from arrow keys and space.
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault()
      }

      if (!keysRef.current.has(key)) {
        keysRef.current.add(key)
        setHeldKeys(new Set(keysRef.current))
      }
    }

    function up(e: KeyboardEvent) {
      const key = e.key === ' ' ? ' ' : e.key.toLowerCase()
      // Reset outtake timers on key release so the next press fires immediately.
      if (key === 'x') lastOuttakeTimeRef.current = Number.NEGATIVE_INFINITY
      if (key === 'c') lastFrontOuttakeTimeRef.current = Number.NEGATIVE_INFINITY
      if (keysRef.current.delete(key)) setHeldKeys(new Set(keysRef.current))
    }

    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
    }
  }, [resetScene])

  // ── Mouse listeners (left-click activates intake) ─────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      // Don't activate intake when clicking UI buttons.
      if (e.button !== 0) return
      if (e.target instanceof HTMLButtonElement) return
      mouseDownRef.current = true
    }
    function onUp(e: MouseEvent) {
      if (e.button === 0) mouseDownRef.current = false
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ── Physics loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number
    let lastTime: number | null = null

    function tick(now: number) {
      const dt = lastTime != null ? Math.min((now - lastTime) / 1000, 0.05) : 0
      lastTime = now

      const keys = keysRef.current

      // ── 1. Robot movement ───────────────────────────────────────────────
      const fwd  = (keys.has('w') || keys.has('arrowup')    ? 1 : 0)
                 - (keys.has('s') || keys.has('arrowdown')  ? 1 : 0)
      const turn = (keys.has('a') || keys.has('arrowleft')  ? 1 : 0)
                 - (keys.has('d') || keys.has('arrowright') ? 1 : 0)

      const r = robotRef.current

      // Park Zone speed multiplier — briefly applied when an axle crosses the tape.
      const speedMult = now < parkZoneStuckUntilRef.current ? 0.05 : 1.0

      let newHdg = r.heading + turn * turnRateRef.current * speedMult * dt
      const rad    = (newHdg * Math.PI) / 180
      const cosH   = Math.cos(rad)
      const sinH   = Math.sin(rad)
      const robotVx = fwd * moveSpeedRef.current * speedMult * cosH
      const robotVy = fwd * moveSpeedRef.current * speedMult * sinH

      // Compute velocity delta (used for held-block inertia, see step 3).
      const dvx = robotVx - prevRobotVxRef.current
      const dvy = robotVy - prevRobotVyRef.current
      prevRobotVxRef.current = robotVx
      prevRobotVyRef.current = robotVy

      let newX = Math.max(-BOUND, Math.min(BOUND, r.x + robotVx * dt))
      let newY = Math.max(-BOUND, Math.min(BOUND, r.y + robotVy * dt))

      // Resolve robot against solid long goals, center goals, and loaders (run twice for corner stability).
      for (let gi = 0; gi < 2; gi++) {
        for (const g of LONG_GOAL_COLLIDERS) {
          const res = resolveRobotGoalAABB(newX, newY, newHdg, g.cx, g.cy, g.hw, g.hh)
          if (res) {
            newX = Math.max(-BOUND, Math.min(BOUND, res.x))
            newY = Math.max(-BOUND, Math.min(BOUND, res.y))
          }
        }
        {
          const res = resolveRobotGoalOBB(newX, newY, newHdg, 0, 0, CG_UPPER_HALF_L, CG_UPPER_HALF_W, CG_UPPER_ROT)
          if (res) {
            newX = Math.max(-BOUND, Math.min(BOUND, res.x))
            newY = Math.max(-BOUND, Math.min(BOUND, res.y))
          }
        }
        {
          const res = resolveRobotGoalOBB(newX, newY, newHdg, 0, 0, CG_LOWER_HALF_L, CG_LOWER_HALF_W, CG_LOWER_ROT)
          if (res) {
            newX = Math.max(-BOUND, Math.min(BOUND, res.x))
            newY = Math.max(-BOUND, Math.min(BOUND, res.y))
          }
        }
        for (const l of LOADER_COLLIDERS) {
          const res = resolveRobotGoalAABB(newX, newY, newHdg, l.cx, l.cy, l.hw, l.hh)
          if (res) {
            newX = Math.max(-BOUND, Math.min(BOUND, res.x))
            newY = Math.max(-BOUND, Math.min(BOUND, res.y))
          }
        }
      }

      // Detect Park Zone axle-crossing events and set the stuck timer.
      // |y| and |x| symmetry handles both red and blue zones with the same constants.
      // The guard (now >= stuckUntil) prevents re-triggering mid-stuck.
      if (now >= parkZoneStuckUntilRef.current) {
        const absY     = Math.abs(newY)
        const absPrevY = Math.abs(prevRobotYForPZRef.current)
        const absX     = Math.abs(newX)
        const absPrevX = Math.abs(prevRobotXForPZRef.current)

        // Horizontal borders (inner tape line running along X): Y-axis crossings.
        if (absX < PZ_X_TRIGGER) {
          if (
            (absPrevY < PZ_THRESH_NEAR && absY >= PZ_THRESH_NEAR) ||
            (absPrevY > PZ_THRESH_NEAR && absY <= PZ_THRESH_NEAR) ||
            (absPrevY < PZ_THRESH_FAR  && absY >= PZ_THRESH_FAR ) ||
            (absPrevY > PZ_THRESH_FAR  && absY <= PZ_THRESH_FAR )
          ) {
            parkZoneStuckUntilRef.current = now + PZ_STUCK_MS
          }
        }

        // Vertical borders (side tape lines running along Y): X-axis crossings.
        // Only applies when the robot is inside the park zone's Y band.
        if (absY > PZ_THRESH_NEAR) {
          if (
            (absPrevX < PZ_X_THRESH_NEAR && absX >= PZ_X_THRESH_NEAR) ||
            (absPrevX > PZ_X_THRESH_NEAR && absX <= PZ_X_THRESH_NEAR) ||
            (absPrevX < PZ_X_THRESH_FAR  && absX >= PZ_X_THRESH_FAR ) ||
            (absPrevX > PZ_X_THRESH_FAR  && absX <= PZ_X_THRESH_FAR )
          ) {
            parkZoneStuckUntilRef.current = now + PZ_STUCK_MS
          }
        }
      }
      prevRobotYForPZRef.current = newY
      prevRobotXForPZRef.current = newX

      // ── 1.5 Goal alignment assist (contact-based) ──────────────────────────
      // Activates ONLY when the robot's back face is physically touching an open
      // end — not from a distance. Applies heading correction AND lateral position
      // correction so the rear outtake aligns with the channel.
      //
      // The heading threshold (HDG_THRESH) has been intentionally removed.
      // Without it the correction always fires whenever contact is detected,
      // regardless of how far off-angle the robot currently is. This prevents
      // the common failure mode where the robot reaches the correct position but
      // its angle is still too far from the target for the assist to engage.
      {
        const CONTACT_MARGIN = 6.0   // inches — back face must be within this of open end
        const HDG_RATE       = 360.0 // degrees/sec — corrects 40° in ~0.11 s
        const LAT_RATE       = 60.0  // inches/sec — lateral pull toward channel axis
        const backX = newX - ROBOT_HALF * cosH
        const backY = newY - ROBOT_HALF * sinH

        // ── Long goals ──────────────────────────────────────────────────────
        for (const g of LONG_GOAL_PHYSICS) {
          if (Math.abs(backX - g.cx) > g.hw + ROBOT_HALF + 3) continue
          const southEnd = g.cy - g.hh
          const northEnd = g.cy + g.hh
          let targetHdg: number | null = null
          if (backY >= southEnd - CONTACT_MARGIN && backY <= southEnd + CONTACT_MARGIN) targetHdg = 270
          if (backY >= northEnd - CONTACT_MARGIN && backY <= northEnd + CONTACT_MARGIN) targetHdg = 90
          if (targetHdg === null) continue
          const rawDiff = ((targetHdg - newHdg) % 360 + 540) % 360 - 180
          // Always correct — no HDG_THRESH so even large misalignments are resolved.
          newHdg += Math.sign(rawDiff) * Math.min(Math.abs(rawDiff), HDG_RATE * dt)
          const xErr = g.cx - newX
          if (Math.abs(xErr) > 0.05) {
            newX += Math.sign(xErr) * Math.min(Math.abs(xErr), LAT_RATE * dt)
            newX  = Math.max(-BOUND, Math.min(BOUND, newX))
          }
        }

      }

      robotRef.current = { ...r, x: newX, y: newY, heading: newHdg }

      const rob = robotRef.current

      // ── 2a. Rear outtake (X key) — one block per 100 ms ────────────────
      // Releases through the back of the robot. Can only score into:
      //   • long goals
      //   • upper center goal
      // Will NOT score into the lower center goal.
      if (keys.has('x') && heldIdsRef.current.length > 0) {
        if (now - lastOuttakeTimeRef.current >= 100) {
          lastOuttakeTimeRef.current = now
          const id = heldIdsRef.current[0]
          const ob = blocksRef.current.find(bl => bl.id === id)
          if (ob) {
            // Rear outtake: spawn 2" behind the robot's back face.
            const OUTTAKE_BACK_LX = RHW + 2.0
            const outRad  = (rob.heading * Math.PI) / 180
            const outCosH = Math.cos(outRad)
            const outSinH = Math.sin(outRad)
            const ox = rob.x - OUTTAKE_BACK_LX * outCosH
            const oy = rob.y - OUTTAKE_BACK_LX * outSinH
            ob.x = ox
            ob.y = oy
            ob.scatterAt = undefined  // clear any pending scatter from previous goal exit

            // Upper center goal — rear outtake CAN score if robot is near center
            // with back roughly facing either end (heading ≈ 45° or 225°).
            const robDistU = Math.hypot(rob.x, rob.y)
            const hdgDiff45  = Math.abs(((45  - rob.heading) % 360 + 540) % 360 - 180)
            const hdgDiff225 = Math.abs(((225 - rob.heading) % 360 + 540) % 360 - 180)
            if (robDistU <= CG_SCORE_RADIUS && (hdgDiff45 <= CG_SCORE_HDG || hdgDiff225 <= CG_SCORE_HDG)) {
              ob.state  = 'goal'
              ob.goalId = 'center-goal-upper'
              const { cosG, sinG, halfL } = CENTER_GOAL_UPPER
              // Place block just inside the entry end; shoot it inward.
              const sign = hdgDiff225 <= hdgDiff45 ? 1 : -1
              ob.x  = sign * (halfL - BLOCK_RADIUS - 0.5) * cosG
              ob.y  = sign * (halfL - BLOCK_RADIUS - 0.5) * sinG
              ob.vx = -sign * 18 * cosG
              ob.vy = -sign * 18 * sinG
              cgChainPush(ob, blocksRef.current, halfL, cosG, sinG, now, false)
            }
            // Lower center goal — rear outtake CANNOT score here; treat as a field release.
            else if (isInsideLowerCenterGoal(ox, oy)) {
              ob.vx = -outCosH * 18
              ob.vy = -outSinH * 18
              ob.state  = 'field'
              ob.goalId = undefined
            }
            // Long goals — rear outtake CAN score here.
            else {
              const hitGoal = getGoalAtPoint(ox, oy)
              if (hitGoal) {
                ob.state = 'goal'
                ob.goalId = hitGoal.id
                // Center X on the goal channel; carry backward momentum as Y velocity.
                ob.x = hitGoal.cx
                ob.vx = 0
                ob.vy = Math.abs(outSinH) > 0.1 ? -outSinH * 18 : 0

                // ── Chain push ─────────────────────────────────────────────────
                if (Math.abs(ob.vy) > 0) {
                  const SPACING  = BLOCK_RADIUS * 2 + 0.2
                  const pushNorth = ob.vy > 0
                  const siblings  = blocksRef.current.filter(
                    bl => bl.state === 'goal' && bl.goalId === hitGoal.id && bl.id !== ob.id
                  )
                  if (pushNorth) {
                    siblings.sort((a, b) => a.y - b.y)
                    let floor = ob.y + SPACING
                    for (const bl of siblings) {
                      if (bl.y < floor) { bl.y = floor; if (bl.vy < ob.vy) bl.vy = ob.vy }
                      floor = bl.y + SPACING
                    }
                  } else {
                    siblings.sort((a, b) => b.y - a.y)
                    let ceil = ob.y - SPACING
                    for (const bl of siblings) {
                      if (bl.y > ceil) { bl.y = ceil; if (bl.vy > ob.vy) bl.vy = ob.vy }
                      ceil = bl.y - SPACING
                    }
                  }
                  // Immediately exit any balls pushed past an open end — with scatter.
                  for (const bl of siblings) {
                    const d = bl.y - hitGoal.cy
                    if (Math.abs(d) > hitGoal.hh) {
                      bl.state  = 'field'
                      bl.goalId = undefined
                      const sign = d > 0 ? 1 : -1
                      bl.y  = hitGoal.cy + sign * (hitGoal.hh + BLOCK_RADIUS + 0.1)
                      bl.x  = hitGoal.cx
                      bl.vy = sign * Math.max(Math.abs(bl.vy), 8)
                      bl.vx = (Math.random() - 0.5) * SCATTER_LONG_V
                    }
                  }
                }
                // ── End chain push ─────────────────────────────────────────────
              } else {
                ob.vx = -outCosH * 18
                ob.vy = -outSinH * 18
                ob.state = 'field'
                ob.goalId = undefined
              }
            }
          }
          heldIdsRef.current = heldIdsRef.current.slice(1)
        }
      }

      // ── 2b. Front outtake (C key) — one block per 100 ms ───────────────
      // Releases through the FRONT rake area of the robot. Can only score into:
      //   • lower center goal
      // Will NOT score into long goals or the upper center goal.
      if (keys.has('c') && heldIdsRef.current.length > 0) {
        if (now - lastFrontOuttakeTimeRef.current >= 100) {
          lastFrontOuttakeTimeRef.current = now
          const id = heldIdsRef.current[0]
          const ob = blocksRef.current.find(bl => bl.id === id)
          if (ob) {
            // Front outtake: spawn 2" past the robot's front face.
            const OUTTAKE_FRONT_LX = RHW + 2.0
            const outRad  = (rob.heading * Math.PI) / 180
            const outCosH = Math.cos(outRad)
            const outSinH = Math.sin(outRad)
            const fx = rob.x + OUTTAKE_FRONT_LX * outCosH
            const fy = rob.y + OUTTAKE_FRONT_LX * outSinH
            ob.x = fx
            ob.y = fy
            ob.scatterAt = undefined

            // Lower center goal — front outtake CAN score if robot is near center
            // with front roughly facing either end (heading ≈ 315° or 135°).
            const robDistL = Math.hypot(rob.x, rob.y)
            const hdgDiff315 = Math.abs(((315 - rob.heading) % 360 + 540) % 360 - 180)
            const hdgDiff135 = Math.abs(((135 - rob.heading) % 360 + 540) % 360 - 180)
            if (robDistL <= CG_SCORE_RADIUS && (hdgDiff315 <= CG_SCORE_HDG || hdgDiff135 <= CG_SCORE_HDG)) {
              ob.state  = 'goal'
              ob.goalId = 'center-goal-lower'
              const { cosG, sinG, halfL } = CENTER_GOAL_LOWER
              // Place block just inside the entry end; shoot it inward.
              const sign = hdgDiff315 <= hdgDiff135 ? 1 : -1
              ob.x  = sign * (halfL - BLOCK_RADIUS - 0.5) * cosG
              ob.y  = sign * (halfL - BLOCK_RADIUS - 0.5) * sinG
              ob.vx = -sign * 18 * cosG
              ob.vy = -sign * 18 * sinG
              cgChainPush(ob, blocksRef.current, halfL, cosG, sinG, now, true)
            }
            // Anywhere else (including long goals and upper center) — front outtake
            // CANNOT score; release as a regular field ball.
            else {
              ob.vx = outCosH * 18
              ob.vy = outSinH * 18
              ob.state  = 'field'
              ob.goalId = undefined
            }
          }
          heldIdsRef.current = heldIdsRef.current.slice(1)
        }
      }

      // ── 2. Intake: check for blocks in the pickup zone ──────────────────
      const intakeActive = keys.has(' ') || mouseDownRef.current

      if (intakeActive && heldIdsRef.current.length < capacityRef.current) {
        for (const b of blocksRef.current) {
          // 'goal' blocks cannot be intaked — they are inside the raised goal channel.
          if (b.state !== 'field') continue
          if (heldIdsRef.current.length >= capacityRef.current) break

          // Transform block to robot-local frame (front = +localX, left = +localY).
          const wx = b.x - rob.x
          const wy = b.y - rob.y
          const localX =  wx * cosH + wy * sinH
          const localY = -wx * sinH + wy * cosH

          // Check if block center is inside the pickup zone.
          const inZoneX = localX > (RHW - INTAKE_FRONT_OFFSET) &&
                          localX < (RHW + RAKE_REACH + BLOCK_RADIUS)
          const inZoneY = Math.abs(localY) < INTAKE_HALF_H

          if (inZoneX && inZoneY) {
            b.state = 'held'
            b.scatterAt = undefined  // cancel any pending scatter when intaked
            heldIdsRef.current = [...heldIdsRef.current, b.id]
          }
        }
      }

      // ── 2c. Loader dispense — one ball per 100 ms, same rate as outtake ───
      if (intakeActive && heldIdsRef.current.length < capacityRef.current) {
        if (now - lastLoaderDispenseRef.current >= 100) {
          for (let i = 0; i < blocksRef.current.length; i++) {
            const b = blocksRef.current[i]
            if (b.state !== 'loader') continue

            const wx = b.x - rob.x
            const wy = b.y - rob.y
            const localX =  wx * cosH + wy * sinH
            const localY = -wx * sinH + wy * cosH

            const inZoneX = localX > (RHW - INTAKE_FRONT_OFFSET) &&
                            localX < (RHW + RAKE_REACH + BLOCK_RADIUS)
            const inZoneY = Math.abs(localY) < INTAKE_HALF_H

            if (inZoneX && inZoneY) {
              b.state = 'held'
              b.scatterAt = undefined
              heldIdsRef.current = [...heldIdsRef.current, b.id]
              lastLoaderDispenseRef.current = now
              break  // one ball per interval
            }
          }
        }
      }

      // ── 3. Held block physics — bounce inside robot box ─────────────────
      // Each held block is carried with the robot's translation and rotation,
      // has its own velocity integrated with high friction, and is resolved
      // against the robot's interior walls instead of the field walls.
      const dTx  = rob.x - r.x
      const dTy  = rob.y - r.y
      const dRad = ((rob.heading - r.heading) * Math.PI) / 180
      const cosD = Math.cos(dRad), sinD = Math.sin(dRad)

      // Helper: clamp one block to robot interior in local frame.
      function clampToRobot(b: PhysicsBlock) {
        let lx  =  (b.x - rob.x) * cosH + (b.y - rob.y) * sinH
        let ly  = -(b.x - rob.x) * sinH + (b.y - rob.y) * cosH
        let vlx =  b.vx * cosH + b.vy * sinH
        let vly = -b.vx * sinH + b.vy * cosH
        if (lx >  HELD_LIMIT) { lx =  HELD_LIMIT; vlx = -Math.abs(vlx) * HELD_RESTITUTION }
        if (lx < -HELD_LIMIT) { lx = -HELD_LIMIT; vlx =  Math.abs(vlx) * HELD_RESTITUTION }
        if (ly >  HELD_LIMIT) { ly =  HELD_LIMIT; vly = -Math.abs(vly) * HELD_RESTITUTION }
        if (ly < -HELD_LIMIT) { ly = -HELD_LIMIT; vly =  Math.abs(vly) * HELD_RESTITUTION }
        b.x  = rob.x + lx * cosH - ly * sinH
        b.y  = rob.y + lx * sinH + ly * cosH
        b.vx =  vlx * cosH - vly * sinH
        b.vy =  vlx * sinH + vly * cosH
      }

      const heldBlocks: PhysicsBlock[] = []
      for (const id of heldIdsRef.current) {
        const b = blocksRef.current.find(bl => bl.id === id)
        if (!b) continue
        heldBlocks.push(b)

        // Inertial impulse: robot velocity change is felt as opposite kick on
        // held blocks, causing them to slosh backward on acceleration, forward
        // on braking, and sideways on turns.
        const INERTIA = 0.55
        b.vx -= dvx * INERTIA
        b.vy -= dvy * INERTIA

        // Carry with robot translation
        b.x += dTx; b.y += dTy

        // Carry with robot rotation around its center
        const dx = b.x - rob.x, dy = b.y - rob.y
        b.x = rob.x + dx * cosD - dy * sinD
        b.y = rob.y + dx * sinD + dy * cosD
        const nvx = b.vx * cosD - b.vy * sinD
        const nvy = b.vx * sinD + b.vy * cosD
        b.vx = nvx; b.vy = nvy

        // Integrate velocity
        b.x += b.vx * dt; b.y += b.vy * dt

        // Friction (higher than field blocks for quicker settling)
        const spd = Math.hypot(b.vx, b.vy)
        if (spd > REST_SPEED) {
          const factor = Math.max(0, (spd - HELD_FRICTION * dt) / spd)
          b.vx *= factor; b.vy *= factor
        } else {
          b.vx = 0; b.vy = 0
        }

        clampToRobot(b)
        b.state = 'held'
      }

      // Block-block collisions among held blocks, then re-clamp to walls.
      for (let iter = 0; iter < 2; iter++) {
        for (let i = 0; i < heldBlocks.length - 1; i++) {
          for (let j = i + 1; j < heldBlocks.length; j++) {
            resolveBlockBlock(heldBlocks[i], heldBlocks[j])
          }
        }
        for (const b of heldBlocks) clampToRobot(b)
      }

      // ── 4. Integrate velocities + friction ('field' blocks only) ───────────
      const blocks = blocksRef.current
      for (const b of blocks) {
        if (b.state !== 'field') continue  // skip 'held', 'loader', 'goal'

        // Apply pending scatter kick (delayed exit from lower center goal).
        if (b.scatterAt != null && now >= b.scatterAt) {
          b.vx += (Math.random() - 0.5) * SCATTER_LOWER_V
          b.vy += (Math.random() - 0.5) * SCATTER_LOWER_V
          b.scatterAt = undefined
        }

        b.x += b.vx * dt
        b.y += b.vy * dt

        const speed = Math.hypot(b.vx, b.vy)
        if (speed > REST_SPEED) {
          const decel  = Math.min(speed, FRICTION * dt)
          const factor = (speed - decel) / speed
          b.vx *= factor
          b.vy *= factor
        } else {
          b.vx = 0
          b.vy = 0
        }
      }

      // ── 4b-i. Upper center goal channel physics ──────────────────────────
      // Blocks inside the upper center goal move along the 45° diagonal axis.
      // Width axis is locked to 0; exit through either end converts to field state
      // with an immediate perpendicular scatter so balls fan out naturally.
      for (const b of blocks) {
        if (b.state !== 'goal' || b.goalId !== 'center-goal-upper') continue
        const { cx, cy, halfL, cosG, sinG } = CENTER_GOAL_UPPER

        const dx = b.x - cx, dy = b.y - cy
        let lx = dx * cosG + dy * sinG
        let vlx = b.vx * cosG + b.vy * sinG

        lx += vlx * dt
        const absVlx = Math.abs(vlx)
        if (absVlx > REST_SPEED) {
          const decel = Math.min(absVlx, FRICTION * dt)
          vlx = vlx > 0 ? vlx - decel : vlx + decel
        } else { vlx = 0 }

        b.x  = cx + lx * cosG; b.y  = cy + lx * sinG
        b.vx = vlx * cosG;     b.vy = vlx * sinG

        if (Math.abs(lx) > halfL) {
          b.state = 'field'; b.goalId = undefined
          const sign = lx > 0 ? 1 : -1
          const exitL = sign * (halfL + BLOCK_RADIUS + 0.1)
          b.x  = cx + exitL * cosG; b.y  = cy + exitL * sinG
          b.vx = sign * Math.max(Math.abs(vlx), 8) * cosG
          b.vy = sign * Math.max(Math.abs(vlx), 8) * sinG
          // Immediate scatter perpendicular to the goal axis.
          const perpScatter = (Math.random() - 0.5) * SCATTER_CG_V
          b.vx += perpScatter * (-sinG)
          b.vy += perpScatter * cosG
        }
      }

      // ── 4b-ii. Lower center goal channel physics ─────────────────────────
      // Same structure as upper, but runs along the -45° diagonal axis.
      // Exits get a delayed scatter so balls travel briefly in a straight line
      // before spreading (lower goal is at floor level, not raised).
      for (const b of blocks) {
        if (b.state !== 'goal' || b.goalId !== 'center-goal-lower') continue
        const { cosG, sinG, halfL } = CENTER_GOAL_LOWER

        const lx = b.x * cosG + b.y * sinG
        let vlx = b.vx * cosG + b.vy * sinG

        let newLx = lx + vlx * dt
        const absVlx = Math.abs(vlx)
        if (absVlx > REST_SPEED) {
          const decel = Math.min(absVlx, FRICTION * dt)
          vlx = vlx > 0 ? vlx - decel : vlx + decel
        } else { vlx = 0 }

        b.x = newLx * cosG; b.y = newLx * sinG
        b.vx = vlx * cosG;  b.vy = vlx * sinG

        if (Math.abs(newLx) > halfL) {
          b.state = 'field'; b.goalId = undefined
          const sign = newLx > 0 ? 1 : -1
          b.x  = sign * (halfL + BLOCK_RADIUS + 0.1) * cosG
          b.y  = sign * (halfL + BLOCK_RADIUS + 0.1) * sinG
          b.vx = sign * Math.max(Math.abs(vlx), 8) * cosG
          b.vy = sign * Math.max(Math.abs(vlx), 8) * sinG
          // Delayed scatter — ball travels straight briefly before spreading.
          b.scatterAt = now + SCATTER_DELAY_MS
        }
      }

      // ── 4b. Long goal-channel physics ('goal' blocks) ────────────────────
      // Each block in a long goal moves only along the goal's Y axis. X is
      // clamped to the channel walls. If the block drifts past either open end
      // (|y| > halfH) it converts back to a normal field block with immediate scatter.
      for (const b of blocks) {
        if (b.state !== 'goal' || b.goalId?.startsWith('center-goal')) continue
        const g = LONG_GOAL_PHYSICS.find(g => g.id === b.goalId)
        if (!g) { b.state = 'field'; b.goalId = undefined; continue }

        // Integrate along Y; zero out any X velocity immediately.
        b.y += b.vy * dt
        b.x = g.cx  // lock to channel center X
        b.vx = 0

        // Apply friction along Y
        const absVy = Math.abs(b.vy)
        if (absVy > REST_SPEED) {
          const decel = Math.min(absVy, FRICTION * dt)
          b.vy = b.vy > 0 ? b.vy - decel : b.vy + decel
        } else {
          b.vy = 0
        }

        // Exit through open ends: convert to field state with immediate scatter.
        const distFromCenter = b.y - g.cy
        if (Math.abs(distFromCenter) > g.hh) {
          b.state = 'field'
          b.goalId = undefined
          const sign = distFromCenter > 0 ? 1 : -1
          b.y  = g.cy + sign * (g.hh + BLOCK_RADIUS + 0.1)
          b.vy = sign * Math.max(Math.abs(b.vy), 8)
          // Immediate lateral scatter — goal is raised so ball fans out on landing.
          b.vx = (Math.random() - 0.5) * SCATTER_LONG_V
        }
      }

      // ── 5. Collision resolution ('field' blocks only, multiple iterations) ─
      for (let iter = 0; iter < ITERS; iter++) {
        for (const b of blocks) {
          if (b.state === 'field') resolveBlockWall(b)
        }
        for (const b of blocks) {
          if (b.state === 'field') resolveRobotBlock(rob.x, rob.y, rob.heading, robotVx, robotVy, b)
        }
        for (let i = 0; i < blocks.length - 1; i++) {
          for (let j = i + 1; j < blocks.length; j++) {
            if (blocks[i].state !== 'field' || blocks[j].state !== 'field') continue
            resolveBlockBlock(blocks[i], blocks[j])
          }
        }
        for (const b of blocks) {
          if (b.state === 'field') resolveBlockWall(b)
        }
      }

      // ── 5b. Stacked-block dispersal ──────────────────────────────────────────
      for (let i = 0; i < blocks.length - 1; i++) {
        const a = blocks[i]
        if (a.state !== 'field') continue
        for (let j = i + 1; j < blocks.length; j++) {
          const b = blocks[j]
          if (b.state !== 'field') continue

          const ddx = b.x - a.x
          const ddy = b.y - a.y
          const dd2 = ddx * ddx + ddy * ddy
          if (dd2 >= BLOCK_RADIUS * BLOCK_RADIUS) continue
          if (Math.hypot(a.vx, a.vy) + Math.hypot(b.vx, b.vy) < REST_SPEED * 2) continue

          const dd = Math.sqrt(dd2)
          let snx: number, sny: number
          if (dd < 1e-3) {
            const h = (a.id.charCodeAt(a.id.length - 1) * 73 +
                       b.id.charCodeAt(b.id.length - 1) * 37) % 628
            snx = Math.cos(h * 0.01)
            sny = Math.sin(h * 0.01)
          } else {
            snx = ddx / dd
            sny = ddy / dd
          }

          const MIN_SEP = 15  // in/s
          const rvn = (b.vx - a.vx) * snx + (b.vy - a.vy) * sny
          if (rvn < MIN_SEP) {
            const kick = (MIN_SEP - rvn) * 0.5
            a.vx -= snx * kick;  a.vy -= sny * kick
            b.vx += snx * kick;  b.vy += sny * kick
          }
        }
      }

      // ── 5c. Long goal-channel block-block collisions ─────────────────────
      // 'goal' blocks within the same long goal collide along Y; re-locked to X.
      // Immediate scatter applied on any collision-induced exit.
      for (let iter = 0; iter < ITERS; iter++) {
        for (let i = 0; i < blocks.length - 1; i++) {
          const a = blocks[i]
          if (a.state !== 'goal' || a.goalId?.startsWith('center-goal')) continue
          for (let j = i + 1; j < blocks.length; j++) {
            const b = blocks[j]
            if (b.state !== 'goal' || b.goalId !== a.goalId) continue
            resolveBlockBlock(a, b)
            const g = LONG_GOAL_PHYSICS.find(g => g.id === a.goalId)
            if (g) {
              a.x = g.cx; a.vx = 0
              b.x = g.cx; b.vx = 0
              for (const bl of [a, b]) {
                const dist = bl.y - g.cy
                if (Math.abs(dist) > g.hh) {
                  bl.state = 'field'; bl.goalId = undefined
                  const sign = dist > 0 ? 1 : -1
                  bl.y = g.cy + sign * (g.hh + BLOCK_RADIUS + 0.1)
                  bl.vy = sign * Math.max(Math.abs(bl.vy), 8)
                  bl.vx = (Math.random() - 0.5) * SCATTER_LONG_V
                }
              }
            }
          }
        }
      }

      // ── 5c-ii. Center goal block-block collisions ─────────────────────────
      // For each center goal, resolve block-block overlaps generically then
      // re-lock all blocks back to their diagonal axis and check for exits.
      // Scatter type (immediate vs delayed) follows the goal type.
      for (let iter = 0; iter < ITERS; iter++) {
        for (const cg of [CENTER_GOAL_UPPER, CENTER_GOAL_LOWER] as const) {
          const { id, halfL, cosG, sinG } = cg
          const isLower = id === 'center-goal-lower'
          for (let i = 0; i < blocks.length - 1; i++) {
            const a = blocks[i]
            if (a.state !== 'goal' || a.goalId !== id) continue
            for (let j = i + 1; j < blocks.length; j++) {
              const b = blocks[j]
              if (b.state !== 'goal' || b.goalId !== id) continue
              resolveBlockBlock(a, b)
              cgReLock(a, halfL, cosG, sinG, now, isLower)
              cgReLock(b, halfL, cosG, sinG, now, isLower)
            }
          }
        }
      }

      // ── 5d. Robot pushing long-goal-channel blocks through open ends ──────
      // Immediate scatter on any robot-induced exit.
      for (const b of blocks) {
        if (b.state !== 'goal' || b.goalId?.startsWith('center-goal')) continue
        const g = LONG_GOAL_PHYSICS.find(g => g.id === b.goalId)
        if (!g) continue
        resolveRobotBlock(rob.x, rob.y, rob.heading, robotVx, robotVy, b)
        b.x = g.cx; b.vx = 0
        const dist = b.y - g.cy
        if (Math.abs(dist) > g.hh) {
          b.state = 'field'; b.goalId = undefined
          const sign = dist > 0 ? 1 : -1
          b.y = g.cy + sign * (g.hh + BLOCK_RADIUS + 0.1)
          b.vy = sign * Math.max(Math.abs(b.vy), 8)
          b.vx = (Math.random() - 0.5) * SCATTER_LONG_V
        }
      }

      // ── 5d-ii. Robot pushing center goal channel blocks ───────────────────
      // Scatter type follows the goal type (delayed for lower).
      for (const cg of [CENTER_GOAL_UPPER, CENTER_GOAL_LOWER] as const) {
        const { id, halfL, cosG, sinG } = cg
        const isLower = id === 'center-goal-lower'
        for (const b of blocks) {
          if (b.state !== 'goal' || b.goalId !== id) continue
          resolveRobotBlock(rob.x, rob.y, rob.heading, robotVx, robotVy, b)
          cgReLock(b, halfL, cosG, sinG, now, isLower)
        }
      }

      // ── 6. Snapshot for React rendering ──────────────────────────────────
      setRenderState({
        robot: { ...rob },
        physicsBlocks: blocks.map(b => ({
          id: b.id, color: b.color,
          x: b.x, y: b.y,
          vx: b.vx, vy: b.vy,
          state: b.state,
          goalId: b.goalId,
        })),
        intakeActive,
        heldIds: [...heldIdsRef.current],
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return {
    robot:         renderState.robot,
    physicsBlocks: renderState.physicsBlocks,
    resetScene,
    heldKeys,
    intakeActive:  renderState.intakeActive,
    heldIds:       renderState.heldIds,
  }
}
