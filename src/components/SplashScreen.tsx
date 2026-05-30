import { useEffect, useRef, useCallback } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
const T_DRIFT_END    = 600
const T_CONVERGE_END = 2000
const T_HOLD_END     = 4200
const T_DISSOLVE_END = 6000

// ─── Colors ──────────────────────────────────────────────────────────────────
const COL_BG         = '#090b0f'
const RAINBOW_SPARKS = ['#ff4444','#ff9020','#ffe030','#44ee44','#30d0ff','#8844ff','#ff44cc']
const COL_CAPTION    = 'rgba(90,180,216,0.7)'
const COL_GRID_MAJOR = 'rgba(79,195,247,0.03)'
const COL_GRID_MINOR = 'rgba(79,195,247,0.015)'

// Per-part color palettes: [fill, stroke, accent]
const PART_PALETTES: [string, string, string][] = [
  ['#1c3a58', '#5ab4d8', '#7dd4f0'],   // steel blue
  ['#3b1a10', '#c0622a', '#f08040'],   // burnt orange / rust
  ['#1a2e1a', '#4caf50', '#80e080'],   // circuit green
  ['#2e2010', '#b8922a', '#e8c060'],   // brass / gold
  ['#2a1a38', '#9060c8', '#c090f8'],   // anodized purple
  ['#1e1e1e', '#888888', '#cccccc'],   // bare steel / silver
]

// ─── Part types ───────────────────────────────────────────────────────────────
type PartType = 'gear' | 'axle' | 'screw' | 'bracket' | 'wheel' | 'connector'
const PART_POOL: PartType[] = ['gear','gear','axle','axle','axle','screw','screw','bracket','wheel','connector']

// ─── Seeded LCG random ────────────────────────────────────────────────────────
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0
    return s / 0xffffffff
  }
}

function easeOut(t: number) { return 1 - (1 - t) ** 3 }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return a + d * t
}

// ─── Shapes — each accepts (ctx, size, stroke, accent) ───────────────────────
function drawGear(ctx: CanvasRenderingContext2D, r: number, stroke: string, accent: string) {
  const teeth = 7, toothH = r * 0.32
  ctx.beginPath()
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? r + toothH : r
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
  ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.strokeStyle = stroke
}

function drawAxle(ctx: CanvasRenderingContext2D, len: number, w: number, accent: string) {
  ctx.beginPath()
  ctx.roundRect(-len / 2, -w / 2, len, w, w / 2)
  ctx.fill(); ctx.stroke()
  ctx.strokeStyle = accent; ctx.lineWidth = 1
  for (const ex of [-len * 0.38, len * 0.38]) {
    ctx.beginPath()
    ctx.moveTo(ex, -w * 0.6); ctx.lineTo(ex, w * 0.6); ctx.stroke()
  }
}

function drawScrew(ctx: CanvasRenderingContext2D, r: number, accent: string) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0)
  ctx.strokeStyle = accent; ctx.lineWidth = r * 0.22; ctx.stroke()
}

function drawBracket(ctx: CanvasRenderingContext2D, s: number, stroke: string, accent: string) {
  ctx.strokeStyle = stroke; ctx.lineWidth = s * 0.24; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, -s * 0.55)
  ctx.lineTo(-s * 0.5, s * 0.45)
  ctx.lineTo(s * 0.55, s * 0.45)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath(); ctx.arc(-s * 0.5, -s * 0.3, s * 0.1, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(s * 0.35, s * 0.45, s * 0.1, 0, Math.PI * 2); ctx.fill()
}

function drawWheel(ctx: CanvasRenderingContext2D, r: number, stroke: string, accent: string) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2)
  ctx.strokeStyle = COL_BG; ctx.lineWidth = r * 0.18; ctx.stroke()
  ctx.strokeStyle = stroke; ctx.lineWidth = r * 0.12
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18)
    ctx.lineTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65)
    ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = accent; ctx.fill()
}

function drawConnector(ctx: CanvasRenderingContext2D, r: number, accent: string) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2)
  ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = accent; ctx.fill()
}

// ─── Part instance ────────────────────────────────────────────────────────────
interface Part {
  type: PartType
  tx: number; ty: number
  x: number; y: number
  rot: number; targetRot: number
  dvx: number; dvy: number; drotV: number
  scale: number; opacity: number
  locked: boolean; size: number
  palette: [string, string, string]  // [fill, stroke, accent]
  above: boolean  // true = renders above the outline
}

