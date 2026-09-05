/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Spell } from '../core/types';
import type { StrokeRenderState } from './sim/types';
import type { SimState } from './sim/state';

/**
 * Layer 6 of the frame: tapered glow-ink stroke rendering + the live-tip
 * sparkle trail. The stroke color/glow follow the selected spell (white ink
 * with cyan glow in sandbox). Casting boosts the ink width with a pulsing
 * shimmer while the transition flash runs.
 */

/** Maximum sparkles to spawn per frame along the in-progress stroke tip. */
const LIVE_TIP_SPARKLE_MAX = 900;

interface StrokeInk {
  color: string;
  glow: string;
}

/** Resolves ink palette from the spell being cast (fallback white/cyan). */
export function resolveInkPalette(spell: Spell | null): StrokeInk {
  return {
    color: spell?.color || '#FFFFFF',
    glow: spell?.shadowColor || '#00CEC9',
  };
}

/**
 * Renders the completed + in-progress strokes with speed-variable width
 * (3..7px), glow shadow, and the casting-transition width boost.
 */
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: StrokeRenderState,
  ink: StrokeInk,
  castingBoost: number
) {
  const allRenderStrokes = [
    ...strokes.completed,
    ...(strokes.current.length > 0
      ? [{ id: 'current', points: strokes.current }]
      : []),
  ];

  allRenderStrokes.forEach((str) => {
    if (str.points.length < 2) {return;}

    ctx.save();
    ctx.shadowColor = ink.glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = ink.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let pIdx = 1; pIdx < str.points.length; pIdx++) {
      const pPrev = str.points[pIdx - 1];
      const pCurr = str.points[pIdx];
      const segDist = Math.sqrt((pCurr.x - pPrev.x) ** 2 + (pCurr.y - pPrev.y) ** 2);
      const dt = Math.max(1, (pCurr.t ?? Date.now()) - (pPrev.t ?? Date.now()));
      const speed = segDist / dt; // px per ms
      // Map speed to width: slow strokes (~0.1px/ms) -> 7px, fast (~1.5px/ms) -> 3px
      const speedFactor = Math.min(1, Math.max(0, (1.5 - speed) / 1.4));
      const width = 3 + speedFactor * 4 + castingBoost;
      ctx.lineWidth = width;

      ctx.beginPath();
      ctx.moveTo(pPrev.x, pPrev.y);
      ctx.lineTo(pCurr.x, pCurr.y);
      ctx.stroke();
    }
    ctx.restore();
  });
}

/** Boosts ink width with a pulsing shimmer while the cast transition runs. */
export function castingBoostFor(sim: SimState, now: number): number {
  return sim.castingTrans ? 2 + Math.sin(now * 0.03) * 1.5 : 0;
}

/**
 * Occasional sparkle trail along the tip of the in-progress stroke
 * (preserves the monolith's ~0.3 roll per frame with a 4-point minimum).
 */
export function spawnLiveTipSparkles(sim: SimState, ink: StrokeInk) {
  const live = sim.strokes.current;
  if (
    live.length > 4 &&
    sim.particles.length < LIVE_TIP_SPARKLE_MAX &&
    Math.random() < 0.3
  ) {
    const tip = live[live.length - 1];
    sim.particles.push({
      id: Math.random().toString(),
      type: 'sparkle',
      x: tip.x + (Math.random() * 8 - 4),
      y: tip.y + (Math.random() * 8 - 4),
      vx: Math.random() * 0.5 - 0.25,
      vy: -Math.random() * 0.4,
      size: Math.random() * 2.5 + 1,
      color: ink.color,
      alpha: 1,
      life: 0,
      maxLife: 18 + Math.random() * 12,
    });
  }
}
