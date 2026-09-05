/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Spell } from '../core/types';
import { MAX_PARTICLES } from './constants';
import type { EffectLayer, EffectKind } from '../effects';
import type { EngineEntity } from './sim/types';
import type { SimState } from './sim/state';

// ---------------------------------------------------------------------------
// Cast-time spell spawners + activation burst + clear-canvas semantics.
//
// activateTriggerSpell is the single funnel for every successful cast. It
// fires the WebGL effect layer when the cast spell is mapped to a shader kind
// and the layer accepts the request (returns true) — in that case the legacy
// 2D entity/particle spawner for that spell is SKIPPED, while the cast
// transition, success sound, notification and 2D activation-burst sparks still
// run so the moment keeps its tactile feedback under the shader overlay.
// When the layer is unsupported, saturated or the spell has no shader kind,
// the legacy 2D branch runs exactly as before.
// ---------------------------------------------------------------------------

/** Effects layer callbacks; the component builds this object per mount. */
export interface EffectHost {
  /** Lazily-constructed WebGL effect layer, or null when unavailable. */
  layer: EffectLayer | null;
  /** EFFECT_SPELL_MAP lookup (kept out of the import graph for testability). */
  kindFor: (spellId: string) => EffectKind | undefined;
}

/** Cast-origin geometry in CSS pixels, computed once by the caller. */
export interface CastOrigin {
  x: number;
  y: number;
  /** Logical CSS-pixel canvas box for the shader's iResolution. */
  width: number;
  height: number;
}

/**
 * Radial sparks + expanding shockwave ring at the cast origin. Mirrors the
 * monolith's spawnActivationBurst (26 sparks, plus one ring entity capped by
 * the particle ceiling check on the sparks only — the ring always spawns).
 */
export function spawnActivationBurst(sim: SimState, x: number, y: number, color: string) {
  if (sim.particles.length < MAX_PARTICLES) {
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1;
      sim.particles.push({
        id: Math.random().toString(),
        type: Math.random() < 0.6 ? 'spark' : 'sparkle',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        size: Math.random() * 3 + 1.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 22 + Math.random() * 16,
      });
    }
  }

  sim.entities.push({
    id: Math.random().toString(),
    type: 'light_sphere',
    x,
    y,
    size: 10,
    color,
    maxLife: 36,
    data: { isRing: true, baseRadius: 12, age: 0 },
  });
}

/**
 * Master cast funnel. `origin` is the CSS-pixel cast centroid + canvas box.
 * `spellToCast` has already been resolved by the caller. Returns true when the
 * WebGL layer consumed the cast (legacy 2D spawn skipped); false otherwise.
 */
export function activateTriggerSpell(
  sim: SimState,
  spellToCast: Spell,
  origin: CastOrigin,
  effects: EffectHost
): boolean {
  const { x: castX, y: castY, width: w, height: h } = origin;

  // --- Effects-layer seam: real WebGL burst first ---------------------------
  const kind = effects.kindFor(spellToCast.id);
  const effectLayer = effects.layer;
  if (kind && effectLayer && effectLayer.supported) {
    const started = effectLayer.request(spellToCast.id, kind, { x: castX, y: castY, width: w, height: h });
    if (started) {
      // Shader owns the elemental burst: skip the legacy 2D spawner below.
      return true;
    }
  }

  // --- Legacy 2D spawner -----------------------------------------------------
  spawnLegacySpell(sim, spellToCast.id, castX, castY, w, h, spellToCast.color);
  return false;
}

/**
 * The original per-spell spawner switch, moved body-identical.
 * `spawnActivationBurst` is invoked by the caller (before this) exactly once
 * per activation; it is NOT repeated here.
 */