function drawPart(ctx: CanvasRenderingContext2D, p: Part, fade = 1) {
  const [fill, stroke, accent] = p.palette
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.scale(p.scale, p.scale)
  ctx.globalAlpha = p.opacity * fade
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.4
  ctx.lineCap = 'butt'

  switch (p.type) {
    case 'gear':      drawGear(ctx, p.size, stroke, accent); break
    case 'axle':      drawAxle(ctx, p.size * 3.2, p.size * 0.55, accent); break
    case 'screw':     drawScrew(ctx, p.size * 0.85, accent); break
    case 'bracket':   drawBracket(ctx, p.size * 1.6, stroke, accent); break
    case 'wheel':     drawWheel(ctx, p.size, stroke, accent); break
    case 'connector': drawConnector(ctx, p.size * 0.7, accent); break
  }
  ctx.restore()
}

// ─── Sparks + ticks ───────────────────────────────────────────────────────────
interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; color: string
}
interface Tick { x: number; y: number; life: number }

// ─── Pixel sampling ───────────────────────────────────────────────────────────
function sampleText(text: string, cw: number, ch: number, fontSize: number, targetCount: number) {
  const oc = document.createElement('canvas')
  oc.width = cw; oc.height = ch
  const ox = oc.getContext('2d')!
  ox.fillStyle = '#fff'
  ox.font = `italic 900 ${fontSize}px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif`
  ox.textAlign = 'center'
  ox.textBaseline = 'middle'
  // two-line render for smaller screens
  if (cw < 600) {
    ox.fillText('VEX', cw / 2, ch / 2 - fontSize * 0.55)
    ox.fillText('Machina', cw / 2, ch / 2 + fontSize * 0.55)
  } else {
    ox.fillText(text, cw / 2, ch / 2)
  }
  const img = ox.getImageData(0, 0, cw, ch)
  const allPts: {x: number; y: number}[] = []
  const step = 4
  for (let y = 0; y < ch; y += step) {
    for (let x = 0; x < cw; x += step) {
      if (img.data[(y * cw + x) * 4 + 3] > 60) allPts.push({x, y})
    }
  }
  // Subsample to target count
  const stride = Math.max(1, Math.floor(allPts.length / targetCount))
  const pts: {x: number; y: number}[] = []
  for (let i = 0; i < allPts.length; i += stride) pts.push(allPts[i])
  return pts
}

