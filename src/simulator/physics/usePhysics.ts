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
//   X       release all held blocks
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
import { resolveBlockBlock, resolveBlockWall, resolveRobotBlock } from './collision'

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

// Field interior limit for clamping released-block positions.
const FIELD_INNER = FIELD_HALF - BLOCK_RADIUS

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
  const heldIdsRef          = useRef<string[]>([])
  const mouseDownRef        = useRef(false)
  const lastOuttakeTimeRef  = useRef<number>(Number.NEGATIVE_INFINITY)

  // ── Previous robot velocity — used to compute inertial delta for held blocks
  const prevRobotVxRef = useRef(0)
  const prevRobotVyRef = useRef(0)

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
    lastOuttakeTimeRef.current = Number.NEGATIVE_INFINITY
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
      // Reset outtake timer on X release so next press fires immediately.
      if (key === 'x') lastOuttakeTimeRef.current = Number.NEGATIVE_INFINITY
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

      const r      = robotRef.current
      const newHdg = r.heading + turn * turnRateRef.current * dt
      const rad    = (newHdg * Math.PI) / 180
      const cosH   = Math.cos(rad)
      const sinH   = Math.sin(rad)
      const robotVx = fwd * moveSpeedRef.current * cosH
      const robotVy = fwd * moveSpeedRef.current * sinH

      // Compute velocity delta (used for held-block inertia, see step 3).
      const dvx = robotVx - prevRobotVxRef.current
      const dvy = robotVy - prevRobotVyRef.current
      prevRobotVxRef.current = robotVx
      prevRobotVyRef.current = robotVy

      const newX = Math.max(-BOUND, Math.min(BOUND, r.x + robotVx * dt))
      const newY = Math.max(-BOUND, Math.min(BOUND, r.y + robotVy * dt))
      robotRef.current = { ...r, x: newX, y: newY, heading: newHdg }

      const rob = robotRef.current

      // ── 2a. Sequential outtake (X key) — one block per 0.5 s ───────────
      if (keys.has('x') && heldIdsRef.current.length > 0) {
        if (now - lastOuttakeTimeRef.current >= 100) {
          lastOuttakeTimeRef.current = now
          const id = heldIdsRef.current[0]
          const ob = blocksRef.current.find(bl => bl.id === id)
          if (ob) {
            // Fixed center outtake point: just past the front face, no lateral offset.
            const OUTTAKE_LX = RHW + 2.0
            ob.x = Math.max(-FIELD_INNER, Math.min(FIELD_INNER, rob.x + OUTTAKE_LX * cosH))
            ob.y = Math.max(-FIELD_INNER, Math.min(FIELD_INNER, rob.y + OUTTAKE_LX * sinH))
            ob.vx = cosH * 18
            ob.vy = sinH * 18
            ob.state = 'field'
          }
          heldIdsRef.current = heldIdsRef.current.slice(1)
        }
      }

      // ── 2. Intake: check for blocks in the pickup zone ──────────────────
      const intakeActive = keys.has(' ') || mouseDownRef.current

      if (intakeActive && heldIdsRef.current.length < capacityRef.current) {
        for (const b of blocksRef.current) {
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
            heldIdsRef.current = [...heldIdsRef.current, b.id]
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
        // on braking, and sideways on turns. Factor < 1 so it doesn't overpower
        // the friction that settles them.
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

      // ── 4. Integrate velocities + friction (field blocks only) ───────────
      const blocks = blocksRef.current
      for (const b of blocks) {
        if (b.state === 'held') continue

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

      // ── 5. Collision resolution (field blocks only, multiple iterations) ──
      for (let iter = 0; iter < ITERS; iter++) {
        for (const b of blocks) {
          if (b.state !== 'held') resolveBlockWall(b)
        }
        for (const b of blocks) {
          if (b.state !== 'held') resolveRobotBlock(rob.x, rob.y, rob.heading, robotVx, robotVy, b)
        }
        for (let i = 0; i < blocks.length - 1; i++) {
          for (let j = i + 1; j < blocks.length; j++) {
            if (blocks[i].state === 'held' || blocks[j].state === 'held') continue
            resolveBlockBlock(blocks[i], blocks[j])
          }
        }
        for (const b of blocks) {
          if (b.state !== 'held') resolveBlockWall(b)
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
