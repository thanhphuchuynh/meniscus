import { unionKernel, type UnionJob } from './union';

/** Encoded union maps, as data URLs ready for `feImage`, `mask-image` and `background-image`. */
export interface UnionURLs {
  displacement: string;
  highlight: string;
}

// The worker runs the kernel's own source text, then encodes both maps with
// an OffscreenCanvas and returns data URLs, so the main thread only swaps
// strings. Data URLs work in every place the maps are used, where blob URLs
// are not guaranteed to (SVG feImage).
const source = () => `'use strict';
const unionKernel = ${unionKernel.toString()};
let canvas = null;
function encode(data, width, height) {
  if (!canvas) canvas = new OffscreenCanvas(width, height);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' }).then((blob) => new FileReaderSync().readAsDataURL(blob));
}
self.onmessage = async (event) => {
  const { id, job } = event.data;
  try {
    const px = unionKernel(job);
    const displacement = await encode(px.disp, px.width, px.height);
    const highlight = await encode(px.glow, px.width, px.height);
    self.postMessage({ id, displacement, highlight });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
`;

interface Pending {
  resolve: (urls: UnionURLs) => void;
  reject: (reason: unknown) => void;
}

let worker: Worker | null = null;
let broken = false;
let forced: boolean | undefined;
let seq = 0;
const pending = new Map<number, Pending>();

function capable(): boolean {
  if (forced !== undefined) return forced;
  return (
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  );
}

function fail(reason: unknown): void {
  broken = true;
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(reason);
  pending.clear();
}

function spawn(): Worker | null {
  if (worker) return worker;
  if (broken || !capable()) return null;
  try {
    // A content security policy without `blob:` in worker-src throws here or
    // fires `error`; either way every later job runs on the main thread.
    worker = new Worker(URL.createObjectURL(new Blob([source()], { type: 'text/javascript' })));
  } catch (error) {
    fail(error);
    return null;
  }
  worker.onmessage = (event: MessageEvent<{ id: number; displacement?: string; highlight?: string; error?: string }>) => {
    const { id, displacement, highlight, error } = event.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error !== undefined || displacement === undefined || highlight === undefined) p.reject(new Error(error ?? 'meniscus: union worker returned nothing'));
    else p.resolve({ displacement, highlight });
  };
  worker.onerror = (event) => {
    event.preventDefault?.();
    fail(new Error('meniscus: union worker failed to start'));
  };
  return worker;
}

/**
 * Builds and encodes union maps off the main thread. Returns null where
 * workers, OffscreenCanvas or blob workers are unavailable; the promise
 * rejects if the worker fails, after which this keeps returning null.
 */
export function buildUnionInWorker(job: UnionJob): Promise<UnionURLs> | null {
  const w = spawn();
  if (!w) return null;
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, job });
  });
}

/** For tests: force the worker on or off, or undefined to detect again. Resets a failed worker. */
export function overrideUnionWorker(value: boolean | undefined): void {
  forced = value;
  broken = false;
  worker?.terminate();
  worker = null;
}
