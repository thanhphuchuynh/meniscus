import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Glass } from "./Glass";
import { useMergedRef } from "./refs";
import { GlassGlyph } from "./GlassGlyph";

const FIELD: CSSProperties = {
  display: "grid",
  gap: "0.2em",
  padding: "0.7em 1em",
  color: "inherit",
};

const CONTROL: CSSProperties = {
  width: "100%",
  // The whole field shows focus; a second ring inside it would box the text in.
  outline: "none",
  minWidth: 0,
  padding: "0.15em 0",
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

const LABEL: CSSProperties = { fontSize: "0.8em", fontWeight: 600 };
const DISABLED: CSSProperties = { opacity: 0.5, cursor: "not-allowed" };
/** Set `--meniscus-focus-ring` (an outline) to match your own focus style. */
const RING: CSSProperties = {
  outline: "var(--meniscus-focus-ring, auto)",
  outlineOffset: 2,
};

function visible(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** Focus inside a field, for drawing the ring on the field itself. */
function useFieldFocus(disabled: boolean | undefined) {
  const [ring, setRing] = useState(false);
  const style: CSSProperties = {
    ...FIELD,
    ...(disabled ? DISABLED : null),
    ...(ring ? RING : null),
  };
  return {
    style,
    onFocus: (e: FocusEvent<HTMLElement>) => setRing(visible(e.target)),
    onBlur: () => setRing(false),
  };
}

export interface GlassTextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children"
> {
  label: string;
}

/** A labelled native input on a glass surface. Validation and form submission stay native. */
export const GlassTextField = forwardRef<HTMLInputElement, GlassTextFieldProps>(
  function GlassTextField({ label, type = "text", style, ...props }, ref) {
    const field = useFieldFocus(props.disabled);
    return (
      <Glass as="label" radius={18} interactive={!props.disabled} {...field}>
        <span style={LABEL}>{label}</span>
        <input
          ref={ref}
          type={type}
          style={{ ...CONTROL, ...style }}
          {...props}
        />
      </Glass>
    );
  },
);

export interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

/** A labelled native select on a glass surface. */
export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  function GlassSelect({ label, children, style, ...props }, ref) {
    const field = useFieldFocus(props.disabled);
    return (
      <Glass as="label" radius={18} interactive={!props.disabled} {...field}>
        <span style={LABEL}>{label}</span>
        <select ref={ref} style={{ ...CONTROL, ...style }} {...props}>
          {children}
        </select>
      </Glass>
    );
  },
);

export interface GlassCheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> {
  label: string;
}

const BOX: CSSProperties = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: "1.3em",
  height: "1.3em",
};
const HIDDEN_INPUT: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  opacity: 0,
  cursor: "inherit",
};
const TICK: CSSProperties = {
  width: "0.8em",
  height: "0.8em",
  overflow: "visible",
};

/**
 * A checkbox drawn in glass: a small glass box whose check mark draws itself
 * in, on a glass hit target with a visible label. The native checkbox stays
 * underneath, invisible, so keyboard, forms, validation and assistive
 * technology work as usual.
 */
export const GlassCheckbox = forwardRef<HTMLInputElement, GlassCheckboxProps>(
  function GlassCheckbox(
    { label, style, onChange, onFocus, onBlur, ...props },
    ref,
  ) {
    const controlled = props.checked !== undefined;
    const [own, setOwn] = useState(!!props.defaultChecked);
    const checked = controlled ? !!props.checked : own;
    const [ring, setRing] = useState(false);
    const input = useRef<HTMLInputElement | null>(null);
    const setRef = useMergedRef(ref, (el: HTMLInputElement | null) => {
      input.current = el;
    });
    // A form reset changes an uncontrolled box without a change event.
    useEffect(() => {
      const form = input.current?.form;
      if (!form || controlled) return;
      const reset = () => setTimeout(() => setOwn(!!input.current?.checked));
      form.addEventListener("reset", reset);
      return () => form.removeEventListener("reset", reset);
    }, [controlled]);

    return (
      <Glass
        as="label"
        radius="capsule"
        // The disabled state lives on the input, so the label's glass is told directly.
        interactive={!props.disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.65em",
          padding: "0.65em 1em",
          color: "inherit",
          cursor: "pointer",
          ...(props.disabled ? DISABLED : null),
        }}
      >
        <span style={BOX}>
          <Glass
            as="span"
            aria-hidden="true"
            radius={7}
            tint={
              checked
                ? "color-mix(in srgb, currentColor 16%, transparent)"
                : undefined
            }
            shadow="0 1px 2px rgba(0, 0, 0, 0.12)"
            style={{ ...BOX, ...(ring ? RING : null) }}
          >
            {/* The tick is glass too. */}
            <GlassGlyph depth={0.7}>
              <svg viewBox="0 0 12 12" style={TICK}>
                <path
                  d="M2.2 6.4 4.9 9 9.8 3.2"
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 1,
                    strokeDashoffset: checked ? 0 : 1,
                    transition:
                      "stroke-dashoffset 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </svg>
            </GlassGlyph>
          </Glass>
          <input
            ref={setRef}
            type="checkbox"
            style={{ ...HIDDEN_INPUT, ...style }}
            onChange={(e) => {
              if (!controlled) setOwn(e.target.checked);
              onChange?.(e);
            }}
            onFocus={(e) => {
              setRing(visible(e.target));
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setRing(false);
              onBlur?.(e);
            }}
            {...props}
          />
        </span>
        <span>{label}</span>
      </Glass>
    );
  },
);
