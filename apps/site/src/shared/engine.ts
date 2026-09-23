import { supportsBackdropRefraction, supportsWebGL2 } from 'meniscus/core';
import { useSyncExternalStore } from 'react';

export interface EngineReport {
  browser: string;
  refracts: boolean;
  webgl: boolean;
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  const brands = (navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData?.brands ?? [];
  const named = brands.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand));
  if (named) return named.brand.replace('Google ', '').replace(/^Headless/, '');
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'this browser';
}

let cached: EngineReport | null = null;
function snapshot(): EngineReport {
  cached ??= { browser: detectBrowser(), refracts: supportsBackdropRefraction(), webgl: supportsWebGL2() };
  return cached;
}
const SERVER: EngineReport = { browser: 'this browser', refracts: false, webgl: false };

/** Which rendering paths this visitor's browser gets, stated plainly on the page. */
export function useEngine(): EngineReport {
  return useSyncExternalStore(() => () => {}, snapshot, () => SERVER);
}
