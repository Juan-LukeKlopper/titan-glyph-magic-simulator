/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Spell } from '../../core/types';
import { drawAstronomicalBackground, drawInvisibilityOverlay, drawPracticeGuide } from './background';
import { updateAndRenderEntities, updateAndRenderMonsterArm, applyElementReactions } from './entities';
import { updateAndRenderParticles } from './particles';
import { castingBoostFor, renderStrokes, resolveInkPalette, spawnLiveTipSparkles } from '../strokes';
import type { FrameContext } from './types';
import type { SimState } from './state';
import { createSimState, logicalBox } from './state';

/**
 * The RAF step: one simulation frame. The component's mount-once RAF loop
 * calls this with the canvas + dpr; the step fills the raw-pixel background,
 * anchors the dpr transform, then runs background / entities / monster arm /
 * reactions / particles / strokes / invisibility overlay in the monolith's
 * exact order. All React writes flow through `syncIsInvis` so the RAF never
 * calls setState directly; strokes are read from the component-owned mirrors.
 */

/** One step of the simulation, including dpr anchoring. */
export function stepSimulation(
  canvas: HTMLCanvasElement,
  dpr: number,
  sim: SimState,
  currentSpell: Spell | null,
  practiceMode: boolean,
  syncIsInvis: (active: boolean) => void
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {return;}

  const { w, h } = logicalBox(canvas, dpr);
  const now = Date.now();

  // Sync invisibility state ONLY when the ref actually changed (was previously every frame)
  syncIsInvis(sim.isInvisActive);

  // --- 1. Draw Background: Witch's Ancient Astronomical Circle ---
  // Anchor the DPR scale ONCE per frame, right after the background fill:
  // the fill must use the identity transform (it addresses raw backing
  // pixels), while everything drawn afterwards works in CSS-pixel space.
  // setTransform survives every ctx.save()/restore() pair in the draw code.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawAstronomicalBackground(ctx, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // --- 2. Draw Gorgeous High-Fidelity Guide Outline ---
  drawPracticeGuide(ctx, w, h, currentSpell, practiceMode);

  const frame: FrameContext = { ctx, w, h };

  // --- 3. Update & Draw Ambient Entities (Vines, Ice Pillars, Magic Stars) ---
  updateAndRenderEntities(sim, frame);

  // Element-on-element reactions (fire melts ice / burns vine)
  applyElementReactions(sim);

  // --- 4. Master-Level "Monster Arm" (IK chain + claw capture) ---
  updateAndRenderMonsterArm(sim, frame);

  // --- 5. Update & Render Particles (Flames, Shards, Leaves, Sleep Mist) ---
  updateAndRenderParticles(sim, frame);

  // --- 6. Draw Drawing Strokes (Tapered glow-ink trails) ---
  const ink = resolveInkPalette(currentSpell);
  const castingBoost = castingBoostFor(sim, now);
  renderStrokes(ctx, sim.strokes, ink, castingBoost);
  spawnLiveTipSparkles(sim, ink);

  // --- 7. Optical Lens bending/refraction (Invisibility overlay) ---
  if (sim.isInvisActive) {
    drawInvisibilityOverlay(ctx, w, h);
  }
}

export { createSimState };
