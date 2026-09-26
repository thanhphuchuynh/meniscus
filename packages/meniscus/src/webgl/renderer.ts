import { glassProfile, lightingProfile, type ResolvedGlass } from '../core/glass';
import { ABERRATION_SPREAD } from '../core/filter';
import { lightVector } from '../core/maps';
import { profileKey } from '../core/profiles';
import { presenceOpacity, type OpticalState } from '../core/physics';
import { RIPPLE_MAX, type RippleField } from '../core/ripple';
import { FRAGMENT, LUT_SAMPLES, MAX_PANES, VERTEX } from './shaders';

export type Fit = 'cover' | 'contain' | 'fill';

/** Where the whole source lands on the canvas, CSS px. Anything outside it draws nothing. */
export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderOptions {
  /** Composite panes back to front, refracting earlier panes and their shadows. Ignored when merging. */
  layered?: boolean;
  /** Smooth-union distance: panes whose outlines are closer than this many px flow together. */
  merge?: number;
  /** Draw only the glass (and its shadow), leaving the rest of the canvas clear. */
  panesOnly?: boolean;
  /** With `layered`: composite panes 0…clip only, and keep just pane `clip` in the output, transparent elsewhere. */
  clip?: number;
  /** A soft shadow outside the glass: strength 0 to 1, drop and blur in CSS px. */
  shadow?: { strength: number; drop: number; blur: number } | null;
}

export interface PaneFrame {
  /** Whether this pane casts the standard refracted shadow in layered mode. Defaults to true. */
  shadow?: boolean;
  /** Pane box relative to the canvas, CSS px. */
  x: number;
  y: number;
  glass: ResolvedGlass;
  /** Tint as linear 0..1 rgba. */
  tint: [number, number, number, number];
  /** A liquid surface over this pane, drawn while it moves. */
  ripple?: RippleField | null;
  /** Its optics on springs: presence fades it, refraction scales the bend, the highlight turns the light, tint and lift scale theirs. */
  optics?: OpticalState | null;
}

interface Decode {
  src: string;
  bitmap?: ImageBitmap;
  failed?: boolean;
}
const decodes = new WeakMap<HTMLImageElement, Decode>();

/**
 * The pixels to upload for a source. An image is decoded off the main thread
 * into an ImageBitmap first (null until it's ready), so its upload doesn't
 * stall a frame decoding it. Video and canvas upload as they are, and so does
 * an image that can't be decoded this way.
 */
function uploadable(s: TexImageSource): TexImageSource | null {
  if (typeof HTMLImageElement === 'undefined' || !(s instanceof HTMLImageElement) || typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return s;
  const src = s.currentSrc || s.src;
  let d = decodes.get(s);
  if (!d || d.src !== src) {
    const decode: Decode = (d = { src });
    decodes.set(s, decode);
    // A cross-origin image the page didn't open to CORS stays as it was: unreadable.
    const readable = s.crossOrigin !== null || new URL(src, location.href).origin === location.origin;
    // From its bytes (in the HTTP cache by now): a bitmap made from the element itself decodes on the main thread.
    const bytes = readable ? fetch(src, { cache: 'force-cache', credentials: s.crossOrigin === 'use-credentials' ? 'include' : 'same-origin' }) : Promise.reject(new Error('opaque'));
    bytes
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.statusText))))
      .then((blob) => createImageBitmap(blob, { premultiplyAlpha: 'premultiply' }))
      .then(
        (bitmap) => {
          if (decodes.get(s) === decode) decode.bitmap = bitmap;
          else bitmap.close();
        },
        () => (decode.failed = true),
      );
  }
  return d.failed ? s : (d.bitmap ?? null);
}

/** Frees an image's decoded copy once it's on the GPU; a later upload decodes it again. */
function uploadedFrom(s: TexImageSource): void {
  if (typeof HTMLImageElement === 'undefined' || !(s instanceof HTMLImageElement)) return;
  decodes.get(s)?.bitmap?.close();
  decodes.delete(s);
}

const MAX_SLOPE = 1e4;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('meniscus: could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/**
 * Draws a source image, video or canvas with glass panes refracting it, in a
 * single full-screen pass by default, or ordered framebuffer passes for layers.
 * Each pane's refraction table (the same one the SVG
 * path encodes into displacement maps) lives in one row of a lookup texture.
 */
