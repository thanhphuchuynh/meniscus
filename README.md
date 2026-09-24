# meniscus workspace

Liquid glass for React, refracted by optics. The library lives in [`packages/meniscus`](packages/meniscus); the demo site, playground and manual live in [`apps/site`](apps/site). The package is prepared for npm publication as `meniscus`.

```sh
pnpm install
pnpm dev        # demo site at http://localhost:5173
pnpm test       # optics and component tests
pnpm build      # library, then site
```

The demo reproduces two plates from Isaac Newton's *Opticks* (London, 1704): Book I, Plates II and IV, public domain, scanned by the [Internet Archive](https://archive.org/details/optickstreatise00newta) and duotoned for the site.

The original project code and documentation are [MIT licensed](LICENSE). The site's bundled fonts and JavaScript dependencies retain their own licenses, listed in the [third-party notices](apps/site/public/THIRD_PARTY_NOTICES.txt). The demo's [privacy note](apps/site/public/PRIVACY.txt) describes its local theme preference and current data use.
