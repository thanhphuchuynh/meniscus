import { place, placementSide, POSITION_AREA, type GlassPlacement } from '../src/core/place';

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

it('maps every placement to a CSS position-area and a side', () => {
  expect(Object.keys(POSITION_AREA)).toHaveLength(12);
  expect(POSITION_AREA['bottom-start']).toBe('bottom span-right');
  expect(POSITION_AREA['left-end']).toBe('left span-top');
  expect(placementSide('right-start')).toBe('right');
});
