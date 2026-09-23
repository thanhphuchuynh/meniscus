import type { TileURLs } from './glass';

export type FilterAttrs = Record<string, string | number>;

export interface FilterNode {
  tag: 'feFlood' | 'feImage' | 'feMerge' | 'feMergeNode' | 'feDisplacementMap' | 'feColorMatrix' | 'feBlend';
  attrs: FilterAttrs;
  children?: FilterNode[];
}

export interface FilterInput {
  width: number;
  height: number;
  tiles: TileURLs;
  /** 0 to 1; splits the color channels along the displacement. */
  aberration?: number;
  /**
   * Margin around the glass inside the filter's space, px. The filtered
   * element is that much larger than the glass on every side (so a blur has
   * page to draw from at the rim); the map sits `offset` in.
   */
  offset?: number;
}

/** Channel spread at aberration 1: red travels 25% further than green, blue 25% less. */
export const ABERRATION_SPREAD = 0.25;

const ONLY = {
  r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
};

/**
 * The primitives of the refraction filter, in user space px of the element.
 * A neutral flood covers the plateau; corner tiles and stretched edge strips
 * are merged over it to assemble the displacement map, which then shifts the
 * backdrop. Strips extend 1 px under the corners so no seam shows neutral.
 */
export function describeFilter({ width: w, height: h, tiles, aberration = 0, offset: m = 0 }: FilterInput): FilterNode[] {
  const r = tiles.radius;
  const nodes: FilterNode[] = [{ tag: 'feFlood', attrs: { floodColor: 'rgb(128, 128, 128)', result: 'neutral' } }];
  const merge: string[] = ['neutral'];
  const img = (result: string, href: string, x: number, y: number, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    nodes.push({ tag: 'feImage', attrs: { href, x: x + m, y: y + m, width, height, preserveAspectRatio: 'none', result } });
    merge.push(result);
  };
  const span = w - 2 * r;
  const rise = h - 2 * r;
  if (span > 0) {
    img('top', tiles.top, r - 1, 0, span + 2, r);
    img('bottom', tiles.bottom, r - 1, h - r, span + 2, r);
  }
  if (rise > 0) {
    img('left', tiles.left, 0, r - 1, r, rise + 2);
    img('right', tiles.right, w - r, r - 1, r, rise + 2);
  }
  img('tl', tiles.tl, 0, 0, r, r);
  img('tr', tiles.tr, w - r, 0, r, r);
  img('bl', tiles.bl, 0, h - r, r, r);
  img('br', tiles.br, w - r, h - r, r, r);
  nodes.push({ tag: 'feMerge', attrs: { result: 'map' }, children: merge.map((m) => ({ tag: 'feMergeNode', attrs: { in: m } })) });

  const displace = (scale: number, result?: string): FilterNode => ({
    tag: 'feDisplacementMap',
    attrs: { in: 'SourceGraphic', in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', ...(result ? { result } : {}) },
  });

  const spread = Math.max(0, Math.min(1, aberration)) * ABERRATION_SPREAD;
  if (spread <= 0) {
    nodes.push(displace(tiles.scale));
    return nodes;
  }
  nodes.push(
    displace(tiles.scale * (1 + spread), 'shiftR'),
    { tag: 'feColorMatrix', attrs: { in: 'shiftR', type: 'matrix', values: ONLY.r, result: 'red' } },
    displace(tiles.scale, 'shiftG'),
    { tag: 'feColorMatrix', attrs: { in: 'shiftG', type: 'matrix', values: ONLY.g, result: 'green' } },
    displace(tiles.scale * (1 - spread), 'shiftB'),
    { tag: 'feColorMatrix', attrs: { in: 'shiftB', type: 'matrix', values: ONLY.b, result: 'blue' } },
    { tag: 'feBlend', attrs: { in: 'red', in2: 'green', mode: 'screen', result: 'rg' } },
    { tag: 'feBlend', attrs: { in: 'rg', in2: 'blue', mode: 'screen' } },
  );
  return nodes;
}

const SVG_ATTR: Record<string, string> = {
  floodColor: 'flood-color',
  xChannelSelector: 'xChannelSelector',
  yChannelSelector: 'yChannelSelector',
  preserveAspectRatio: 'preserveAspectRatio',
};

function attrString(attrs: FilterAttrs): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${SVG_ATTR[k] ?? k}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ');
}

function nodeString(n: FilterNode): string {
  const inner = n.children?.map(nodeString).join('') ?? '';
  return inner ? `<${n.tag} ${attrString(n.attrs)}>${inner}</${n.tag}>` : `<${n.tag} ${attrString(n.attrs)}/>`;
}

/** A complete `<filter>` element as markup, for use without React. */
export function filterMarkup(id: string, input: FilterInput): string {
  const body = describeFilter(input).map(nodeString).join('');
  const m = input.offset ?? 0;
  return `<filter id="${id}" x="0" y="0" width="${input.width + 2 * m}" height="${input.height + 2 * m}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${body}</filter>`;
}
