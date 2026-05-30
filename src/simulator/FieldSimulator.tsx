import { useState } from 'react'
import FieldView from './FieldView'
import { pushBackField } from './field/pushBackField'
import { usePhysics } from './physics/usePhysics'
import { TEST_BLOCK_COUNT } from './physics/testLayout'
import { FIELD_HALF, INTAKE_CAPACITY, NEAR_WALL_DIST, ROBOT_HALF } from './robot/robotTypes'
import './FieldSimulator.css'

const CAPACITY_MIN = 3
const CAPACITY_MAX = 9

export default function FieldSimulator() {
  const [showDebug, setShowDebug]   = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [capacity, setCapacity]     = useState(INTAKE_CAPACITY)

  const { robot, physicsBlocks, resetScene, heldKeys, intakeActive, heldIds } = usePhysics(capacity)

  const wallBound = FIELD_HALF - ROBOT_HALF
  const nearWall  =
    Math.abs(robot.x) >= wallBound - NEAR_WALL_DIST ||
    Math.abs(robot.y) >= wallBound - NEAR_WALL_DIST

  const movingBlocks = physicsBlocks.filter((b) => Math.hypot(b.vx, b.vy) > 0.25).length
  const heading = ((robot.heading % 360) + 360) % 360 | 0

  return (
    <div className="field-simulator">
      {/* Decorative background layer */}
      <div className="fs-bg" aria-hidden="true">
        <div className="fs-bg-corner fs-bg-corner-tl" />
        <div className="fs-bg-corner fs-bg-corner-br" />
        <div className="fs-bg-line fs-bg-line-1" />
        <div className="fs-bg-line fs-bg-line-2" />
        <div className="fs-bg-line fs-bg-line-3" />
        <div className="fs-bg-line fs-bg-line-4" />
        <div className="fs-bg-center-glow" />
      </div>

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
              <KeybindRow label="Intake (hold)"   keys={['Space', 'LMB']} />
              <KeybindRow label="Release Blocks"  keys={['X']} />
              <KeybindRow label="Reset Field"     keys={['R']} />
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
              showLabels={showLabels}
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

            <div className="fs-setting-item">
              <label className="fs-setting-label">Intake Capacity</label>
              <div className="fs-slider-row">
                <input
                  type="range"
                  min={CAPACITY_MIN}
                  max={CAPACITY_MAX}
                  step={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="fs-slider"
                />
                <span className="fs-slider-val">{capacity}</span>
              </div>
              <div className="fs-slider-ticks">
                {Array.from({ length: CAPACITY_MAX - CAPACITY_MIN + 1 }, (_, i) => (
                  <span key={i} className={`fs-tick ${capacity === CAPACITY_MIN + i ? 'fs-tick-active' : ''}`}>
                    {CAPACITY_MIN + i}
                  </span>
                ))}
              </div>
            </div>

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
              <ToggleSwitch label="Block Labels"   checked={showLabels} onChange={() => setShowLabels(v => !v)} />
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

/* ── Sub-components ──────────────────────────────────────────────────────── */

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
