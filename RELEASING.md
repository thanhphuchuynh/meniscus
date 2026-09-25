# Releasing meniscus

The package version in `packages/meniscus/package.json` is the release version. Tags use the matching `v` prefix, such as `v0.1.1`.

The `meniscus` package on npm must trust GitHub Actions from `thanhphuchuynh/meniscus` and workflow filename `release.yml`, with direct `npm publish` allowed. Configure this under the package's Trusted Publisher settings on npm before pushing a release tag. The workflow uses npm's short-lived OIDC credentials; do not add an npm token to GitHub secrets.

1. Update the package version and add its section to `CHANGELOG.md`. Keep new work in `Unreleased` until it belongs to a version.
2. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`. Review the npm tarball with `cd packages/meniscus && npm pack --dry-run`. If `Glass` changed size, update the gzipped size in the site's quick start (`apps/site/src/home/Home.tsx`): the minified `import { Glass }` bundle with React external, gzip level 9.
3. Commit the version and changelog changes. Push `main` and confirm CI passes.
4. Create and push an annotated tag: `git tag -a v0.1.1 -m "meniscus v0.1.1"`, then `git push origin v0.1.1` (replace the version for later releases).

The release workflow checks that the tag matches the package version, reruns CI, builds the package, publishes to npm through trusted publishing, and creates a GitHub Release with notes from that version's changelog section and an npm tarball.
