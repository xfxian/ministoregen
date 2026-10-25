# ministoregen agent instructions

Web app that generates 3D-printable Gridfinity bins and inlays for storing tabletop miniatures. Static site (React, Vite, three.js), deployed to GitHub Pages from `main`.

## Workflow

- Branches: `<type>/<short-kebab-topic>` with type one of feat, fix, docs, chore, refactor, ci, test. One branch per PR.
- Every change goes through a PR; merges use GitHub rebase merge. Never merge `main` into a branch; rebase instead.
- A PR is ready when CI is green and it is rebased on current `main`.
- PR bodies follow `.github/pull_request_template.md`, including "User notes" for end users; they become the release notes.
- Every PR carries exactly one release label: `release:major`, `release:minor`, `release:patch` or `release:none`. Merges to `main` release and deploy automatically; see `docs/VERSIONING.md`.
- Visual changes get screenshots in the PR.
- English everywhere in the repo: code, comments, docs, commits, PR text.

## Commands

```sh
npm ci            # install from lockfile
npm run dev       # dev server on http://localhost:5173
npm test          # vitest
npm run lint      # eslint, zero warnings allowed
npm run build     # production build to dist/
```

Lockfile changes need npm 11 or newer (`npx npm@11 install`); npm 10 crashes resolving this dependency tree.

## Geometry design rule

The bin has two layers with different rules:

- **Gridfinity shell** (outside): must stay compatible with Gridfinity and is covered by fit tests. Changes need a test print against a reference bin.
- **Interior features** (inside): miniature-specific parts such as base pockets, magnet pockets, inlays, lids. Free to change as long as the shell tests pass.

Gridfinity reference dimensions (mm):

| Item | Value |
| --- | --- |
| Grid pitch | 42 |
| Bin body per unit | 41.5 |
| Outer corner radius | 3.75 |
| Foot profile, bottom to top | 0.8 at 45°, 1.8 vertical, 2.15 at 45° (4.75 total) |
| Foot bottom size per unit | 35.6 |
| Stacking lip profile, from its base | starts 2.6 inward, 0.7 at 45° outward, 1.8 vertical, 1.9 at 45° outward to the outer face (4.4 total) |
| Height unit | 7 |
