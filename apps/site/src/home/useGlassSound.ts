import { useEffect, useRef, useState } from 'react';

/** Optional, locally synthesized sound. Audio is created only after an explicit click. */
export function useGlassSound() {
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close().catch(() => {}); }, []);
  const toggle = async () => {
    if (enabled) { setEnabled(false); void context.current?.suspend().catch(() => {}); return; }
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      setEnabled(true);
    } catch { setUnavailable(true); }
  };
  const play = () => {
    const ctx = context.current;
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const at = ctx.currentTime;
    for (const [frequency, volume] of [[1568, 0.035], [2637, 0.015]]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.setValueAtTime(frequency!, at);
      gain.gain.setValueAtTime(volume!, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.23);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  };
  return { enabled, unavailable, toggle, play };
}
