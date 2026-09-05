/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Glyph guide blueprint drawing: pure 2D vector guides for the practiced spell.
// The spell to trace is drawn as a spectral lavender "celestial blueprint"
// behind the user's gold ink. All geometry below is moved VERBATIM from the
// former MagicCanvas monolith — none of the constants or path math changed.

// Helper functions to draw pure element primitives in guide outlines
function drawMiniLight(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 1. Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Small circle at top-center (relative cx = 0, cy = -0.5 * r, radius = r / 6)
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.5, r / 6, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Triangle lines at the bottom
  // bottom-left: cx - 0.943 * r, cy + 0.333 * r
  // bottom-right: cx + 0.943 * r, cy + 0.333 * r
  // apex: cx, cy - 0.333 * r
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.943, cy + r * 0.333);
  ctx.lineTo(cx, cy - r * 0.333);
  ctx.lineTo(cx + r * 0.943, cy + r * 0.333);
  ctx.closePath();
  ctx.stroke();

  // 4. Vertical stem from bottom of circle (cy + r) to triangle apex (cy - 0.333 * r)
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.lineTo(cx, cy - r * 0.333);
  ctx.stroke();

  // 5. Left and right horns
  // Left horn: from (cx - 0.157 * r, cy - 0.556 * r) to (cx, cy - r)
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.157, cy - r * 0.556);
  ctx.lineTo(cx, cy - r);
  ctx.stroke();

  // Right horn: from (cx + 0.157 * r, cy - 0.556 * r) to (cx, cy - r)
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.157, cy - r * 0.556);
  ctx.lineTo(cx, cy - r);
  ctx.stroke();

  // 6. Two slated crossbars (slashes) across center of stem
  // Slash 1: from (cx - 0.157 * r, cy + 0.25 * r) to (cx + 0.157 * r, cy + 0.083 * r)
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.157, cy + r * 0.25);
  ctx.lineTo(cx + r * 0.157, cy + r * 0.083);
  ctx.stroke();

  // Slash 2: from (cx - 0.157 * r, cy + 0.083 * r) to (cx + 0.157 * r, cy - 0.083 * r)
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.157, cy + r * 0.083);
  ctx.lineTo(cx + r * 0.157, cy - r * 0.083);
  ctx.stroke();
}

function drawMiniIce(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 1. Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Large curved arc crossing the bottom half
  // M (cx - 0.969 * r, cy + 0.25 * r) to (cx + 0.969 * r, cy + 0.25 * r)
  // Curving through control points: (cx - 0.366 * r, cy - 0.083 * r) and (cx + 0.366 * r, cy - 0.083 * r)
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.969, cy + r * 0.25);
  ctx.bezierCurveTo(
    cx - r * 0.366, cy - r * 0.083,
    cx + r * 0.366, cy - r * 0.083,
    cx + r * 0.969, cy + r * 0.25
  );
  ctx.stroke();

  // 3. Horizontal bar at cy + 0.5 * r
  // from cx - 0.867 * r to cx + 0.867 * r
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.867, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.867, cy + r * 0.5);
  ctx.stroke();

  // 4. Central Diamond below the horizontal bar
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.125, cy + r * 0.625);
  ctx.lineTo(cx, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.125, cy + r * 0.625);
  ctx.lineTo(cx, cy + r * 0.75);
  ctx.closePath();
  ctx.stroke();

  // 5. Large inner diamond/kite at the top half
  // apex: (cx, cy - r)
  // mid-left: (cx - 0.375 * r, cy - 0.5 * r)
  // mid-right: (cx + 0.375 * r, cy - 0.5 * r)
  // base: (cx, cy + 0.5 * r)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx - r * 0.375, cy - r * 0.5);
  ctx.lineTo(cx, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.375, cy - r * 0.5);
  ctx.closePath();
  ctx.stroke();

  // 6. Central vertical stem
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r * 0.5);
  ctx.stroke();
}

