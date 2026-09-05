/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EngineParticle, FrameContext } from './types';
import type { SimState } from './state';
import { computeFrameFlags } from './state';

/**
 * Layer 5 of the frame: particle physics + rendering.
 *
 * Update order mirrors the monolith exactly: age first, then vortex pull,
 * then per-type motion (gravity/drag/sleep-mist slowdown), then cull expired
 * particles, then draw. Flags (vortex presence, mist, safety hover) are
 * computed once per frame by the loop and passed in for coherent physics.
 */

/** World-side constants, frozen from the monolith. */
const GRAVITY_NORMAL = 0.12;
const GRAVITY_SAFETY = 0.03;
const GRAVITY_MIST = 0.02;

/**
 * Updates particle physics and renders every live particle. Mutates `sim`
 * (aging particles, pushing replacements via the spawn queues and compacting
 * into `sim.particles` at the end).
 */
export function updateAndRenderParticles(sim: SimState, frame: FrameContext) {
  const { ctx, h } = frame;
  const flags = computeFrameFlags(sim);

  const nextParticles: EngineParticle[] = [];

  sim.particles.forEach((part) => {
    // Gravity & Drag constants.
    // NOTE: the monolith also computed `horizontalDrag` (0.99, or 0.92 under
    // sleep mist), but drag is actually applied through the per-type motion
    // rules below (frost *= 0.92, leaf flutter, spark gravity), so the value
    // is intentionally not used here — behavior is identical.
    let localGravity = flags.isSafetyHoverActive ? GRAVITY_SAFETY : GRAVITY_NORMAL;
    if (flags.isSleepMistActive) {
      localGravity = GRAVITY_MIST;
    }

    part.life++;

    // Wind Vortex attraction: pull and swirl nearby particles inside the active tornado
    if (flags.activeVortex) {
      const dx = flags.activeVortex.x - part.x;
      const dy = flags.activeVortex.y - part.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 360) {
        const pullFactor = (1 - dist / 360) * 0.95;
        // Swirl orbit + collapse pull + vertical updraft drift
        part.vx += (dy / dist) * 1.6 * pullFactor + (dx / dist) * 0.35 * pullFactor;
        part.vy += (-dx / dist) * 1.6 * pullFactor + (dy / dist) * 0.35 * pullFactor - 0.24 * pullFactor;
      }
    }

    if (part.type === 'flame' || part.type === 'smoke') {
      part.x += part.vx;
      part.y += part.vy;
      part.size *= 0.96; // fade size
      part.alpha = 1 - part.life / part.maxLife;
    } else if (part.type === 'spark') {
      part.vy += localGravity; // fall
      part.x += part.vx;
      part.y += part.vy;
      part.alpha = 1 - part.life / part.maxLife;
    } else if (part.type === 'frost') {
      part.vy *= 0.92; // rapid horizontal drag
      part.x += part.vx;
      part.y += part.vy;
      part.alpha = 0.8 * (1 - part.life / part.maxLife);
    } else if (part.type === 'leaf') {
      // Floating leaf: gravity + fluttering air resistance
      part.vy = 0.45;
      part.vx = Math.sin(part.life * 0.04) * 0.6;
      part.x += part.vx;
      part.y += part.vy;

      if (part.y > h - 10) {part.y = h - 10;} // rest on floor

      const leafData = part.data;
      if (leafData) {leafData.angle += 0.01;}
    } else if (part.type === 'mist') {
      // Purple sleepy gas swirling gently
      part.x += part.vx + Math.sin(Date.now() * 0.0015 + part.size) * 0.3;
      part.y += part.vy + Math.cos(Date.now() * 0.001 - part.size) * 0.2;
      part.alpha = 0.45 * (1 - part.life / part.maxLife);
    } else if (part.type === 'portal_dust' || part.type === 'sparkle') {
      part.x += part.vx;
      part.y += part.vy;
      part.alpha = 1 - part.life / part.maxLife;
    }

    if (part.life < part.maxLife) {
      nextParticles.push(part);
    }

    renderParticle(ctx, part);
  });

  sim.particles = nextParticles;
}

/** Renders one particle according to its type (unchanged visuals). */
function renderParticle(ctx: CanvasRenderingContext2D, part: EngineParticle) {
  ctx.save();
  ctx.globalAlpha = part.alpha;

  switch (part.type) {
    case 'flame': {
      // Flame shape using beautiful layered bezier curves to map out natural flame contours
      ctx.save();
      ctx.translate(part.x, part.y);

      // Add a subtle flickering rotate sway based on particle x coord and timer
      const flicker = Math.sin(Date.now() * 0.015 + part.x * 0.04) * 0.12;
      ctx.rotate(flicker);

      const s = part.size * 1.6;

      // Double color layer: warm red/orange shell with glowing yellow inner core
      const flameGradient = ctx.createLinearGradient(0, s, 0, -s);
      flameGradient.addColorStop(0, '#D63031'); // Dark crimson base
      flameGradient.addColorStop(0.4, '#FF7675'); // Radiant orange core
      flameGradient.addColorStop(0.85, '#FFEAA7'); // Gold crown
      flameGradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Soft tips fade

      ctx.beginPath();
      ctx.moveTo(0, s); // starts at base center
      ctx.bezierCurveTo(-s * 0.82, s * 0.95, -s * 1.05, 0, 0, -s * 1.15); // left curvature to tapering tip
      ctx.bezierCurveTo(s * 1.05, 0, s * 0.82, s * 0.95, 0, s); // right curvature back down
      ctx.closePath();

      ctx.fillStyle = flameGradient;
      ctx.shadowBlur = s * 1.4;
      ctx.shadowColor = '#D63031';
      ctx.fill();

      // Hot inner core shell
      if (part.size > 2) {
        const innerS = s * 0.45;
        const innerGradient = ctx.createLinearGradient(0, innerS, 0, -innerS);
        innerGradient.addColorStop(0, '#FFEAA7');
        innerGradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.beginPath();
        ctx.moveTo(0, innerS);
        ctx.bezierCurveTo(-innerS * 0.75, innerS * 0.9, -innerS * 0.95, 0, 0, -innerS * 1.15);
        ctx.bezierCurveTo(innerS * 0.95, 0, innerS * 0.75, innerS * 0.9, 0, innerS);
        ctx.closePath();
        ctx.fillStyle = innerGradient;
        ctx.shadowBlur = 0;
        ctx.fill();
      }

      ctx.restore();
      break;
    }
    case 'smoke': {
      ctx.fillStyle = '#4A4A4A';
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'spark':
    case 'sparkle':
    case 'portal_dust': {
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
      break;
    }
    case 'frost': {
      ctx.fillStyle = part.color;
      ctx.beginPath();
      // Draw diamond ice flakes
      ctx.moveTo(part.x, part.y - part.size);
      ctx.lineTo(part.x + part.size, part.y);
      ctx.lineTo(part.x, part.y + part.size);
      ctx.lineTo(part.x - part.size, part.y);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.fillStyle = part.color;
      ctx.translate(part.x, part.y);
      ctx.rotate(part.data?.angle ?? 0);
      ctx.beginPath();
      // leaf oval shape
      ctx.ellipse(0, 0, part.size, part.size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mist': {
      // large gaseous smoke clouds
      const gradient = ctx.createRadialGradient(part.x, part.y, 2, part.x, part.y, part.size);
      gradient.addColorStop(0, 'rgba(162, 155, 254, 0.55)');
      gradient.addColorStop(0.5, 'rgba(108, 92, 231, 0.25)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}
