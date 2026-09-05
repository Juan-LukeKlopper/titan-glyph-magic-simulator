/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Point } from '../core/types';
import type { SimState } from './sim/state';
import { shatterPillar } from './sim/world';

/**
 * Pointer input helpers: canvas->CSS-pixel coordinate math, click-to-drag /
 * click-to-shatter hit-testing, pointer-capture helpers and stroke-abort
 * bookkeeping. Pure DOM-free math except where noted.
 */

/** Converts a client-space pointer event to CSS pixels within the canvas box. */
export function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect
): Point {
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Finds a portable (non-vortex / non-arm) entity under the cursor, if any. */
export function findDraggableEntity(
  sim: SimState,
  x: number,
  y: number
): SimState['entities'][number] | null {
  return (
    sim.entities.find((ent) => {
      if (ent.type === 'light_sphere' || ent.type === 'portal') {
        const dx = ent.x - x;
        const dy = ent.y - y;
        return Math.sqrt(dx * dx + dy * dy) < ent.size;
      }
      return false;
    }) ?? null
  );
}

/** True when the point sits on a shatterable ice pillar (typed payload). */
export function findShatterablePillar(
  sim: SimState,
  x: number,
  y: number,
  canvasHeight: number
): SimState['entities'][number] | null {
  return (
    sim.entities.find((ent) => {
      if (ent.type !== 'ice_pillar') {return false;}
      const distToFloor = canvasHeight - y;
      return Math.abs(ent.x - x) < 40 && distToFloor < ent.data.height;
    }) ?? null
  );
}

/**
 * Marks an entity as dragged, releasing any prior drag first. Monster arms are
 * never draggable (they are driven by the IK loop).
 */
export function beginEntityDrag(sim: SimState, entityId: string) {
  const entity = sim.entities.find((e) => e.id === entityId);
  if (!entity) {return;}
  if (entity.type === 'light_sphere') {entity.data.isDragged = true;}
  else if (entity.type === 'portal') {entity.data.isDragged = true;}
  sim.dragEntityId = entityId;
}

/** Move the dragged entity to a pointer position (no-op when none dragged). */
export function moveDraggedEntity(sim: SimState, x: number, y: number) {
  const entity = sim.entities.find((e) => e.id === sim.dragEntityId);
  if (!entity) {return;}
  entity.x = x;
  entity.y = y;
}

/** Releases the pointer capture taken on pointerdown; harmless if none held. */
export function releasePointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number
) {
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
}

/** Aborts the active gesture (stroke or drag) without a cast or score. */
export function cancelActiveStroke(sim: SimState) {
  if (sim.dragEntityId) {
    const dragged = sim.entities.find((ent) => ent.id === sim.dragEntityId);
    if (dragged) {
      if (dragged.type === 'light_sphere') {dragged.data.isDragged = false;}
      else if (dragged.type === 'portal') {dragged.data.isDragged = false;}
    }
    sim.dragEntityId = null;
  }
  // The caller (component) mirrors the React isDrawing/currentStroke state;
  // sim.strokes.current is cleared there as well.
  sim.strokes.current = [];
}

/** Click-to-shatter dispatcher shared by pointer-down handlers. */
export function handleShatterClick(
  sim: SimState,
  x: number,
  y: number,
  canvasHeight: number
) {
  const pillar = findShatterablePillar(sim, x, y, canvasHeight);
  if (pillar) {
    shatterPillar(sim, pillar, canvasHeight);
    return true;
  }
  return false;
}
