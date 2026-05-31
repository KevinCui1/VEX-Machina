// ─────────────────────────────────────────────────────────────────────────────
// RobotLayer — SVG layer that renders the robot body and rake intake mechanism.
//
// Robot local frame (after SVG transform): front points toward +svgX.
// +svgY is the robot's right side (SVG Y is down, opposite of field +Y).
//
// Visual anatomy (top-down, robot facing right):
//
//   ┌───────────────────────┤ ══════╗
//   │       chassis          │tines ║  ← rake extends when intake is active
//   │          ╔═╗           │ ══════╣
//   │          ║ ║ intake    │      ║
//   │          ╚═╝ bar       │ ══════╣
//   └───────────────────────┤ ══════╝
//
// Rake states:
//   raised  (always shown when !intakeActive) — compact tines at front face
//   extended (intakeActive) — full tines forward with glow
//
// Held blocks are drawn at their actual physics positions in the robot-local
// frame (lx = forward, ly = robot-left). svgX = lx, svgY = -ly.
//
// Debug overlay (when showDebug):
//   - dashed bounding box
//   - heading angle text
//   - intake zone rectangle
//   - held block count label
// ─────────────────────────────────────────────────────────────────────────────

import { toSvg, toSvgRotation } from '../field/geometry'
import type { RobotState } from './robotTypes'
import {
  INTAKE_FRONT_OFFSET,
  INTAKE_HALF_H,
  RAKE_HEIGHT,
  RAKE_REACH,
  ROBOT_H,
  ROBOT_W,
} from './robotTypes'
import { BLOCK_RADIUS } from '../physics/physicsTypes'
import './RobotLayer.css'

export interface HeldBlock {
  color: 'red' | 'blue'
  /** Robot-local forward component (+ = toward front face). */
  lx: number
  /** Robot-local lateral component (+ = robot-left, − = robot-right). */
  ly: number
}

interface RobotLayerProps {
  robot: RobotState
  showDebug: boolean
  intakeActive: boolean
  heldBlocks: HeldBlock[]
}

const HW = ROBOT_W / 2   // 7" half-width  (left/right in local SVG frame)
const HH = ROBOT_H / 2   // 7" half-height (front/back — robot front = +svgX)

// Rake tine Y positions in local SVG frame (+ = robot's right = field -Y after heading).
// Three tines: outer two span the Blocks; center one guides the middle.
const TINE_Y = [-3.5, 0, 3.5] as const

// Octagon at full block size — matches PhysicsBlockLayer exactly.
const OCTAGON_POINTS = Array.from({ length: 8 }, (_, k) => {
  const theta = Math.PI / 8 + k * (Math.PI / 4)
  return `${(BLOCK_RADIUS * Math.cos(theta)).toFixed(4)},${(BLOCK_RADIUS * Math.sin(theta)).toFixed(4)}`
}).join(' ')

const INNER_SCALE = 0.62  // same bevel ratio as PhysicsBlockLayer

const TINE_HALF_THICK = 0.45

// Debug intake zone dimensions (local SVG frame, front = +svgX).
const INTAKE_ZONE_X   = HW - INTAKE_FRONT_OFFSET
const INTAKE_ZONE_W   = INTAKE_FRONT_OFFSET + RAKE_REACH + BLOCK_RADIUS
const INTAKE_ZONE_H   = INTAKE_HALF_H * 2

