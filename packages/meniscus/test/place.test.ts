import { place, placementSide, type GlassPlacement } from '../src/core/place';

const viewport = { x: 0, y: 0, width: 400, height: 300 };
const anchor = { x: 150, y: 120, width: 100, height: 40 };
const box = { width: 80, height: 50 };

it.each<[GlassPlacement, number, number]>([
  ['bottom', 160, 168],
  ['bottom-start', 150, 168],
  ['bottom-end', 170, 168],
  ['top', 160, 62],
  ['right', 258, 115],
  ['left', 62, 115],
  ['left-start', 62, 120],
  ['right-end', 258, 110],
])('%s puts the box beside the anchor, offset px away', (placement, x, y) => {
  expect(place(anchor, box, placement, { offset: 8, viewport })).toEqual({ x, y, placement });
});

it('flips to the opposite side when the requested one lacks room and the other has more', () => {
  const low = { x: 150, y: 260, width: 100, height: 30 };
  expect(place(low, box, 'bottom', { offset: 8, viewport })).toEqual({ x: 160, y: 202, placement: 'top' });
  expect(place(low, box, 'bottom-end', { offset: 8, viewport }).placement).toBe('top-end');
});

it('keeps the requested side when the other has no more room', () => {
  expect(place(anchor, { width: 80, height: 290 }, 'bottom', { offset: 8, viewport }).placement).toBe('bottom');
});

it('shifts along the edge to stay inside the viewport padding', () => {
  expect(place({ x: 2, y: 120, width: 30, height: 40 }, box, 'bottom', { offset: 8, viewport }).x).toBe(8);
  expect(place({ x: 380, y: 120, width: 20, height: 40 }, box, 'bottom', { offset: 8, viewport }).x).toBe(312);
  expect(place({ x: 150, y: 2, width: 40, height: 20 }, box, 'right', { offset: 8, viewport }).y).toBe(8);
});

it('pins a box wider than the viewport to its start', () => {
  expect(place(anchor, { width: 500, height: 20 }, 'bottom', { offset: 8, viewport }).x).toBe(8);
});

it('overlaps its anchor rather than leave the viewport when neither side has room', () => {
  const p = place({ x: 150, y: 130, width: 100, height: 40 }, { width: 80, height: 200 }, 'bottom', { offset: 8, viewport });
  expect(p).toEqual({ x: 160, y: 300 - 8 - 200, placement: 'bottom' });
});

it('follows its anchor out of the viewport rather than come loose from it', () => {
  // Scrolled above the top: the box keeps touching the anchor's edge.
  expect(place({ x: 150, y: -100, width: 100, height: 40 }, box, 'bottom', { offset: 8, viewport }).y).toBe(-52);
});

it('pins a box taller than the viewport to its top', () => {
  expect(place(anchor, { width: 80, height: 500 }, 'bottom', { offset: 8, viewport }).y).toBe(8);
});

it('names the side of each placement', () => {
  expect(placementSide('right-start')).toBe('right');
  expect(placementSide('top')).toBe('top');
});
