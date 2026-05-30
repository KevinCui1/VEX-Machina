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
  HELD_SLOTS,
  INTAKE_CAPACITY,
  INTAKE_FRONT_OFFSET,
  INTAKE_HALF_H,
  MOVE_SPEED,
  RAKE_REACH,
  RELEASE_SLOTS,
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

// Field interior limit for clamping held-block positions.
const FIELD_INNER = FIELD_HALF - BLOCK_RADIUS

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

export function usePhysics(): UsePhysicsResult {
  // ── Physics refs (mutated every frame, never trigger re-renders) ──────────
  const robotRef   = useRef<RobotState>({ ...DEFAULT_ROBOT })
  const blocksRef  = useRef<PhysicsBlock[]>(makeTestBlocks())
  const keysRef    = useRef<Set<string>>(new Set())

  // ── Intake refs ───────────────────────────────────────────────────────────
  const heldIdsRef     = useRef<string[]>([])
  const mouseDownRef   = useRef(false)
  const xHandledRef    = useRef(false)   // prevents X from repeating while held

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

  // ── Release all held blocks ───────────────────────────────────────────────
  // Places blocks in front of the robot at release-slot positions with a
  // small forward velocity so they clear the intake zone immediately.
  const releaseHeldBlocks = useCallback(() => {
    if (heldIdsRef.current.length === 0) return
    const rob = robotRef.current
    const rad  = (rob.heading * Math.PI) / 180
    const cosH = Math.cos(rad)
    const sinH = Math.sin(rad)

    heldIdsRef.current.forEach((id, i) => {
      const b = blocksRef.current.find(bl => bl.id === id)
      if (!b) return
      const slot = RELEASE_SLOTS[i] ?? RELEASE_SLOTS[0]
      b.x = Math.max(-FIELD_INNER, Math.min(FIELD_INNER,
        rob.x + slot.lx * cosH - slot.ly * sinH))
      b.y = Math.max(-FIELD_INNER, Math.min(FIELD_INNER,
        rob.y + slot.lx * sinH + slot.ly * cosH))
      // Small forward push so blocks clear the intake zone in ~0.3 s.
      b.vx = cosH * 22
      b.vy = sinH * 22
      b.state = 'field'
    })
    heldIdsRef.current = []
  }, [])

  // ── Scene reset ───────────────────────────────────────────────────────────
  const resetScene = useCallback(() => {
    heldIdsRef.current = []
    xHandledRef.current = false
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

      // X key: release held blocks (single trigger per press).
      if (key === 'x') {
        if (!xHandledRef.current) {
          xHandledRef.current = true
          releaseHeldBlocks()
        }
        return
      }

      if (!keysRef.current.has(key)) {
        keysRef.current.add(key)
        setHeldKeys(new Set(keysRef.current))
      }
    }

    function up(e: KeyboardEvent) {
      const key = e.key === ' ' ? ' ' : e.key.toLowerCase()
      if (key === 'x') { xHandledRef.current = false; return }
      if (keysRef.current.delete(key)) setHeldKeys(new Set(keysRef.current))
    }

    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
    }
  }, [resetScene, releaseHeldBlocks])

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
      const newHdg = r.heading + turn * TURN_RATE * dt
      const rad    = (newHdg * Math.PI) / 180
      const cosH   = Math.cos(rad)
      const sinH   = Math.sin(rad)
      const robotVx = fwd * MOVE_SPEED * cosH
      const robotVy = fwd * MOVE_SPEED * sinH
      const newX = Math.max(-BOUND, Math.min(BOUND, r.x + robotVx * dt))
      const newY = Math.max(-BOUND, Math.min(BOUND, r.y + robotVy * dt))
      robotRef.current = { ...r, x: newX, y: newY, heading: newHdg }

      const rob = robotRef.current

      // ── 2. Intake: check for blocks in the pickup zone ──────────────────
      const intakeActive = keys.has(' ') || mouseDownRef.current

      if (intakeActive && heldIdsRef.current.length < INTAKE_CAPACITY) {
        for (const b of blocksRef.current) {
          if (b.state !== 'field') continue
          if (heldIdsRef.current.length >= INTAKE_CAPACITY) break

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
            b.vx = 0
            b.vy = 0
            heldIdsRef.current = [...heldIdsRef.current, b.id]
          }
        }
      }

      // ── 3. Position held blocks at their slot locations ─────────────────
      // Held blocks track the robot each frame so they move with it while
      // keeping their physics velocity zeroed to prevent jitter.
      for (let i = 0; i < heldIdsRef.current.length; i++) {
        const id = heldIdsRef.current[i]
        const b  = blocksRef.current.find(bl => bl.id === id)
        if (!b) continue

        const slot = HELD_SLOTS[i]
        b.x = Math.max(-FIELD_INNER, Math.min(FIELD_INNER,
          rob.x + slot.lx * cosH - slot.ly * sinH))
        b.y = Math.max(-FIELD_INNER, Math.min(FIELD_INNER,
          rob.y + slot.lx * sinH + slot.ly * cosH))
        b.vx = 0
        b.vy = 0
        b.state = 'held'
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
