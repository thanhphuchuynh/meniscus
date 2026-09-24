import { useEffect, useState } from 'react';
import { GlassPhysics, type GlassPhysicsOptions } from '../core/physics';
import { REDUCED_MOTION } from '../core/support';
import { useIsomorphicLayoutEffect, useMediaQuery } from './hooks';

/**
 * A `GlassPhysics` owned by this component: one instance for its whole life,
 * reconfigured as options change and paused on unmount. Give it to a glass
 * as `optics`, then move it with `to()` and `impulse()`. It follows the
 * reduced-motion setting unless `reducedMotion` is passed.
 */
export function useGlassPhysics(options: GlassPhysicsOptions = {}): GlassPhysics {
  const systemReduced = useMediaQuery(REDUCED_MOTION);
  const reducedMotion = options.reducedMotion ?? systemReduced;
  const [physics] = useState(() => new GlassPhysics({ ...options, reducedMotion }));
  // Keyed by value: inline objects are new on every render.
  const physicsKey = JSON.stringify(options.physics ?? null);
  const responseKey = JSON.stringify(options.response ?? null);
  useIsomorphicLayoutEffect(() => {
    physics.configure({ physics: options.physics, response: options.response, reducedMotion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physics, physicsKey, responseKey, reducedMotion]);
  // Pause, not dispose: StrictMode unmounts and remounts effects in development,
  // and a transition started once at mount must survive that. A real unmount
  // leaves a paused instance for the garbage collector.
  useEffect(() => {
    physics.resume();
    return () => physics.pause();
  }, [physics]);
  return physics;
}
