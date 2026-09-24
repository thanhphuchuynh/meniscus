import {
  useId,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { DEFAULTS } from "../core/glass";
import { useGlassDefaults } from "./context";

export interface GlassGlyphProps extends HTMLAttributes<HTMLSpanElement> {
  /** Height of the bevel, px. Thin line icons want about 1; bold shapes 2 to 4. */
  depth?: number;
  /** Opacity of the glyph's body, 0 to 1. Lower lets what's beneath show through. */
  body?: number;
  /** Where the light comes from, degrees clockwise from the top. Defaults to the provider's `lightAngle`. */
  lightAngle?: number;
  children?: ReactNode;
}

const HIDDEN: CSSProperties = {
  position: "absolute",
  width: 0,
  height: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

/**
 * Makes whatever it wraps (an SVG icon, shapes, text) look like a piece of
 * glass, as in Apple's Icon Composer: a translucent body, a bright rim where
 * the bevel faces the light, a shaded far edge, and a soft shadow below.
 * Glyphs that overlap tint each other like stacked glass. It works in every
 * browser: one SVG filter applied through CSS `filter`.
 */
export function GlassGlyph({
  depth = 2,
  body = 0.82,
  lightAngle,
  style,
  children,
  ...rest
}: GlassGlyphProps) {
  const defaults = useGlassDefaults();
  const id = `meniscus-glyph-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const a =
    ((lightAngle ?? defaults.lightAngle ?? DEFAULTS.lightAngle) * Math.PI) /
    180;
  // Toward the light, in screen space (y down).
  const lx = Math.sin(a);
  const ly = -Math.cos(a);
  const azimuth = (Math.atan2(ly, lx) * 180) / Math.PI;
  const d = Math.max(0.3, depth);
  // With glass switched off for a subtree, glyphs are plain too. The tree
  // keeps its shape either way, so the children never remount.
  const on = defaults.mode !== "none";
  return (
    <>
      {on ? (
        <svg
          aria-hidden="true"
          focusable="false"
          width="0"
          height="0"
          style={HIDDEN}
        >
          <filter
            id={id}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            {/* The glyph's outline, softened into a bevel: a height map. */}
            <feGaussianBlur in="SourceAlpha" stdDeviation={d} result="height" />
            {/* The sun on the bevel, kept inside the glyph. */}
            <feSpecularLighting
              in="height"
              surfaceScale={d * 1.8}
              specularConstant={1.1}
              specularExponent={22}
              lightingColor="#ffffff"
              result="spec"
            >
              <feDistantLight azimuth={azimuth} elevation={48} />
            </feSpecularLighting>
            <feComposite
              in="spec"
              in2="SourceAlpha"
              operator="in"
              result="rim"
            />
            {/* The edge facing away from the light: what's left when the glyph is lifted toward it. */}
            <feOffset
              in="SourceAlpha"
              dx={lx * d * 1.4}
              dy={ly * d * 1.4}
              result="lifted"
            />
            <feComposite
              in="SourceAlpha"
              in2="lifted"
              operator="out"
              result="crescent"
            />
            <feGaussianBlur
              in="crescent"
              stdDeviation={d * 0.7}
              result="softCrescent"
            />
            <feComposite
              in="softCrescent"
              in2="SourceAlpha"
              operator="in"
              result="shadeMask"
            />
            <feColorMatrix
              in="shadeMask"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0.05  0 0 0 0.32 0"
              result="shade"
            />
            {/* The body: the glyph's own colour, translucent. */}
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${body} 0`}
              result="body"
            />
            {/* A soft shadow falling away from the light. */}
            <feGaussianBlur
              in="SourceAlpha"
              stdDeviation={d * 1.3}
              result="blurred"
            />
            <feOffset
              in="blurred"
              dx={-lx * d}
              dy={Math.max(0.6, -ly) * d * 1.2}
              result="dropped"
            />
            <feColorMatrix
              in="dropped"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0.05  0 0 0 0.22 0"
              result="drop"
            />
            <feMerge>
              <feMergeNode in="drop" />
              <feMergeNode in="body" />
              <feMergeNode in="shade" />
              <feMergeNode in="rim" />
            </feMerge>
          </filter>
        </svg>
      ) : null}
      <span
        {...rest}
        style={{
          display: "inline-grid",
          placeItems: "center",
          filter: on ? `url(#${id})` : undefined,
          ...style,
        }}
      >
        {children}
      </span>
    </>
  );
}
