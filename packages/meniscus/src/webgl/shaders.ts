import { DEFAULT_SHININESS, RIM_BACK, RIM_FLOOR, RIM_POWER, SHADE_COLOR, SHADE_FLOOR, SHADE_POWER } from '../core/maps';
import { NORMAL_FLOOR } from '../core/union';
import { RIPPLE_MAX } from '../core/ripple';

const glsl = (v: number) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

export const MAX_PANES = 16;
export const LUT_SAMPLES = 256;

export const VERTEX = /* glsl */ `#version 300 es
in vec2 a_position;
uniform vec2 u_resolution;
out vec2 v_px;
void main() {
  // Clip space to canvas px, y pointing down like the DOM.
  v_px = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5) * u_resolution;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * One pass draws the source and every pane. Per pane: signed distance to the
 * rounded rectangle, the refraction table looked up by depth into the bezel,
 * a displaced (and optionally blurred, channel-split) read of the source, then
 * saturation, tint and the same lighting terms the CSS highlight maps use.
 */
export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

const int MAX_PANES = ${MAX_PANES};
const float LUT_SAMPLES = ${LUT_SAMPLES}.0;

uniform int u_layer;              // -1: independent panes; otherwise one composited layer
uniform bool u_screenSource;     // source is a previous framebuffer pass
uniform sampler2D u_source;
uniform sampler2D u_lut;
uniform vec2 u_resolution;
uniform vec2 u_uvScale;
uniform vec2 u_uvOffset;
uniform float u_srcTexel;
uniform bool u_letterbox;
uniform int u_count;
uniform float u_merge;             // smooth-union radius (canvas px); 0 keeps panes apart
uniform bool u_panesOnly;          // leave the canvas clear outside the glass
uniform vec3 u_shadow;             // outer shadow: strength, drop, blur (canvas px)
uniform vec4 u_rect[MAX_PANES];   // x, y, width, height (canvas px)
uniform vec4 u_shape[MAX_PANES];  // radius, bezel, blur, aberration spread (px or ratio)
uniform vec4 u_tint[MAX_PANES];   // rgb, alpha
uniform vec4 u_light[MAX_PANES];  // light vector xyz, specular strength
uniform vec4 u_misc[MAX_PANES];   // rim strength, saturation, shade strength, displacement scale
uniform mediump sampler2DArray u_waves; // liquid surface heights (layout px), one layer per pane
uniform vec4 u_wave[MAX_PANES];         // shift per unit slope (canvas px), cols, rows, on

in vec2 v_px;
out vec4 outColor;

vec2 toUV(vec2 px) {
  return px * u_uvScale + u_uvOffset;
}

float paneShadow(vec2 px);

vec4 source(vec2 px, float lod) {
  if (u_screenSource) {
    vec2 uv = vec2(px.x / u_resolution.x, 1.0 - px.y / u_resolution.y);
    vec4 color = textureLod(u_source, clamp(uv, 0.0, 1.0), lod);
    float a = paneShadow(px);
    return vec4(0.0, 0.0, 0.0, a) + color * (1.0 - a);
  }
  vec2 uv = toUV(px);
  if (u_letterbox && (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0)) return vec4(0.0);
  return textureLod(u_source, clamp(uv, 0.0, 1.0), lod);
}

// A small rotated disc of taps on top of a mip level approximates a Gaussian.
vec4 blurred(vec2 px, float radius) {
  if (radius < 0.5) return source(px, 0.0);
  float lod = max(0.0, log2(radius * u_srcTexel * 0.5));
  vec4 sum = source(px, lod) * 0.2;
  const float GOLDEN = 2.39996323;
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    float r = radius * sqrt((fk + 0.5) / 8.0);
    float a = fk * GOLDEN;
    sum += source(px + vec2(cos(a), sin(a)) * r, lod) * 0.1;
  }
  return sum;
}

float roundedRect(vec2 p, vec2 halfSize, float r, out vec2 normal) {
  vec2 q = abs(p) - halfSize + r;
  vec2 s = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  if (q.x > 0.0 && q.y > 0.0) {
    normal = normalize(q) * s;
    return length(q) - r;
  }
  normal = q.x > q.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
  return max(q.x, q.y) - r;
}

float lobe(float d, float shininess, float flatBase) {
  return max(pow(max(d, 0.0), shininess) - flatBase, 0.0) / (1.0 - flatBase);
}

// Signed distance from p to pane i, and its outward normal.
float paneSdfAt(int i, vec2 p, out vec2 n) {
  vec4 rect = u_rect[i];
  vec2 halfSize = rect.zw * 0.5;
  return roundedRect(p - (rect.xy + halfSize), halfSize, u_shape[i].x, n);
}

// Sample the current pane’s shadow at the refracted position too. Previous
// panes and their shadows are already part of the framebuffer source.
float paneShadow(vec2 px) {
  if (u_layer < 0 || u_shadow.x <= 0.0) return 0.0;
  vec2 n;
  float d = paneSdfAt(u_layer, px - vec2(0.0, u_shadow.y), n);
  return u_shadow.x * 0.5 * (1.0 - tanh(d / max(u_shadow.z, 1e-3)));
}

float paneSdf(int i, out vec2 n) {
  return paneSdfAt(i, v_px, n);
}

// Distance from p to the glass as a whole: merged, or the nearest pane.
float glassField(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < MAX_PANES; i++) {
    if (i >= u_count) break;
    vec2 n;
    float di = paneSdfAt(i, p, n);
    if (i == 0) {
      d = di;
    } else if (u_merge > 0.0) {
      float h = clamp(0.5 + 0.5 * (di - d) / u_merge, 0.0, 1.0);
      d = mix(di, d, h) - u_merge * h * (1.0 - h);
    } else {
      d = min(d, di);
    }
  }
  return d;
}

// Slope of pane i's liquid surface here, from central differences of its layer.
vec2 waveSlope(int i) {
  vec4 w = u_wave[i];
  if (w.w < 0.5) return vec2(0.0);
  vec4 rect = u_rect[i];
  vec2 cells = w.yz;
  vec2 at = (v_px - rect.xy) / rect.zw * cells;
  vec2 lo = vec2(0.5);
  vec2 hi = cells - 0.5;
  float layer = float(i);
  const float SIZE = ${glsl(RIPPLE_MAX)};
  float l = textureLod(u_waves, vec3(clamp(at - vec2(1.0, 0.0), lo, hi) / SIZE, layer), 0.0).r;
  float r = textureLod(u_waves, vec3(clamp(at + vec2(1.0, 0.0), lo, hi) / SIZE, layer), 0.0).r;
  float t = textureLod(u_waves, vec3(clamp(at - vec2(0.0, 1.0), lo, hi) / SIZE, layer), 0.0).r;
  float b = textureLod(u_waves, vec3(clamp(at + vec2(0.0, 1.0), lo, hi) / SIZE, layer), 0.0).r;
  // One cell in layout px: the rect is in canvas px and misc.w is the pixel ratio.
  vec2 cell = rect.zw / (cells * u_misc[i].w);
  return vec2(r - l, b - t) / (2.0 * cell);
}

// Everything that shades one point of glass, so merged panes can blend it.
struct Material {
  float shift;      // displacement along -n, canvas px
  float slope;      // surface slope for lighting
  float blur;
  float spread;     // aberration
  float saturation;
  vec4 tint;
  vec4 light;       // light vector xyz, specular strength
  float rim;
  float shade;
  vec2 wave;        // liquid surface slope
  float waveDepth;  // shift per unit slope, canvas px
};

Material paneMaterial(int i, float d) {
  float bezel = max(u_shape[i].y, 1e-3);
  float t = clamp(-d / bezel, 0.0, 1.0);
  vec2 table = texture(u_lut, vec2((t * (LUT_SAMPLES - 1.0) + 0.5) / LUT_SAMPLES, (float(i) + 0.5) / float(MAX_PANES))).rg;
  return Material(table.r * u_misc[i].w, table.g, u_shape[i].z, u_shape[i].w, u_misc[i].y, u_tint[i], u_light[i], u_misc[i].x, u_misc[i].z, waveSlope(i), u_wave[i].x);
}

// The glass color for material m with outward normal n (premultiplied, before coverage).
vec4 glassColor(Material m, vec2 n) {
  vec2 offset = -n * m.shift + m.wave * m.waveDepth;
  vec4 glass;
  if (m.spread > 0.0) {
    vec4 cr = blurred(v_px + offset * (1.0 + m.spread), m.blur);
    vec4 cg = blurred(v_px + offset, m.blur);
    vec4 cb = blurred(v_px + offset * (1.0 - m.spread), m.blur);
    glass = vec4(cr.r, cg.g, cb.b, cg.a);
  } else {
    glass = blurred(v_px + offset, m.blur);
  }

  float luma = dot(glass.rgb, vec3(0.2126, 0.7152, 0.0722));
  glass.rgb = mix(vec3(luma), glass.rgb, m.saturation);
  glass.rgb = mix(glass.rgb, m.tint.rgb * glass.a, m.tint.a);
  glass.a = mix(glass.a, 1.0, m.tint.a);

  // Lighting, matching shadeSurface() in core/maps.ts.
  vec3 N = normalize(vec3(n * m.slope - m.wave, 1.0));
  vec3 L = m.light.xyz;
  float hLen = length(vec3(L.xy, L.z + 1.0));
  const float shininess = ${glsl(DEFAULT_SHININESS)};
  float flatBase = pow((L.z + 1.0) / hLen, shininess);
  float highlight = lobe(dot(N, vec3(L.xy, L.z + 1.0)) / hLen, shininess, flatBase);
  float bounce = lobe(dot(N, vec3(-L.xy, L.z + 1.0)) / hLen, shininess, flatBase);
  vec2 planar = L.xy / max(length(L.xy), 1e-4);
  float facing = dot(n, planar);
  float rim = pow(1.0 - N.z, ${glsl(RIM_POWER)}) * (${glsl(RIM_FLOOR)} + (1.0 - ${glsl(RIM_FLOOR)}) * max(facing, 0.0) + ${glsl(RIM_BACK)} * max(-facing, 0.0));
  float shade = pow(1.0 - N.z, ${glsl(SHADE_POWER)}) * (${glsl(SHADE_FLOOR)} + (1.0 - ${glsl(SHADE_FLOOR)}) * max(-facing, 0.0));
  float light = clamp(m.light.w * (highlight + 0.45 * bounce) + m.rim * rim, 0.0, 1.0);
  float dark = clamp(m.shade * shade, 0.0, 1.0) * (1.0 - light);
  glass.rgb = mix(glass.rgb, vec3(${glsl(SHADE_COLOR[0] / 255)}, ${glsl(SHADE_COLOR[1] / 255)}, ${glsl(SHADE_COLOR[2] / 255)}) * glass.a, dark);
  glass.rgb = glass.rgb + light * (glass.a - glass.rgb); // white light: screen blend, premultiplied
  return glass;
}

void main() {
  vec4 color = u_panesOnly ? vec4(0.0) : source(v_px, 0.0);

  // A soft shadow under the glass, dropped and blurred: a blurred step is
  // close to 1 - tanh. The glass covers it, so it only shows outside.
  if (u_layer < 0 && u_shadow.x > 0.0 && u_count > 0) {
    float ds = glassField(v_px - vec2(0.0, u_shadow.y));
    float a = u_shadow.x * 0.5 * (1.0 - tanh(ds / max(u_shadow.z, 1e-3)));
    color = vec4(0.0, 0.0, 0.0, a) + color * (1.0 - a);
  }

  if (u_merge > 0.0) {
    // Liquid panes: one surface from a polynomial smooth minimum of every
    // outline. The same weights blend the normals and each pane's material,
    // so a neck between different glasses changes smoothly from one to the
    // other.
    float w[MAX_PANES];
    float d = 1e9;
    vec2 g = vec2(0.0);
    for (int i = 0; i < MAX_PANES; i++) {
      if (i >= u_count) break;
      vec2 ni;
      float di = paneSdf(i, ni);
      if (i == 0) {
        d = di;
        g = ni;
        w[0] = 1.0;
        continue;
      }
      float h = clamp(0.5 + 0.5 * (di - d) / u_merge, 0.0, 1.0);
      d = mix(di, d, h) - u_merge * h * (1.0 - h);
      g = mix(ni, g, h);
      for (int j = 0; j < MAX_PANES; j++) {
        if (j >= i) break;
        w[j] *= h;
      }
      w[i] = 1.0 - h;
    }
    if (u_count > 0 && d <= 1.0) {
      Material m = Material(0.0, 0.0, 0.0, 0.0, 0.0, vec4(0.0), vec4(0.0), 0.0, 0.0, vec2(0.0), 0.0);
      for (int i = 0; i < MAX_PANES; i++) {
        if (i >= u_count) break;
        if (w[i] < 1e-3) continue;
        Material p = paneMaterial(i, d);
        m.shift += w[i] * p.shift;
        m.slope += w[i] * p.slope;
        m.blur += w[i] * p.blur;
        m.spread += w[i] * p.spread;
        m.saturation += w[i] * p.saturation;
        m.tint += w[i] * p.tint;
        m.light += w[i] * p.light;
        m.rim += w[i] * p.rim;
        m.shade += w[i] * p.shade;
        m.wave += w[i] * p.wave;
        m.waveDepth += w[i] * p.waveDepth;
      }
      m.light.xyz = normalize(m.light.xyz);
      // Normals that nearly cancel (the waist of a neck) stay short.
      vec2 n = g / max(length(g), ${glsl(NORMAL_FLOOR)});
      color = mix(color, glassColor(m, n), clamp(0.5 - d, 0.0, 1.0));
    }
  } else {
    for (int i = 0; i < MAX_PANES; i++) {
      if (i >= u_count) break;
      if (u_layer >= 0 && i != u_layer) continue;
      vec2 n;
      float d = paneSdf(i, n);
      if (d > 1.0) continue;
      color = mix(color, glassColor(paneMaterial(i, d), n), clamp(0.5 - d, 0.0, 1.0));
    }
  }

  outColor = color;
}
`;
