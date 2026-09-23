import { createElement, type CSSProperties } from 'react';
import { describeFilter, type FilterNode } from '../core/filter';
import type { TileURLs } from '../core/glass';

export interface GlassFilterProps {
  id: string;
  width: number;
  height: number;
  tiles: TileURLs;
  aberration?: number;
  /** Margin around the glass in the filter's space, px; see `describeFilter`. */
  offset?: number;
}

const HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 0,
  height: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

function renderNode(node: FilterNode, key: number): ReturnType<typeof createElement> {
  // `data-scale` keeps the full strength while an appear animation ramps `scale`.
  const extra = node.tag === 'feDisplacementMap' ? { 'data-scale': node.attrs.scale } : null;
  return createElement(node.tag, { key, ...node.attrs, ...extra }, node.children?.map(renderNode));
}

/**
 * The SVG refraction filter for one glass, sized in the element's own px.
 * `display: none` would disable the filter in some engines, so the SVG is
 * collapsed to zero size instead.
 */
export function GlassFilter({ id, width, height, tiles, aberration = 0, offset = 0 }: GlassFilterProps) {
  const nodes = describeFilter({ width, height, tiles, aberration, offset });
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={HIDDEN}>
      <filter
        id={id}
        x="0"
        y="0"
        width={width + 2 * offset}
        height={height + 2 * offset}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        {nodes.map(renderNode)}
      </filter>
    </svg>
  );
}
