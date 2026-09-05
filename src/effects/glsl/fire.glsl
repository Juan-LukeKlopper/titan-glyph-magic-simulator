// fire.glsl - Glyph Magic Simulator shader burst (fire spell).
//
// Merges two user-provided Shadertoy references:
//   1. IQ-style domain-warped fbm flame body ("Fire Flame shader",
//      red/orange/white additive core) - value noise/hash/fbm below by
//      iq (Inigo Quilez).
//   2. "Simplex fire" reference - Ashima simplex noise (smoke plume) plus
//      a rising spark grid with life arcs (PRNG hash from 4djSRW).
//
// Flame body rises from the lower-center of the cast box and reads as a
// fire column, with an additive white-hot core, ember sparks drifting off
// the edges and a pale smoke plume above the flame.
//
// SPDX-License-Identifier: MIT  (simplex noise: Copyright (C) 2011 Ashima
// Arts, MIT License, https://github.com/ashima/webgl-noise; repo LICENSE: MIT)

precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform vec2 u_castPos;
uniform float u_alpha;

const float PI = 3.14159265358979323846;

// ============================================================================
// Ashima Arts 3D simplex noise (MIT, verbatim from the embers reference).
// ============================================================================
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//         Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//       Lastmod : 20110822 (ijm)
//       License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//                 Distributed under the MIT License. See LICENSE file.
//                 https://github.com/ashima/webgl-noise

vec3 mod289(vec3 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
	return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec3 v) {
	const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
	const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

	// First corner
	vec3 i = floor(v + dot(v, C.yyy));
	vec3 x0 = v - i + dot(i, C.xxx);

	// Other corners
	vec3 g = step(x0.yzx, x0.xyz);
	vec3 l = 1.0 - g;
	vec3 i1 = min(g.xyz, l.zxy);
	vec3 i2 = max(g.xyz, l.zxy);

	vec3 x1 = x0 - i1 + C.xxx;
	vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
	vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

	// Permutations
	i = mod289(i);
	vec4 p = permute(permute(permute(
				i.z + vec4(0.0, i1.z, i2.z, 1.0))
			+ i.y + vec4(0.0, i1.y, i2.y, 1.0))
			+ i.x + vec4(0.0, i1.x, i2.x, 1.0));

	// Gradients: 7x7 points over a square, mapped onto an octahedron.
	// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
	float n_ = 0.142857142857; // 1.0/7.0
	vec3 ns = n_ * D.wyz - D.xzx;

	vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  // mod(p,7*7)

	vec4 x_ = floor(j * ns.z);
	vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)

	vec4 x = x_ * ns.x + ns.yyyy;
	vec4 y = y_ * ns.x + ns.yyyy;
	vec4 h = 1.0 - abs(x) - abs(y);

	vec4 b0 = vec4(x.xy, y.xy);
	vec4 b1 = vec4(x.zw, y.zw);

	vec4 s0 = floor(b0) * 2.0 + 1.0;
	vec4 s1 = floor(b1) * 2.0 + 1.0;
	vec4 sh = -step(h, vec4(0.0));

	vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
	vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

	vec3 p0 = vec3(a0.xy, h.x);
	vec3 p1 = vec3(a0.zw, h.y);
	vec3 p2 = vec3(a1.xy, h.z);
	vec3 p3 = vec3(a1.zw, h.w);

	// Normalise gradients
	vec4 norm = inversesqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
	p0 *= norm.x;
	p1 *= norm.y;
	p2 *= norm.z;
	p3 *= norm.w;

	// Mix final noise value
	vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
	m = m * m;
	return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ============================================================================
// IQ procedural value noise + fbm (flame body domain warp).
// ============================================================================

vec2 hash(vec2 p) {
	p = vec2(dot(p, vec2(127.1, 311.7)),
			dot(p, vec2(269.5, 183.3)));
	return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
	const float K1 = 0.366025404; // (sqrt(3)-1)/2;
	const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2 i = floor(p + (p.x + p.y) * K1);

	vec2 a = p - i + (i.x + i.y) * K2;
	vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0 * K2;

	vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);

	vec3 n = h * h * h * h *
		vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));

	return dot(n, vec3(70.0));
}

