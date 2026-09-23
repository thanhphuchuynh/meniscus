import { useCallback, type ForwardedRef } from 'react';

/**
 * A callback ref that reports the node and forwards it to the app's ref,
 * passing through the cleanup a React 19 callback ref may return.
 */
export function useMergedRef<E>(forwarded: ForwardedRef<E>, onNode: (node: E | null) => void) {
  return useCallback(
    (node: E | null) => {
      onNode(node);
      if (typeof forwarded === 'function') {
        const cleanup = (forwarded as (n: E | null) => void | (() => void))(node);
        if (typeof cleanup === 'function') {
          return () => {
            onNode(null);
            cleanup();
          };
        }
      } else if (forwarded) {
        forwarded.current = node;
      }
      return undefined;
    },
    [forwarded, onNode],
  );
}
