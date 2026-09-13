# Titan's Glyph Grimoire

A browser-based spell-casting simulator inspired by _The Owl House_. Draw the
four primal glyphs on a canvas and watch them compile into magic. No account,
no backend, and no data leaves your device.

> **Fan project disclaimer:** This is an unofficial fan-made website. It is not
> affiliated with, endorsed by, sponsored by, or otherwise related to Disney or
> any of its subsidiaries. _The Owl House_ and all related characters, glyphs,
> art, and lore are the property of their respective owners. This project uses
> those elements solely as homage for non-commercial, educational purposes.

## Features

- **Hybrid gesture recognition:** a rotation-invariant point-cloud matcher that
  fuses chamfer distance with a soft-IoU occupancy-grid descriptor, plus
  single-stroke scribble defense (`src/core/recognizer.ts`).
- **Two casting modes:** Trace mode overlays a glyph guide and scores stroke
  accuracy; Sandbox mode lets you free-draw any element and compile it.
- **Spellbook:** 4 primal glyphs (Light, Ice, Plant, Fire) and combinatory
  arrays (Sleep Mist, Wind Vortex, Invisibility Shroud, Safety Hover,
  Petrification, Abomination Mutation, Titan Spatial Teleportation).
- **WebGL spell bursts:** every spell has its own GLSL fragment (light, ice,
  plant, fire, sleep mist, wind vortex, invisibility, safety hover,
  petrification, abomination, teleportation) played as a short, transparent
  overlay anchored at the cast point (`src/effects/`), falling back to the 2D
  effects when WebGL is unavailable or `prefers-reduced-motion` is set.
- **Invisibility shroud:** casting Invisibility fades the entire interface out,
  leaving only the breath gauge on screen until the held breath runs out, then
  restores the UI.
- **Procedural FX:** a 60 FPS canvas particle simulation drives each spell's
  effects, entities, and element-on-element reactions (`src/engine/`).
- **Runtime audio:** all sound is synthesized with the Web Audio API in
  `src/core/audio/synth.ts`; no audio assets are shipped, and each primal
  element has its own distinct cast sound.
- **Keyboard shortcuts:** `M` mute, `T` trace mode, `S` sandbox mode, and `/`
  to focus search.
- **Offline-capable static build:** plain Vite output, no backend required.

## Tech Stack

| Layer      | Choice                                 |
| ---------- | -------------------------------------- |
| UI         | React 19                               |
| Build tool | Vite 6                                 |
| Styling    | Tailwind CSS 4                         |
| Language   | TypeScript 5.8 (strict)                |
| Effects    | WebGL 1, raw GLSL ES 1.00              |
| Audio      | Web Audio API (runtime synth)          |
| Testing    | Vitest                                 |
| Quality    | ESLint (type-aware) + Lefthook hooks   |

## Getting Started

Prerequisites: Node.js 18+ and npm.

```sh
npm install     # install dependencies (also installs git hooks via lefthook)
npm run dev     # start the dev server at http://localhost:3000
npm run build   # create a production build in dist/
npm run preview # serve the production build locally
```

No environment variables are required to run, build, or deploy the app, so the
repository ships no `.env.example`.

## Scripts

| Command            | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Vite dev server on port 3000                   |
| `npm run build`    | Production build into `dist/`                  |
| `npm run preview`  | Serve the production build locally             |
| `npm run typecheck`| `tsc --noEmit`                                 |
| `npm run lint`     | ESLint (use `lint:fix` to autofix)             |
| `npm test`         | Vitest run (use `test:watch` while developing) |
| `npm run clean`    | Remove `dist/`                                 |

## Testing

`npm test` runs the Vitest suite (67 tests) over the pure logic that carries the
project's behavior: the gesture recognizer, spell data and shader mapping, the
WebGL effect registry and burst queue, and the simulation state machine. Tests
stay decoupled from canvas and WebGL internals; nothing snapshots markup.

## Accessibility

This project targets WCAG 2.1 AA.

- **Semantic structure:** landmarks, headings, and native buttons throughout.
- **Keyboard operable:** all controls are reachable and operable by keyboard,
  with visible focus rings and a skip-to-canvas link.