float fbm(vec2 uv) {
	float f;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	f = 0.5000 * noise(uv); uv = m * uv;
	f += 0.2500 * noise(uv); uv = m * uv;
	f += 0.1250 * noise(uv); uv = m * uv;
	f += 0.0625 * noise(uv); uv = m * uv;
	f = 0.5 + 0.5 * f;
	return f;
}

// ============================================================================
// Ember spark helpers (from the simplex-fire reference).
// ============================================================================
// PRNG from https://www.shadertoy.com/view/4djSRW
float prng(in vec2 seed) {
	seed = fract(seed * vec2(5.3983, 5.4427));
	seed += dot(seed.yx, seed.xy + vec2(21.5351, 14.3137));
	return fract(seed.x * seed.y * 95.4337);
}

// int-octave simplex stack (if-chain, WebGL1-safe - no dynamic loop).
float noiseStack(vec3 pos, int octaves, float falloff) {
	float n = snoise(vec3(pos));
	float off = 1.0;
	if (octaves > 1) {
		pos *= 2.0;
		off *= falloff;
		n = (1.0 - off) * n + off * snoise(vec3(pos));
	}
	if (octaves > 2) {
		pos *= 2.0;
		off *= falloff;
		n = (1.0 - off) * n + off * snoise(vec3(pos));
	}
	if (octaves > 3) {
		pos *= 2.0;
		off *= falloff;
		n = (1.0 - off) * n + off * snoise(vec3(pos));
	}
	return (1.0 + n) / 2.0;
}

vec2 noiseStackUV(vec3 pos, int octaves, float falloff, float diff) {
	float displaceA = noiseStack(pos, octaves, falloff);
	float displaceB = noiseStack(pos + vec3(3984.293, 423.21, 5235.19), octaves, falloff);
	return vec2(displaceA, displaceB);
}

