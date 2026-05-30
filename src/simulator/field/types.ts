// ─────────────────────────────────────────────────────────────────────────────
// Generic VEX field model.
//
// This file is intentionally game-agnostic. A "GameField" describes any VEX
// game's static field as a collection of typed elements expressed in a single
// coordinate system. Push Back is one instance (see pushBackField.ts), but the
// renderer (FieldView.tsx) only knows about these generic shapes, so additional
// games can be added later without touching rendering code.
//
// COORDINATE SYSTEM (see FIELD_REFERENCE.md for the authoritative description):
//   - Units: inches.
//   - Origin: geometric center of the field interior.
//   - +X points to the audience's right, +Y points "up"/away (toward the Blue
//     alliance station in Push Back). This is the manual/CAD top-down view.
//   - Rotations are in degrees, counter-clockwise, about an element's center.
// ─────────────────────────────────────────────────────────────────────────────

/** How trustworthy a particular measurement is. */
export type Confidence = 'verified' | 'approximate'

/** A point in field inches (origin = field center, +X right, +Y up). */
export interface Vec2 {
  x: number
  y: number
}

/** Alliance association, where relevant. */
export type Alliance = 'red' | 'blue' | 'neutral'

/**
 * Provenance for a measurement or placement so we can be honest about what is
 * verified from official CAD versus what is an educated approximation.
 */
export interface SourceNote {
  /** Is this value taken from an official source, or approximated? */
  confidence: Confidence
  /** Which official document / image / reasoning produced this value. */
  source: string
  /** Optional clarification. */
  note?: string
}

// ─── Field shell ─────────────────────────────────────────────────────────────

export interface FieldShell {
  /** Nominal interior size used as the coordinate span (e.g. 6 tiles * 24"). */
  nominalInteriorSize: number
  /** Official measured inside wall-to-wall dimension. */
  wallToWall: number
  /** Number of foam tiles per side. */
  tilesPerSide: number
  /** Foam tile edge length. */
  tileSize: number
  /** Perimeter wall thickness (visual). */
  wallThickness: number
  shellSource: SourceNote
}

// ─── Elements ────────────────────────────────────────────────────────────────

/**
 * A Long Goal: a long structure with two open sections flanking an enclosed
 * center section. We model it as a centered rectangle plus the longitudinal
 * lengths of its three sections so the renderer can draw the dividers.
 */
export interface LongGoal {
  id: string
  center: Vec2
  /** Overall length along the goal's long axis. */
  length: number
  /** Cross-axis depth (how "deep" the trough reads from top-down). */
  depth: number
  /** Rotation in degrees CCW. 0 means the long axis is horizontal (along X). */
  rotation: number
  /** Length of each of the three sections along the long axis. */
  sections: {
    openStart: number
    enclosedCenter: number
    openEnd: number
  }
  placement: SourceNote
}

/**
 * A Center Goal. In Push Back the two center goals stack to read as an "X" from
 * above; each is modeled as a square rotated 45° (a diamond).
 */
export interface CenterGoal {
  id: string
  label: string
  center: Vec2
  /** Tip-to-tip length of the goal. */
  length: number
  /** Square side length (the diamond's edge). */
  side: number
  /** Rotation in degrees CCW. */
  rotation: number
  placement: SourceNote
}

/** A Loader: a field-side block source adjacent to an alliance station. */
export interface Loader {
  id: string
  alliance: Alliance
  /** Center of the loader footprint, at the wall. */
  center: Vec2
  /** Footprint size (cross-wall x along-wall). */
  width: number
  depth: number
  /** Diameter of the circular output mouth. */
  mouthDiameter: number
  /** Rotation in degrees CCW (0 => mouth opens toward +Y / into field from top). */
  rotation: number
  placement: SourceNote
}

/** An alliance-colored L-shaped Park Zone hugging a field corner. */
export interface ParkZone {
  id: string
  alliance: Alliance
  /** Which corner the L hugs. */
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Arm length running along the top/bottom wall. */
  armAlongX: number
  /** Arm length running along the side wall. */
  armAlongY: number
  /** Width of the colored strip. */
  stripWidth: number
  placement: SourceNote
}

/** An alliance station drawn outside the perimeter for orientation. */
export interface AllianceStation {
  id: string
  alliance: Alliance
  /** Which side of the field the station sits on. */
  side: 'top' | 'bottom' | 'left' | 'right'
  label: string
  /** Band thickness (distance the station extends away from the wall). */
  thickness: number
  placement: SourceNote
}

/** A straight tape line across the field (e.g. the Autonomous Line). */
export interface TapeLine {
  id: string
  label: string
  from: Vec2
  to: Vec2
  /** Render as a double tape line (two parallel strokes). */
  double?: boolean
  placement: SourceNote
}

// ─── Assembled field ─────────────────────────────────────────────────────────

export interface GameField {
  meta: {
    game: string
    season: string
    /** Human-readable orientation, e.g. "Audience view (manual/CAD top-down)". */
    orientation: string
    units: 'inches'
    notes: string[]
  }
  shell: FieldShell
  allianceStations: AllianceStation[]
  parkZones: ParkZone[]
  loaders: Loader[]
  longGoals: LongGoal[]
  centerGoals: CenterGoal[]
  tapeLines: TapeLine[]
}
