# Releasing meniscus

The package version in `packages/meniscus/package.json` is the release version. Tags use the matching `v` prefix, such as `v0.1.0`. The initial version is `0.1.0`; no tag has been created yet.

1. Update the package version and add its section to `CHANGELOG.md`. Keep new work in `Unreleased` until it belongs to a version.
2. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`. Review the npm tarball with `cd packages/meniscus && npm pack --dry-run`.
3. Commit the version and changelog changes. Push `main` and confirm CI passes.
4. Create and push an annotated tag: `git tag -a v0.1.0 -m "meniscus v0.1.0"`, then `git push origin v0.1.0` (replace the version for later releases).

The release workflow checks that the tag matches the package version, reruns CI, builds the package, and creates a GitHub Release with notes from that version's changelog section and an npm tarball. It does not publish to npm. npm publication needs a separate decision and registry credentials.
