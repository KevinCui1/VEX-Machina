import { useState } from 'react'
import FieldView from './FieldView'
import { pushBackField } from './field/pushBackField'
import { usePhysics } from './physics/usePhysics'
import { TEST_BLOCK_COUNT } from './physics/testLayout'
import { FIELD_HALF, INTAKE_CAPACITY, NEAR_WALL_DIST, ROBOT_HALF } from './robot/robotTypes'
import './FieldSimulator.css'

export default function FieldSimulator() {
  const [showDebug, setShowDebug]   = useState(false)
  const [showLabels, setShowLabels] = useState(true)

  const { robot, physicsBlocks, resetScene, heldKeys, intakeActive, heldIds } = usePhysics()

  const wallBound = FIELD_HALF - ROBOT_HALF
  const nearWall  =
    Math.abs(robot.x) >= wallBound - NEAR_WALL_DIST ||
    Math.abs(robot.y) >= wallBound - NEAR_WALL_DIST

  const movingBlocks = physicsBlocks.filter(
    (b) => Math.hypot(b.vx, b.vy) > 0.25,
  ).length

  return (
    <div className="field-simulator">
      <header className="fs-header">
        <span className="fs-wordmark">VEX Machina</span>
        <span className="fs-badge">Push Back · 2025–2026 V5RC</span>
        <div className="fs-controls">
          <button
            type="button"
            className={`fs-toggle ${showLabels ? 'is-on' : ''}`}
            onClick={() => setShowLabels((v) => !v)}
            aria-pressed={showLabels}
          >
            Labels
          </button>
          <button
            type="button"
            className={`fs-toggle ${showDebug ? 'is-on' : ''}`}
            onClick={() => setShowDebug((v) => !v)}
            aria-pressed={showDebug}
          >
            Debug
          </button>
          <button
            type="button"
            className="fs-reset"
            onClick={resetScene}
            title="Reset robot + blocks (R)"
          >
            ↺ Reset
          </button>
        </div>
      </header>

      <main className="fs-canvas-area">
        <div className="fs-layout-row">
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

          {showDebug && (
            <aside className="fs-reserve-panel fs-robot-panel">
              <div className="fs-reserve-title">ROBOT</div>

              <div className="fs-robot-stat">
                <span className="fs-robot-key">X</span>
                <span className="fs-robot-val">{robot.x.toFixed(1)}&thinsp;in</span>
              </div>
              <div className="fs-robot-stat">
                <span className="fs-robot-key">Y</span>
                <span className="fs-robot-val">{robot.y.toFixed(1)}&thinsp;in</span>
              </div>
              <div className="fs-robot-stat">
                <span className="fs-robot-key">HDG</span>
                <span className="fs-robot-val">{((robot.heading % 360) + 360) % 360 | 0}°</span>
              </div>
              <div className="fs-robot-stat">
                <span className="fs-robot-key">WALL</span>
                <span className={`fs-robot-val ${nearWall ? 'fs-robot-warn' : ''}`}>
                  {nearWall ? 'NEAR' : 'OK'}
                </span>
              </div>

              <div className="fs-robot-divider" />

              <div className="fs-reserve-title">INTAKE</div>

              <div className="fs-robot-stat">
                <span className="fs-robot-key">RAKE</span>
                <span className={`fs-robot-val ${intakeActive ? 'fs-robot-active' : ''}`}>
                  {intakeActive ? 'EXT' : 'ret'}
                </span>
              </div>
              <div className="fs-robot-stat">
                <span className="fs-robot-key">HELD</span>
                <span className={`fs-robot-val ${heldIds.length > 0 ? 'fs-robot-active' : ''}`}>
                  {heldIds.length}&thinsp;/&thinsp;{INTAKE_CAPACITY}
                </span>
              </div>
              {heldIds.length > 0 && (
                <div className="fs-robot-stat fs-robot-ids">
                  <span className="fs-robot-key">IDs</span>
                  <span className="fs-robot-val fs-robot-val-sm">
                    {heldIds.map(id => id.replace('test-', '')).join(', ')}
                  </span>
                </div>
              )}

              <div className="fs-robot-divider" />

              <div className="fs-reserve-title">PHYSICS TEST</div>
              <div className="fs-robot-stat">
                <span className="fs-robot-key">BLKS</span>
                <span className="fs-robot-val">{TEST_BLOCK_COUNT}</span>
              </div>
              <div className="fs-robot-stat">
                <span className="fs-robot-key">MOVE</span>
                <span className="fs-robot-val">{movingBlocks}</span>
              </div>

              <div className="fs-robot-divider" />

              <div className="fs-reserve-title">INPUTS</div>
              <div className="fs-robot-keys">
                <KeyPill label="W" active={heldKeys.has('w') || heldKeys.has('arrowup')} />
                <KeyPill label="A" active={heldKeys.has('a') || heldKeys.has('arrowleft')} />
                <KeyPill label="S" active={heldKeys.has('s') || heldKeys.has('arrowdown')} />
                <KeyPill label="D" active={heldKeys.has('d') || heldKeys.has('arrowright')} />
              </div>
              <div className="fs-robot-keys">
                <KeyPill label="SPC" active={intakeActive} />
                <KeyPill label="X" active={heldKeys.has('x')} />
              </div>
            </aside>
          )}
        </div>

        {/* ── Controls guide ──────────────────────────────────────────── */}
        <div className="fs-controls-guide">
          <span><kbd>W/A/S/D</kbd> or <kbd>↑←↓→</kbd> move</span>
          <span><kbd>Space</kbd> / <kbd>LMB</kbd> intake (hold)</span>
          <span><kbd>X</kbd> release Blocks</span>
          <span><kbd>R</kbd> or <kbd>↺</kbd> reset</span>
        </div>

        <span className="fs-orientation-note">{pushBackField.meta.orientation}</span>
      </main>

      <footer className="fs-footer">
        <span>Unofficial educational simulator · Not affiliated with VEX Robotics or RECF</span>
      </footer>
    </div>
  )
}

function KeyPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`fs-keypill ${active ? 'fs-keypill-on' : ''}`}>{label}</span>
  )
}
