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
//              ▶ heading arrow
//
// Rake elements (only when intakeActive):
//   - back bar (at front face)
//   - 3 tines extending forward
//   - front tip bar
//   - glow area behind rake
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

interface RobotLayerProps {
  robot: RobotState
  showDebug: boolean
  intakeActive: boolean
  heldCount: number
  heldColors: ('red' | 'blue')[]
}

const HW = ROBOT_W / 2   // 7" half-width  (left/right in local SVG frame)
const HH = ROBOT_H / 2   // 7" half-height (front/back — robot front = +svgX)

// Rake tine Y positions in local SVG frame (+ = robot's right = field -Y after heading).
// Three tines: outer two span the Blocks; center one guides the middle.
const TINE_Y = [-3.5, 0, 3.5] as const
const TINE_HALF_THICK = 0.45

// Debug intake zone dimensions (local SVG frame, front = +svgX).
const INTAKE_ZONE_X   = HW - INTAKE_FRONT_OFFSET
const INTAKE_ZONE_W   = INTAKE_FRONT_OFFSET + RAKE_REACH + BLOCK_RADIUS
const INTAKE_ZONE_H   = INTAKE_HALF_H * 2

export default function RobotLayer({
  robot,
  showDebug,
  intakeActive,
  heldCount,
  heldColors,
}: RobotLayerProps) {
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

        {/* ── Rake — extends in front when intakeActive ──────────────────── */}
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

        {/* ── Interior detail — wheel wells / structural lines ─────────── */}
        <rect x={-HW + 1.5} y={-HH + 1.5} width={4}  height={ROBOT_H - 3} rx={0.8} className="rl-wheel" />
        <rect x={ HW - 5.5} y={-HH + 1.5} width={4}  height={ROBOT_H - 3} rx={0.8} className="rl-wheel" />

        {/* ── Intake housing on the front face (+svgX edge) ─────────────── */}
        <rect
          x={HW - 3.5}
          y={-HH + 2.5}
          width={3.5}
          height={ROBOT_H - 5}
          rx={0.6}
          className={`rl-intake rl-${alliance} ${intakeActive ? 'rl-intake-active' : ''}`}
        />

        {/* ── Held block indicators (small swatches near the intake bar) ─── */}
        {heldColors.map((c, i) => (
          <rect
            key={i}
            x={HW - 5.8}
            y={-HH + 2.5 + i * 3.0}
            width={2.0}
            height={2.0}
            rx={0.4}
            className={`rl-held-swatch rl-held-${c}`}
          />
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

        {/* ── Heading chevron beyond the front face ─────────────────────── */}
        <polygon
          points={`${HW + 1},0 ${HW + 4.5},-2.2 ${HW + 4.5},2.2`}
          className={`rl-arrow rl-${alliance}`}
        />

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
