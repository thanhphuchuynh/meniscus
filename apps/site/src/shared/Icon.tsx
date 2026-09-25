import type { SVGProps } from 'react';

/**
 * Icons drawn in the plate's single engraving weight: 1.5px strokes on a
 * 24px grid, round joins, no fills.
 */
/** A numeral five for the skip glyphs, drawn at the same stroke. */
const FIVE = 'M13.6 8.75h-2.9l-.4 3.2c.5-.35 1.05-.5 1.6-.5 1.25 0 2.1.95 2.1 2.1s-.9 2.2-2.2 2.2c-.8 0-1.4-.35-1.8-.9';

const paths = {
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  arrow: <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />,
  lantern: (
    <>
      <path d="M9.5 4.5h5M12 2.5v2" />
      <path d="M8 7.5h8l1 2v7.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9.5z" />
      <path d="M12 11.5c-1.2 1.3-1.2 2.9 0 4 1.2-1.1 1.2-2.7 0-4z" />
      <path d="M9 21.5h6" />
    </>
  ),
  print: (
    <>
      <path d="M7 8.5V3.5h10v5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="2" />
      <path d="M7 14.5h10v6H7z" />
    </>
  ),
  grip: <path d="M10 8v8M14 8v8" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  expand: <path d="M9 4.5H4.5V9M15 4.5h4.5V9M4.5 15v4.5H9M19.5 15v4.5H15" />,
  volume: <><path d="M4.5 9h4l4.5-3.5v13L8.5 15h-4z" /><path d="M16 8a6 6 0 0 1 0 8M18.5 5.5a9.5 9.5 0 0 1 0 13" /></>,
  muted: <><path d="M4.5 9h4l4.5-3.5v13L8.5 15h-4z" /><path d="m16 9 5 6m0-6-5 6" /></>,
  back: <path d="M15 5.5L8.5 12l6.5 6.5" />,
  forward: <path d="M9 5.5l6.5 6.5L9 18.5" />,
  back5: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4.5v3.5h3.5" />
      <path d={FIVE} />
    </>
  ),
  forward5: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M20 4.5v3.5h-3.5" />
      <path d={FIVE} />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  bookmark: <path d="M7 3.5h10v17l-5-3.8-5 3.8z" />,
  share: (
    <>
      <path d="M12 3.5v11M7.5 8L12 3.5 16.5 8" />
      <path d="M5.5 11.5v7a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  reset: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4.5v3.5h3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {paths[name]}
    </svg>
  );
}

/** The mark: a liquid surface curving up the walls of its vessel. */
export function MeniscusMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M6 5v17a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 12.5c3 5.2 17 5.2 20 0" stroke="var(--spot)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
