import { GlassLoader } from 'meniscus';
import { useEffect, useState } from 'react';

const SHORTEST = 900;
const LONGEST = 2500;
const FADE = 450;

/**
 * The loading page shown as the site opens: glass drops that fuse and part
 * until the fonts and images are in (at least a moment, at most a few
 * seconds), then a fade.
 */
export function Splash() {
  const [phase, setPhase] = useState<'on' | 'leaving' | 'off'>('on');

  useEffect(() => {
    // Count the shortest stay from the first frame the splash is painted in,
    // not from mount: a heavy first render can delay that paint.
    let start = performance.now();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => (start = performance.now()));
    });
    const loaded = new Promise<void>((done) => (document.readyState === 'complete' ? done() : window.addEventListener('load', () => done(), { once: true })));
    const ready = Promise.all([document.fonts?.ready, loaded]);
    const longest = new Promise<void>((done) => setTimeout(done, LONGEST));
    let timer = 0;
    let alive = true;
    Promise.race([ready, longest]).then(() => {
      if (!alive) return;
      timer = window.setTimeout(() => setPhase('leaving'), Math.max(0, SHORTEST - (performance.now() - start)));
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = setTimeout(() => setPhase('off'), FADE);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'off') return null;
  return <GlassLoader page label="Loading meniscus" className="splash" data-leaving={phase === 'leaving' ? '' : undefined} />;
}