function drawMiniPlant(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 1. Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Small circle at bottom-center (relative cx = 0, cy = 0.5 * r, radius = r / 6)
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.5, r / 6, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Solid center dot inside bottom-center circle
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.5, r * 0.052, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Vertical main stem from small circle top (relative 0, 0.25) to upper branch split (relative 0, -0.375)
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.25);
  ctx.lineTo(cx, cy - r * 0.375);
  ctx.stroke();

  // 5. Lower branch splitters (clover leaflets)
  // Left: from (cx, cy + 0.25 * r) to (cx - 0.25 * r, cy)
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.25);
  ctx.lineTo(cx - r * 0.25, cy);
  ctx.stroke();

  // Right: from (cx, cy + 0.25 * r) to (cx + 0.25 * r, cy)
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.25);
  ctx.lineTo(cx + r * 0.25, cy);
  ctx.stroke();

  // 6. Upper branches splitting
  // Left: from (cx, cy - 0.375 * r) to (cx - 0.375 * r, cy - 0.75 * r)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.375);
  ctx.lineTo(cx - r * 0.375, cy - r * 0.75);
  ctx.stroke();

  // Right: from (cx, cy - 0.375 * r) to (cx + 0.375 * r, cy - 0.75 * r)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.375);
  ctx.lineTo(cx + r * 0.375, cy - r * 0.75);
  ctx.stroke();

  // 7. Lower horizontal crossbar (crossbar 1) at cy - 0.563 * r
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.187, cy - r * 0.563);
  ctx.lineTo(cx + r * 0.187, cy - r * 0.563);
  ctx.stroke();

  // 8. Upper horizontal crossbar (crossbar 2) at cy - 0.75 * r
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.375, cy - r * 0.75);
  ctx.lineTo(cx + r * 0.375, cy - r * 0.75);
  ctx.stroke();
}

function drawMiniFire(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 1. Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Large loop/circle at the bottom-center (relative cy = 0.5 * r, radius = 0.5 * r)
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.5, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Central bullet dot inside bottom-center circle
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.5, r * 0.052, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Smaller circle at the top-middle (relative cy = -0.309 * r, radius = 0.309 * r)
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.309, r * 0.309, 0, Math.PI * 2);
  ctx.stroke();

  // 5. Curved inner right flame
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.5, cy + r * 0.5);
  ctx.bezierCurveTo(
    cx + r * 0.5, cy + r * 0.073,
    cx + r * 0.318, cy - r * 0.334,
    cx, cy - r * 0.618
  );
  ctx.stroke();

  // 6. Curved inner left flame
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.618);
  ctx.bezierCurveTo(
    cx - r * 0.318, cy - r * 0.334,
    cx - r * 0.5, cy + r * 0.073,
    cx - r * 0.5, cy + r * 0.5
  );
  ctx.stroke();

  // 7. Outer right tip flame hook
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.309, cy - r * 0.309);
  ctx.bezierCurveTo(
    cx + r * 0.309, cy - r * 0.573,
    cx + r * 0.197, cy - r * 0.825,
    cx, cy - r
  );
  ctx.stroke();

  // 8. Outer left tip flame hook
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(
    cx - r * 0.197, cy - r * 0.825,
    cx - r * 0.309, cy - r * 0.573,
    cx - r * 0.309, cy - r * 0.309
  );
  ctx.stroke();
}