export class GlassRenderer {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private targets: Array<{ texture: WebGLTexture; framebuffer: WebGLFramebuffer }> = [];
  private targetSize = '';
  private sourceTex: WebGLTexture;
  private lutTex: WebGLTexture;
  private waveTex: WebGLTexture;
  private waveReady = false;
  private waveBroken = false;
  private waveUploads = Array.from({ length: MAX_PANES }, () => ({ field: null as RippleField | null, version: -1 }));
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private maxTexture: number;
  private scratch: HTMLCanvasElement | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private sourceSize: [number, number] = [0, 0];
  private hasSource = false;
  private lutKeys: Array<string | null> = new Array(MAX_PANES).fill(null);
  private lutRow = new Float32Array(LUT_SAMPLES * 2);
  private arrays = {
    rect: new Float32Array(MAX_PANES * 4),
    shape: new Float32Array(MAX_PANES * 4),
    tint: new Float32Array(MAX_PANES * 4),
    light: new Float32Array(MAX_PANES * 4),
    misc: new Float32Array(MAX_PANES * 4),
    wave: new Float32Array(MAX_PANES * 4),
    optic: new Float32Array(MAX_PANES * 4),
  };

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('meniscus: WebGL2 is unavailable');
    this.gl = gl;

    const program = gl.createProgram();
    if (!program) throw new Error('meniscus: could not create program');
    const shaders = [compile(gl, gl.VERTEX_SHADER, VERTEX), compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.bindAttribLocation(program, 0, 'a_position');
    gl.linkProgram(program);
    // One status query, after linking: each query waits for the GPU to finish compiling.
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = shaders.map((shader) => gl.getShaderInfoLog(shader)).filter(Boolean).join('\n') || gl.getProgramInfoLog(program);
      throw new Error(`meniscus: shaders failed to compile or link: ${log}`);
    }
    this.program = program;

