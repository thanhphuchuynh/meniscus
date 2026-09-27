/** A side of the anchor, optionally aligned to its start or end edge. Without an alignment the box is centered. */
export type GlassPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end';

/** A rectangle in viewport px. */
export interface PlaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

const OPPOSITE: Readonly<Record<Side, Side>> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** The side of the anchor a placement puts the box on. */
export function placementSide(p: GlassPlacement): Side {
  return p.split('-')[0] as Side;
}

function alignOf(p: GlassPlacement): Align {
  const a = p.split('-')[1];
  return a === 'start' || a === 'end' ? a : 'center';
}

const vertical = (side: Side) => side === 'top' || side === 'bottom';

/** Space between the anchor and the viewport's padded edge on one side. */
function room(a: PlaceRect, v: PlaceRect, side: Side, padding: number): number {
  switch (side) {
    case 'top':
      return a.y - (v.y + padding);
    case 'bottom':
      return v.y + v.height - padding - (a.y + a.height);
    case 'left':
      return a.x - (v.x + padding);
    case 'right':
      return v.x + v.width - padding - (a.x + a.width);
  }
}

/**
 * Where a box goes beside an anchor: on the placement's side, `offset` px
 * away, centered or aligned to the anchor's start or end. If that side lacks
 * room and the opposite side has more, it flips. It then shifts along the
 * edge to stay `padding` px inside the viewport. Returns the side it used.
 */
export function place(
  anchor: PlaceRect,
  box: { width: number; height: number },
  placement: GlassPlacement,
  { offset, viewport, padding = 8 }: { offset: number; viewport: PlaceRect; padding?: number },
): { x: number; y: number; placement: GlassPlacement } {
  let side = placementSide(placement);
  const align = alignOf(placement);
  const need = (vertical(side) ? box.height : box.width) + offset;
  const here = room(anchor, viewport, side, padding);
  if (here < need && room(anchor, viewport, OPPOSITE[side], padding) > here) side = OPPOSITE[side];

  let x: number;
  let y: number;
  if (vertical(side)) {
    y = side === 'top' ? anchor.y - offset - box.height : anchor.y + anchor.height + offset;
    x = align === 'start' ? anchor.x : align === 'end' ? anchor.x + anchor.width - box.width : anchor.x + (anchor.width - box.width) / 2;
    x = Math.max(viewport.x + padding, Math.min(x, viewport.x + viewport.width - padding - box.width));
  } else {
    x = side === 'left' ? anchor.x - offset - box.width : anchor.x + anchor.width + offset;
    y = align === 'start' ? anchor.y : align === 'end' ? anchor.y + anchor.height - box.height : anchor.y + (anchor.height - box.height) / 2;
    y = Math.max(viewport.y + padding, Math.min(y, viewport.y + viewport.height - padding - box.height));
  }
  return { x, y, placement: (align === 'center' ? side : `${side}-${align}`) as GlassPlacement };
}
