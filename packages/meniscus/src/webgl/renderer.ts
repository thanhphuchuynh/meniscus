import { glassProfile, lightingProfile, type ResolvedGlass } from '../core/glass';
import { ABERRATION_SPREAD } from '../core/filter';
import { lightVector } from '../core/maps';
import { profileKey } from '../core/profiles';
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
}

const MAX_SLOPE = 1e4;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('meniscus: could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`meniscus: shader failed to compile: ${log}`);
  }
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
  };

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('meniscus: WebGL2 is unavailable');
    this.gl = gl;

    const program = gl.createProgram();
    if (!program) throw new Error('meniscus: could not create program');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.bindAttribLocation(program, 0, 'a_position');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`meniscus: program failed to link: ${gl.getProgramInfoLog(program)}`);
    this.program = program;

    for (const name of ['u_layer', 'u_screenSource', 'u_source', 'u_lut', 'u_resolution', 'u_uvScale', 'u_uvOffset', 'u_srcTexel', 'u_letterbox', 'u_count', 'u_merge', 'u_panesOnly', 'u_shadow', 'u_rect', 'u_shape', 'u_tint', 'u_light', 'u_misc', 'u_waves', 'u_wave']) {
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
    const { merge = 0, panesOnly = false, shadow = null, layered = false } = typeof options === 'number' ? { merge: options } : options;
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
      a.tint.set(p.tint, o);
      const [lx, ly, lz] = lightVector(g.lightAngle, g.lightElevation);
      a.light.set([lx, ly, lz, g.specular], o);
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
        a.wave.set([g.thickness * (1 - 1 / g.ior) * pixelRatio, field.cols, field.rows, 1], o);
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.vao);
    if (layered && merge <= 0 && !panesOnly && count > 0) {
      this.ensureTargets(cw, ch);
      // First pass fits the original media to the stage. Every following pass
      // samples screen coordinates, including prior refraction and shadows.
      gl.uniform1i(u.u_count!, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[0]!.framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.uniform1i(u.u_count!, count);
      gl.uniform1i(u.u_screenSource!, 1);
      gl.uniform1f(u.u_srcTexel!, 1);
      for (let i = 0; i < count; i++) {
        const input = this.targets[i % 2]!;
        const output = i === count - 1 ? null : this.targets[(i + 1) % 2]!.framebuffer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, output);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, input.texture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1i(u.u_layer!, i);
        gl.uniform3f(u.u_shadow!, shadow && panes[i]!.shadow !== false ? shadow.strength : 0, shadow ? shadow.drop * pixelRatio : 0, shadow ? shadow.blur * pixelRatio : 1);
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
