// abomination.glsl - Glyph Magic Simulator shader burst (monster_arm spell).
//
// Authored for this project (no external reference): a writhing mass of
// thick abomination flesh erupting from the cast point and reaching upward.
// A bundle of overlapping sinewy tendrils coils and pulses, each a rounded
// tube shaded like a fleshy cylinder (deep-purple shadow flesh, mid-violet
// body, warm #E17055 rim highlight). A bioluminescent violet-green vein runs
// the length of every tendril and pulses along it, while a fleshy lump
// anchors the bundle at the cast point. Everything outside the mass fades to
// transparent so the canvas behind the burst shows through.
//
// Purely analytic (no raymarch): 7 constant-loop tendrils plus one cheap
// procedural value-noise warp field. Anchored on u_castPos with
// aspect-corrected local coordinates (X across in canvas-height units, +Y up).
//
// SPDX-License-Identifier: MIT  (authored for the Glyph Magic Simulator;
// repo LICENSE: MIT)

precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform vec2 u_castPos;
uniform float u_alpha;

const float PI = 3.14159265358979323846;

// Abomination #E17055, violet #9B59B6, plus a sickly bioluminescent green.
const vec3 COL_ABOM = vec3(0.8824, 0.4392, 0.2157);     // #E17055
const vec3 COL_VIOLET = vec3(0.6078, 0.3490, 0.7137);   // #9B59B6
const vec3 COL_GREEN = vec3(0.5600, 0.9600, 0.3800);    // sickly bio-green glow
const vec3 COL_FLESH_DK = vec3(0.1100, 0.0250, 0.1400); // deep purple shadow
const vec3 COL_FLESH = vec3(0.3600, 0.1300, 0.3400);    // mid purple flesh

// Procedural value noise (no textures, no samplers).
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float time = iTime;

    // Aspect-correct local space centred on the cast point; +Y reaches up.
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = vec2(
        (uv.x - u_castPos.x) * (iResolution.x / max(iResolution.y, 1.0)),
        uv.y - u_castPos.y
    );

    // Coherent writhe: one cheap noise warp field bends the whole bundle.
    float w1 = noise(vec2(p.x * 4.0 + time * 0.30, p.y * 4.0 - time * 0.55));
    float w2 = noise(vec2(p.x * 7.5 - time * 0.22 + 5.0, p.y * 7.5 - time * 0.80));
    float X = p.x + (w1 - 0.5) * 0.13 + (w2 - 0.5) * 0.05;
    float Y = p.y;

    float r = length(p);

    // ---- bundle of overlapping tendrils ------------------------------------
    float massEdge = 0.0;   // defined silhouette (drives coverage)
    float massSoft = 0.0;   // soft body value (drives the bio glow)
    vec3 topCol = COL_FLESH_DK;
    float topBody = 0.0;
    float veinHalo = 0.0;

    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float seed = hash(vec2(fi * 13.7 + 1.3, 3.1));
        float seed2 = hash(vec2(fi * 7.9 + 4.7, 11.2));

        float phase = fi * 2.399 + seed * 6.2831;
        float baseX = (fi - 3.0) * 0.052;
        float height = 0.52 + 0.46 * seed;
        float amp = 0.09 + 0.13 * seed2;
        float freq = 1.6 + 2.4 * seed;
        float sway = 0.9 + 0.7 * seed2;

        // Parametric centre line: 0 at base, 1 at tip; it coils as it rises.
        float t = Y / height;
        float tc = clamp(t, 0.0, 1.0);
        float cx = baseX + amp * sin(tc * freq * PI + phase + time * sway) * tc;

        // Thickness tapers toward the tip; a travelling pulse makes it writhe.
        float thick = (0.052 + 0.030 * seed2) * (1.0 - 0.55 * tc);
        thick *= 1.0 + 0.16 * sin(tc * 17.0 - time * 3.2 + phase);

        float dx = X - cx;
        float d = abs(dx) / max(thick, 1e-4);

        // Head/tip falloff keeps each tendril a finite limb.
        float span = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.82, 1.0, t));

        float body = span * (1.0 - smoothstep(0.55, 1.45, d));
        float soft = span * exp(-d * d * 1.1);

        // Tube shading: lateral coordinate -> fake cylindrical normal.
        float uu = clamp(dx / max(thick, 1e-4), -1.0, 1.0);
        float radial = sqrt(max(1.0 - uu * uu, 0.0));
        float lit = 0.18 + 0.82 * radial;
        float gl = (uu + 0.35) * 2.3;
        float gloss = exp(-gl * gl) * radial;

        // Vein: a thin bioluminescent cord running the length of the tendril.
        float vz = dx / max(thick * 0.30, 1e-4);
        float vein = exp(-vz * vz) * span;
        float flow = 0.55 + 0.45 * sin(tc * 22.0 - time * 5.5 + phase * 1.7);
        vec3 veinCol = mix(COL_VIOLET, COL_GREEN,
            0.5 + 0.5 * sin(tc * 8.0 + phase * 2.3 - time * 1.6));

        // Flesh ramp: deep shadow -> mid purple, warm #E17055 on the lit face.
        vec3 fCol = mix(COL_FLESH_DK, COL_FLESH, lit);
        fCol += COL_ABOM * gloss * 0.55;
        fCol += COL_VIOLET * (1.0 - radial) * 0.10;
        fCol += COL_GREEN * 0.03 * radial;
        fCol += veinCol * vein * 1.5 * flow;

        massEdge = max(massEdge, body);
        massSoft = max(massSoft, soft * (0.4 + 0.6 * radial));
        veinHalo = max(veinHalo, vein * flow);

        if (body > topBody) {
            topBody = body;
            topCol = fCol;
        }
    }

    // ---- fleshy lump anchoring the bundle at the cast point ----------------
    float lumpD = length(vec2(p.x * 0.85, (p.y - 0.02) * 1.3));
    float lump = 1.0 - smoothstep(0.05, 0.27, lumpD);
    vec3 lumpCol = mix(COL_FLESH_DK, COL_FLESH, 0.85);
    lumpCol += COL_ABOM * 0.22 * (0.5 + 0.5 * sin(p.x * 28.0 + time * 2.0));
    lumpCol += COL_GREEN * 0.35 * exp(-length(vec2(p.x * 2.2, p.y * 3.0)) * 14.0);

    float mask = max(massEdge, lump);

    // Front tendril colour over the lump colour, weighted by tendril body.
    float w = clamp(topBody, 0.0, 1.0);
    vec3 col = mix(lumpCol, topCol, w) * mask;

    // ---- bioluminescent glow (in the gaps, ignition at the core) -----------
    float halo = exp(-r * 5.5);
    col += COL_GREEN * (veinHalo * 0.30 + halo * 0.30);
    col += COL_VIOLET * (massSoft * 0.10 + halo * 0.14);

    col = clamp(col, 0.0, 1.0);

    // Coverage: the defined mass plus a faint halo so the glow does not clip.
    float coverage = clamp(mask + halo * 0.20, 0.0, 1.0);

    fragColor = vec4(col, coverage);
}

// Shadertoy-style wrapper (coverage folded into rgb before the fade).
void main() {
    vec4 c;
    mainImage(c, gl_FragCoord.xy);
    c.rgb *= c.a;
    c *= u_alpha;
    gl_FragColor = c;
}
