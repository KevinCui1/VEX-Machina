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
  AllianceStation,
  CenterGoal,
  GameField,
  Loader,
  LongGoal,
  ParkZone,
  TapeLine,
  Vec2,
} from './field/types'
import { fieldViewBox, toSvg, toSvgRotation } from './field/geometry'
import RobotLayer from './robot/RobotLayer'
import type { RobotState } from './robot/robotTypes'
import PhysicsBlockLayer from './physics/PhysicsBlockLayer'
import type { PhysicsBlock } from './physics/physicsTypes'
import './FieldView.css'

interface FieldViewProps {
  field: GameField
  showDebug: boolean
  showLabels: boolean
  robot: RobotState
  showRobotDebug: boolean
  physicsBlocks: PhysicsBlock[]
  intakeActive: boolean
  heldIds: string[]
}

const MARGIN = 30 // inches of breathing room around the interior for stations

export default function FieldView({
  field, showDebug, showLabels, robot, showRobotDebug,
  physicsBlocks, intakeActive, heldIds,
}: FieldViewProps) {
  const heldColors = heldIds
    .map(id => physicsBlocks.find(b => b.id === id)?.color)
    .filter((c): c is 'red' | 'blue' => c !== undefined)
  const { shell } = field
  const half = shell.nominalInteriorSize / 2
  const vb = fieldViewBox(shell.nominalInteriorSize, MARGIN)

  return (
    <svg
      className="field-view"
      viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`}
      role="img"
      aria-label={`${field.meta.game} field, top-down view`}
    >
      <defs>
        <linearGradient id="foam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#33383f" />
          <stop offset="100%" stopColor="#262a30" />
        </linearGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b7480" />
          <stop offset="100%" stopColor="#454c56" />
        </linearGradient>
        <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(205,228,245,0.22)" />
          <stop offset="100%" stopColor="rgba(150,185,215,0.10)" />
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

      <AllianceStations stations={field.allianceStations} half={half} margin={MARGIN} />

      <Perimeter half={half} thickness={shell.wallThickness} />

      <FoamFloor half={half} tiles={shell.tilesPerSide} tileSize={shell.tileSize} />

      <CoordGrid half={half} tileSize={shell.tileSize} wallThickness={shell.wallThickness} />

      <ParkZones zones={field.parkZones} half={half} />

      <TapeLines lines={field.tapeLines} />

      <LongGoals goals={field.longGoals} />

      <CenterGoals goals={field.centerGoals} />

      <Loaders loaders={field.loaders} />

      {/* Step 4: Physics blocks */}
      <PhysicsBlockLayer blocks={physicsBlocks} showDebug={showDebug} />

      {/* Step 3 + 5: Robot layer — above blocks */}
      <RobotLayer
        robot={robot}
        showDebug={showRobotDebug}
        intakeActive={intakeActive}
        heldCount={heldIds.length}
        heldColors={heldColors}
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

      {showLabels && <Labels field={field} />}
      {showDebug && <DebugOverlay field={field} half={half} />}
    </svg>
  )
}

// ─── Foam floor ──────────────────────────────────────────────────────────────

function FoamFloor({ half, tiles, tileSize }: { half: number; tiles: number; tileSize: number }) {
  const seams: number[] = []
  for (let i = 1; i < tiles; i++) seams.push(-half + i * tileSize)
  return (
    <g className="fv-floor">
      <rect x={-half} y={-half} width={half * 2} height={half * 2} fill="url(#foam)" />
      {/* Tile seams */}
      {seams.map((c) => (
        <Fragment key={`v${c}`}>
          <line x1={c} y1={-half} x2={c} y2={half} className="fv-seam" />
        </Fragment>
      ))}
      {seams.map((c) => (
        <Fragment key={`h${c}`}>
          <line x1={-half} y1={c} x2={half} y2={c} className="fv-seam" />
        </Fragment>
      ))}
    </g>
  )
}

// ─── Coordinate grid ─────────────────────────────────────────────────────────

function CoordGrid({ half, tileSize, wallThickness }: { half: number; tileSize: number; wallThickness: number }) {
  const positions: number[] = []
  for (let v = -half; v <= half + 0.001; v += tileSize) positions.push(Math.round(v))

  // Ticks start at the field interior edge and poke through the wall into the margin.
  const wallOuter = half + wallThickness
  const tickEnd = wallOuter + 1.5
  const labelDist = wallOuter + 5.5

  return (
    <g className="fv-coord-grid" pointerEvents="none">
      {/* X labels along the bottom edge */}
      {positions.map((v) => (
        <g key={`cgx${v}`}>
          <line x1={v} y1={half} x2={v} y2={tickEnd} className="fv-grid-tick" />
          <text x={v} y={labelDist} className="fv-grid-label" dominantBaseline="middle" textAnchor="middle">
            {v}"
          </text>
        </g>
      ))}
      {/* Y labels along the left edge (field +Y up, so field y = -SVG y) */}
      {positions.map((v) => (
        <g key={`cgy${v}`}>
          <line x1={-half} y1={-v} x2={-tickEnd} y2={-v} className="fv-grid-tick" />
          <text x={-labelDist} y={-v} className="fv-grid-label" dominantBaseline="middle" textAnchor="middle">
            {v}"
          </text>
        </g>
      ))}
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

// ─── Alliance stations ───────────────────────────────────────────────────────

function AllianceStations({
  stations,
  half,
  margin,
}: {
  stations: AllianceStation[]
  half: number
  margin: number
}) {
  return (
    <g className="fv-stations">
      {stations.map((s) => {
        const t = s.thickness
        const gap = (margin - t) / 2 + 2 // sit just outside the wall
        let rect: { x: number; y: number; w: number; h: number }
        let labelPos: Vec2
        if (s.side === 'top') {
          rect = { x: -half, y: -(half + gap + t), w: half * 2, h: t }
          labelPos = { x: 0, y: rect.y + t / 2 }
        } else if (s.side === 'bottom') {
          rect = { x: -half, y: half + gap, w: half * 2, h: t }
          labelPos = { x: 0, y: rect.y + t / 2 }
        } else if (s.side === 'left') {
          rect = { x: -(half + gap + t), y: -half, w: t, h: half * 2 }
          labelPos = { x: rect.x + t / 2, y: 0 }
        } else {
          rect = { x: half + gap, y: -half, w: t, h: half * 2 }
          labelPos = { x: rect.x + t / 2, y: 0 }
        }
        return (
          <g key={s.id}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              rx={2}
              className={`fv-station fv-${s.alliance}`}
            />
            <text x={labelPos.x} y={labelPos.y} className="fv-station-label" dominantBaseline="middle">
              {s.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Park zones (L-shaped corner bands) ──────────────────────────────────────

function ParkZones({ zones, half }: { zones: ParkZone[]; half: number }) {
  return (
    <g className="fv-parkzones">
      {zones.map((z) => {
        // Corner sign: which way the arms extend from the corner.
        const left = z.corner.includes('left')
        const top = z.corner.includes('top')
        const cx = left ? -half : half // corner x at the wall
        const cy = top ? -half : half // SVG: top wall is -Y

        // Filled enclosed L-region (light tint), anchored at the corner.
        const fillX = left ? cx : cx - z.armAlongX
        const fillY = top ? cy : cy - z.armAlongY

        // The two strips forming the L.
        const stripA = {
          // along the top/bottom wall
          x: left ? cx : cx - z.armAlongX,
          y: top ? cy : cy - z.stripWidth,
          w: z.armAlongX,
          h: z.stripWidth,
        }
        const stripB = {
          // along the side wall
          x: left ? cx : cx - z.stripWidth,
          y: top ? cy : cy - z.armAlongY,
          w: z.stripWidth,
          h: z.armAlongY,
        }
        return (
          <g key={z.id} className={`fv-park fv-${z.alliance}`}>
            <rect x={fillX} y={fillY} width={z.armAlongX} height={z.armAlongY} className="fv-park-fill" />
            <rect x={stripA.x} y={stripA.y} width={stripA.w} height={stripA.h} className="fv-park-strip" />
            <rect x={stripB.x} y={stripB.y} width={stripB.w} height={stripB.h} className="fv-park-strip" />
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
            {/* section dividers */}
            <line x1={enclosedStart} y1={-D / 2} x2={enclosedStart} y2={D / 2} className="fv-goal-divider" />
            <line x1={enclosedEnd} y1={-D / 2} x2={enclosedEnd} y2={D / 2} className="fv-goal-divider" />
            {/* outline */}
            <rect x={xStart} y={-D / 2} width={L} height={D} rx={1} className="fv-goal-outline" />
          </g>
        )
      })}
    </g>
  )
}

// ─── Center goals ────────────────────────────────────────────────────────────

function CenterGoals({ goals }: { goals: CenterGoal[] }) {
  return (
    <g className="fv-centergoals">
      {goals.map((g) => {
        const c = toSvg(g.center)
        const rot = toSvgRotation(g.rotation)
        const s = g.side
        return (
          <g key={g.id} transform={`translate(${c.x} ${c.y}) rotate(${rot})`} className="fv-centergoal">
            <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={1} className="fv-goal-glass" />
            <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={1} className="fv-goal-outline" />
          </g>
        )
      })}
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

// ─── Orientation labels ──────────────────────────────────────────────────────

function Labels({ field }: { field: GameField }) {
  const labelFor = (id: string, center: Vec2, text: string) => {
    const c = toSvg(center)
    return (
      <text key={id} x={c.x} y={c.y} className="fv-elem-label" dominantBaseline="middle">
        {text}
      </text>
    )
  }
  return (
    <g className="fv-labels" pointerEvents="none">
      {field.longGoals.map((g) => labelFor(g.id, g.center, 'LONG GOAL'))}
      {field.centerGoals.map((g, i) =>
        // offset the two stacked center-goal labels so they don't overlap
        labelFor(g.id, { x: g.center.x, y: g.center.y + (i === 0 ? 4 : -4) }, `${g.label} CENTER`),
      )}
      {field.loaders.map((l) => labelFor(l.id, { x: l.center.x, y: l.center.y }, 'LOADER'))}
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
  field.centerGoals.forEach((g) => push(g.id, g.center, g.side, g.side, g.rotation))
  field.loaders.forEach((l) => push(l.id, l.center, l.width, l.depth, l.rotation))
  return boxes
}
