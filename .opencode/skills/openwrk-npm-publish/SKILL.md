---
name: openwrk-npm-publish
description: |
  Use when manual recovery or one-off openwrk npm publishing is required; otherwise use `release`.

  Triggers when user mentions:
  - "openwrk npm publish"
  - "publish openwrk"
  - "bump openwrk"
---

## Quick usage (already configured)

1. Ensure you are on the default branch and the tree is clean.
2. Bump versions via `release` to keep `openwrk` aligned with app/desktop versions.

3. Commit the bump.
4. Preferred: publish via the "Release App" GitHub Actions workflow by tagging `vX.Y.Z`.

Manual recovery path (sidecars + npm) below.

```bash
pnpm --filter openwrk build:sidecars
gh release create openwrk-vX.Y.Z packages/headless/dist/sidecars/* \
  --repo different-ai/openwork \
  --title "openwrk vX.Y.Z sidecars" \
  --notes "Sidecar binaries and manifest for openwrk vX.Y.Z"
```

5. Build openwrk binaries for all supported platforms.

```bash
pnpm --filter openwrk build:bin:all
```

6. Publish `openwrk` as a meta package + platform packages (optionalDependencies).

```bash
node packages/headless/scripts/publish-npm.mjs
```

7. Verify the published version.

```bash
npm view openwrk version
```

---

## Scripted publish

```bash
./.opencode/skills/openwrk-npm-publish/scripts/publish-openwrk.sh
```

---

## First-time setup (if not configured)

Authenticate with npm before publishing.

```bash
npm login
```

Alternatively, export an npm token in your environment (see `.env.example`).

---

## Notes

- `openwrk` is published as:
  - `openwrk` (wrapper + optionalDependencies)
  - `openwrk-darwin-arm64`, `openwrk-darwin-x64`, `openwrk-linux-arm64`, `openwrk-linux-x64`, `openwrk-windows-x64` (platform binaries)
- `openwrk` is versioned in lockstep with OpenWork app/desktop releases.
- openwrk downloads sidecars from `openwrk-vX.Y.Z` release assets by default.