function spawnLegacySpell(
  sim: SimState,
  spellId: string,
  castX: number,
  castY: number,
  w: number,
  h: number,
  color: string
) {
  const push = (e: EngineEntity) => sim.entities.push(e);

  switch (spellId) {
    case 'light':
      // Light golden spheres
      push({
        id: Math.random().toString(),
        type: 'light_sphere',
        x: castX,
        y: castY,
        size: 35 + Math.random() * 15,
        vx: Math.random() * 1.2 - 0.6,
        vy: -Math.random() * 0.8 - 0.2,
        color,
        data: {},
      });
      break;

    case 'ice':
      // Growth jagged pillars side-by-side
      push({
        id: Math.random().toString(),
        type: 'ice_pillar',
        x: castX,
        y: h, // Rise from floor level
        size: 130 + Math.random() * 50,
        color,
        data: { height: 0, velocity: 0 },
      });
      break;

    case 'plant':
      // Proc botanical sprout vines
      push({
        id: Math.random().toString(),
        type: 'plant_vine',
        x: castX,
        y: h, // start bottom anchor
        size: 12 + Math.floor(Math.random() * 8), // joints count
        color,
        data: { joints: [{ x: castX, y: h }] },
      });
      break;

    case 'fire': {
      // Launch blazing combustion meteors
      for (let meteors = 0; meteors < 3; meteors++) {
        push({
          id: Math.random().toString(),
          type: 'fireball',
          x: castX,
          y: castY,
          size: 20 + Math.random() * 10,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 5 - 2,
          color,
          life: 0,
          maxLife: 150 + Math.random() * 50,
        });
      }
      break;
    }

    case 'sleep_mist':
      // Spawns 25 lavender cloud nodes filling screen
      for (let mist = 0; mist < 25; mist++) {
        sim.particles.push({
          id: Math.random().toString(),
          type: 'mist',
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.4,
          size: 80 + Math.random() * 80,
          color,
          alpha: 0.55,
          life: 0,
          maxLife: 600 + Math.random() * 200,
        });
      }
      break;

    case 'wind_vortex':
      // Vortex tornado
      push({
        id: 'tornado-vortex',
        type: 'light_sphere',
        x: castX,
        y: castY,
        size: 120,
        vx: 0,
        vy: 0,
        color,
        data: { isVortex: true },
      });
      break;

    case 'invisibility':
      // Shroud opacity refraction lens (state transitioned by the caller)
      break;

    case 'safety_hover':
      // Gravity bubble shield
      push({
        id: Math.random().toString(),
        type: 'light_sphere',
        x: castX,
        y: castY,
        size: 180,
        vx: 0,
        vy: 0,
        color,
        data: { isGravityBubble: true },
      });
      break;

    case 'petrification':
      // Freeze and calcify plants/fire into stone. The original monolith set
      // isStone on EVERY plant_vine + light_sphere (rings, vortex funnels and
      // gravity bubbles included — the bag spread was unconditional). Nothing
      // reads isStone off a light_sphere for rendering/behavior (only the
      // ice_pillar and plant_vine renderers grey out), but the flag layout
      // below matches the original scope exactly so the model is identical.
      sim.entities.forEach((e) => {
        if (e.type === 'plant_vine' || e.type === 'light_sphere') {
          e.data.isStone = true;
        }
      });
      break;

    case 'monster_arm':
      // Sprout IK arm attachment
      push({
        id: 'mutation-arm',
        type: 'plant_vine',
        x: w * 0.15,
        y: h,
        size: 6,
        color,
        data: { isArm: true },
      });
      break;

    case 'teleportation': {
      // Teleport portal portals relocate helper seeds. Do not append, resets portal anchors
      const pA = sim.entities.find((e) => e.type === 'portal' && e.id === 'portal-a');
      const pB = sim.entities.find((e) => e.type === 'portal' && e.id === 'portal-b');
      if (pA && pB) {
        pA.x = castX - 100;
        pA.y = castY;
        pB.x = castX + 100;
        pB.y = castY;
      }
      break;
    }

    default:
      break;
  }
}
