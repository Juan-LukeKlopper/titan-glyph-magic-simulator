/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Canvas sizing + Hi-DPI + 2D context helpers.
//
// The canvas backing store is sized in *device* pixels (capped at 2x) while
// every simulation & draw calculation in the engine stays in *CSS* pixel
// space. Each frame the loop applies ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
// right after the raw-pixel background fill, so pointer coordinates
// (getBoundingClientRect-based) and drawing coordinates agree 1:1.

/** Maximum device-pixel-ratio multiplier for the backing store (fill-rate cap). */
export const DPR_CAP = 2;

/** A live handle the engine uses to read surface + frame state each tick. */
export interface CanvasSurface {
  readonly canvas: HTMLCanvasElement;
  /** Current dpr the backing store was sized with. */
  readonly dpr: number;
  /** Logical CSS-pixel width of the drawing surface. */
  readonly width: number;
  /** Logical CSS-pixel height of the drawing surface. */
  readonly height: number;
  readonly ctx: CanvasRenderingContext2D;
}

/** Lazily resolve the 2D context of a canvas (the loop bails out if null). */
export function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d');
}

/** Resize the backing store to the container box in CSS pixels, capped at 2x. */
export function resizeCanvasToBox(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  return dpr;
}

/** Builds a fresh surface handle after a resize. */
export function createSurface(canvas: HTMLCanvasElement, dpr: number): CanvasSurface | null {
  const ctx = get2DContext(canvas);
  if (!ctx) {return null;}
  const width = Math.round(canvas.width / dpr);
  const height = Math.round(canvas.height / dpr);
  return { canvas, dpr, width, height, ctx };
}
