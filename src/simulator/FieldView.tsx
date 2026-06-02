// ─────────────────────────────────────────────────────────────────────────────
// FieldView — static, top-down SVG renderer for a VEX GameField.
//
// Renders the static field geometry (Step 1) plus the Block layout layer
// (Step 2). No physics, no robot, no scoring logic here.
//
// All drawing is in field inches (1 SVG unit = 1 inch). Y-flip lives in
// field/geometry.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { Fragment } from 'react'
import type {
  CenterGoal,
  GameField,
  Loader,
  LongGoal,
  ParkZone,
  TapeLine,
  Vec2,
} from './field/types'
import { fieldViewBox, toSvg, toSvgRotation } from './field/geometry'
import RobotLayer, { type HeldBlock } from './robot/RobotLayer'
import type { RobotState } from './robot/robotTypes'
import PhysicsBlockLayer from './physics/PhysicsBlockLayer'
import type { PhysicsBlock } from './physics/physicsTypes'
import './FieldView.css'

interface FieldViewProps {
  field: GameField
  showDebug: boolean
  showGrid: boolean
  robot: RobotState
  showRobotDebug: boolean
  physicsBlocks: PhysicsBlock[]
  intakeActive: boolean
  heldIds: string[]
}

const MARGIN = 2

export default function FieldView({
  field, showDebug, showGrid, robot, showRobotDebug,
  physicsBlocks, intakeActive, heldIds,
}: FieldViewProps) {
  // Compute each held block's robot-local position so RobotLayer can render
  // them at their actual physics positions (they shift with acceleration/stops).
  const rad  = (robot.heading * Math.PI) / 180
  const cosH = Math.cos(rad)
  const sinH = Math.sin(rad)
  const heldBlocks: HeldBlock[] = heldIds
    .map(id => physicsBlocks.find(b => b.id === id))
    .filter((b): b is typeof physicsBlocks[number] => b !== undefined)
    .map(b => {
      const wx = b.x - robot.x
      const wy = b.y - robot.y
      return {
        color: b.color,
        lx:  wx * cosH + wy * sinH,   // forward component
        ly: -wx * sinH + wy * cosH,   // lateral component (+ = robot-left)
      }
    })
  const { shell } = field
  const half = shell.nominalInteriorSize / 2
  const fieldActualHalf = shell.wallToWall / 2
  const vb = fieldViewBox(shell.nominalInteriorSize, MARGIN)

  return (
    <svg
      className="field-view"
      viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`}
      role="img"
      aria-label={`${field.meta.game} field, top-down view`}
    >
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#50565e" />
          <stop offset="100%" stopColor="#373c43" />
        </linearGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </radialGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(215,192,148,0.55)" />
          <stop offset="100%" stopColor="rgba(195,168,118,0.35)" />
        </linearGradient>
      </defs>

      {/* Backdrop behind everything (outside the field too). */}
      <rect
        x={vb.minX}
        y={vb.minY}
        width={vb.width}
        height={vb.height}
        className="fv-backdrop"
      />

      <Perimeter half={half} thickness={shell.wallThickness} />

      <FoamFloor half={half} tiles={shell.tilesPerSide} tileSize={shell.tileSize} />

      <CoordGrid half={half} fieldActualHalf={fieldActualHalf} wallThickness={shell.wallThickness} showGrid={showGrid} />

      <ParkZones zones={field.parkZones} half={half} />

      <TapeLines lines={field.tapeLines} />

      {/* Field blocks — below lower center goal and under upper center goal */}
      <PhysicsBlockLayer blocks={physicsBlocks} showDebug={showDebug} mode="field" />

      {/* Lower center goal structure — rendered above field blocks */}
      {field.centerGoals.filter(g => !g.allowUnderPassage).map(g => (
        <SingleCenterGoal key={g.id} goal={g} />
      ))}

      {/* Blocks scored inside lower center goal — above the lower goal structure */}
      <PhysicsBlockLayer blocks={physicsBlocks} showDebug={showDebug} mode="center-goal-lower" />

      {/* Upper center goal structure — field balls slide under it, rendered above them */}
      {field.centerGoals.filter(g => g.allowUnderPassage).map(g => (
        <SingleCenterGoal key={g.id} goal={g} />
      ))}

      {/* Blocks scored inside upper center goal — above the upper goal structure */}
      <PhysicsBlockLayer blocks={physicsBlocks} showDebug={showDebug} mode="center-goal" />

      <LongGoals goals={field.longGoals} />

      <Loaders loaders={field.loaders} />

      {/* Loader-state blocks — rendered above loader bodies so the top ball colour is visible */}
      <PhysicsBlockLayer blocks={physicsBlocks} showDebug={showDebug} mode="loader" />

      {/* Goal-state blocks in long goals — above the long goal structure */}
      <PhysicsBlockLayer blocks={physicsBlocks} showDebug={showDebug} mode="goal" />

      {/* Step 3 + 5: Robot layer — above blocks */}
      <RobotLayer
        robot={robot}
        showDebug={showRobotDebug}
        intakeActive={intakeActive}
        heldBlocks={heldBlocks}
      />

      {/* Soft vignette to sell the "simulator" look. */}
      <rect
        x={-half}
        y={-half}
        width={half * 2}
        height={half * 2}
        fill="url(#vignette)"
        pointerEvents="none"
      />

      {showDebug && <DebugOverlay field={field} half={half} />}
    </svg>
  )
}

// ─── Foam floor ──────────────────────────────────────────────────────────────

const TILE_COLOR_A = '#b0b0b0' // top-left and every (col+row) even tile
const TILE_COLOR_B = '#b8b8b8' // tiles to the right of A

function FoamFloor({ half, tiles, tileSize }: { half: number; tiles: number; tileSize: number }) {
  const tileRects: { key: string; x: number; y: number; fill: string }[] = []
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      tileRects.push({
        key: `t${col}_${row}`,
        x: -half + col * tileSize,
        y: -half + row * tileSize,
        fill: (col + row) % 2 === 0 ? TILE_COLOR_A : TILE_COLOR_B,
      })
    }
  }
  return (
    <g className="fv-floor">
      {tileRects.map((t) => (
        <rect key={t.key} x={t.x} y={t.y} width={tileSize} height={tileSize} fill={t.fill} />
      ))}
    </g>
  )
}

// ─── Coordinate grid ─────────────────────────────────────────────────────────
//
// Labels use the user coordinate system: (0,0) = bottom-left usable corner,
// (wallToWall, wallToWall) = top-right usable corner.
// Internal ↔ user conversion: internal = user − fieldActualHalf.
//
// The cross-field grid lines are toggled by `showGrid`; the edge ticks and
// labels are always shown so the user can read inch positions at a glance.

function CoordGrid({
  half, fieldActualHalf, wallThickness, showGrid,
}: {
  half: number; fieldActualHalf: number; wallThickness: number; showGrid: boolean
}) {
  const fieldSize = fieldActualHalf * 2  // 140.43

  // Grid positions in user-space (0, 24, 48 … 120, then the actual wall edge).
  const STEP = 24
  const userPositions: number[] = []
  for (let u = 0; u < fieldSize - 0.5; u += STEP) userPositions.push(Math.round(u))
  userPositions.push(Math.round(fieldSize * 100) / 100)  // 140.43 at the wall

  // Convert a user coordinate to the internal (center-origin) value.
  const fi = (u: number) => u - fieldActualHalf

  const wallOuter = half + wallThickness
  const tickEnd   = wallOuter + 1.5
  const labelDist = wallOuter + 5.5

  return (
    <g className="fv-coord-grid" pointerEvents="none">

      {/* Toggleable cross-field grid lines */}
      {showGrid && userPositions.map((u) => {
        const ix = fi(u)
        return (
          <Fragment key={`gl${u}`}>
            <line x1={ix}   y1={-half} x2={ix}  y2={half}  className="fv-grid-line" />
            <line x1={-half} y1={-ix}  x2={half} y2={-ix}  className="fv-grid-line" />
          </Fragment>
        )
      })}

      {/* X-axis tick marks + labels along the bottom edge (user coords) */}
      {userPositions.map((u) => {
        const ix = fi(u)
        return (
          <g key={`cgx${u}`}>
            <line x1={ix} y1={half} x2={ix} y2={tickEnd} className="fv-grid-tick" />
            <text x={ix} y={labelDist} className="fv-grid-label" dominantBaseline="middle" textAnchor="middle">
              {u}"
            </text>
          </g>
        )
      })}

      {/* Y-axis tick marks + labels along the left edge (user coords, +Y up) */}
      {userPositions.map((u) => {
        const ix = fi(u)
        return (
          <g key={`cgy${u}`}>
            <line x1={-half} y1={-ix} x2={-tickEnd} y2={-ix} className="fv-grid-tick" />
            <text x={-labelDist} y={-ix} className="fv-grid-label" dominantBaseline="middle" textAnchor="middle">
              {u}"
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Perimeter ───────────────────────────────────────────────────────────────

function Perimeter({ half, thickness }: { half: number; thickness: number }) {
  const o = half + thickness
  return (
    <g className="fv-perimeter">
      <rect x={-o} y={-o} width={o * 2} height={o * 2} rx={2} fill="url(#wall)" />
      <rect x={-half} y={-half} width={half * 2} height={half * 2} className="fv-perimeter-inner" />
    </g>
  )
}

// ─── Park zones ──────────────────────────────────────────────────────────────
//
// Each park zone is a three-sided frame attached to the field wall — two
// vertical arms extending into the field plus a horizontal connecting piece.
// The wall-facing edge is deliberately open (no fourth side drawn).
//
// Geometry (using Red zone at the bottom wall as the reference):
//
//     lx        lx+r   rx-r      rx
//      |          _______|_______          |
//      |         /               \         |   ← rounded corners, r=2"
//      |        |                 |        |   ← horizontal top at depth=16.86"
//      | (arm)  |                 | (arm)  |   ← corner arcs drawn in black
//      |        |                 |        |
//      |  (14.86" straight arm)   |        |
//      |                          |        |
//  [===+==========================+=========] ← WALL (no line drawn here)
//
// Inner layer: same shape inset 2" on the three visible sides.

function ParkZones({ zones, half }: { zones: ParkZone[]; half: number }) {
  return (
    <g className="fv-parkzones">
      {zones.map((z) => {
        const c = toSvg(z.center)

        // Red = bottom wall (high SVG y), Blue = top wall (low SVG y).
        const wallAtBottom = z.alliance === 'red'
        const wallDir = wallAtBottom ? 1 : -1

        const lx = c.x - z.width / 2   // left outer x
        const rx = c.x + z.width / 2   // right outer x
        // Use the nominal interior half (visual wall edge) so arms reach the wall.
        const wallSvgY = wallAtBottom ? half : -half

        const inset = z.innerInset ?? 0
        const r = inset                             // corner radius = 2"
        const armLen = z.height - r                 // straight arm depth = 14.86"
        const armEndSvgY = wallSvgY - wallDir * armLen
        const topSvgY    = wallSvgY - wallDir * z.height

        // Both corners on the same alliance use the same sweep flag.
        // Cross-product of radius vectors (CA×CB) for both corners yields +4 for
        // Red and -4 for Blue → CW (1) for Red, CCW (0) for Blue.
        const sweep      = wallAtBottom ? 1 : 0
        const leftSweep  = sweep
        const rightSweep = sweep

        // ── Outer 3-sided path (open at wall edge) ──────────────────────
        const outerPath = [
          `M ${lx} ${wallSvgY}`,
          `L ${lx} ${armEndSvgY}`,
          `A ${r} ${r} 0 0 ${leftSweep} ${lx + r} ${topSvgY}`,
          `L ${rx - r} ${topSvgY}`,
          `A ${r} ${r} 0 0 ${rightSweep} ${rx} ${armEndSvgY}`,
          `L ${rx} ${wallSvgY}`,
        ].join(' ')

        // ── Inner 3-sided path (open at wall, no rounded corners) ────────
        const innerLx      = lx + inset
        const innerRx      = rx - inset
        const innerTopSvgY = armEndSvgY  // inner depth = outer arm end = 14.86"

        const innerPath = [
          `M ${innerLx} ${wallSvgY}`,
          `L ${innerLx} ${innerTopSvgY}`,
          `L ${innerRx} ${innerTopSvgY}`,
          `L ${innerRx} ${wallSvgY}`,
        ].join(' ')

        // ── Frame fill (evenodd ring = only the band between outer and inner) ──
        // Both sub-paths close at the wall edge; the inner sub-path "punches
        // out" the hollow center via the evenodd fill rule.
        const frameFill = `${outerPath} Z ${innerPath} Z`

        // ── Corner accent arcs (same geometry as outer arcs, drawn in black) ──
        // Both accent arcs must start from the same endpoint the outer path uses
        // for that arc segment, so the sweep flag draws the same physical curve.
        const leftArc  = `M ${lx} ${armEndSvgY} A ${r} ${r} 0 0 ${leftSweep} ${lx + r} ${topSvgY}`
        const rightArc = `M ${rx - r} ${topSvgY} A ${r} ${r} 0 0 ${rightSweep} ${rx} ${armEndSvgY}`

        return (
          <g key={z.id} className={`fv-park fv-${z.alliance}`}>
            {/* Alliance-coloured fill of the frame band only */}
            <path d={frameFill} fillRule="evenodd" className="fv-park-frame-fill" />
            {/* Outer 3-sided border */}
            <path d={outerPath} className="fv-park-outer-border" />
            {/* Inner 3-sided border */}
            {inset > 0 && <path d={innerPath} className="fv-park-inner-border" />}
            {/* Black rounded corner accent pieces */}
            {inset > 0 && (
              <>
                <path d={leftArc}  className="fv-park-corner" />
                <path d={rightArc} className="fv-park-corner" />
              </>
            )}
          </g>
        )
      })}
    </g>
  )
}

// ─── Tape lines ──────────────────────────────────────────────────────────────

function TapeLines({ lines }: { lines: TapeLine[] }) {
  return (
    <g className="fv-tape">
      {lines.map((l) => {
        const a = toSvg(l.from)
        const b = toSvg(l.to)
        if (l.double) {
          // Two parallel strokes offset perpendicular to the line.
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const nx = (-dy / len) * 1.1
          const ny = (dx / len) * 1.1
          return (
            <g key={l.id}>
              <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} className="fv-tape-line" />
              <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} className="fv-tape-line" />
            </g>
          )
        }
        return <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fv-tape-line" />
      })}
    </g>
  )
}

// ─── Long goals ──────────────────────────────────────────────────────────────

// Width of the solid white control-zone strips on the long goals.
const LG_CZ_STRIP_W = 0.9

// Length of the triangular support/guide pieces at each open end of a long goal.
// Each triangle occupies one corner of the goal end, creating a funnel effect.
const LG_SUPPORT_TRI_LEN = 5.5

function LongGoals({ goals }: { goals: LongGoal[] }) {
  return (
    <g className="fv-longgoals">
      {goals.map((g) => {
        const c = toSvg(g.center)
        const rot = toSvgRotation(g.rotation)
        const L = g.length
        const D = g.depth
        const xStart = -L / 2
        const enclosedStart = xStart + g.sections.openStart
        const enclosedEnd = enclosedStart + g.sections.enclosedCenter
        const xEnd = xStart + L
        return (
          <g key={g.id} transform={`translate(${c.x} ${c.y}) rotate(${rot})`} className="fv-longgoal">
            {/* full glass body */}
            <rect x={xStart} y={-D / 2} width={L} height={D} rx={1} className="fv-goal-glass" />
            {/* enclosed center section — more opaque */}
            <rect
              x={enclosedStart}
              y={-D / 2}
              width={g.sections.enclosedCenter}
              height={D}
              className="fv-goal-enclosed"
            />
            {/* Triangular support/guide pieces at each open end.
                Each end gets two mirrored right-triangles (one per corner) that act
                as a funnel to help the robot self-align when backing into the goal.
                Triangles are confined entirely within the goal's AABB. */}
            <polygon
              points={`${xStart},${-D / 2} ${xStart},0 ${xStart + LG_SUPPORT_TRI_LEN},${-D / 2}`}
              className="fv-goal-support-tri"
            />
            <polygon
              points={`${xStart},${D / 2} ${xStart},0 ${xStart + LG_SUPPORT_TRI_LEN},${D / 2}`}
              className="fv-goal-support-tri"
            />
            <polygon
              points={`${xEnd},${-D / 2} ${xEnd},0 ${xEnd - LG_SUPPORT_TRI_LEN},${-D / 2}`}
              className="fv-goal-support-tri"
            />
            <polygon
              points={`${xEnd},${D / 2} ${xEnd},0 ${xEnd - LG_SUPPORT_TRI_LEN},${D / 2}`}
              className="fv-goal-support-tri"
            />
            {/* Solid white control-zone strips — replaces the old dotted divider lines.
                Each strip is a narrow rectangle centered on the section boundary. */}
            <rect
              x={enclosedStart - LG_CZ_STRIP_W / 2}
              y={-D / 2}
              width={LG_CZ_STRIP_W}
              height={D}
              className="fv-goal-cz-strip"
            />
            <rect
              x={enclosedEnd - LG_CZ_STRIP_W / 2}
              y={-D / 2}
              width={LG_CZ_STRIP_W}
              height={D}
              className="fv-goal-cz-strip"
            />
            {/* outline */}
            <rect x={xStart} y={-D / 2} width={L} height={D} rx={1} className="fv-goal-outline" />
          </g>
        )
      })}
    </g>
  )
}

// ─── Center goals ────────────────────────────────────────────────────────────
//
// Each center goal is a diagonal oriented rectangle sharing the same design
// language as the long goals (glass body, outline, optional alignment triangles).
//
// Upper center goal (rotation=45°):  positive slope diagonal, wider (5.53"),
//   alignment triangles at both ends, elevated — rendered in two SVG passes so
//   field balls appear below it and scored balls appear above it.
//
// Lower center goal (rotation=-45°): negative slope diagonal, narrower (4.15"),
//   no triangles, solid — rendered once, above field balls.
//
// Triangle size matches the long goal support triangles for visual consistency.

const CG_TRI_LEN = 5.5   // alignment triangle leg length along the goal axis

function SingleCenterGoal({ goal }: { goal: CenterGoal }) {
  const c   = toSvg(goal.center)
  const rot = toSvgRotation(goal.rotation)
  const L   = goal.length
  const W   = goal.width
  const xS  = -L / 2  // SVG local x-start
  const xE  =  L / 2  // SVG local x-end

  return (
    <g
      transform={`translate(${c.x} ${c.y}) rotate(${rot})`}
      className={`fv-centergoal fv-centergoal-${goal.allowUnderPassage ? 'upper' : 'lower'}`}
    >
      {/* Full glass body */}
      <rect x={xS} y={-W / 2} width={L} height={W} rx={1} className="fv-goal-glass" />

      {/* Alignment triangles — upper goal only, same pattern as long goals */}
      {goal.hasAlignmentTriangles && (
        <>
          {/* Left end — two corner triangles */}
          <polygon
            points={`${xS},${-W / 2} ${xS},0 ${xS + CG_TRI_LEN},${-W / 2}`}
            className="fv-goal-support-tri"
          />
          <polygon
            points={`${xS},${W / 2} ${xS},0 ${xS + CG_TRI_LEN},${W / 2}`}
            className="fv-goal-support-tri"
          />
          {/* Right end — two corner triangles */}
          <polygon
            points={`${xE},${-W / 2} ${xE},0 ${xE - CG_TRI_LEN},${-W / 2}`}
            className="fv-goal-support-tri"
          />
          <polygon
            points={`${xE},${W / 2} ${xE},0 ${xE - CG_TRI_LEN},${W / 2}`}
            className="fv-goal-support-tri"
          />
        </>
      )}

      {/* Outline */}
      <rect x={xS} y={-W / 2} width={L} height={W} rx={1} className="fv-goal-outline" />
    </g>
  )
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

function Loaders({ loaders }: { loaders: Loader[] }) {
  return (
    <g className="fv-loaders">
      {loaders.map((l) => {
        const c = toSvg(l.center)
        const rot = toSvgRotation(l.rotation)
        const w = l.width
        const d = l.depth
        // Local frame: +localY points toward the field interior (mouth side)
        // for a rotation-0 (top) loader.
        return (
          <g key={l.id} transform={`translate(${c.x} ${c.y}) rotate(${rot})`} className={`fv-loader fv-${l.alliance}`}>
            <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={1.5} className="fv-loader-body" />
            <circle cx={0} cy={d * 0.18} r={l.mouthDiameter / 2} className="fv-loader-mouth" />
          </g>
        )
      })}
    </g>
  )
}

// ─── Debug overlay ───────────────────────────────────────────────────────────

function DebugOverlay({ field, half }: { field: GameField; half: number }) {
  const grid: number[] = []
  for (let v = -half; v <= half + 0.001; v += 12) grid.push(Math.round(v))

  const elementBoxes = collectDebugBoxes(field)

  return (
    <g className="fv-debug" pointerEvents="none">
      {/* 12" coordinate grid */}
      {grid.map((v) => (
        <Fragment key={`gx${v}`}>
          <line x1={v} y1={-half} x2={v} y2={half} className="fv-debug-grid" />
          <line x1={-half} y1={v} x2={half} y2={v} className="fv-debug-grid" />
        </Fragment>
      ))}

      {/* axes */}
      <line x1={-half} y1={0} x2={half} y2={0} className="fv-debug-axis" />
      <line x1={0} y1={-half} x2={0} y2={half} className="fv-debug-axis" />

      {/* axis tick labels (field inches, +Y up) */}
      {grid
        .filter((v) => v % 24 === 0)
        .map((v) => (
          <Fragment key={`lbl${v}`}>
            <text x={v} y={half - 1} className="fv-debug-tick">
              {v}
            </text>
            {/* field +Y up => SVG y = -v */}
            <text x={1} y={-v} className="fv-debug-tick">
              {v}
            </text>
          </Fragment>
        ))}

      {/* element bounding boxes + center dots */}
      {elementBoxes.map((b) => (
        <Fragment key={b.id}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            transform={b.rot ? `rotate(${b.rot} ${b.cx} ${b.cy})` : undefined}
            className="fv-debug-box"
          />
          <circle cx={b.cx} cy={b.cy} r={0.8} className="fv-debug-dot" />
          <text x={b.cx + 1.5} y={b.cy - 1.5} className="fv-debug-id">
            {b.id}
          </text>
        </Fragment>
      ))}

      {/* origin marker */}
      <circle cx={0} cy={0} r={1.4} className="fv-debug-origin" />
      <text x={2} y={-2} className="fv-debug-tick">
        (0,0)
      </text>
    </g>
  )
}

interface DebugBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  rot: number
}

function collectDebugBoxes(field: GameField): DebugBox[] {
  const boxes: DebugBox[] = []
  const push = (id: string, center: Vec2, w: number, h: number, fieldRot: number) => {
    const c = toSvg(center)
    boxes.push({
      id,
      x: c.x - w / 2,
      y: c.y - h / 2,
      w,
      h,
      cx: c.x,
      cy: c.y,
      rot: toSvgRotation(fieldRot),
    })
  }
  field.longGoals.forEach((g) => push(g.id, g.center, g.length, g.depth, g.rotation))
  field.centerGoals.forEach((g) => push(g.id, g.center, g.length, g.width, g.rotation))
  field.loaders.forEach((l) => push(l.id, l.center, l.width, l.depth, l.rotation))
  return boxes
}
