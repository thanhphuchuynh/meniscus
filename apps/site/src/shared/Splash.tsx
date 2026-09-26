import { GlassLoader } from 'meniscus';
import { useEffect, useState } from 'react';

const LONGEST = 2500;
const FADE = 450;

/**
 * The loading page shown as the site opens: glass drops that fuse and part
 * until the page's fonts are in (at most a few seconds), then a fade. It
 * never holds a page that is already ready.
 */
export function Splash() {
  const [phase, setPhase] = useState<'on' | 'leaving' | 'off'>('on');

  useEffect(() => {
    let alive = true;
    // A frame in, the page's text is laid out and its fonts have been asked for.
    const frame = requestAnimationFrame(() => {
      const longest = new Promise<void>((done) => setTimeout(done, LONGEST));
      Promise.race([document.fonts?.ready, longest]).then(() => {
        if (alive) setPhase('leaving');
      });
    });
    return () => {
      alive = false;
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
