/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Point } from '../../core/types';
import { mystSynth } from '../../core/audio/synth';
import type { EngineEntity, FrameContext } from './types';
import { isArmVine, makeLeaf } from './types';
import type { SimState } from './state';
import { computeFrameFlags } from './state';

/**
 * Layers 3 & 4 of the frame: per-entity update + render, element-on-element
 * reactions (fire melts ice / burns vines), and the monster-arm IK chain with
 * claw capture.
 *
 * All coordinates are CSS pixels (dpr transform already applied by the loop).
 * Entity state lives on the discriminated-union payloads (`data`), so no
 * untyped custom bags are ever touched here.
 */

/** Monster arm configuration (frozen from the monolith). */
const ARM_SEGMENTS = 6;
const ARM_LENGTH_LIMIT = 42;
const ARM_ANCHOR_X_FRACTION = 0.15;

/** Update + render every entity, then compact the world array. */
export function updateAndRenderEntities(sim: SimState, frame: FrameContext) {
  const { ctx, w, h } = frame;
  const flags = computeFrameFlags(sim);
  const now = Date.now();

  const nextEntities: EngineEntity[] = [];

  sim.entities.forEach((ent) => {
    const isPetrified =
      (ent.type === 'light_sphere' && ent.data.isStone === true) ||
      (ent.type === 'ice_pillar' && ent.data.isStone === true) ||
      (ent.type === 'plant_vine' && ent.data.isStone === true);

    switch (ent.type) {
      case 'light_sphere': {
        // Natural drifting float
        if (!ent.data.isDragged) {
          const driftY = flags.isSafetyHoverActive ? -0.2 : (ent.vy ?? -0.4);
          ent.y += driftY;
          ent.x += ent.vx ?? 0;
          // Gentle wave
          ent.x += Math.sin(now * 0.003 + ent.size) * 0.15;

          // Bound bounce
          if (ent.x - ent.size < 0 || ent.x + ent.size > w) {
            ent.vx = -(ent.vx ?? 0);
          }
          if (ent.y - ent.size < 0) {
            ent.y = h + ent.size; // wrap to bottom
          }
        }

        // Wind Force reaction
        if (flags.activeVortex && !ent.data.isDragged && !ent.data.isVortex) {
          const dx = flags.activeVortex.x - ent.x;
          const dy = flags.activeVortex.y - ent.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 350) {
            // Circular pull
            ent.vx = (ent.vx ?? 0) * 0.9 + (dy / d) * 1.5 + (dx / d) * 0.8;
            ent.vy = (ent.vy ?? 0) * 0.9 - (dx / d) * 1.5 + (dy / d) * 0.8;
          }
        }

        // Expanding activation shockwave rings ride the light_sphere type.
        // They never drift or pulse: they simply grow from baseRadius and fade.
        if (ent.data.isRing) {
          const baseRadius = ent.data.baseRadius ?? 12;
          const age = (ent.data.age ?? 0) + 0.06;
          ent.data.age = age;
          const ringRadius = baseRadius + age * 8;
          const ringAlpha = Math.max(0, 1 - age);
          ctx.save();
          ctx.globalAlpha = ringAlpha;
          ctx.strokeStyle = ent.color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = ent.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(ent.x, ent.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          // Self-removing once the shockwave expands past its useful range
          // (a few frames after alpha hits zero).
          if (age >= 1.2) {
            return; // cull
          }
          nextEntities.push(ent);
          return;
        }

        // Subtle breathing pulse
        const lightPulse = 1 + 0.06 * Math.sin(now * 0.004 + ent.x * 0.01);

        // Draw glowing orbit sphere
        const radG = ctx.createRadialGradient(ent.x, ent.y, 2, ent.x, ent.y, ent.size * lightPulse);
        radG.addColorStop(0, '#FFFFFF');
        radG.addColorStop(0.3, ent.color);
        radG.addColorStop(1, 'rgba(254, 211, 48, 0)');

        ctx.fillStyle = radG;
        ctx.beginPath();
        ctx.arc(ent.x, ent.y, ent.size * lightPulse, 0, Math.PI * 2);
        ctx.fill();

        // Four-point star glints: two thin crossing lines rotating slowly
        ctx.save();
        ctx.translate(ent.x, ent.y);
        ctx.rotate(now * 0.0004);
        const glintLen = ent.size * lightPulse * 1.35;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        for (let glint = 0; glint < 2; glint++) {
          ctx.beginPath();
          ctx.moveTo(-glintLen, 0);
          ctx.lineTo(glintLen, 0);
          ctx.stroke();
          ctx.rotate(Math.PI / 2);
        }
        ctx.restore();

        // Spawn ambient sparkling stars
        if (Math.random() < 0.08) {
          sim.particles.push({
            id: Math.random().toString(),
            type: 'sparkle',
            x: ent.x + (Math.random() * 20 - 10),
            y: ent.y + (Math.random() * 20 - 10),
            vx: Math.random() * 0.6 - 0.3,
            vy: Math.random() * -0.5,
            size: Math.random() * 3 + 1,
            color: ent.color,
            alpha: 1,
            life: 0,
            maxLife: 40 + Math.random() * 30,
          });
        }

        // Gorgeous high-fidelity procedural wind funnel (tornado) with multiple swirling layers
        if (ent.data.isVortex) {
          renderVortexFunnel(ctx, ent, now);
        }
        break;
      }

      case 'ice_pillar': {
        // Spring-damped growth with an 8% overshoot past target before settling.
        // Pillars are always spawned with { height: 0 }; the typed payload
        // guarantees the fields exist, so no malformed-entity guard is needed.
        if (!ent.data.settled) {
          const targetH = ent.size;
          const overshootTarget = targetH * 1.08;
          const vel = ent.data.velocity + 2.5;
          ent.data.height += vel;
          ent.data.velocity = vel;
          if (ent.data.height >= overshootTarget) {
            ent.data.settled = true;
          }
        } else {
          const targetH = ent.size;
          const displacement = ent.data.height - targetH;
          const springVel = (ent.data.velocity - displacement * 0.12) * 0.82;
          ent.data.velocity = springVel;
          ent.data.height += springVel;
          if (Math.abs(displacement) < 0.5 && Math.abs(springVel) < 0.5) {
            ent.data.height = targetH;
            ent.data.velocity = 0;
          }
        }
        // Drawing jagged crystalline geometries
        ctx.fillStyle = isPetrified ? '#636E72' : ent.color;
        ctx.strokeStyle = isPetrified ? '#2D3436' : '#EBF8FF';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        const leftX = ent.x - 25;
        const rightX = ent.x + 25;
        const topY = ent.y - ent.data.height;

        ctx.moveTo(ent.x, ent.y);
        ctx.lineTo(leftX, ent.y);
        ctx.lineTo(leftX + 4, ent.y - ent.data.height * 0.3);
        ctx.lineTo(ent.x - 10, ent.y - ent.data.height * 0.7);
        ctx.lineTo(ent.x, topY); // top apex
        ctx.lineTo(ent.x + 12, ent.y - ent.data.height * 0.6);
        ctx.lineTo(rightX, ent.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Facet line highlights
        ctx.beginPath();
        ctx.moveTo(ent.x - 10, ent.y - ent.data.height * 0.7);
        ctx.lineTo(ent.x + 12, ent.y - ent.data.height * 0.6);
        ctx.stroke();

        // Little frost dust flakes
        if (Math.random() < 0.05 && ent.data.height >= ent.size) {
          sim.particles.push({
            id: Math.random().toString(),
            type: 'frost',
            x: ent.x + (Math.random() * 40 - 20),
            y: topY + Math.random() * 15,
            vx: Math.random() * 0.4 - 0.2,
            vy: Math.random() * 0.3,
            size: Math.random() * 2 + 1,
            color: '#DFF9FB',
            alpha: 0.8,
            life: 0,
            maxLife: 50,
          });
        }
        break;
      }

      case 'plant_vine': {
        // Monster arms never grow or self-render here: the loop's dedicated
        // IK stage (renderMonsterArm) owns their joints + visuals.
        if (ent.data.isArm) {
          break;
        }
        // Update botanical joints (procedural organic growth animation)
        const joints = ent.data.joints;
        if (!joints) {break;}
        const maxLength = ent.size;

        if (joints.length < maxLength && !isPetrified) {
          const lastJoint = joints[joints.length - 1];
          // Grow climbing branches upward with sine waves
          const angleOffset = Math.sin(joints.length * 0.6 + now * 0.004) * 0.25;
          const growAngle = -Math.PI / 2 + angleOffset;
          // Ease-out: growth steps shrink as the vine approaches full length
          const nextLen = 14 - (joints.length / maxLength) * 8;
          const nextPt: Point = {
            x: lastJoint.x + Math.cos(growAngle) * nextLen,
            y: lastJoint.y + Math.sin(growAngle) * nextLen,
          };
          joints.push(nextPt);

          // Seed green leaves
          if (Math.random() < 0.35) {
            sim.particles.push(
              makeLeaf(nextPt.x, nextPt.y, ent.color, Math.random() * 6 + 4, 200)
            );
          }
        }

        // Render joint-by-joint vine branches
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = isPetrified ? '#636E72' : ent.color;
        ctx.lineWidth = 7;

        ctx.beginPath();
        joints.forEach((pt, jIdx) => {
          if (jIdx === 0) {ctx.moveTo(pt.x, pt.y);}
          else {ctx.lineTo(pt.x, pt.y);}
        });
        ctx.stroke();

        // Inner bark tube line
        ctx.strokeStyle = '#2D3436';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw little blossoming flowers at tip node
        if (joints.length >= 8) {
          const tip = joints[joints.length - 1];
          ctx.fillStyle = isPetrified ? '#2D3436' : '#FD79A8';
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
          ctx.fill();

          // Flower petals
          for (let petal = 0; petal < 5; petal++) {
            const angle = (petal / 5) * Math.PI * 2 + now * 0.001;
            ctx.fillStyle = isPetrified ? '#636E72' : '#FF7675';
            ctx.beginPath();
            ctx.arc(tip.x + Math.cos(angle) * 7, tip.y + Math.sin(angle) * 7, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case 'fireball': {
        // Fast launching balls
        // Muzzle-flash sparks burst at the moment of launch
        if (ent.life === 0) {
          for (let flash = 0; flash < 8; flash++) {
            const flashAngle = Math.random() * Math.PI * 2;
            const flashSpeed = Math.random() * 2.5 + 0.8;
            sim.particles.push({
              id: Math.random().toString(),
              type: 'spark',
              x: ent.x,
              y: ent.y,
              vx: Math.cos(flashAngle) * flashSpeed,
              vy: Math.sin(flashAngle) * flashSpeed,
              size: Math.random() * 3 + 1.5,
              color: '#FFEAA7',
              alpha: 1,
              life: 0,
              maxLife: 14 + Math.random() * 10,
            });
          }
        }
        ent.x += ent.vx ?? 4;
        ent.y += ent.vy ?? -2;

        // Simple gravity/slow
        if (flags.isSleepMistActive) {
          ent.x -= (ent.vx ?? 4) * 0.4;
          ent.y -= (ent.vy ?? -2) * 0.4;
        }

        // Boundary collision
        if (ent.x - ent.size < 0 || ent.x + ent.size > w) {
          ent.vx = -(ent.vx ?? 4) * 0.9;
          mystSynth.playDrawingHum(300); // trigger dynamic pitch hum on collision
        }
        if (ent.y - ent.size < 0 || ent.y + ent.size > h) {
          ent.vy = -(ent.vy ?? -2) * 0.9;
        }

        // Render highly stylized real fire shape with procedural curves and cometary tails
        renderFireball(ctx, ent);

        // Spawn smoke and flame tail trails
        sim.particles.push({
          id: Math.random().toString(),
          type: 'flame',
          x: ent.x,
          y: ent.y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 8 + 4,
          color: ent.color,
          alpha: 0.9,
          life: 0,
          maxLife: 25 + Math.random() * 15,
        });

        // Spark combustion life decay timer
        ent.life = (ent.life ?? 0) + 1;
        if (ent.life > (ent.maxLife ?? 180)) {
          // Explode on expiration
          mystSynth.playFireExplosion();
          for (let exp = 0; exp < 18; exp++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            sim.particles.push({
              id: Math.random().toString(),
              type: 'spark',
              x: ent.x,
              y: ent.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: Math.random() * 6 + 2,
              color: '#FF7675',
              alpha: 1,
              life: 0,
              maxLife: 30 + Math.random() * 20,
            });
          }
          return; // cull this fireball
        }
        break;
      }

      case 'portal': {
        // Keep persistent. Animate spatial rotation
        ent.data.angle += 0.045;
        // Organic wobble: gentle vertical squash/stretch oscillation
        const squashY = 1 + Math.sin(now * 0.0021) * 0.04;

        // Apply the wobble inside a save/restore so the transform never
        // leaks into subsequent entity drawing or the next frame.
        ctx.save();
        ctx.translate(ent.x, ent.y);
        ctx.scale(1, squashY);
        ctx.translate(-ent.x, -ent.y);

        // 1. Swirling dimensional distortion shadow
        ctx.shadowColor = ent.color;
        ctx.shadowBlur = 18;

        // Draw a spinning outer portal frame
        const pulse = 1.0 + Math.sin(now * 0.003) * 0.05;
        const size = ent.size * pulse;

        // Gradient line border
        const lineGrad = ctx.createLinearGradient(ent.x - size, ent.y - size, ent.x + size, ent.y + size);
        lineGrad.addColorStop(0, ent.color);
        lineGrad.addColorStop(0.5, '#FFF');
        lineGrad.addColorStop(1, '#9B59B6'); // purple wisp overlay
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ent.x, ent.y, size, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Translucent vortex deep background
        const radialPortal = ctx.createRadialGradient(ent.x, ent.y, 2, ent.x, ent.y, size);
        radialPortal.addColorStop(0, 'rgba(10, 10, 15, 0.98)');
        radialPortal.addColorStop(0.5, 'rgba(44, 44, 84, 0.92)');
        radialPortal.addColorStop(0.85, 'rgba(129, 236, 236, 0.45)');
        radialPortal.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radialPortal;
        ctx.beginPath();
        ctx.arc(ent.x, ent.y, size * 0.98, 0, Math.PI * 2);
        ctx.fill();

        // 3. Mathematical vortex spiral streaks (resembling a real spacetime warp shader)
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5;
        const spiralSlices = 62;
        const loops = 1.6;
        ctx.beginPath();
        for (let i = 0; i < spiralSlices; i++) {
          const t = i / (spiralSlices - 1);
          const r = t * size * 0.92;
          const a = t * Math.PI * 2 * loops + ent.data.angle * 2;
          const px = ent.x + Math.cos(a) * r;
          const py = ent.y + Math.sin(a) * r;

          // Fade color closer to center
          ctx.strokeStyle = `rgba(129, 236, 236, ${t * 0.6})`;
          if (i === 0) {ctx.moveTo(px, py);}
          else {ctx.lineTo(px, py);}
        }
        ctx.stroke();

        // 4. Secondary reversing spiral wisp (offset phase and purple tint)
        ctx.beginPath();
        for (let i = 0; i < spiralSlices; i++) {
          const t = i / (spiralSlices - 1);
          const r = t * size * 0.92;
          const a = t * Math.PI * 2 * loops - ent.data.angle * 2.5 + Math.PI;
          const px = ent.x + Math.cos(a) * r;
          const py = ent.y + Math.sin(a) * r;

          ctx.strokeStyle = `rgba(155, 89, 182, ${t * 0.5})`;
          if (i === 0) {ctx.moveTo(px, py);}
          else {ctx.lineTo(px, py);}
        }
        ctx.stroke();

        // Draw swirly portal outer notches
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        for (let Notch = 0; Notch < 5; Notch++) {
          const ringAngle = ent.data.angle + (Notch / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(ent.x, ent.y, size + 2, ringAngle, ringAngle + 0.3);
          ctx.stroke();
        }
        // Spawn portal vacuum dust particles
        if (Math.random() < 0.12) {
          const vacuumAngle = Math.random() * Math.PI * 2;
          const spawnDist = ent.size + 15;
          sim.particles.push({
            id: Math.random().toString(),
            type: 'portal_dust',
            x: ent.x + Math.cos(vacuumAngle) * spawnDist,
            y: ent.y + Math.sin(vacuumAngle) * spawnDist,
            // Vacuum pull velocity towards portal center
            vx: -Math.cos(vacuumAngle) * 0.8,
            vy: -Math.sin(vacuumAngle) * 0.8,
            size: Math.random() * 2 + 1,
            color: ent.color,
            alpha: 0.8,
            life: 0,
            maxLife: 20,
          });
        }
        ctx.restore();
        break;
      }
    }

    nextEntities.push(ent);
  });

  sim.entities = nextEntities;
}

/** Fireball mesh: procedural flame body + molten core, rotated with velocity. */
function renderFireball(ctx: CanvasRenderingContext2D, ent: Extract<EngineEntity, { type: 'fireball' }>) {
  ctx.save();
  ctx.translate(ent.x, ent.y);

  // Rotate the fireball to align with its velocity vector
  const vx = ent.vx ?? 4;
  const vy = ent.vy ?? -2;
  const angle = Math.atan2(vy, vx);
  ctx.rotate(angle + Math.PI); // face away from movement direction to show trailing fire

  const size = ent.size;
  const time = Date.now() * 0.015;

  ctx.shadowBlur = size * 1.5;
  ctx.shadowColor = '#FF3E3E';

  // Outer roaring plasma trail shell
  const outerG = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 1.8);
  outerG.addColorStop(0, 'rgba(255, 118, 117, 1)');
  outerG.addColorStop(0.4, 'rgba(235, 94, 40, 0.95)');
  outerG.addColorStop(0.7, 'rgba(214, 48, 49, 0.8)');
  outerG.addColorStop(1, 'rgba(214, 48, 49, 0)');

  ctx.fillStyle = outerG;
  ctx.beginPath();
  ctx.moveTo(0, 0);

  // Draw a gorgeous fluid flame tail stretching behind the movement
  ctx.bezierCurveTo(size, size * 1.1, size * 2.5, size * 1.2 + Math.sin(time) * 4, size * 3.2, 0); // Upper tail wisp
  ctx.bezierCurveTo(size * 2.5, -size * 1.2 + Math.cos(time) * 4, size, -size * 1.1, 0, 0); // Lower tail wisp
  ctx.arc(0, 0, size, Math.PI / 2, -Math.PI / 2, true); // Round head
  ctx.fill();

  // Inner molten white-hot energy core
  const innerG = ctx.createRadialGradient(-size * 0.15, 0, 1, -size * 0.15, 0, size * 0.95);
  innerG.addColorStop(0, '#FFFFFF');
  innerG.addColorStop(0.35, '#FFEAA7');
  innerG.addColorStop(0.7, 'rgba(253, 203, 110, 0.5)');
  innerG.addColorStop(1, 'rgba(253, 203, 110, 0)');

  ctx.fillStyle = innerG;
  ctx.beginPath();
  ctx.arc(-size * 0.15, 0, size * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Multi-layered procedural tornado funnel drawn around a vortex sphere. */
function renderVortexFunnel(
  ctx: CanvasRenderingContext2D,
  ent: Extract<EngineEntity, { type: 'light_sphere' }>,
  now: number
) {
  const ringCount = 15;
  const maxRadius = ent.size * 1.5;
  const tornadoHeight = 380;
  const time = now * 0.0035;

  ctx.save();

  // Draw swirling back-half layers first to create an immersive 3D overlap effect
  for (let i = ringCount - 1; i >= 0; i--) {
    const progress = i / (ringCount - 1); // bottom to top (0.0 to 1.0)
    const ringY = ent.y - progress * tornadoHeight;

    // Classic tapering tornado funnel shape (wider at the top, pinching near ground anchor)
    const shapeFactor = 0.25 + Math.pow(progress, 1.4) * 0.95;
    const rx = maxRadius * shapeFactor;
    const ry = rx * 0.26; // flattened elliptical 3D perspective

    // Dynamic breathing/bellowing pulse (blowing in and out!)
    const pulse = 1.0 + Math.sin(time * 0.8 + progress * Math.PI * 1.5) * 0.14;
    const finalRx = rx * pulse;
    const finalRy = ry * pulse;

    // Swirl angle speed
    const swirlAngle = time * 1.8 + progress * Math.PI;

    ctx.lineWidth = 1.2 + (1 - progress) * 3.5;

    // Layer 1: Cool cyan glowing wind currents
    ctx.strokeStyle = `rgba(129, 236, 236, ${0.08 + progress * 0.35})`;
    ctx.shadowColor = '#81ECEC';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(ent.x, ringY, finalRx, finalRy, swirlAngle, 0, Math.PI * 1.1);
    ctx.stroke();

    // Layer 2: White whipping speed-streaks (offset angle)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + progress * 0.25})`;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(ent.x, ringY, finalRx * 0.88, finalRy * 0.88, swirlAngle + Math.PI * 0.8, 0, Math.PI * 0.9);
    ctx.stroke();

    // Layer 3: Extra high-frequency whipping wisps
    if (i % 3 === 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(ent.x, ringY, finalRx * 1.04, finalRy * 1.04, -swirlAngle * 0.5, 0, Math.PI * 0.4);
      ctx.stroke();
    }
  }

  // Draw central vertical energy spire vacuum
  const spireG = ctx.createLinearGradient(ent.x, ent.y - tornadoHeight, ent.x, ent.y);
  spireG.addColorStop(0, 'rgba(129, 236, 236, 0.4)');
  spireG.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
  spireG.addColorStop(0.9, 'rgba(129, 236, 236, 0.5)');
  spireG.addColorStop(1, 'rgba(0, 206, 201, 0)');

  ctx.fillStyle = spireG;
  ctx.beginPath();
  ctx.moveTo(ent.x - 4, ent.y);
  ctx.quadraticCurveTo(ent.x - maxRadius * 0.2, ent.y - tornadoHeight * 0.5, ent.x - maxRadius * 0.6, ent.y - tornadoHeight);
  ctx.lineTo(ent.x + maxRadius * 0.6, ent.y - tornadoHeight);
  ctx.quadraticCurveTo(ent.x + maxRadius * 0.2, ent.y - tornadoHeight * 0.5, ent.x + 4, ent.y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// --- Element-on-element reactions ------------------------------------------

/**
 * Reactions run once per frame after entity updates (preserving the monolith's
 * scan: each fireball inspects every ice pillar / vine in the world).
 */
export function applyElementReactions(sim: SimState) {
  sim.entities.forEach((ent) => {
    if (ent.type !== 'fireball') {return;}

    sim.entities.forEach((targetEnt) => {
      if (targetEnt.type === 'ice_pillar') {
        const dx = targetEnt.x - ent.x;
        const dy = targetEnt.y - ent.y;
        const elementDist = Math.sqrt(dx * dx + dy * dy);
        if (elementDist < ent.size + 25) {
          // Melt Ice: shorten height
          if (targetEnt.data.height > 10) {
            targetEnt.data.height -= 12; // melt block
            // Trigger steam particles
            for (let steamIdx = 0; steamIdx < 3; steamIdx++) {
              sim.particles.push({
                id: Math.random().toString(),
                type: 'smoke',
                x: targetEnt.x,
                y: targetEnt.y - targetEnt.data.height,
                vx: Math.random() * 0.8 - 0.4,
                vy: -Math.random() * 1.5,
                size: Math.random() * 12 + 6,
                color: '#ECEFF1',
                alpha: 0.5,
                life: 0,
                maxLife: 60,
              });
            }
            mystSynth.playIceSprout(); // crack crunch sound
          } else {
            targetEnt.data.height = 0;
          }
        }
      }

      if (targetEnt.type === 'plant_vine') {
        // Compare joints coordinates of plants
        const joints = targetEnt.data.joints;
        if (joints) {
          joints.forEach((joint) => {
            const dx = joint.x - ent.x;
            const dy = joint.y - ent.y;
            const vineDist = Math.sqrt(dx * dx + dy * dy);
            if (vineDist < ent.size + 15) {
              // Fire consumes vine. Shrink vine segments from tip
              if (joints.length > 2) {
                joints.length = Math.max(2, joints.length - 2);
                // Spawn charcoal fire dust
                sim.particles.push({
                  id: Math.random().toString(),
                  type: 'flame',
                  x: joint.x,
                  y: joint.y,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: (Math.random() - 0.5) * 1.5,
                  size: Math.random() * 5 + 2,
                  color: '#E07A5F',
                  alpha: 0.9,
                  life: 0,
                  maxLife: 30,
                });
              }
            }
          });
        }
      }
    });
  });
}

// --- Monster arm (IK chain + claw capture) ----------------------------------

/**
 * Renders + simulates the monster arm. Anchored at (0.15w, h); 6 segments,
 * spring-follows the pointer; draws thick limb + glowing core + rotating claw
 * teeth, then sucks nearby particles into the palm.
 */
export function updateAndRenderMonsterArm(sim: SimState, frame: FrameContext) {
  const { ctx, w, h } = frame;
  const hasMonsterSpell = sim.entities.some(isArmVine);
  if (!hasMonsterSpell) {return;}

  const armColor = '#2F3542'; // Dark purplish abomination clay
  const targetX = sim.lastPointer.x;
  const targetY = sim.lastPointer.y;

  // Anchor at bottom-left corner
  const anchorX = w * ARM_ANCHOR_X_FRACTION;
  const anchorY = h;

  // Segment joints calculation (smoothed spring interpolation)
  let armJoints: Point[] = [];
  const existingArm = sim.entities.find(isArmVine);

  if (existingArm) {
    armJoints = existingArm.data.armJoints ?? [];
    if (armJoints.length === 0) {
      // Initialize joints points
      for (let seg = 0; seg < ARM_SEGMENTS; seg++) {
        armJoints.push({ x: anchorX, y: anchorY - seg * 40 });
      }
      existingArm.data.armJoints = armJoints;
    }
  } else {
    return; // monster entity vanished mid-frame; nothing to animate
  }

  // Kinematics solver: first segment follows anchor, last follows mouse with elastic tension
  armJoints[0] = { x: anchorX, y: anchorY };
  for (let seg = 1; seg < armJoints.length; seg++) {
    const prev = armJoints[seg - 1];
    const curr = armJoints[seg];

    // Vector pointing forward
    let dx = curr.x - prev.x;
    let dy = curr.y - prev.y;
    const angle = Math.atan2(dy, dx);

    // If last segment, drag towards target cursor
    if (seg === armJoints.length - 1) {
      const dragDx = targetX - curr.x;
      const dragDy = targetY - curr.y;
      // Smoothly move towards mouse with spring scale
      curr.x += dragDx * 0.12;
      curr.y += dragDy * 0.12;
    }

    // Force standard length separation (40px)
    dx = curr.x - prev.x;
    dy = curr.y - prev.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const limitDist = ARM_LENGTH_LIMIT;
    if (length > limitDist) {
      curr.x = prev.x + Math.cos(angle) * limitDist;
      curr.y = prev.y + Math.sin(angle) * limitDist;
    }
  }

  // Render thick abomination branch arm
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = armColor;
  ctx.lineWidth = 32;

  ctx.beginPath();
  armJoints.forEach((j, idx) => {
    if (idx === 0) {ctx.moveTo(j.x, j.y);}
    else {ctx.lineTo(j.x, j.y);}
  });
  ctx.stroke();

  // Inner glowing magic core
  ctx.strokeStyle = '#FEA47F';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Claw / Hand grabbing head
  const tipFinger = armJoints[armJoints.length - 1];
  ctx.fillStyle = '#FD9644';
  ctx.beginPath();
  ctx.arc(tipFinger.x, tipFinger.y, 14, 0, Math.PI * 2);
  ctx.fill();

  // Claw teeth
  const now = Date.now();
  for (let claw = 0; claw < 3; claw++) {
    const toothAngle = (claw / 3) * Math.PI * 2 + now * 0.003;
    ctx.fillStyle = '#D35400';
    ctx.beginPath();
    ctx.moveTo(tipFinger.x + Math.cos(toothAngle) * 12, tipFinger.y + Math.sin(toothAngle) * 12);
    ctx.lineTo(tipFinger.x + Math.cos(toothAngle + 0.5) * 22, tipFinger.y + Math.sin(toothAngle + 0.5) * 22);
    ctx.lineTo(tipFinger.x + Math.cos(toothAngle - 0.2) * 15, tipFinger.y + Math.sin(toothAngle - 0.2) * 15);
    ctx.fill();
  }

  // Claw captures loose floating light particles!
  sim.particles.forEach((p) => {
    const dx = p.x - tipFinger.x;
    const dy = p.y - tipFinger.y;
    const clawDist = Math.sqrt(dx * dx + dy * dy);
    if (clawDist < 80) {
      // vacuum snap towards hand claw
      p.vx += -dx * 0.05;
      p.vy += -dy * 0.05;
      if (clawDist < 18) {
        p.life = p.maxLife; // consume / absorb!
        mystSynth.playDrawingHum(440); // play high pitch pop
      }
    }
  });
}
