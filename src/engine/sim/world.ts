/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { mystSynth } from '../../core/audio/synth';
import type { EngineEntity } from './types';
import type { SimState } from './state';

/**
 * Clear-canvas semantics: keep persistent portals, wipe everything else
 * (entities, particles, invisibility). The caller also clears the React
 * stroke state — this only touches the simulation world.
 */
export function clearSimulationWorld(sim: SimState) {
  sim.entities = sim.entities.filter((e) => e.type === 'portal'); // Keep portal, wipe rest
  sim.particles = [];
  sim.isInvisActive = false;
}

/**
 * Releases drag state on an entity and clears the drag handle. Mirrors the
 * monolith's cancelActiveStroke bookkeeping (kept here so pointer + blur paths
 * share one implementation).
 */
export function releaseDrag(sim: SimState) {
  const draggedId = sim.dragEntityId;
  if (draggedId) {
    const dragged = sim.entities.find((ent) => ent.id === draggedId);
    if (dragged) {
      if (dragged.type === 'light_sphere') {dragged.data.isDragged = false;}
      else if (dragged.type === 'portal') {dragged.data.isDragged = false;}
    }
    sim.dragEntityId = null;
  }
}

/**
 * Click-to-shatter an ice pillar (or petrified stone). Plays the ice-sprout
 * crunch, spawns 10 falling shard particles, and removes the pillar.
 */
export function shatterPillar(sim: SimState, pillar: EngineEntity, canvasHeight: number) {
  if (pillar.type !== 'ice_pillar') {return;}

  // Play shatter noise
  mystSynth.playIceSprout();
  // Spawn falling shattering triangle ice blocks
  for (let shard = 0; shard < 10; shard++) {
    sim.particles.push({
      id: Math.random().toString(),
      type: 'spark', // Bounces and falls
      x: pillar.x + (Math.random() * 40 - 20),
      y: canvasHeight - Math.random() * pillar.data.height,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4 - 1,
      size: Math.random() * 12 + 6,
      color: pillar.data.isStone ? '#636E72' : '#74B9FF',
      alpha: 1,
      life: 0,
      maxLife: 80 + Math.random() * 40,
    });
  }
  // Delete pillar
  sim.entities = sim.entities.filter((e) => e.id !== pillar.id);
}
