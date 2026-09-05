/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Spell } from '../../core/types';
import { drawHighFidelityGlyphBlueprint } from '../blueprints';

/**
 * Layer 1 of the frame: the witch's ancient astronomical circle background.
 *
 * IMPORTANT dpr contract: the caller fills the raw backing store (identity
 * transform) and then applies ctx.setTransform(dpr,0,0,dpr,0,0) BEFORE calling
 * these helpers, so every coordinate here is in CSS-pixel space.
 */
export function drawAstronomicalBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#160E1D'; // Rich deep mulberry obsidian
  ctx.fillRect(0, 0, w, h);

  // Draw faint magical geometric alignment guidelines
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.08)'; // Warm gold/bronze
  ctx.lineWidth = 1.5;
  const minDim = Math.min(w, h);

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, minDim * 0.44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, minDim * 0.41, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(w / 2, h / 2);
  // Celestial star coordinate rays
  for (let ray = 0; ray < 8; ray++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, minDim * 0.08);
    ctx.lineTo(0, minDim * 0.41);
    ctx.stroke();
  }
  ctx.restore();

  // Cosmic background stars
  ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
  const starCoords = [
    { x: w * 0.08, y: h * 0.12 },
    { x: w * 0.92, y: h * 0.15 },
    { x: w * 0.14, y: h * 0.84 },
    { x: w * 0.86, y: h * 0.82 },
    { x: w * 0.05, y: h * 0.48 },
    { x: w * 0.95, y: h * 0.52 },
  ];
  starCoords.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Spectral-lavender trace guide. Only drawn in practice mode with a selected
 * spell; radius is min(w,h) * 0.38 as in the monolith.
 */
export function drawPracticeGuide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spell: Spell | null,
  practiceMode: boolean
) {
  if (!spell || !practiceMode || w <= 0) {return;}
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  drawHighFidelityGlyphBlueprint(ctx, cx, cy, r, spell.id, spell.color);
}

/**
 * Invisibility refraction overlay: a slow-breathing white ring + faint glass
 * tint across the whole surface. Only called while the shroud is active.
 */
export function drawInvisibilityOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(
    w / 2,
    h / 2,
    Math.max(0, Math.min(w, h) * 0.25 + Math.sin(Date.now() * 0.003) * 15),
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.fillStyle = 'rgba(223, 230, 233, 0.04)';
  ctx.fillRect(0, 0, w, h);
}
