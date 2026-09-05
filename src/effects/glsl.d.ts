/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vite `?raw` suffix typing: allows the effect layer to import its GLSL
 * sources as plain strings (`import src from './glsl/fire.glsl?raw'`).
 * The `?raw` query is stripped by Vite's import analysis before emit, so
 * the runtime module id never reaches the filesystem.
 */
declare module '*.glsl?raw' {
  const src: string;
  export default src;
}