// ─── Grid drawing ─────────────────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.lineWidth = 0.5
  ctx.strokeStyle = COL_GRID_MINOR
  for (let x = 0; x < w; x += 14) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
  for (let y = 0; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }
  ctx.strokeStyle = COL_GRID_MAJOR; ctx.lineWidth = 0.8
  for (let x = 0; x < w; x += 56) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
  for (let y = 0; y < h; y += 56) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const doneRef   = useRef(false)

  const complete = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    cancelAnimationFrame(rafRef.current)
    sessionStorage.setItem('vmIntroShown', '1')
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (sessionStorage.getItem('vmIntroShown')) { onComplete(); return }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const W = canvas.width
    const H = canvas.height
    const fontSize = Math.max(Math.min(W * 0.25, 220), 90)
    const TARGET_PARTS = Math.min(900, Math.max(400, Math.floor(W * H / 1400)))
    const pts = sampleText('VEX Machina', W, H, fontSize, TARGET_PARTS)

    const rand = makeLCG(0xcafebabe)
    const parts: Part[] = pts.map(pt => ({
      type: PART_POOL[Math.floor(rand() * PART_POOL.length)] as PartType,
      tx: pt.x, ty: pt.y,
      x: rand() * W, y: rand() * H,
      rot: (rand() - 0.5) * Math.PI * 2,
      targetRot: (rand() - 0.5) * 0.5,
      dvx: (rand() - 0.5) * 0.5, dvy: (rand() - 0.5) * 0.5,
      drotV: (rand() - 0.5) * 0.012,
      scale: 0.75 + rand() * 0.65,
      opacity: 0.60 + rand() * 0.30,
      locked: false,
      size: 6 + rand() * 6,
      palette: PART_PALETTES[Math.floor(rand() * PART_PALETTES.length)],
      above: rand() < 0.33,
    }))

    const sparks: Spark[] = []
    const ticks: Tick[] = []

    function emitSparks(x: number, y: number) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2
        sparks.push({ x, y,
          vx: Math.cos(a) * (1.5 + Math.random() * 2.5),
          vy: Math.sin(a) * (1.5 + Math.random() * 2.5),
          life: 1,
          color: RAINBOW_SPARKS[Math.floor(Math.random() * RAINBOW_SPARKS.length)] })
      }
      ticks.push({ x, y, life: 1 })
    }

    // skip
    let skipRequested = false
    const onSkip = () => { skipRequested = true }
    canvas.addEventListener('click', onSkip)
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') skipRequested = true }
    window.addEventListener('keydown', onKey)

    const startTime = performance.now()
    let captionOpacity = 0
    let outlineOpacity = 0
    let dissolveAlpha = 1

    function frame(now: number) {
      if (doneRef.current) return
      const el = now - startTime

      // ── skip: snap everything to target ──────────────────────────────────
      if (skipRequested && el < T_CONVERGE_END) {
        for (const p of parts) {
          p.x = p.tx; p.y = p.ty; p.rot = p.targetRot; p.opacity = 1; p.locked = true
        }
        skipRequested = false
        // pretend we're in mid-hold
        const fakeDelta = T_HOLD_END - el - 200
        rafRef.current = requestAnimationFrame(n => frame(n - fakeDelta))
        return
      }

      const W2 = canvas!.width, H2 = canvas!.height
      ctx.clearRect(0, 0, W2, H2)
      ctx.fillStyle = COL_BG
      ctx.fillRect(0, 0, W2, H2)
      drawGrid(ctx, W2, H2)

      // vignette
      const vg = ctx.createRadialGradient(W2/2, H2/2, H2*0.15, W2/2, H2/2, H2*0.8)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.7)')
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W2, H2)

      // ── phase logic ────────────────────────────────────────────────────
      if (el < T_DRIFT_END) {
        // Drift: parts float around
        const t = el / T_DRIFT_END
        captionOpacity = t * 0.4
        outlineOpacity = 0
        for (const p of parts) {
          p.x += p.dvx; p.y += p.dvy; p.rot += p.drotV
          if (p.x < -30) p.x = W2 + 30; if (p.x > W2 + 30) p.x = -30
          if (p.y < -30) p.y = H2 + 30; if (p.y > H2 + 30) p.y = -30
          p.opacity = 0.45 + 0.2 * Math.sin(el * 0.003 + p.tx * 0.02)
        }
      } else if (el < T_CONVERGE_END) {
        // Converge: parts fly to letter positions
        const raw = (el - T_DRIFT_END) / (T_CONVERGE_END - T_DRIFT_END)
        const t = easeOut(raw)
        captionOpacity = Math.min(1, raw * 2)
        outlineOpacity = easeOut(Math.max(0, (raw - 0.5) / 0.5))
        for (const p of parts) {
          if (p.locked) continue
          p.x = lerp(p.x, p.tx, 0.06 + t * 0.06)
          p.y = lerp(p.y, p.ty, 0.06 + t * 0.06)
          p.rot = lerpAngle(p.rot, p.targetRot, 0.04 + t * 0.04)
          p.opacity = lerp(p.opacity, 1, 0.06)
          const dx = p.tx - p.x, dy = p.ty - p.y
          if (Math.sqrt(dx*dx + dy*dy) < 3) {
            p.locked = true; p.x = p.tx; p.y = p.ty
            emitSparks(p.tx, p.ty)
          }
        }
      } else if (el < T_HOLD_END) {
        // Hold: assembled wordmark, add glow
        const t = (el - T_CONVERGE_END) / (T_HOLD_END - T_CONVERGE_END)
        captionOpacity = 1
        outlineOpacity = 1
        for (const p of parts) {
          p.opacity = 0.88 + 0.1 * Math.sin(t * Math.PI * 4 + p.tx * 0.03)
        }
      } else {
        // Dissolve
        const raw = (el - T_HOLD_END) / (T_DISSOLVE_END - T_HOLD_END)
        dissolveAlpha = Math.max(0, 1 - easeOut(raw))
        captionOpacity = dissolveAlpha
        outlineOpacity = dissolveAlpha
        ctx.globalAlpha = dissolveAlpha
        if (raw >= 1) { ctx.globalAlpha = 1; complete(); return }
      }

      // ── Draw below-outline parts (67%) ───────────────────────────────
      const fade = el >= T_HOLD_END ? dissolveAlpha : 1
      for (const p of parts) if (!p.above) drawPart(ctx, p, fade)
      ctx.globalAlpha = 1

      // ── Text outline ─────────────────────────────────────────────────
      if (outlineOpacity > 0.01) {
        ctx.save()
        ctx.globalAlpha = outlineOpacity
        const grad = ctx.createLinearGradient(W2 * 0.1, 0, W2 * 0.9, 0)
        grad.addColorStop(0,    '#f08040')
        grad.addColorStop(0.2,  '#5ab4d8')
        grad.addColorStop(0.4,  '#4caf50')
        grad.addColorStop(0.6,  '#e8c040')
        grad.addColorStop(0.8,  '#c090f8')
        grad.addColorStop(1,    '#cccccc')
        ctx.strokeStyle = grad
        ctx.lineWidth = 5.5
        ctx.lineJoin = 'round'
        ctx.font = `italic 900 ${fontSize}px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (W2 < 600) {
          ctx.strokeText('VEX',     W2 / 2, H2 / 2 - fontSize * 0.55)
          ctx.strokeText('Machina', W2 / 2, H2 / 2 + fontSize * 0.55)
        } else {
          ctx.strokeText('VEX Machina', W2 / 2, H2 / 2)
        }
        ctx.restore()
      }

      // ── Draw above-outline parts (33%) ───────────────────────────────
      for (const p of parts) if (p.above) drawPart(ctx, p, fade)
      ctx.globalAlpha = 1

      // ── Ticks ──────────────────────────────────────────────────────────
      for (let i = ticks.length - 1; i >= 0; i--) {
        const tk = ticks[i]
        tk.life -= 0.03
        if (tk.life <= 0) { ticks.splice(i, 1); continue }
        const s = (1 - tk.life) * 8 + 2
        ctx.save(); ctx.globalAlpha = tk.life * 0.8
        ctx.strokeStyle = '#7dd4f0'; ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(tk.x - s, tk.y); ctx.lineTo(tk.x + s, tk.y)
        ctx.moveTo(tk.x, tk.y - s); ctx.lineTo(tk.x, tk.y + s)
        ctx.stroke(); ctx.restore()
      }

      // ── Sparks ─────────────────────────────────────────────────────────
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i]
        sp.life -= 0.05; sp.x += sp.vx; sp.y += sp.vy; sp.vy += 0.07
        if (sp.life <= 0) { sparks.splice(i, 1); continue }
        ctx.save(); ctx.globalAlpha = sp.life
        ctx.fillStyle = sp.color
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.life * 2, 0, Math.PI * 2)
        ctx.fill(); ctx.restore()
      }

      // ── Caption ────────────────────────────────────────────────────────
      if (captionOpacity > 0.01) {
        ctx.save()
        ctx.globalAlpha = captionOpacity
        ctx.fillStyle = COL_CAPTION
        ctx.font = '11px "Courier New", monospace'
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillText('INITIALIZING  VEX  MACHINA', W2 / 2, H2 - 28)
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    if (reducedMotion) {
      // Static: snap all parts to target, show briefly, then done
      for (const p of parts) {
        p.x = p.tx; p.y = p.ty; p.rot = p.targetRot; p.opacity = 1; p.locked = true
      }
      const W2 = canvas.width, H2 = canvas.height
      ctx.fillStyle = COL_BG; ctx.fillRect(0, 0, W2, H2)
      drawGrid(ctx, W2, H2)
      for (const p of parts) drawPart(ctx, p)
      ctx.fillStyle = COL_CAPTION
      ctx.font = '11px "Courier New", monospace'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText('INITIALIZING  VEX  MACHINA', W2 / 2, H2 - 28)
      setTimeout(complete, 1500)
    } else {
      rafRef.current = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
      if (canvas) canvas.removeEventListener('click', onSkip)
    }
  }, [complete, onComplete])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 9999 }}
    />
  )
}
