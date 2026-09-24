import { createContext } from 'react';
import type { ResolvedGlass } from '../core/glass';
import type { GlassPhysics } from '../core/physics';

/** A control layer beneath another, as the WebGL path needs it. */
export interface StackPane {
  el: HTMLElement;
  glass: ResolvedGlass;
  optics: GlassPhysics;
}

/** What a control layer tells its own glass. */
export interface LayerHandle {
  /** Take WebGL even where live refraction works (`renderer="webgl"`). */
  preferWebGL: boolean;
  /** The glass shares its resolved shape, for the layers above that draw it. Returns the unbind. */
  bind(glass: () => ResolvedGlass | null): () => void;
  /** Control layers beneath this one, deepest first. */
  below(): StackPane[];
}

/** Set by a control layer for its own glass. That glass clears it for its children. */
export const LayerContext = createContext<LayerHandle | null>(null);

/** True anywhere inside a control layer, for the nested-stack warning. */
export const InsideLayerContext = createContext(false);
