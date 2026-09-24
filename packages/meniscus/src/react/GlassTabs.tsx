import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Glass } from './Glass';
import { GlassIndicator } from './GlassIndicator';

export interface GlassTabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface GlassTabsProps {
  /** Accessible name for the tab list. */
  label: string;
  items: readonly GlassTabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

const TAB_STYLE: CSSProperties = {
  position: 'relative',
  padding: '0.65em 1em',
  border: 0,
  borderRadius: '9999px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
};

/** A complete tab list and panel with keyboard selection and a moving glass lens. */
export function GlassTabs({ label, items, value, defaultValue, onValueChange, className, style }: GlassTabsProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items.find((item) => !item.disabled)?.value);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const selectedValue = value ?? internalValue;
  const selected = items.find((item) => item.value === selectedValue && !item.disabled) ?? items.find((item) => !item.disabled);
  const selectedIndex = selected ? items.indexOf(selected) : -1;

  const select = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    if (value === undefined) setInternalValue(item.value);
    if (item.value !== selected?.value) onValueChange?.(item.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else return;
    event.preventDefault();
    for (let count = 0; count < items.length; count++) {
      if (!items[next]?.disabled) {
        select(next);
        (event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next] as HTMLButtonElement | undefined)?.focus();
        return;
      }
      next = event.key === 'ArrowLeft' || event.key === 'End' ? (next - 1 + items.length) % items.length : (next + 1) % items.length;
    }
  };

  return (
    <div className={className} style={style}>
      <Glass role="tablist" aria-label={label} radius="capsule" style={{ display: 'flex', position: 'relative', width: 'fit-content', maxWidth: '100%', gap: 2, padding: 4 }}>
        <GlassIndicator target={target} />
        {items.map((item, index) => (
          <button
            key={item.value}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            ref={selectedIndex === index ? setTarget : undefined}
            aria-selected={selectedIndex === index}
            aria-controls={`${id}-panel-${index}`}
            disabled={item.disabled}
            tabIndex={selectedIndex === index ? 0 : -1}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            style={TAB_STYLE}
          >
            {item.label}
          </button>
        ))}
      </Glass>
      {items.map((item, index) => (
        <div key={item.value} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} tabIndex={selectedIndex === index ? 0 : -1} hidden={selectedIndex !== index}>
          {item.content}
        </div>
      ))}
    </div>
  );
}