- **ARIA:** live regions announce cast results (`aria-live`), toggle buttons
  expose pressed state (`aria-pressed`), and icon-only controls carry labels.
- **Motion:** ambient/looping CSS animations are disabled under
  `prefers-reduced-motion`; canvas FX are user-initiated feedback, and the WebGL
  effect layer disables itself entirely under reduced-motion.
- **Canvas interaction:** the drawing surface is a single tab stop with a
  pointer-only interaction model; gesture results are announced via a live
  region.

## Project Structure

```
src/
├── App.tsx                  # Layout, modes, keyboard shortcuts, localStorage persistence
├── main.tsx                 # React entry point
├── index.css                # Tailwind entry + reduced-motion handling
├── components/
│   ├── MagicCanvas.tsx      # Canvas host + recognition wiring
│   └── ui/                  # Header, ModeTabs, SpellCodex, Spectrograph, HistoryLog, ...
├── core/
│   ├── types.ts             # Shared types
│   ├── spells.ts            # SPELLS_DATABASE: primitives and combinatory arrays
│   ├── recognizer.ts        # Hybrid gesture matcher (chamfer + occupancy grid)
│   └── audio/synth.ts       # Web Audio sound synthesis
├── effects/                 # WebGL burst layer
│   ├── index.ts             # createEffectLayer public API
│   ├── WebGLRenderer.ts     # Shader compile/link + fullscreen burst renderer
│   ├── registry.ts          # kind -> GLSL source, with a compile probe
│   ├── queue.ts             # concurrent burst slot manager
│   └── glsl/                # one fragment shader per spell burst
├── engine/                  # Rendering + simulation core
│   ├── cast.ts              # Spell-to-effect dispatch
│   ├── canvas2d.ts          # 2D draw helpers
│   ├── input.ts             # Pointer capture and stroke handling
│   ├── strokes.ts           # Stroke capture and resampling
│   ├── blueprints.ts        # Spell effect blueprints
│   ├── constants.ts         # Simulation constants
│   └── sim/                 # particles, entities, world, background, state, loop
└── hooks/                   # useLocalStorage, useKeyboardShortcuts, useCastHistory
```

## Deployment

The production build in `dist/` is fully static, so any static host works.

- **Netlify / Vercel:** set the publish directory to `dist` and the build
  command to `npm run build`.
- **Any web server:** upload the contents of `dist/`.

`public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`, and the
favicon are copied into `dist/` automatically. The canonical origin is
`https://titan-magic-simulator.juan-luke.com/`, referenced by `index.html`,
`robots.txt`, and `sitemap.xml`; update those three files if you deploy the app
under a different domain.

## Troubleshooting

- **Nothing draws:** the canvas responds to pointer (mouse/touch/pen) input
  only; it is not keyboard-drawable. Click and drag inside the framed pad.
- **A glyph won't compile:** slow, deliberate strokes score higher than quick
  scribbles. In Trace mode, follow the violet guide closely; in Sandbox mode,
  finish a recognizable glyph before pressing **Activate Glyph**.
- **No sound:** press `M` or the **Audio Aura** button to unmute. Browsers
  require a user gesture before audio can start.
- **The shader burst doesn't play:** the WebGL layer falls back to the 2D
  effects when WebGL is unavailable, the device cannot compile that shader, the
  burst queue is saturated, or `prefers-reduced-motion` is set.

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-change`.
3. Make your changes and run the full gate, which mirrors CI:

   ```sh
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

4. Commit and open a pull request. Lefthook runs lint, typecheck, and tests on
   pre-commit.

## Credits

Third-party shader, artwork, and library attributions are listed in
[CREDITS.md](CREDITS.md).

## Disclaimer

This project is an unofficial, non-commercial fan work created for fun and
education. It is not affiliated with, endorsed by, or sponsored by Disney, and
no Disney entity has any relationship to this project. _The Owl House_ and all
related characters, glyphs, designs, and lore are trademarks/copyright of their
respective owners; the series was created by Dana Terrace and produced by
Disney Television Animation. Glyph designs and lore are referenced here solely
as homage.

## License

[MIT](LICENSE). See also the [privacy notice](PRIVACY.md); the app collects no
data.
