import { Glass, GlassButton, GlassLayer, GlassProvider, GlassStack } from 'meniscus';
import { PathReport } from './path-report';

// A Server Component. meniscus's React entries carry "use client", so they
// render here as client components; every prop crosses as plain data.
export default function Page() {
  return (
    <GlassProvider lightAngle={300}>
      <main className="page">
        <Glass as="header" radius="capsule" className="bar">
          <strong>meniscus</strong>
          <GlassButton>Plates</GlassButton>
          <GlassButton>Search</GlassButton>
        </Glass>
        {/* Named exports on the server: <Glass.Stack> reads a property off a client component, which is undefined here. */}
        <GlassStack className="stack">
          <GlassLayer kind="context" className="scene" />
          <GlassLayer depth={1} className="card" radius={26}>
            <h1>Glass from a Server Component</h1>
            <PathReport />
          </GlassLayer>
        </GlassStack>
      </main>
    </GlassProvider>
  );
}
