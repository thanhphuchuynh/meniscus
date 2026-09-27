// @vitest-environment jsdom
import { overrideAnchorPositioning, overridePopoverSupport, supportsAnchorPositioning, supportsPopover } from '../src/core';

afterEach(() => {
  overridePopoverSupport(undefined);
  overrideAnchorPositioning(undefined);
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

it('asks CSS for anchor positioning, and an override wins', () => {
  const supports = vi.spyOn(CSS, 'supports').mockReturnValue(false);
  overrideAnchorPositioning(undefined);
  expect(supportsAnchorPositioning()).toBe(false);
  supports.mockReturnValue(true);
  overrideAnchorPositioning(undefined);
  expect(supportsAnchorPositioning()).toBe(true);
  expect(supports).toHaveBeenCalledWith('position-area', 'bottom');
  overrideAnchorPositioning(false);
  expect(supportsAnchorPositioning()).toBe(false);
});
