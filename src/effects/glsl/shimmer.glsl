// shimmer.glsl - Glyph Magic Simulator shader burst (invisibility spell).
//
// Authored for this project (no reference): the momentary light-bending
// "refraction lens" that marks an invisibility shroud. A single thin
// iridescent ring sits at the cast point, wrapped around a faint glassy
// interior, with caustic ripples travelling along the rim and concentric
// lensing ripples bending the light inward. Pale cyan / white with a hint of
// violet; mostly transparent so the canvas and UI keep showing through.
//
// Design notes: radial coordinates are aspect-correct and centred on the cast
// point so the lens is a true circle regardless of canvas shape. The whole
// effect lives on a sub-unit disc; coverage hugs the rim, stays very faint
// across the interior, and fades to zero well before the disc edge so the
// burst overlays the surface instead of covering it.
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
const float TWO_PI = 6.28318530717958647692;

const vec3 COL_CYAN = vec3(0.5059, 0.9255, 0.9255);   // #81ECEC
const vec3 COL_VIOLET = vec3(0.6078, 0.3490, 0.7137); // #9B59B6
const vec3 COL_WHITE = vec3(0.94, 0.99, 1.00);

// Gaussian band around a radius - the clean ring primitive from portal.glsl.
float ringBand(float rad, float radius, float width) {
	float d = (rad - radius) / max(width, 0.0001);
	return exp(-d * d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	float time = iTime;

	// Aspect-correct radial coordinates centred on the cast point.
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 p = vec2((uv.x - u_castPos.x) * (iResolution.x / max(iResolution.y, 1.0)),
			uv.y - u_castPos.y);
	float r = length(p);
	float ang = atan(p.y, p.x);

	// The ring sits at a fixed radius; a slow breath scales it a touch.
	float pulse = 0.5 + 0.5 * sin(time * 1.6);
	float R = 0.34 + 0.020 * pulse;

	// ---- lensing distortion: concentric ripples bending inward --------------
	// A radial phase travelling toward the centre, strongest near the ring and
	// vanishing at the cast point, so it reads as air being pulled in.
	float lensRipple = sin(r * 26.0 - time * 3.0) * exp(-pow((r - R) / 0.16, 2.0));
	float lens = lensRipple * (0.5 + 0.5 * cos(ang * 2.0 + time * 0.8));

	// ---- thin iridescent ring ----------------------------------------------
	float ring = ringBand(r, R, 0.014 + 0.004 * pulse);

	// Caustic ripples travelling along the rim: a travelling wave in angle
	// plus a counter-rotating wave whose product makes moving caustic knots.
	float causticA = 0.5 + 0.5 * sin(ang * 9.0 - time * 2.6);
	float causticB = 0.5 + 0.5 * sin(ang * 15.0 + time * 1.9);
	float caustic = 0.35 + 0.65 * pow(causticA * causticB, 1.6);

	// Bright knots drifting around the rim (the sharp caustic sparkle).
	float knot = pow(0.5 + 0.5 * sin(ang * 6.0 - time * 3.4), 4.0);

	// Iridescent tint walking cyan -> pale white -> violet with the angle.
	float hue = 0.5 + 0.5 * sin(ang * 3.0 - time * 0.9);
	vec3 iris = mix(COL_CYAN, COL_WHITE, hue);
	iris = mix(iris, COL_VIOLET, 0.26 * pow(1.0 - hue, 3.0) + 0.10 * causticA);

	// ---- faint glassy interior ---------------------------------------------
	// Barely-there fill inside the ring so the lens reads as a disc of glass,
	// plus a soft highlight where the surface turns over at the rim.
	float glass = exp(-pow(r / (R * 0.85), 2.0));
	float glassEdge = smoothstep(R * 0.70, R, r) * exp(-pow((r - R) / 0.10, 2.0));
	float inner = 1.0 - smoothstep(R * 0.20, R, r);

	// ---- assemble -----------------------------------------------------------
	vec3 col = vec3(0.0);

	// Ring body: iridescent, modulated by the caustics and the lensing ripple.
	col += iris * ring * (0.55 + 0.55 * caustic) * (1.0 + 0.50 * lensRipple);

	// White-hot caustic highlights where the travelling waves overlap.
	col += COL_WHITE * ring * knot * 0.60;

	// Faint lensing sheen across the interior (light bending near the rim).
	col += mix(COL_CYAN, COL_VIOLET, 0.35 + 0.35 * lens) * lens * glass * 0.10;

	// Glassy surface tint and the turned-over rim highlight.
	col += COL_CYAN * glass * 0.035;
	col += COL_WHITE * glassEdge * 0.060;

	col = clamp(col, 0.0, 1.0);

	// ---- coverage -----------------------------------------------------------
	// Low and hugged tightly to the ring; the interior stays faint, and the
	// whole thing goes to zero away from the rim so the canvas shows through.
	float ringCov = ring * (0.30 + 0.22 * caustic);
	float glassCov = glass * 0.050 + glassEdge * 0.050;
	float coverage = ringCov + glassCov * inner + 0.05 * abs(lens) * glassEdge;
	coverage = clamp(coverage, 0.0, 0.85);

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