    for (const name of ['u_layer', 'u_screenSource', 'u_source', 'u_lut', 'u_resolution', 'u_uvScale', 'u_uvOffset', 'u_srcTexel', 'u_letterbox', 'u_count', 'u_merge', 'u_panesOnly', 'u_shadow', 'u_rect', 'u_shape', 'u_tint', 'u_light', 'u_misc', 'u_waves', 'u_wave', 'u_optic']) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error('meniscus: could not create buffers');
    this.vao = vao;
    this.buffer = buffer;
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const sourceTex = gl.createTexture();
    const lutTex = gl.createTexture();
    if (!sourceTex || !lutTex) throw new Error('meniscus: could not create textures');
    this.sourceTex = sourceTex;
    this.lutTex = lutTex;

    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, LUT_SAMPLES, MAX_PANES, 0, gl.RG, gl.FLOAT, null);

    // Wave heights, one layer per pane. A 1 × 1 placeholder keeps the sampler
    // valid; the full array is allocated the first time something ripples.
    const waveTex = gl.createTexture();
    if (!waveTex) throw new Error('meniscus: could not create textures');
    this.waveTex = waveTex;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, waveTex);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, 1, 1, 1, 0, gl.RED, gl.FLOAT, null);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * Uploads a frame of the source. Throws a SecurityError for cross-origin
   * media served without CORS headers. Sources larger than the GPU's texture
   * limit are downscaled through a 2D canvas first.
   */
  setSource(source: TexImageSource, width: number, height: number): void {
    const gl = this.gl;
    let upload: TexImageSource = source;
    let w = width;
    let h = height;
    if (w > this.maxTexture || h > this.maxTexture) {
      const k = this.maxTexture / Math.max(w, h);
      w = Math.max(1, Math.floor(w * k));
      h = Math.max(1, Math.floor(h * k));
      this.scratch ??= document.createElement('canvas');
      this.scratch.width = w;
      this.scratch.height = h;
      this.scratch.getContext('2d')?.drawImage(source as CanvasImageSource, 0, 0, w, h);
      upload = this.scratch;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (this.hasSource && this.sourceSize[0] === w && this.sourceSize[1] === h) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, upload);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    this.sourceSize = [w, h];
    this.hasSource = w > 0 && h > 0;
  }

  /**
   * `setSource`, with an image decoded off the main thread first: returns
   * false, uploading nothing, until its pixels are ready.
   */
  uploadDecoded(source: TexImageSource, width: number, height: number): boolean {
    const pixels = uploadable(source);
    if (!pixels) return false;
    this.setSource(pixels, width, height);
    uploadedFrom(source);
    return true;
  }

  get ready(): boolean {
    return this.hasSource;
  }

  private uploadProfile(row: number, glass: ResolvedGlass, key: string): void {
    if (this.lutKeys[row] === key) return;
    // Shift from the optics; slope from the lighting surface, as the CSS highlight maps use.
    const profile = glassProfile(glass);
    const lighting = lightingProfile(glass);
    const data = this.lutRow;
    const at = (table: Float32Array, t: number) => {
      const x = t * (table.length - 1);
      const j = Math.floor(x);
      const k = Math.min(table.length - 1, j + 1);
      return table[j]! + (table[k]! - table[j]!) * (x - j);
    };
    for (let i = 0; i < LUT_SAMPLES; i++) {
      const t = i / (LUT_SAMPLES - 1);
      data[i * 2] = at(profile.displacement, t);
      data[i * 2 + 1] = Math.min(MAX_SLOPE, at(lighting.slope, t));
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row, LUT_SAMPLES, 1, gl.RG, gl.FLOAT, data);
    this.lutKeys[row] = key;
  }

  /** Allocates the wave layers once. False if the GPU refused; glass then draws without waves. */
  private waves(): boolean {
    if (this.waveReady || this.waveBroken) return this.waveReady;
    const gl = this.gl;
    gl.getError();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.waveTex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, RIPPLE_MAX, RIPPLE_MAX, MAX_PANES, 0, gl.RED, gl.FLOAT, null);
    gl.activeTexture(gl.TEXTURE0);
    this.waveReady = gl.getError() === gl.NO_ERROR;
    this.waveBroken = !this.waveReady;
    return this.waveReady;
  }

  private uploadWave(layer: number, field: RippleField): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.waveTex);
    // Typed-array uploads to 3D textures require both flags off.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, field.cols, field.rows, 1, gl.RED, gl.FLOAT, field.heights);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * Draws one frame. Canvas size must already be set in device px. `fit`
   * scales the source to the canvas like object-fit, or a rect places it.
   */
  render(panes: PaneFrame[], fit: Fit | SourceRect, pixelRatio: number, options: RenderOptions | number = {}): void {
    const { merge = 0, panesOnly = false, shadow = null, layered = false, clip } = typeof options === 'number' ? { merge: options } : options;
    const gl = this.gl;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.hasSource) return;

    const [sw, sh] = this.sourceSize;
    let dw = cw;
    let dh = ch;
    let ox: number;
    let oy: number;
    if (typeof fit === 'object') {
      dw = fit.width * pixelRatio;
      dh = fit.height * pixelRatio;
      ox = fit.x * pixelRatio;
      oy = fit.y * pixelRatio;
    } else {
      if (fit !== 'fill') {
        const scale = fit === 'cover' ? Math.max(cw / sw, ch / sh) : Math.min(cw / sw, ch / sh);
        dw = sw * scale;
        dh = sh * scale;
      }
      ox = (cw - dw) / 2;
      oy = (ch - dh) / 2;
    }
    if (dw <= 0 || dh <= 0) return;

    const count = Math.min(MAX_PANES, panes.length);
    const a = this.arrays;
    for (let i = 0; i < count; i++) {
      const p = panes[i]!;
      const g = p.glass;
      const o = i * 4;
      a.rect.set([p.x * pixelRatio, p.y * pixelRatio, g.width * pixelRatio, g.height * pixelRatio], o);
      a.shape.set([g.radius * pixelRatio, g.bezel * pixelRatio, g.blur * pixelRatio, g.aberration * ABERRATION_SPREAD], o);
      const optics = p.optics;
      const presence = optics ? Math.max(0, optics.presence) : 1;
      const bend = optics ? Math.max(0, optics.refraction) * presence : 1;
      const coverage = optics ? presenceOpacity(presence) : 1;
      a.tint.set([p.tint[0], p.tint[1], p.tint[2], optics ? p.tint[3] * Math.max(0, Math.min(1, optics.tint)) : p.tint[3]], o);
      let [lx, ly, lz] = lightVector(g.lightAngle, g.lightElevation);
      if (optics && (optics.highlightX || optics.highlightY)) {
        // Turn the light toward the highlight offset.
        const tx = lx + 0.6 * optics.highlightX;
        const ty = ly + 0.6 * optics.highlightY;
        const len = Math.hypot(tx, ty, lz);
        [lx, ly, lz] = [tx / len, ty / len, lz / len];
      }
      a.light.set([lx, ly, lz, g.specular], o);
      a.optic.set([coverage, bend, optics ? Math.max(0, optics.shadow) * coverage : 1, 0], o);
      a.misc.set([g.rim, g.saturation, g.shade, pixelRatio], o);
      this.uploadProfile(i, g, `${profileKey(g.profile)}|${g.bezel}|${g.thickness}|${g.ior}|${g.caustics}|${g.radius}`);
      const field = p.ripple;
      if (field && field.active && field.cols > 0 && this.waves()) {
        const slot = this.waveUploads[i]!;
        if (slot.field !== field || slot.version !== field.version) {
          this.uploadWave(i, field);
          slot.field = field;
          slot.version = field.version;
        }
        // Small-angle refraction: a surface tilted by slope s shifts the view s·T·(1 − 1/n).
        a.wave.set([g.thickness * (1 - 1 / g.ior) * pixelRatio * bend, field.cols, field.rows, 1], o);
      } else {
        a.wave.set([0, 0, 0, 0], o);
      }
    }

    gl.useProgram(this.program);
    const u = this.uniforms;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.uniform1i(u.u_layer!, -1);
    gl.uniform1i(u.u_screenSource!, 0);
    gl.uniform1i(u.u_source!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.uniform1i(u.u_lut!, 1);
    gl.uniform2f(u.u_resolution!, cw, ch);
    gl.uniform2f(u.u_uvScale!, 1 / dw, 1 / dh);
    gl.uniform2f(u.u_uvOffset!, -ox / dw, -oy / dh);
    gl.uniform1f(u.u_srcTexel!, sw / dw);
    gl.uniform1i(u.u_letterbox!, fit === 'contain' || typeof fit === 'object' ? 1 : 0);
    gl.uniform1i(u.u_panesOnly!, panesOnly ? 1 : 0);
    gl.uniform3f(u.u_shadow!, shadow ? shadow.strength : 0, shadow ? shadow.drop * pixelRatio : 0, shadow ? shadow.blur * pixelRatio : 1);
    gl.uniform1i(u.u_count!, count);
    // A smooth minimum of radius k bridges gaps narrower than k / 2.
    gl.uniform1f(u.u_merge!, 2 * merge * pixelRatio);
    gl.uniform4fv(u.u_rect!, a.rect);
    gl.uniform4fv(u.u_shape!, a.shape);
    gl.uniform4fv(u.u_tint!, a.tint);
    gl.uniform4fv(u.u_light!, a.light);
    gl.uniform4fv(u.u_misc!, a.misc);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.waveTex);
    gl.uniform1i(u.u_waves!, 2);
    gl.uniform4fv(u.u_wave!, a.wave);
    gl.uniform4fv(u.u_optic!, a.optic);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.vao);
    const stack = clip === undefined ? count : Math.max(0, Math.min(count, clip + 1));
    if (layered && merge <= 0 && stack > 0 && (!panesOnly || clip !== undefined)) {
      gl.uniform1i(u.u_panesOnly!, 0);
      this.ensureTargets(cw, ch);
      // First pass fits the original media to the stage. Every following pass
      // samples screen coordinates, including prior refraction and shadows.
      gl.uniform1i(u.u_count!, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[0]!.framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.uniform1i(u.u_count!, count);
      gl.uniform1i(u.u_screenSource!, 1);
      gl.uniform1f(u.u_srcTexel!, 1);
      for (let i = 0; i < stack; i++) {
        const input = this.targets[i % 2]!;
        const output = i === stack - 1 ? null : this.targets[(i + 1) % 2]!.framebuffer;
        // A clipped render keeps only its last pane.
        if (clip !== undefined && i === stack - 1) gl.uniform1i(u.u_panesOnly!, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, output);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, input.texture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1i(u.u_layer!, i);
        gl.uniform3f(u.u_shadow!, shadow && panes[i]!.shadow !== false ? shadow.strength * a.optic[i * 4 + 2]! : 0, shadow ? shadow.drop * pixelRatio : 0, shadow ? shadow.blur * pixelRatio : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindVertexArray(null);
  }

  private ensureTargets(width: number, height: number): void {
    const key = `${width}x${height}`;
    if (this.targetSize === key) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    try {
      for (let i = 0; i < 2; i++) {
        if (!this.targets[i]) {
          const texture = gl.createTexture();
          const framebuffer = gl.createFramebuffer();
          if (!texture || !framebuffer) {
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(framebuffer);
            throw new Error('meniscus: could not allocate layered render targets');
          }
          this.targets.push({ texture, framebuffer });
        }
        const target = this.targets[i]!;
        gl.bindTexture(gl.TEXTURE_2D, target.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error('meniscus: layered framebuffer is incomplete');
        }
      }
      this.targetSize = key;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    }
  }

  dispose(): void {
    const gl = this.gl;
    for (const target of this.targets) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    this.targets = [];
    gl.deleteTexture(this.sourceTex);
    gl.deleteTexture(this.lutTex);
    gl.deleteTexture(this.waveTex);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.buffer);
  }
}

export { parseColor } from './color';
