'use client';

import { Glass, useGlassMode } from 'meniscus';
import { useState } from 'react';

// A function prop can't cross from the server, so this part lives on the client.
export function PathReport() {
  const mode = useGlassMode();
  const [path, setPath] = useState('…');
  return (
    <Glass as="p" radius="capsule" className="report" onPathChange={(drawn, reason) => setPath(`${drawn}, ${reason}`)}>
      Glass on this page draws <b>{mode}</b>; this pill draws <b>{path}</b>.
    </Glass>
  );
}