export default function RobotLayer({
  robot,
  showDebug,
  intakeActive,
  heldBlocks,
}: RobotLayerProps) {
  const heldCount = heldBlocks.length
  const svgPos = toSvg({ x: robot.x, y: robot.y })
  const svgRot = toSvgRotation(robot.heading)
  const alliance = robot.alliance

  return (
    <g className="rl-layer" pointerEvents="none">
      <g transform={`translate(${svgPos.x.toFixed(3)} ${svgPos.y.toFixed(3)}) rotate(${svgRot.toFixed(2)})`}>

        {/* ── Debug intake zone (behind everything else) ─────────────────── */}
        {showDebug && (
          <rect
            x={INTAKE_ZONE_X}
            y={-INTAKE_ZONE_H / 2}
            width={INTAKE_ZONE_W}
            height={INTAKE_ZONE_H}
            className="rl-debug-intake-zone"
          />
        )}

        {/* ── Extended rake — full tines forward when intakeActive ───────── */}
        {intakeActive && (
          <g className={`rl-rake rl-rake-${alliance}`}>
            {/* Glow area */}
            <rect
              x={HW - 1.0}
              y={-RAKE_HEIGHT / 2 - 0.6}
              width={RAKE_REACH + 1.8}
              height={RAKE_HEIGHT + 1.2}
              rx={1.5}
              className="rl-rake-glow"
            />
            {/* Back connection bar at the front face */}
            <rect
              x={HW - 0.45}
              y={-RAKE_HEIGHT / 2}
              width={0.9}
              height={RAKE_HEIGHT}
              rx={0.3}
              className="rl-rake-bar"
            />
            {/* Three tines */}
            {TINE_Y.map((ty) => (
              <rect
                key={ty}
                x={HW}
                y={ty - TINE_HALF_THICK}
                width={RAKE_REACH}
                height={TINE_HALF_THICK * 2}
                rx={0.35}
                className={`rl-rake-tine rl-rake-tine-${alliance}`}
              />
            ))}
            {/* Front tip bar connecting the tine ends */}
            <rect
              x={HW + RAKE_REACH - 0.45}
              y={-RAKE_HEIGHT / 2}
              width={0.9}
              height={RAKE_HEIGHT}
              rx={0.3}
              className="rl-rake-bar"
            />
          </g>
        )}

        {/* ── Drop shadow ──────────────────────────────────────────────── */}
        <rect
          x={-HW + 0.5}
          y={-HH + 0.6}
          width={ROBOT_W}
          height={ROBOT_H}
          rx={1.5}
          className="rl-shadow"
        />

        {/* ── Chassis body ─────────────────────────────────────────────── */}
        <rect
          x={-HW}
          y={-HH}
          width={ROBOT_W}
          height={ROBOT_H}
          rx={1.5}
          className={`rl-body rl-${alliance}`}
        />

        {/* ── Held block indicators — full-size blocks at physics positions ─── */}
        {/* lx = robot-local forward (+svgX), ly = robot-local left (svgY = -ly) */}
        {heldBlocks.map((b, i) => (
          <g key={i} transform={`translate(${b.lx.toFixed(3)} ${(-b.ly).toFixed(3)})`}>
            {/* Drop shadow */}
            <polygon
              points={OCTAGON_POINTS}
              transform="translate(0.15 0.2)"
              className="rl-held-shadow"
            />
            {/* Main body */}
            <polygon
              points={OCTAGON_POINTS}
              className={`rl-held-block rl-held-${b.color}`}
            />
            {/* Inner bevel */}
            <polygon
              points={OCTAGON_POINTS}
              transform={`scale(${INNER_SCALE})`}
              className={`rl-held-inner rl-held-${b.color}`}
            />
            {/* Center dot */}
            <circle cx={0} cy={0} r={0.28} className="rl-held-dot" />
          </g>
        ))}

        {/* ── Alliance-color outline / glow ─────────────────────────────── */}
        <rect
          x={-HW}
          y={-HH}
          width={ROBOT_W}
          height={ROBOT_H}
          rx={1.5}
          className={`rl-outline rl-${alliance}`}
        />

        {/* ── Rear outtake channel — two parallel guide lines on the back face.
              Lines run along the local X axis (perpendicular to the back wall).
              They span from 4" inside the robot to 1" outside the back face,
              spaced 3" apart (y = ±1.5), resembling a narrow exit channel. ── */}
        <line x1={-HW + 4.0} y1={-1.5} x2={-HW - 1.0} y2={-1.5} className="rl-outtake-line" />
        <line x1={-HW + 4.0} y1={ 1.5} x2={-HW - 1.0} y2={ 1.5} className="rl-outtake-line" />

        {/* ── Raised rake — bumper rail on top of chassis (retracted) ────── */}
        {!intakeActive && (
          <rect
            x={HW}
            y={-RAKE_HEIGHT / 2}
            width={1.2}
            height={RAKE_HEIGHT}
            rx={0.3}
            className="rl-rake-raised-bar"
          />
        )}

        {/* ── Debug overlay ─────────────────────────────────────────────── */}
        {showDebug && (
          <g className="rl-debug">
            {/* Dashed bounding box */}
            <rect
              x={-HW - 0.5}
              y={-HH - 0.5}
              width={ROBOT_W + 1}
              height={ROBOT_H + 1}
              className="rl-debug-box"
            />
            {/* Center cross */}
            <line x1={-5} y1={0}  x2={5} y2={0}  className="rl-debug-cross" />
            <line x1={0}  y1={-5} x2={0} y2={5}  className="rl-debug-cross" />
            {/* Center dot */}
            <circle cx={0} cy={0} r={0.9} className="rl-debug-dot" />
            {/* Held count label inside robot */}
            {heldCount > 0 && (
              <text x={-HW + 2} y={0} className="rl-debug-held-label" dominantBaseline="middle">
                {`×${heldCount}`}
              </text>
            )}
          </g>
        )}
      </g>

      {/* Heading + intake label — outside rotated group so text stays upright */}
      {showDebug && (
        <g>
          <text
            x={svgPos.x + HW + 5.5}
            y={svgPos.y - HH}
            className="rl-debug-label"
          >
            {`x:${robot.x.toFixed(1)} y:${robot.y.toFixed(1)} h:${robot.heading.toFixed(1)}°`}
          </text>
          <text
            x={svgPos.x + HW + 5.5}
            y={svgPos.y - HH + 3.5}
            className="rl-debug-label"
          >
            {`rake:${intakeActive ? 'EXT' : 'ret'} held:${heldCount}`}
          </text>
        </g>
      )}
    </g>
  )
}
