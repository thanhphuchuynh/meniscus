import { Glass, GlassButton, GlassDialog, GlassLayer, GlassProvider, GlassStack, GlassToaster } from 'meniscus';
import { PathReport } from './path-report';
import { ToastButton } from './toast-button';

// A Server Component. meniscus's React entries carry "use client", so they
// render here as client components; every prop crosses as plain data, and
// elements such as a dialog's trigger cross as elements.
export default function Page() {
  return (
    <GlassProvider lightAngle={300}>
      <main className="page">
        <Glass as="header" radius="capsule" className="bar">
          <strong>meniscus</strong>
          <GlassButton>Plates</GlassButton>
          <GlassDialog label="Search the plates" trigger={<GlassButton>Search</GlassButton>}>
            <p>A dialog rendered from a Server Component.</p>
            <form method="dialog">
              <GlassButton type="submit">Done</GlassButton>
            </form>
          </GlassDialog>
          <ToastButton />
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
      <GlassToaster />
    </GlassProvider>
  );
}
