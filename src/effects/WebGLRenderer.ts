/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One burst's WebGL renderer: owns its own <canvas> + WebGL1 context,
 * compiles/links the fullscreen program, runs the rAF loop with a capped
 * frame delta, applies the fade-in / fade-out envelope through a shared
 * `u_alpha` uniform, and tears everything down on completion.
 *
 * Also exports the compile-probe helper the registry uses to cache
 * per-kind shader compile success/failure (a single shared probe
 * context, so a failing kind never warns more than once).
 */

import type { CastBox } from './types';

/** Fixed fullscreen-triangle vertex shader (WebGL1, no attributes needed). */
const VERTEX_SHADER_SOURCE = [
  'attribute vec2 a_pos;',
  'void main() {',
  '  gl_Position = vec4(a_pos, 0.0, 1.0);',
  '}',
].join('\n');

/** Draws the clip-space triangle covering the whole viewport. */
const TRIANGLE = new Float32Array([-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]);

/** Seconds of the leading fade-in. */
const FADE_IN_SECONDS = 0.2;
/** Seconds of the trailing fade-out. */
const FADE_OUT_SECONDS = 0.5;

const MAX_PIXEL_RATIO = 2;

export interface BurstRendererDeps {
  /** Parent the burst canvas is appended to (must be positioned). */
  container: HTMLElement;
  /** Complete fragment shader source (uniforms + mainImage + main()). */
  fragmentSource: string;
  /** CSS-pixel cast box captured at request time. */
  cast: CastBox;
  /** Total play time in ms including the fade-out tail. */
  durationMs: number;
  /** Caller spell id, stored on the canvas for debugging. */
  spellId: string;
  /** Invoked exactly once when the burst ends for any reason. */
  onEnded: () => void;
}

interface UniformLocations {
  iTime: WebGLUniformLocation | null;
  iResolution: WebGLUniformLocation | null;
  iMouse: WebGLUniformLocation | null;
  u_castPos: WebGLUniformLocation | null;
  u_alpha: WebGLUniformLocation | null;
}

/** Attempts a WebGL1 context, falling back to the prefixed id. */
function acquireWebGL(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  const attributes: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
  };
  const gl = canvas.getContext('webgl', attributes);
  if (gl !== null) {
    return gl;
  }
  return canvas.getContext('experimental-webgl', attributes) as WebGLRenderingContext | null;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
  if (status) {
    return shader;
  }
  const log = gl.getShaderInfoLog(shader);
  if (log !== null && log.length > 0) {
    console.warn(`[effects] shader compile failed:\n${log}`);
  }
  gl.deleteShader(shader);
  return null;
}

function linkProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  if (vertex === null) {
    return null;
  }
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (fragment === null) {
    gl.deleteShader(vertex);
    return null;
  }
  const program = gl.createProgram();
  if (program === null) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
  if (!ok) {
    const log = gl.getProgramInfoLog(program);
    if (log !== null && log.length > 0) {
      console.warn(`[effects] program link failed:\n${log}`);
    }
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  // Shaders are fully consumed by the link; release the compile objects.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

/** Detaches the context from its canvas (helps the browser reclaim VRAM). */
function loseContext(gl: WebGLRenderingContext): void {
  const ext = gl.getExtension('WEBGL_lose_context');
  if (ext !== null) {
    ext.loseContext();
  }
}

/**
 * The shared probe context used for compile checks. Created lazily, kept
 * for the page lifetime; detached from any DOM element.
 */
let probeContext: WebGLRenderingContext | null = null;
let probeCanvas: HTMLCanvasElement | null = null;

function getProbeContext(): WebGLRenderingContext | null {
  if (probeContext !== null) {
    return probeContext;
  }
  if (probeCanvas === null) {
    probeCanvas = document.createElement('canvas');
  }
  probeContext = acquireWebGL(probeCanvas);
  return probeContext;
}

/** True when a WebGL1 context can be created at all. */
export function isWebGLAvailable(): boolean {
  return getProbeContext() !== null;
}

/**
 * Compiles + links `fragmentSource` against the fixed vertex shader on the
 * shared probe context. Caching the result per kind is the registry's job;
 * this only answers "does this exact source compile?".
 */
export function checkFragmentShaderCompiles(fragmentSource: string): boolean {
  const gl = getProbeContext();
  if (gl === null) {
    return false;
  }
  const program = linkProgram(gl, VERTEX_SHADER_SOURCE, fragmentSource);
  if (program === null) {
    return false;
  }
  gl.deleteProgram(program);
  return true;
}

export class BurstRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly deps: BurstRendererDeps;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private readonly locs: UniformLocations = {
    iTime: null,
    iResolution: null,
    iMouse: null,
    u_castPos: null,
    u_alpha: null,
  };

  private startedAtMs = 0;
  private elapsedMs = 0;
  private lastFrameMs = 0;
  private rafId: number | null = null;
  private ended = false;
  /** True once the burst was fully set up and its rAF loop is running. */
  private live = false;

  constructor(deps: BurstRendererDeps) {
    this.deps = deps;
    this.container = deps.container;
    this.canvas = this.buildCanvas();
    this.container.appendChild(this.canvas);
    try {
      const gl = acquireWebGL(this.canvas);
      if (gl === null) {
        throw new Error('WebGL context creation failed');
      }
      this.gl = gl;
      this.setupGL(gl);
    } catch (error) {
      this.teardown();
      throw error;
    }
  }

  private buildCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.effectSpell = this.deps.spellId;
    const style = canvas.style;
    style.position = 'absolute';
    style.left = '0';
    style.top = '0';
    style.width = '100%';
    style.height = '100%';
    style.pointerEvents = 'none';
    style.zIndex = '10';
    style.display = 'block';
    return canvas;
  }

  private setupGL(gl: WebGLRenderingContext): void {
    const { fragmentSource } = this.deps;
    const program = linkProgram(gl, VERTEX_SHADER_SOURCE, fragmentSource);
    if (program === null) {
      throw new Error('Fragment shader failed to link');
    }
    this.program = program;
    gl.useProgram(program);

    const aPos = gl.getAttribLocation(program, 'a_pos');
    if (aPos < 0) {
      throw new Error('a_pos attribute missing from vertex shader');
    }
    const buffer = gl.createBuffer();
    if (buffer === null) {
      throw new Error('Cannot allocate the fullscreen-triangle buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc = (name: string): WebGLUniformLocation | null =>
      gl.getUniformLocation(program, name);
    this.locs.iTime = loc('iTime');
    this.locs.iResolution = loc('iResolution');
    this.locs.iMouse = loc('iMouse');
    this.locs.u_castPos = loc('u_castPos');
    this.locs.u_alpha = loc('u_alpha');

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    // Stop cleanly if the GPU context dies (prevent default so the browser
    // may restore; we choose a clean teardown over a half-dead burst).
    const onContextLost = (event: Event): void => {
      event.preventDefault();
      this.dispose();
    };
    this.canvas.addEventListener('webglcontextlost', onContextLost);
    this.onContextLost = onContextLost;

    this.startedAtMs = performance.now();
    this.lastFrameMs = this.startedAtMs;
    this.live = true;
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Bound listener so dispose() can remove it again. */
  private onContextLost: EventListener | null = null;

  private frame = (now: number): void => {
    if (this.ended) {
      return;
    }
    const deltaMs = Math.min(Math.max(now - this.lastFrameMs, 0), 100);
    this.lastFrameMs = now;
    this.elapsedMs += deltaMs;
    const gl = this.gl;
    if (gl !== null) {
      this.syncBackingStore();
      if (this.canvas.width > 0 && this.canvas.height > 0) {
        this.renderFrame(gl);
      }
    }
    if (this.elapsedMs >= this.deps.durationMs) {
      this.dispose();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Keeps the drawing buffer matched to the container's CSS size × DPR. */
  private syncBackingStore(): void {
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    if (cssWidth <= 0 || cssHeight <= 0) {
      return;
    }
    const ratio = Math.min(
      MAX_PIXEL_RATIO,
      Math.max(1, window.devicePixelRatio || 1),
    );
    const bufferWidth = Math.round(cssWidth * ratio);
    const bufferHeight = Math.round(cssHeight * ratio);
    if (this.canvas.width !== bufferWidth) {
      this.canvas.width = bufferWidth;
    }
    if (this.canvas.height !== bufferHeight) {
      this.canvas.height = bufferHeight;
    }
  }

  private renderFrame(gl: WebGLRenderingContext): void {
    const seconds = this.elapsedMs / 1000;
    const duration = this.deps.durationMs / 1000;
    const fadeIn = Math.min(1, seconds / FADE_IN_SECONDS);
    const fadeOut = Math.min(
      1,
      Math.max(0, (duration - seconds) / FADE_OUT_SECONDS),
    );
    const alpha = Math.min(fadeIn, fadeOut);

    const { cast } = this.deps;
    const normalisedX = cast.width > 0 ? Math.min(1, Math.max(0, cast.x / cast.width)) : 0;
    const normalisedY = cast.height > 0 ? Math.min(1, Math.max(0, cast.y / cast.height)) : 0;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.locs.iTime !== null) {
      gl.uniform1f(this.locs.iTime, seconds);
    }
    if (this.locs.iResolution !== null) {
      gl.uniform2f(this.locs.iResolution, w, h);
    }
    if (this.locs.iMouse !== null) {
      gl.uniform4f(this.locs.iMouse, cast.x, cast.y, 0, 0);
    }
    if (this.locs.u_castPos !== null) {
      gl.uniform2f(this.locs.u_castPos, normalisedX, normalisedY);
    }
    if (this.locs.u_alpha !== null) {
      gl.uniform1f(this.locs.u_alpha, alpha);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Stops the loop, releases GL resources and detaches the canvas. */
  dispose(): void {
    this.teardown();
  }

  private teardown(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const gl = this.gl;
    if (gl !== null) {
      if (this.program !== null) {
        gl.deleteProgram(this.program);
        this.program = null;
      }
      loseContext(gl);
      this.gl = null;
    }
    if (this.onContextLost !== null) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
      this.onContextLost = null;
    }
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
    if (this.live) {
      this.live = false;
      this.deps.onEnded();
    }
  }
}
