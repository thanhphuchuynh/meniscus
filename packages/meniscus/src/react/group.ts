import { createContext, useContext } from 'react';

export interface GroupContextValue {
  register: (el: HTMLElement, radius: () => number) => () => void;
}

export const GroupContext = createContext<GroupContextValue | null>(null);

/** For `Glass`: the group this glass belongs to, if any. Grouped glass hands its surface to the group. */
export function useGlassGroup(): GroupContextValue | null {
  return useContext(GroupContext);
}
