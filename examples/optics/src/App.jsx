import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GlassPane, GlassStage } from 'meniscus/webgl';
import './style.css';

// Local SVG source: no image server, CORS requirement or tracking request.
const source = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#eef2f4"/><g stroke="#0f1a24" stroke-width="2">' + Array.from({ length: 30 }, (_, i) => `<path d="M0 ${i * 24}h800M${i * 32} 0v600"/>`).join('') + '</g><circle cx="400" cy="300" r="145" fill="#ff4a1c"/><text x="400" y="320" font-family="serif" font-size="62" text-anchor="middle" fill="#0f1a24">Opticks</text></svg>')}`;

function App() {
  const [ior, setIor] = useState(1.5);
  const [aberration, setAberration] = useState(0.12);
  const [light, setLight] = useState(-45);
  return <main>
    <h1>Glass that bends light.</h1>
    <p>Change the refractive index. The curved rim uses Snell’s law to shift the image beneath it.</p>
    <GlassStage source={source} alt="A ruled optical target with a red disc" style={{ height: 400, borderRadius: 12 }}>
      <GlassPane radius={110} bezel={90} ior={ior} aberration={aberration} lightAngle={light} variant="clear"
        style={{ position: 'absolute', left: 'calc(50% - 110px)', top: 90, width: 220, height: 220 }} />
    </GlassStage>
    <label>Refractive index n <output>{ior.toFixed(2)}</output><input type="range" min="1" max="2.42" step="0.01" value={ior} onChange={e => setIor(Number(e.target.value))} /></label>
    <label>Chromatic aberration <output>{aberration.toFixed(2)}</output><input type="range" min="0" max="0.5" step="0.01" value={aberration} onChange={e => setAberration(Number(e.target.value))} /></label>
    <label>Light angle <output>{light}°</output><input type="range" min="-180" max="180" value={light} onChange={e => setLight(Number(e.target.value))} /></label>
    <p><a href="https://github.com/thanhphuchuynh/meniscus">Meniscus on GitHub</a> · Edit <code>src/App.jsx</code> to try more props.</p>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
