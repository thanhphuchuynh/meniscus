import type { RGBAImage } from './maps';

/**
 * Encodes an RGBA image as a PNG data URL. Uses a canvas in the browser
 * (native compression) and a small uncompressed encoder anywhere else, so the
 * same call works in workers, tests and server code.
 */
export function toDataURL(img: RGBAImage): string {
  const canvas = createCanvas(img.width, img.height);
  if (canvas) {
    // A CPU canvas: a GPU one makes toDataURL wait for the GPU to drain every frame queued before it.
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (ctx && 'toDataURL' in canvas) {
      const data = ctx.createImageData(img.width, img.height);
      data.data.set(img.data);
      ctx.putImageData(data, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }
  return `data:image/png;base64,${base64(encodePNG(img))}`;
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  if (typeof canvas.getContext !== 'function') return null;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A valid PNG using zlib "stored" blocks (no compression). */
export function encodePNG(img: RGBAImage): Uint8Array {
  const { width, height, data } = img;
  const rowLength = width * 4 + 1;
  const raw = new Uint8Array(rowLength * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowLength] = 0; // filter: none
    raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * rowLength + 1);
  }

  // zlib wrapper around stored deflate blocks of at most 65535 bytes.
  const blockCount = Math.max(1, Math.ceil(raw.length / 65535));
  const zlib = new Uint8Array(2 + raw.length + blockCount * 5 + 4);
  let o = 0;
  zlib[o++] = 0x78;
  zlib[o++] = 0x01;
  for (let b = 0; b < blockCount; b++) {
    const start = b * 65535;
    const len = Math.min(65535, raw.length - start);
    zlib[o++] = b === blockCount - 1 ? 1 : 0;
    zlib[o++] = len & 0xff;
    zlib[o++] = (len >>> 8) & 0xff;
    zlib[o++] = ~len & 0xff;
    zlib[o++] = (~len >>> 8) & 0xff;
    zlib.set(raw.subarray(start, start + len), o);
    o += len;
  }
  let a = 1;
  let b2 = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]!) % 65521;
    b2 = (b2 + a) % 65521;
  }
  const adler = ((b2 << 16) | a) >>> 0;
  zlib[o++] = (adler >>> 24) & 0xff;
  zlib[o++] = (adler >>> 16) & 0xff;
  zlib[o++] = (adler >>> 8) & 0xff;
  zlib[o++] = adler & 0xff;

  const chunks: Array<[string, Uint8Array]> = [
    ['IHDR', ihdr(width, height)],
    ['IDAT', zlib.subarray(0, o)],
    ['IEND', new Uint8Array(0)],
  ];
  const total = 8 + chunks.reduce((sum, [, body]) => sum + 12 + body.length, 0);
  const out = new Uint8Array(total);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  let p = 8;
  for (const [type, body] of chunks) {
    writeU32(out, p, body.length);
    for (let i = 0; i < 4; i++) out[p + 4 + i] = type.charCodeAt(i);
    out.set(body, p + 8);
    writeU32(out, p + 8 + body.length, crc32(out, p + 4, p + 8 + body.length));
    p += 12 + body.length;
  }
  return out;
}

function ihdr(width: number, height: number): Uint8Array {
  const b = new Uint8Array(13);
  writeU32(b, 0, width);
  writeU32(b, 4, height);
  b[8] = 8; // bit depth
  b[9] = 6; // RGBA
  return b;
}

function writeU32(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}

function base64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const B = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (B) return B.from(bytes).toString('base64');
  throw new Error('meniscus: no base64 encoder available');
}
