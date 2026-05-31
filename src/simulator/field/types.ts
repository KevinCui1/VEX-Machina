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
 * A Center Goal. The two center goals cross at the field origin forming an X.
 * Each is modeled as an oriented rectangle at ±45°.
 *
 * Upper center goal (rotation=45): runs upper-right ↔ lower-left, wider (5.53"),
 * elevated — balls can slide under it, and balls outtaked inside are captured.
 *
 * Lower center goal (rotation=-45): runs upper-left ↔ lower-right, narrower (4.15"),
 * solid floor — balls cannot pass under it.
 */
export interface CenterGoal {
  id: string
  label: string
  center: Vec2
  /** Total length along the long axis (22.6" for both). */
  length: number
  /** Cross-axis width (5.53" upper, 4.15" lower). */
  width: number
  /** Rotation in degrees CCW (45 for upper, -45 for lower). */
  rotation: number
  /** If true, render triangular alignment pieces at each end (upper goal only). */
  hasAlignmentTriangles: boolean
  /** If true, field balls slide underneath; if false, goal is a solid ball obstacle. */
  allowUnderPassage: boolean
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

/** An alliance-colored rectangular Park Zone band centered on a wall. */
export interface ParkZone {
  id: string
  alliance: Alliance
  /** Center of the zone in field inches (+Y up). */
  center: Vec2
  /** Zone width along X (the wall direction). */
  width: number
  /** Zone height along Y (into the field from the wall). */
  height: number
  /**
   * If set, an inner layer is drawn inset by this many inches on the three
   * exposed sides (left, right, and the interior-facing side). The wall-side
   * edge is flush with the outer layer. Matches the official park zone tape
   * structure visible in the field assembly reference.
   */
  innerInset?: number
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
