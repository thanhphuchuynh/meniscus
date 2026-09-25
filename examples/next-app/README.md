# meniscus in the Next.js App Router

A minimal App Router page that renders meniscus from a Server Component.

```sh
npm install
npm run dev
```

- `app/page.tsx` is a Server Component. meniscus's React entries carry `"use client"`, so `Glass`, `GlassButton` and the stack render there directly, with plain-data props.
- In server files, use the named `GlassStack` and `GlassLayer`. `Glass.Stack` reads a property off a client component, and on the server that property is undefined, so the page fails to render.
- Anything that takes a function, such as `onPathChange`, lives in a client file: `app/path-report.tsx`.

CI builds this example against the library packed from this repository, so a change that breaks Server Components fails the build.