// ============================================================================
// mainImage - merged flame body + smoke + rising spark grid.
// ============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;
	vec2 res = iResolution.xy;
	float H = max(res.y, 1.0);
	vec2 castPx = u_castPos * res;

	// Local space centred on the cast point: X in canvas-heights across,
	// Y up in canvas-heights (negative below the cast point).
	float X = (fragCoord.x - castPx.x) / H;
	float Y = (fragCoord.y - castPx.y) / H;

	// ---- flame body: one tongue rising from the cast point -----------------
	float tipF = 0.42 + 0.20 * fbm(vec2(time * 0.55, 1.7));
	float t = Y / max(tipF, 0.02); // 0 at the base -> 1 at the tip
	float tt = clamp(t, 0.0, 1.0);

	// Envelope: widest just above the cast point, tapering to a point.
	float width = 0.20 * pow(1.0 - tt, 0.9) + 0.02;
	float dist = abs(X) / max(width, 0.02);

	// Turbulent domain warp inside the column (fbm + simplex layers).
	vec2 wp = vec2(X * 2.4 + time * 0.22, Y * 3.5 - time * 1.6);
	float warpA = fbm(wp);
	float warpB = fbm(wp * 1.8 + vec2(4.2, 9.1));

	// Body: gaussian column above the cast point, carved by noise edges.
	float flame =
		exp(-dist * dist * 1.5) * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.92, 1.08, t));
	flame = flame * (0.4 + 0.9 * warpB);

	// Licking inner tongues flickering up through the column.
	float lickN = fbm(vec2(X * 5.0 - time * 2.2, Y * 6.0 - time * 3.0));
	float licking = smoothstep(0.36, 0.6, lickN) * (1.0 - smoothstep(0.3, 1.0, tt));
	flame += licking * 0.8 * (0.35 + 0.65 * warpA);
	flame = clamp(flame, 0.0, 1.6);

	// Glow pooling right at the cast point (the glyph ignition).
	float pool = exp(-(X * X + Y * Y) * 9.0);

	// White-hot core hugging the axis near the base.
	float baseHot = exp(-abs(X) / 0.06) * exp(-Y * 4.0) * 1.6;

	// Color ramp: white/yellow core -> orange -> deep red outer edge; cools
	// toward the tip.
	vec3 col = vec3(0.0);
	col += vec3(1.0, 0.93, 0.68) * (baseHot + pool * 0.5);
	col += vec3(1.0, 0.78, 0.26) * pow(clamp(flame, 0.0, 1.0), 1.9) * 1.3;
	col += vec3(1.0, 0.38, 0.07) * clamp(flame, 0.0, 1.0) * 1.0;
	col += vec3(0.62, 0.12, 0.03) * clamp(pow(flame, 4.0), 0.0, 1.0) * 0.9;
	col *= mix(vec3(1.0), vec3(0.70, 0.48, 0.40), smoothstep(0.25, 1.0, tt));

	// ---- smoke rising above the tip ----------------------------------------
	float sm = snoise(vec3(X * 1.8 - time * 0.28, Y * 3.0 + time * 0.2, time * 0.35));
	sm = 0.5 + 0.5 * sm;
	float smokeMask =
		smoothstep(0.9, 1.15, t) * (1.0 - smoothstep(1.35, 1.9, t)) *
		exp(-abs(X) / max(0.12 + 0.5 * max(t - 0.9, 0.0), 0.04));
	col += vec3(0.58, 0.52, 0.47) * pow(sm, 2.2) * smokeMask * 0.5;

	// ---- embers rising off the flame ---------------------------------------
	float realTime = 0.5 * time;
	// Grid anchored to the cast axis so sparks stream up from the flame.
	vec2 sparkCoord = fragCoord - vec2(0.0, 190.0 * realTime);
	sparkCoord -= 30.0 * noiseStackUV(0.01 * vec3(sparkCoord, 30.0 * time), 1, 0.4, 0.1);
	if (mod(sparkCoord.y / 30.0, 2.0) < 1.0) {
		sparkCoord.x += 15.0;
	}
	vec2 sparkGridIndex = floor(sparkCoord / 30.0);
	float sparkRandom = prng(sparkGridIndex);
	float sparkLife = min(10.0 *
		(1.0 - min((sparkGridIndex.y + (190.0 * realTime / 30.0)) / (24.0 - 20.0 * sparkRandom), 1.0)), 1.0);
	if (sparkLife > 0.0) {
		float sparkSize = sparkRandom * 0.08;
		float sparkRadians = 999.0 * sparkRandom * 2.0 * PI + 2.0 * time;
		vec2 sparkCircular = vec2(sin(sparkRadians), cos(sparkRadians));
		vec2 sparkOffset = (0.5 - sparkSize) * 30.0 * sparkCircular;
		vec2 sparkModulus = mod(sparkCoord + sparkOffset, 30.0) - vec2(15.0);
		float sparkLength = length(sparkModulus);
		float sparksGray = max(0.0, 1.0 - sparkLength / max(sparkSize * 30.0, 0.0001));
		// Embers appear only near the flame axis, so they read as sparks thrown
		// off one fire rather than a full-screen grid.
		float axisNear = exp(-pow((sparkCoord.x - castPx.x) / (0.5 * H), 2.0));
		// Only above the cast point (sparks rise), tapering off with height.
		float upOnly = smoothstep(0.0, 0.1, (sparkCoord.y - castPx.y) / H) *
			exp(-Y * 1.4);
		col += sparkLife * sparksGray * vec3(1.0, 0.42, 0.10) * axisNear * upOnly * 1.2;
	}

	// Gentle rolloff so the brightest pixels never clip harshly.
	col = 1.0 - exp(-1.4 * col);

	// Premultiplied-style output: alpha tracks the rendered light so the burst
	// overlays the existing canvas instead of blacking out the whole surface.
	float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.6, 0.0, 1.0);
	fragColor = vec4(col, alpha);
}

// Shadertoy-style wrapper: call mainImage from main(). Colors are written
// unpremultiplied with a=1, so fold coverage into rgb before the fade.
void main() {
	vec4 c;
	mainImage(c, gl_FragCoord.xy);
	c.rgb *= c.a;
	c *= u_alpha;
	gl_FragColor = c;
}
