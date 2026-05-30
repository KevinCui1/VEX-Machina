// ─────────────────────────────────────────────────────────────────────────────
// useRobot — keyboard input tracking + frame-rate-independent physics loop.
//
// Input model (arcade drive):
//   W / ↑          forward
//   S / ↓          backward
//   A / ←          turn left (CCW, heading increases)
//   D / →          turn right (CW, heading decreases)
//   R              reset robot to default position
//
// Boundary: robot center is clamped to ±(FIELD_HALF − ROBOT_HALF) so the body
// never visually crosses the perimeter wall. No collision with Goals, Blocks,
// Loaders, or Park Zones is implemented in this step.
//
// Physics are frame-rate independent via requestAnimationFrame delta time.
// Maximum delta is capped at 50 ms to prevent large jumps if the tab loses focus.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ROBOT,
  FIELD_HALF,
  MOVE_SPEED,
  ROBOT_HALF,
  TURN_RATE,
  type RobotState,
} from './robotTypes'

const BOUND = FIELD_HALF - ROBOT_HALF  // 63"

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export interface UseRobotResult {
  robot: RobotState
  resetRobot: () => void
  heldKeys: ReadonlySet<string>
}

export function useRobot(): UseRobotResult {
  const [robot, setRobot] = useState<RobotState>(() => ({ ...DEFAULT_ROBOT }))

  // Key state in a ref so the rAF loop always reads the latest value without
  // being recreated. We also mirror it into React state so the debug panel
  // re-renders when keys change.
  const keysRef = useRef<Set<string>>(new Set())
  const [heldKeys, setHeldKeys] = useState<ReadonlySet<string>>(new Set())

  const resetRobot = useCallback(() => setRobot({ ...DEFAULT_ROBOT }), [])

  // ── Keyboard listeners ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't steal keys from input elements
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const key = e.key.toLowerCase()

      if (key === 'r') {
        resetRobot()
        return
      }

      // Prevent page scroll from arrow keys while the simulator has focus
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
      }

      if (!keysRef.current.has(key)) {
        keysRef.current.add(key)
        setHeldKeys(new Set(keysRef.current))
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      if (keysRef.current.has(key)) {
        keysRef.current.delete(key)
        setHeldKeys(new Set(keysRef.current))
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [resetRobot])

  // ── Physics loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number
    let lastTime: number | null = null

    function tick(now: number) {
      const dt = lastTime !== null ? Math.min((now - lastTime) / 1000, 0.05) : 0
      lastTime = now

      const keys = keysRef.current
      const fwd  = (keys.has('w') || keys.has('arrowup')    ? 1 : 0)
                 - (keys.has('s') || keys.has('arrowdown')  ? 1 : 0)
      const turn = (keys.has('a') || keys.has('arrowleft')  ? 1 : 0)
                 - (keys.has('d') || keys.has('arrowright') ? 1 : 0)

      if (fwd !== 0 || turn !== 0) {
        setRobot(prev => {
          const heading = prev.heading + turn * TURN_RATE * dt
          const rad     = (heading * Math.PI) / 180
          const x = clamp(prev.x + fwd * MOVE_SPEED * Math.cos(rad) * dt, -BOUND, BOUND)
          const y = clamp(prev.y + fwd * MOVE_SPEED * Math.sin(rad) * dt, -BOUND, BOUND)
          return { ...prev, x, y, heading }
        })
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return { robot, resetRobot, heldKeys }
}
