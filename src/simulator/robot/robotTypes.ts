// ─────────────────────────────────────────────────────────────────────────────
// Robot state model for Step 3 — Manual Robot Movement.
//
// The robot is a simplified rectangular chassis, not a real team robot.
// All measurements are in field inches. Coordinate system matches the field:
//   origin = field center, +X right, +Y up toward Blue alliance.
//
// Heading convention (matches standard math angles):
//   0°  = facing right (+X)
//   90° = facing up/toward Blue (+Y)
//   180° = facing left (−X)
//   Positive heading = CCW rotation when viewed from above.
// ─────────────────────────────────────────────────────────────────────────────

export interface RobotState {
  x: number        // field inches, center point
  y: number        // field inches, center point
  heading: number  // degrees CCW from +X axis
  alliance: 'red' | 'blue'
}

// Robot footprint — approximate 14" × 14" VEX-scale placeholder
export const ROBOT_W    = 14   // inches (left–right in robot local frame)
export const ROBOT_H    = 14   // inches (front–back in robot local frame)
export const ROBOT_HALF = 7    // half-width/height for boundary math

// Field boundary
export const FIELD_HALF = 72   // field interior spans −72..+72 in both axes

// Physics constants
export const MOVE_SPEED = 65   // inches per second (≈ 2 ft/s, ≈ 3s to cross the field)
export const TURN_RATE  = 200  // degrees per second (full rotation ≈ 1.2s)

// Debug threshold — "near wall" warning when center is within this distance
// of the clamped boundary (FIELD_HALF − ROBOT_HALF)
export const NEAR_WALL_DIST = 4  // inches

// Starting state — center of field, lower half (red side), facing Blue
export const DEFAULT_ROBOT: RobotState = {
  x: 0,
  y: -30,
  heading: 90,   // facing up/Blue
  alliance: 'red',
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Frontal Rake Intake constants.
// All distances are in field inches. "Front" = +localX in robot-local frame.
// ─────────────────────────────────────────────────────────────────────────────

// How far the rake extends beyond the robot's front face when active.
export const RAKE_REACH = 5.5

// Visual height of the rake span (inner span of the tines, ≈ ROBOT_H − 4).
export const RAKE_HEIGHT = 10.0

// Half-height of the pickup zone in the robot-local lateral axis.
export const INTAKE_HALF_H = 5.5

// The pickup zone starts this far INSIDE the front face so a block pressed
// against the robot is still caught.
export const INTAKE_FRONT_OFFSET = 1.5

// Maximum blocks the robot can hold simultaneously (simulator simplification —
// not an official Push Back possession rule).
export const INTAKE_CAPACITY = 3

// Held-block slot positions in robot-local frame.
//   lx: distance forward from robot center (+lx = toward robot's heading)
//   ly: lateral offset (+ly = robot's left in physics frame)
export const HELD_SLOTS = [
  { lx: ROBOT_W / 2 + 2.0, ly:  0.0 },  // center slot
  { lx: ROBOT_W / 2 + 2.0, ly:  3.5 },  // left slot
  { lx: ROBOT_W / 2 + 2.0, ly: -3.5 },  // right slot
] as const

// Release slot positions — blocks are placed here when the robot releases.
// Beyond the rake tip so released blocks clear the pickup zone quickly.
export const RELEASE_SLOTS = [
  { lx: ROBOT_W / 2 + RAKE_REACH + 2.5, ly:  0.0 },
  { lx: ROBOT_W / 2 + RAKE_REACH + 2.5, ly:  3.8 },
  { lx: ROBOT_W / 2 + RAKE_REACH + 2.5, ly: -3.8 },
] as const
