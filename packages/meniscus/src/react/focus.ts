/** Whether focus on `el` came from the keyboard, as `:focus-visible` tells. Engines without it count every focus. */
export function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable=""], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** Where focus should land inside `root`: an `autofocus` element, else the first focusable one. */
export function firstFocusable(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
}
