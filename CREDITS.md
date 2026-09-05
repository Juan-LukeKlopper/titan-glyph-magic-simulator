# Credits

Glyph Magic Simulator is an unofficial, non-commercial fan project. Its WebGL
effects layer adapts shaders and noise routines from the Shadertoy community and
other open sources. Attribution for each is listed below.

If you are the author of one of these references and would like different
wording, a specific link, or removal, please open an issue.

## Shader sources

Each spell burst in `src/effects/glsl/` is a GLSL ES 1.00 fragment shader
composited as a transparent overlay. Bursts that adapt a community reference are
credited below; the rest are original work for this project.

### Fire - `fire.glsl`

Merges two user-supplied references:

- Flame body adapted from a user-supplied "Fire Flame shader" reference. The
  original author was not recorded when the reference was collected.
- Value noise, hash, and fbm helpers by Inigo Quilez (iq).
- Smoke plume, spark grid, and ember arcs adapted from a user-supplied
  "Simplex fire" reference. The original author was not recorded.
- Simplex noise by Ian McEwan, Ashima Arts, distributed under the MIT License
  as `webgl-noise`: https://github.com/ashima/webgl-noise
- `prng` hash from "Hash without Sine" by Dave Hoskins:
  https://www.shadertoy.com/view/4djSRW

### Ice - `snow.glsl`

- Adapted from "Miracle Snowflakes" (2015) by Panteleymonov Aleksandr
  Konstantinovich:
  https://www.shadertoy.com/view/Xsd3zf
  Author portfolio: https://www.panteleymonov.ru/projects_eng.htm

### Plant - `plant.glsl`

- Adapted from a user-supplied raymarched plant bloom reference. The original
  author was not recorded.
- The soft shadow and ambient occlusion helpers follow Inigo Quilez's classic
  raymarching routines, referenced in the source as:
  - https://www.shadertoy.com/view/lsKcDD
  - https://www.shadertoy.com/view/Xds3zN ("Raymarching - Primitives", Inigo Quilez)

### Wind vortex - `tornado.glsl`

- Original work authored for this project: a transparent, procedural swirling
  twister funnel with no texture or reference dependency.

### Teleportation - `portal.glsl`

- Original work authored for this project.

## Original bursts

The following bursts are authored for this project with no third-party source:

- `radiance.glsl` (Light)
- `mist.glsl` (Sleep Mist)
- `shimmer.glsl` (Invisibility)
- `barrier.glsl` (Safety Hover)
- `petrify.glsl` (Petrification)
- `abomination.glsl` (Abomination Mutation)

## Artwork and lore

The glyph designs, element names, and lore are an homage to *The Owl House*.
They are used here for non-commercial, educational fan purposes only. See the
disclaimer in the [README](README.md) for details.

## Libraries

Built with React, Vite, Tailwind CSS, and lucide-react. Each is distributed
under its own open-source license; see `package.json` for the full list.
