// ─────────────────────────────────────────────────────────────────────────────
// BlockLayer — SVG layer that renders Push Back Blocks on the field.
//
// Renders three visual groups:
//   1. Field-starting blocks  — octagonal polygons at their field positions.
//   2. Loader blocks          — stacked indicator dots near each Loader.
//   3. Debug inspector        — per-block ID / category overlay when enabled.
//
// Match Load reserves and Preloads are shown in the FieldSimulator sidebar,
// not here, so the field stays uncluttered.
//
// Coordinate system: same as FieldView — field inches, origin = center,
// +Y up toward Blue alliance. The toSvg() helper converts to SVG space.
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment } from 'react'
import { toSvg } from '../field/geometry'
import type { Block } from './blockLayout'
import { BLOCK_FLAT_TO_FLAT } from './blockLayout'
import './BlockLayer.css'

interface BlockLayerProps {
  blocks: Block[]
  showDebug: boolean
}

// ─── Octagon geometry ─────────────────────────────────────────────────────────
// Physical block: 3.23" flat-to-flat (verified from Block Specifications).
// Rendered as a regular octagon. inner radius = half flat-to-flat.
const INNER_R = BLOCK_FLAT_TO_FLAT / 2        // 1.615"
const OUTER_R = INNER_R / Math.cos(Math.PI / 8) // 1.748" (circumradius)

/** SVG polygon points string for an octagon centered at (0,0). */
const OCTAGON_POINTS = Array.from({ length: 8 }, (_, k) => {
  const theta = (Math.PI / 8) + k * (Math.PI / 4) // 22.5° + k×45°
  return `${(OUTER_R * Math.cos(theta)).toFixed(4)},${(OUTER_R * Math.sin(theta)).toFixed(4)}`
}).join(' ')

export default function BlockLayer({ blocks, showDebug }: BlockLayerProps) {
  const fieldBlocks = blocks.filter((b) => b.state === 'on-field' && b.fieldPosition)
  const loaderBlocks = blocks.filter((b) => b.state === 'in-loader')

  // Group loader blocks by loaderId for the stacked indicator.
  const byLoader = new Map<string, Block[]>()
  loaderBlocks.forEach((b) => {
    const key = b.loaderId ?? 'unknown'
    if (!byLoader.has(key)) byLoader.set(key, [])
    byLoader.get(key)!.push(b)
  })

  return (
    <g className="bl-layer" pointerEvents="none">
      <FieldBlocks blocks={fieldBlocks} showDebug={showDebug} />
      <LoaderIndicators byLoader={byLoader} loaderBlocks={loaderBlocks} />
    </g>
  )
}

// ─── Field-starting blocks ────────────────────────────────────────────────────

function FieldBlocks({ blocks, showDebug }: { blocks: Block[]; showDebug: boolean }) {
  return (
    <g className="bl-field-blocks">
      {blocks.map((b) => {
        if (!b.fieldPosition) return null
        const c = toSvg(b.fieldPosition)
        return (
          <Fragment key={b.id}>
            <g transform={`translate(${c.x.toFixed(3)} ${c.y.toFixed(3)})`}>
              {/* Drop shadow */}
              <polygon
                points={OCTAGON_POINTS}
                transform="translate(0.25 0.3)"
                className="bl-shadow"
              />
              {/* Main body */}
              <polygon
                points={OCTAGON_POINTS}
                className={`bl-block bl-${b.color}`}
              />
              {/* Inner bevel highlight */}
              <polygon
                points={OCTAGON_POINTS}
                transform="scale(0.62)"
                className={`bl-inner bl-${b.color}`}
              />
              {/* Category dot: loader-sourced blocks get a small center mark */}
              {b.category === 'loader' && (
                <circle cx={0} cy={0} r={0.22} className="bl-cat-dot" />
              )}
            </g>
            {showDebug && (
              <text
                x={c.x + OUTER_R + 0.4}
                y={c.y - 0.3}
                className="bl-debug-label"
              >
                {b.id}
              </text>
            )}
          </Fragment>
        )
      })}
    </g>
  )
}

// ─── Loader block indicators ──────────────────────────────────────────────────
// Each loader shows a small stack of dots representing its remaining blocks,
// plus a ×N count label. The indicator is positioned just outside the field
// wall adjacent to the loader center.

const LOADER_INDICATOR_POSITIONS: Record<string, { x: number; y: number; labelDy: number }> = {
  'loader-blue-left':  { x: -54, y:  78, labelDy: -2.5 },
  'loader-blue-right': { x:  54, y:  78, labelDy: -2.5 },
  'loader-red-left':   { x: -54, y: -78, labelDy:  2.5 },
  'loader-red-right':  { x:  54, y: -78, labelDy:  2.5 },
}

function LoaderIndicators({
  byLoader,
  loaderBlocks,
}: {
  byLoader: Map<string, Block[]>
  loaderBlocks: Block[]
}) {
  const loaderIds = Array.from(new Set(loaderBlocks.map((b) => b.loaderId ?? '')))

  return (
    <g className="bl-loader-indicators">
      {loaderIds.map((lid) => {
        const loadBlocks = byLoader.get(lid) ?? []
        const count = loadBlocks.length
        const color = loadBlocks[0]?.color ?? 'red'
        const pos = LOADER_INDICATOR_POSITIONS[lid]
        if (!pos) return null
        const c = toSvg({ x: pos.x, y: pos.y })

        // Show up to 6 representative dots in a compact row
        const dotCount = Math.min(count, 6)
        const dotSpacing = 2.2
        const totalWidth = (dotCount - 1) * dotSpacing
        const startX = c.x - totalWidth / 2

        return (
          <g key={lid} className={`bl-loader-group bl-${color}`}>
            {Array.from({ length: dotCount }, (_, i) => (
              <polygon
                key={i}
                points={OCTAGON_POINTS}
                transform={`translate(${(startX + i * dotSpacing).toFixed(2)} ${c.y.toFixed(2)}) scale(0.55)`}
                className={`bl-block bl-${color}`}
              />
            ))}
            <text
              x={c.x}
              y={c.y + pos.labelDy}
              className={`bl-loader-count bl-${color}-text`}
            >
              ×{count}
            </text>
          </g>
        )
      })}
    </g>
  )
}
