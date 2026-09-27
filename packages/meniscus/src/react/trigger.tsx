import { cloneElement, isValidElement, useEffect, useRef, version, type ForwardedRef, type ReactElement, type Ref, type SyntheticEvent } from 'react';
import { DEV } from './dev';
import { useMergedRef } from './refs';

type Handler = (e: SyntheticEvent) => void;

/** React 19 passes a ref as a prop; React 18 keeps it on the element. */
const REF_ON_ELEMENT = version.startsWith('18');
let warned = false;

function ownRef(element: ReactElement): Ref<unknown> | undefined {
  return REF_ON_ELEMENT ? (element as unknown as { ref?: Ref<unknown> }).ref : (element.props as { ref?: Ref<unknown> }).ref;
}

/**
 * Clones the element that opens an overlay with `props` added. Its own
 * handlers run first, then ours. `aria-describedby` values join, and its own
 * ref still receives the node, which `onNode` gets too. Warns in development
 * when no node ever arrives: a component that doesn't pass its ref through
 * can't anchor an overlay or take focus back.
 */
export function useTrigger(element: ReactElement | undefined, props: Record<string, unknown>, onNode: (node: HTMLElement | null) => void): ReactElement | null {
  const valid = isValidElement(element);
  const node = useRef<HTMLElement | null>(null);
  const latest = useRef(onNode);
  latest.current = onNode;
  // Stable, so the merged ref changes only when the element's own ref does.
  const report = useRef((value: HTMLElement | null) => {
    node.current = value instanceof HTMLElement ? value : null;
    latest.current(node.current);
  }).current;
  const setRef = useMergedRef(((valid && ownRef(element)) || null) as ForwardedRef<HTMLElement>, report);

  useEffect(() => {
    if (!DEV || !valid || node.current || warned) return;
    warned = true;
    console.warn('meniscus: an overlay’s trigger never received a DOM node. Pass an element, or a component that passes its ref through.');
  }, [valid]);

  if (!valid) return null;
  const own = element.props as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...props, ref: setRef };
  for (const [key, value] of Object.entries(props)) {
    const theirs = own[key];
    if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof theirs === 'function') {
      merged[key] = (e: SyntheticEvent) => {
        (theirs as Handler)(e);
        (value as Handler)(e);
      };
    }
  }
  if (typeof own['aria-describedby'] === 'string' && typeof props['aria-describedby'] === 'string') {
    merged['aria-describedby'] = `${own['aria-describedby']} ${props['aria-describedby']}`;
  }
  return cloneElement(element, merged);
}
