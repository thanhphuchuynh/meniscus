'use client';

import { GlassButton, toast } from 'meniscus';

// toast() runs in the browser: a Server Component can render this button, not call it.
export function ToastButton() {
  return <GlassButton onClick={() => toast('Plate saved', { description: 'From a client component.' })}>Save plate</GlassButton>;
}
