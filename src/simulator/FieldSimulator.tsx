import { useState } from 'react'
import FieldView from './FieldView'
import { pushBackField } from './field/pushBackField'
import { usePhysics } from './physics/usePhysics'
import { TEST_BLOCK_COUNT } from './physics/testLayout'
import { FIELD_HALF, INTAKE_CAPACITY, MOVE_SPEED, NEAR_WALL_DIST, ROBOT_HALF, TURN_RATE } from './robot/robotTypes'
import './FieldSimulator.css'

const CAPACITY_MIN = 3
const CAPACITY_MAX = 9
const SPEED_MIN    = 24   // in/s  (~2 ft/s, torque-heavy bot)
const SPEED_MAX    = 96   // in/s  (~8 ft/s, all-out speed build)
const SPEED_STEP   = 12
const TURN_MIN     = 90   // °/s
const TURN_MAX     = 360  // °/s
const TURN_STEP    = 45

export default function FieldSimulator() {
  const [showDebug, setShowDebug]   = useState(false)
  const [showGrid, setShowGrid]     = useState(false)
  const [capacity,  setCapacity]  = useState<number>(() => loadInt('sim_capacity',  INTAKE_CAPACITY, CAPACITY_MIN, CAPACITY_MAX))
  const [moveSpeed, setMoveSpeed] = useState<number>(() => loadInt('sim_moveSpeed', MOVE_SPEED,      SPEED_MIN,    SPEED_MAX))
  const [turnRate,  setTurnRate]  = useState<number>(() => loadInt('sim_turnRate',  TURN_RATE,       TURN_MIN,     TURN_MAX))

  const { robot, physicsBlocks, resetScene, heldKeys, intakeActive, heldIds } = usePhysics(capacity, moveSpeed, turnRate)

  const wallBound = FIELD_HALF - ROBOT_HALF
  const nearWall  =
    Math.abs(robot.x) >= wallBound - NEAR_WALL_DIST ||
    Math.abs(robot.y) >= wallBound - NEAR_WALL_DIST

  const movingBlocks = physicsBlocks.filter((b) => Math.hypot(b.vx, b.vy) > 0.25).length
  const heading = ((robot.heading % 360) + 360) % 360 | 0

  return (
    <div className="field-simulator">
      {/* Decorative background layer */}
      <BgDecoration />

      {/* Header */}
      <header className="fs-header">
        <div className="fs-brand">
          <span className="fs-wordmark">VEX<span className="fs-wordmark-red">Machina</span></span>
          <span className="fs-season-badge">Push Back · 2025–2026 V5RC</span>
        </div>
        <nav className="fs-header-status" aria-label="Status">
          <StatusChip
            label="ALLIANCE"
            value={robot.alliance.toUpperCase()}
            variant={robot.alliance}
          />
          <StatusChip
            label="BLOCKS HELD"
            value={`${heldIds.length} / ${capacity}`}
            variant={heldIds.length > 0 ? 'active' : 'neutral'}
          />
          <StatusChip
            label="RAKE"
            value={intakeActive ? 'EXTENDED' : 'RETRACTED'}
            variant={intakeActive ? 'active' : 'neutral'}
          />
        </nav>
      </header>

      {/* Three-column body */}
      <div className="fs-body">

        {/* ── Left: Controls panel ─────────────────────────────────── */}
        <aside className="fs-panel fs-left-panel">
          <div className="fs-panel-card">
            <h2 className="fs-panel-title">
              <span className="fs-panel-title-accent" />
              Controls
            </h2>

            <div className="fs-keybind-section">
              <div className="fs-keybind-group-label">Movement</div>
              <KeybindRow label="Forward"    keys={['W', '↑']} />
              <KeybindRow label="Backward"   keys={['S', '↓']} />
              <KeybindRow label="Turn Left"  keys={['A', '←']} />
              <KeybindRow label="Turn Right" keys={['D', '→']} />
            </div>

            <div className="fs-keybind-section">
              <div className="fs-keybind-group-label">Actions</div>
              <KeybindRow label="Intake (hold)"        keys={['Space', 'LMB']} />
              <KeybindRow label="Rear Outtake (→ goal)" keys={['X']} />
              <KeybindRow label="Front Outtake (→ lower)" keys={['C']} />
              <KeybindRow label="Reset Field"          keys={['R']} />
            </div>

            {showDebug && (
              <div className="fs-keybind-section">
                <div className="fs-keybind-group-label">Live Inputs</div>
                <div className="fs-key-pills">
                  <KeyPill label="W"   active={heldKeys.has('w') || heldKeys.has('arrowup')} />
                  <KeyPill label="A"   active={heldKeys.has('a') || heldKeys.has('arrowleft')} />
                  <KeyPill label="S"   active={heldKeys.has('s') || heldKeys.has('arrowdown')} />
                  <KeyPill label="D"   active={heldKeys.has('d') || heldKeys.has('arrowright')} />
                  <KeyPill label="SPC" active={intakeActive} />
                  <KeyPill label="X"   active={heldKeys.has('x')} />
                  <KeyPill label="C"   active={heldKeys.has('c')} />
                </div>
              </div>
            )}
          </div>

          <div className="fs-panel-card fs-panel-card-info">
            <h2 className="fs-panel-title">
              <span className="fs-panel-title-accent" />
              Field Info
            </h2>
            <p className="fs-info-line">{pushBackField.meta.orientation}</p>
            <p className="fs-disclaimer">
              Unofficial educational simulator.<br />
              Not affiliated with VEX Robotics or RECF.
            </p>
          </div>
        </aside>

        {/* ── Center: Field ────────────────────────────────────────── */}
        <main className="fs-field-area">
          <div className="fs-field-frame">
            <FieldView
              field={pushBackField}
              showDebug={showDebug}
              showGrid={showGrid}
              robot={robot}
              showRobotDebug={showDebug}
              physicsBlocks={physicsBlocks}
              intakeActive={intakeActive}
              heldIds={heldIds}
            />
          </div>
        </main>

        {/* ── Right: Settings panel ────────────────────────────────── */}
        <aside className="fs-panel fs-right-panel">
          <div className="fs-panel-card">
            <h2 className="fs-panel-title">
              <span className="fs-panel-title-accent" />
              Robot Settings
            </h2>

            <SliderSetting
              label="Intake Capacity"
              value={capacity}
              min={CAPACITY_MIN} max={CAPACITY_MAX} step={1}
              display={String(capacity)}
              onChange={(v) => { setCapacity(v); saveSetting('sim_capacity', v) }}
            />

            <SliderSetting
              label="Move Speed"
              value={moveSpeed}
              min={SPEED_MIN} max={SPEED_MAX} step={SPEED_STEP}
              display={`${moveSpeed} in/s`}
              onChange={(v) => { setMoveSpeed(v); saveSetting('sim_moveSpeed', v) }}
            />

            <SliderSetting
              label="Turn Rate"
              value={turnRate}
              min={TURN_MIN} max={TURN_MAX} step={TURN_STEP}
              display={`${turnRate}°/s`}
              onChange={(v) => { setTurnRate(v); saveSetting('sim_turnRate', v) }}
            />

            <div className="fs-setting-item">
              <span className="fs-setting-label">Alliance</span>
              <span className={`fs-alliance-pill fs-alliance-${robot.alliance}`}>
                {robot.alliance.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="fs-panel-card">
            <h2 className="fs-panel-title">
              <span className="fs-panel-title-accent" />
              Robot Status
            </h2>

            <div className="fs-stat-grid">
              <StatRow label="Position X" value={`${robot.x.toFixed(1)} in`} />
              <StatRow label="Position Y" value={`${robot.y.toFixed(1)} in`} />
              <StatRow label="Heading"    value={`${heading}°`} />
              <StatRow label="Near Wall"  value={nearWall ? 'YES' : 'No'} warn={nearWall} />
            </div>

            <div className="fs-card-divider" />

            <div className="fs-panel-subtitle">Intake State</div>
            <div className="fs-stat-grid">
              <StatRow label="Rake"        value={intakeActive ? 'EXTENDED' : 'Retracted'} active={intakeActive} />
              <StatRow label="Held Blocks" value={`${heldIds.length} / ${capacity}`}       active={heldIds.length > 0} />
            </div>
          </div>

          <div className="fs-panel-card">
            <h2 className="fs-panel-title">
              <span className="fs-panel-title-accent" />
              Display
            </h2>

            <div className="fs-toggle-group">
              <ToggleSwitch label="Inch Grid"      checked={showGrid}   onChange={() => setShowGrid(v => !v)} />
              <ToggleSwitch label="Debug Overlay"  checked={showDebug}  onChange={() => setShowDebug(v => !v)} />
            </div>

            {showDebug && (
              <>
                <div className="fs-card-divider" />
                <div className="fs-panel-subtitle">Physics Debug</div>
                <div className="fs-stat-grid">
                  <StatRow label="Total Blocks"   value={String(TEST_BLOCK_COUNT)} />
                  <StatRow label="Moving Blocks"  value={String(movingBlocks)} active={movingBlocks > 0} />
                </div>
              </>
            )}

            <div className="fs-card-divider" />

            <button type="button" className="fs-reset-btn" onClick={resetScene}>
              ↺&ensp;Reset Field
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function loadInt(key: string, fallback: number, min: number, max: number): number {
  const saved  = localStorage.getItem(key)
  const parsed = saved !== null ? parseInt(saved, 10) : NaN
  return !isNaN(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function saveSetting(key: string, value: number) {
  localStorage.setItem(key, String(value))
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SliderSetting({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  const count = Math.round((max - min) / step) + 1
  return (
    <div className="fs-setting-item">
      <label className="fs-setting-label">{label}</label>
      <div className="fs-slider-row">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="fs-slider"
        />
        <span className="fs-slider-val">{display}</span>
      </div>
      <div className="fs-slider-ticks">
        {Array.from({ length: count }, (_, i) => {
          const tick = min + i * step
          return (
            <span key={tick} className={`fs-tick ${value === tick ? 'fs-tick-active' : ''}`}>
              {tick}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function KeyPill({ label, active }: { label: string; active: boolean }) {
  return <span className={`fs-keypill ${active ? 'fs-keypill-on' : ''}`}>{label}</span>
}

function KeybindRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="fs-keybind-row">
      <span className="fs-keybind-action">{label}</span>
      <div className="fs-keybind-keys">
        {keys.map((k, i) => (
          <span key={k}>
            {i > 0 && <span className="fs-keybind-or">or</span>}
            <kbd className="fs-kbd">{k}</kbd>
          </span>
        ))}
      </div>
    </div>
  )
}

function StatRow({
  label, value, warn, active,
}: {
  label: string; value: string; warn?: boolean; active?: boolean
}) {
  return (
    <div className="fs-stat-row">
      <span className="fs-stat-label">{label}</span>
      <span className={`fs-stat-value ${warn ? 'is-warn' : ''} ${active ? 'is-active' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function StatusChip({ label, value, variant }: { label: string; value: string; variant: string }) {
  return (
    <div className={`fs-status-chip fs-status-${variant}`}>
      <span className="fs-status-label">{label}</span>
      <span className="fs-status-value">{value}</span>
    </div>
  )
}

function ToggleSwitch({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: () => void
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="fs-toggle-row" onClick={onChange}>
      <span className="fs-toggle-label">{label}</span>
      <div className={`fs-toggle-track ${checked ? 'is-on' : ''}`}>
        <div className="fs-toggle-thumb" />
      </div>
    </button>
  )
}

function BgDecoration() {
  return (
    <div className="fs-bg" aria-hidden="true">

    </div>
  )
}
