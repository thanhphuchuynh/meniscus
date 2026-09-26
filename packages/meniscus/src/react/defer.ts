import { NEAR } from '../core/support';

/**
 * Deferred work for glass that starts off screen: its maps are built in idle
 * time after the page is up, or at once when it comes within NEAR of the
 * viewport, whichever is first. Glass on screen never waits.
 */

type Job = () => void;

const idle = new Set<Job>();
const watched = new Map<Element, Job>();
let observer: IntersectionObserver | undefined;
let pumping = false;

/** Whether `el` is on screen or within NEAR (half a screen above or below) of it. True where nothing can observe it later. */
export function nearViewport(el: Element): boolean {
  if (typeof IntersectionObserver === 'undefined') return true;
  const r = el.getBoundingClientRect();
  const h = window.innerHeight;
  return r.bottom >= -h / 2 && r.top <= h * 1.5 && r.right >= 0 && r.left <= window.innerWidth;
}

/** Runs `job` once: in idle time, or as soon as `el` comes near the viewport. Returns a cancel. */
export function whenNearOrIdle(el: Element, job: Job): () => void {
  let done = false;
  const cancel = () => {
    done = true;
    idle.delete(run);
    if (watched.get(el) === run) {
      watched.delete(el);
      observer?.unobserve(el);
    }
  };
  const run = () => {
    if (done) return;
    cancel();
    job();
  };
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) watched.get(e.target)?.();
    },
    { rootMargin: NEAR },
  );
  watched.set(el, run);
  observer.observe(el);
  idle.add(run);
  schedule();
  return cancel;
}

function schedule(): void {
  if (pumping || !idle.size) return;
  pumping = true;
  if (typeof requestIdleCallback === 'function') requestIdleCallback(pump, { timeout: 2000 });
  else setTimeout(pump, 50);
}

/** A few jobs per idle period, in the order the glass mounted; always at least one, so a busy page still gets there. */
function pump(deadline?: IdleDeadline): void {
  pumping = false;
  const end = performance.now() + 8;
  for (const job of idle) {
    job();
    if ((deadline ? deadline.timeRemaining() : end - performance.now()) < 2) break;
  }
  schedule();
}
