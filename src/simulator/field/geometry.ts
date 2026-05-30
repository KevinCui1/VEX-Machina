// ─────────────────────────────────────────────────────────────────────────────
// Coordinate helpers: field-inch space  ->  SVG user space.
//
// Field space:  origin = center, +X right, +Y UP.
// SVG space:    origin = top-left, +X right, +Y DOWN.
//
// The ONLY place the Y axis is flipped is here, so the rest of the code can
// think purely in field inches with +Y up. We keep SVG in inches too (1 SVG
// unit = 1 inch) and let the <svg> viewBox + CSS scale the whole thing.
// ─────────────────────────────────────────────────────────────────────────────

import type { Vec2 } from './types'

/** Convert a field-space point (inches, +Y up) to an SVG point (+Y down). */
export function toSvg(p: Vec2): Vec2 {
  return { x: p.x, y: -p.y }
}

/** Convert a field-space rotation (CCW degrees) to an SVG rotation (CW degrees). */
export function toSvgRotation(deg: number): number {
  return -deg
}

/**
 * The viewBox that frames the whole field plus a margin for the alliance
 * stations and labels. Returned as the four numbers SVG expects.
 */
export function fieldViewBox(
  nominalInteriorSize: number,
  margin: number,
): { minX: number; minY: number; width: number; height: number } {
  const half = nominalInteriorSize / 2 + margin
  return { minX: -half, minY: -half, width: half * 2, height: half * 2 }
}
