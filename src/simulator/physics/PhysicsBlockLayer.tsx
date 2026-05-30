// ─────────────────────────────────────────────────────────────────────────────
// PhysicsBlockLayer — SVG layer for physics-simulated Blocks (Step 4 + Step 5).
//
// Renders blocks at their live physics positions. Visual style matches the
// static BlockLayer (octagonal shape, same color palette).
//
// Step 5 additions:
//   - state:'held' blocks get a white orbit ring and a "magnetic" glow so the
//     user can clearly see which blocks are attached to the robot.
//   - A small center dot (white) marks all physics blocks.
//
// Debug mode adds:
//   - Dashed circle = collision boundary (radius = BLOCK_RADIUS)
//   - Green line    = current velocity vector (scaled for readability)
//   - Mono label    = block ID and state
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment } from 'react'
import { toSvg } from '../field/geometry'
import type { PhysicsBlock } from './physicsTypes'
import { BLOCK_RADIUS } from './physicsTypes'
import './PhysicsBlockLayer.css'

interface PhysicsBlockLayerProps {
  blocks: PhysicsBlock[]
  showDebug: boolean
}

// ─── Octagon geometry ─────────────────────────────────────────────────────────
const OCTAGON_POINTS = Array.from({ length: 8 }, (_, k) => {
  const theta = Math.PI / 8 + k * (Math.PI / 4)
  return `${(BLOCK_RADIUS * Math.cos(theta)).toFixed(4)},${(BLOCK_RADIUS * Math.sin(theta)).toFixed(4)}`
}).join(' ')

const INNER_SCALE = 0.62

const VEL_ARROW_SCALE = 0.09
const VEL_ARROW_MAX   = 5

export default function PhysicsBlockLayer({ blocks, showDebug }: PhysicsBlockLayerProps) {
  return (
    <g className="pbl-layer" pointerEvents="none">
      {blocks.map((b) => {
        if (b.state === 'held') return null

        const c        = toSvg({ x: b.x, y: b.y })
        const speed    = Math.hypot(b.vx, b.vy)
        const isMoving = speed > 0.25
        const isHeld   = false

        return (
          <Fragment key={b.id}>
            <g transform={`translate(${c.x.toFixed(3)} ${c.y.toFixed(3)})`}>

              {/* Held-state orbit ring — drawn first so it sits behind the block */}
              {isHeld && (
                <circle
                  cx={0} cy={0}
                  r={BLOCK_RADIUS + 0.8}
                  className={`pbl-held-ring pbl-held-ring-${b.color}`}
                />
              )}

              {/* Drop shadow */}
              <polygon
                points={OCTAGON_POINTS}
                transform={isHeld ? 'translate(0.1 0.1)' : 'translate(0.25 0.3)'}
                className={`pbl-shadow ${isHeld ? 'pbl-shadow-held' : ''}`}
              />

              {/* Main body */}
              <polygon
                points={OCTAGON_POINTS}
                className={`pbl-block pbl-${b.color} ${isHeld ? 'pbl-held' : ''}`}
              />

              {/* Inner bevel highlight */}
              <polygon
                points={OCTAGON_POINTS}
                transform={`scale(${INNER_SCALE})`}
                className={`pbl-inner pbl-${b.color}`}
              />

              {/* Center marker: white dot for field blocks, bright white for held */}
              <circle
                cx={0} cy={0}
                r={isHeld ? 0.55 : 0.28}
                className={`pbl-center-dot ${isHeld ? 'pbl-center-dot-held' : ''}`}
              />

              {showDebug && (
                <g className="pbl-debug">
                  {/* Collision boundary circle */}
                  <circle cx={0} cy={0} r={BLOCK_RADIUS} className="pbl-debug-circle" />

                  {/* Velocity vector (SVG Y is flipped relative to field +Y) */}
                  {isMoving && (
                    <line
                      x1={0} y1={0}
                      x2={(b.vx / speed) * Math.min(speed * VEL_ARROW_SCALE, VEL_ARROW_MAX)}
                      y2={-(b.vy / speed) * Math.min(speed * VEL_ARROW_SCALE, VEL_ARROW_MAX)}
                      className="pbl-debug-vel"
                    />
                  )}

                  {/* Block ID and state */}
                  <text x={BLOCK_RADIUS + 0.4} y={-0.3} className="pbl-debug-label">
                    {b.id}
                  </text>
                  <text x={BLOCK_RADIUS + 0.4} y={1.5} className={`pbl-debug-state ${isHeld ? 'pbl-debug-state-held' : ''}`}>
                    {b.state}
                  </text>
                </g>
              )}
            </g>
          </Fragment>
        )
      })}
    </g>
  )
}
