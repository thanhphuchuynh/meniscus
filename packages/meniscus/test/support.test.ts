// @vitest-environment jsdom
import { overridePopoverSupport, supportsPopover } from '../src/core';

afterEach(() => {
  overridePopoverSupport(undefined);
  vi.restoreAllMocks();
});

it('detects the Popover API on HTMLElement.prototype', () => {
  const proto = HTMLElement.prototype as { showPopover?: unknown };
  const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
  try {
    delete proto.showPopover;
    overridePopoverSupport(undefined);
    expect(supportsPopover()).toBe(false);
    Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: () => {} });
    overridePopoverSupport(undefined);
    expect(supportsPopover()).toBe(true);
  } finally {
    if (saved) Object.defineProperty(HTMLElement.prototype, 'showPopover', saved);
    else delete proto.showPopover;
  }
});