// Draw a perfect, high-fidelity vector representation of "The Owl House" showing designs
// Uses a distinct mystical lavender-indigo theme to clearly separate guidelines from drawn gold ink
export function drawHighFidelityGlyphBlueprint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  spellId: string,
  // Kept for call-shape compatibility with the monolith; the guide always
  // paints in the fixed spectral-lavender palette below.
  _color: string
) {
  ctx.save();
  // Style the guide as an ancient, luminous spectral lavender celestial blueprint
  ctx.strokeStyle = 'rgba(162, 155, 254, 0.48)'; // Translucent Mystic Violet / Lavender
  ctx.fillStyle = 'rgba(162, 155, 254, 0.48)';
  ctx.shadowColor = '#6C5CE7'; // Radiant royal violet aura
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the outermost locator circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Draw two subtle inner locator alignment rings to make it look highly tactical and official
  ctx.save();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(162, 155, 254, 0.22)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Render spell blueprint depending on spellId
  if (spellId === 'light') {
    drawMiniLight(ctx, cx, cy, r * 0.85);
  } else if (spellId === 'ice') {
    drawMiniIce(ctx, cx, cy, r * 0.85);
  } else if (spellId === 'plant') {
    drawMiniPlant(ctx, cx, cy, r * 0.85);
  } else if (spellId === 'fire') {
    drawMiniFire(ctx, cx, cy, r * 0.85);
  } else if (spellId === 'sleep_mist') {
    // Divided hemispheres
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85);
    ctx.lineTo(cx, cy + r * 0.85);
    ctx.stroke();

    // Ice on the right, Fire on the left
    drawMiniIce(ctx, cx + r * 0.38, cy, r * 0.33);
    drawMiniFire(ctx, cx - r * 0.38, cy, r * 0.33);
  } else if (spellId === 'wind_vortex') {
    // Ice core
    drawMiniIce(ctx, cx, cy, r * 0.28);

    // 3 orbital stems leading to Fire nodes
    const angles = [Math.PI * 5/6, Math.PI * 1/6, Math.PI * 3/2];
    angles.forEach((ang) => {
      const nx = cx + r * 0.58 * Math.cos(ang);
      const ny = cy + r * 0.58 * Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.28 * Math.cos(ang), cy + r * 0.28 * Math.sin(ang));
      ctx.lineTo(nx, ny);
      ctx.stroke();
      drawMiniFire(ctx, nx, ny, r * 0.15);
    });

    // 1 top Light stem & node
    const tx = cx;
    const ty = cy - r * 0.65;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.28);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    drawMiniLight(ctx, tx, ty, r * 0.16);
  } else if (spellId === 'invisibility') {
    // Light central anchor
    drawMiniLight(ctx, cx, cy, r * 0.38);

    // Top-left Light node
    const tlx = cx - r * 0.52;
    const tly = cy - r * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.25 * Math.SQRT1_2, cy - r * 0.25 * Math.SQRT1_2);
    ctx.lineTo(tlx, tly);
    ctx.stroke();
    drawMiniLight(ctx, tlx, tly, r * 0.20);

    // Bottom-left Ice node
    const blx = cx - r * 0.52;
    const bly = cy + r * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.25 * Math.SQRT1_2, cy + r * 0.25 * Math.SQRT1_2);
    ctx.lineTo(blx, bly);
    ctx.stroke();
    drawMiniIce(ctx, blx, bly, r * 0.20);

    // Bottom-right Ice node
    const brx = cx + r * 0.52;
    const bry = cy + r * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.25 * Math.SQRT1_2, cy + r * 0.25 * Math.SQRT1_2);
    ctx.lineTo(brx, bry);
    ctx.stroke();
    drawMiniIce(ctx, brx, bry, r * 0.20);
  } else if (spellId === 'safety_hover') {
    // Central Light anchor
    drawMiniLight(ctx, cx, cy, r * 0.4);

    // Ice top-right
    const trx = cx + r * 0.55;
    const tryY = cy - r * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.27 * Math.SQRT1_2, cy - r * 0.27 * Math.SQRT1_2);
    ctx.lineTo(trx, tryY);
    ctx.stroke();
    drawMiniIce(ctx, trx, tryY, r * 0.21);

    // Fire bottom-left
    const blex = cx - r * 0.55;
    const bley = cy + r * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.27 * Math.SQRT1_2, cy + r * 0.27 * Math.SQRT1_2);
    ctx.lineTo(blex, bley);
    ctx.stroke();
    drawMiniFire(ctx, blex, bley, r * 0.21);
  } else if (spellId === 'petrification') {
    // Double pentagonal central lines mapping connections
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    const starPts: { x: number; y: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      starPts.push({
        x: cx + r * 0.52 * Math.cos(ang),
        y: cy + r * 0.52 * Math.sin(ang),
      });
    }
    ctx.beginPath();
    ctx.moveTo(starPts[0].x, starPts[0].y);
    ctx.lineTo(starPts[2].x, starPts[2].y);
    ctx.lineTo(starPts[4].x, starPts[4].y);
    ctx.lineTo(starPts[1].x, starPts[1].y);
    ctx.lineTo(starPts[3].x, starPts[3].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 3 Ice nodes at: top (0), bottom-right (2), bottom-left (3)
    drawMiniIce(ctx, starPts[0].x, starPts[0].y, r * 0.17);
    drawMiniIce(ctx, starPts[2].x, starPts[2].y, r * 0.17);
    drawMiniIce(ctx, starPts[3].x, starPts[3].y, r * 0.17);

    // 2 Plant nodes at: mid-right (1), mid-left (4)
    drawMiniPlant(ctx, starPts[1].x, starPts[1].y, r * 0.17);
    drawMiniPlant(ctx, starPts[4].x, starPts[4].y, r * 0.17);
  } else if (spellId === 'monster_arm') {
    // 45-degree rotated diamond inner grid
    const sqPts = [
      { x: cx, y: cy - r * 0.52 },
      { x: cx + r * 0.52, y: cy },
      { x: cx, y: cy + r * 0.52 },
      { x: cx - r * 0.52, y: cy },
    ];
    ctx.beginPath();
    ctx.moveTo(sqPts[0].x, sqPts[0].y);
    sqPts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.stroke();

    // Diagonal crossing stems
    ctx.beginPath();
    ctx.moveTo(sqPts[0].x, sqPts[0].y);
    ctx.lineTo(sqPts[2].x, sqPts[2].y);
    ctx.moveTo(sqPts[1].x, sqPts[1].y);
    ctx.lineTo(sqPts[3].x, sqPts[3].y);
    ctx.stroke();

    // 2 Plant nodes (top, bottom) & 2 Fire nodes (right, left)
    drawMiniPlant(ctx, sqPts[0].x, sqPts[0].y, r * 0.18);
    drawMiniPlant(ctx, sqPts[2].x, sqPts[2].y, r * 0.18);
    drawMiniFire(ctx, sqPts[1].x, sqPts[1].y, r * 0.18);
    drawMiniFire(ctx, sqPts[3].x, sqPts[3].y, r * 0.18);
  } else if (spellId === 'teleportation') {
    // Complex concentric parent-child orbit
    drawMiniFire(ctx, cx, cy, r * 0.35);

    // Alignment alignment rays
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy);
    ctx.lineTo(cx + r * 0.9, cy);
    ctx.moveTo(cx, cy - r * 0.9);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.stroke();
    ctx.restore();

    // 4 satellite interlocking matrix nodes
    const satLocs = [
      { x: cx, y: cy - r * 0.62, type: 'light' },
      { x: cx + r * 0.62, y: cy, type: 'ice' },
      { x: cx, y: cy + r * 0.62, type: 'plant' },
      { x: cx - r * 0.62, y: cy, type: 'fire' },
    ];
    satLocs.forEach((sat) => {
      ctx.beginPath();
      ctx.arc(sat.x, sat.y, r * 0.16, 0, Math.PI * 2);
      ctx.stroke();

      if (sat.type === 'light') {drawMiniLight(ctx, sat.x, sat.y, r * 0.15);}
      else if (sat.type === 'ice') {drawMiniIce(ctx, sat.x, sat.y, r * 0.15);}
      else if (sat.type === 'plant') {drawMiniPlant(ctx, sat.x, sat.y, r * 0.15);}
      else if (sat.type === 'fire') {drawMiniFire(ctx, sat.x, sat.y, r * 0.15);}
    });
  }

  ctx.restore();
}
