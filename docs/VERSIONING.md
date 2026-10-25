# Versioning and releases

ministoregen has one version for the whole app: `vMAJOR.MINOR.PATCH`
following [Semantic Versioning 2.0.0](https://semver.org). The version lives
in git tags only; `package.json` stays at `0.0.0`. Every merge to `main` is
production-ready, and each pull request says before it merges whether it
produces a major, minor or patch release, or none.

## What the version promises

The version describes what people keep between visits and between prints:

| Surface | Where |
|---------|-------|
| Saved data | the collection, the single-bin design and the library in the browser's local storage |
| Backup file | the library export (`format`, `version`, designs, collection) |
| Share links | the design carried in the URL |
| Printed parts | the Gridfinity shell, and parts meant to fit each other across versions (an inlay in a bin, a lid on a bin) |

| Bump | When | Examples |
|------|------|----------|
| **major** | Something saved or printed with the previous version stops working with the new one. | Saved collections, backups or share links that no longer open or open differently; a lid or inlay that no longer fits a bin printed with the previous version; a shell change that breaks Gridfinity compatibility. |
| **minor** | A new capability that leaves everything above working. | New part, setting, base shape, view or export; a new optional field in saved data. |
| **patch** | A fix with no new capability and no contract change. | Bug fix, layout fix, wording, performance. |
| **none** | Nothing people use changes. | Documentation, CI, tests only, refactors with identical behaviour, dev tooling. |

When in doubt between two levels, take the higher one.

**Before 1.0 (`0.x`): no compatibility gate.** ministoregen starts at
`v0.1.0` (decided 2026-10-25). Until `v1.0.0` is released, a breaking change
is labelled `release:minor` (`v0.3.4` → `v0.4.0`); `release:major` still
works and bumps the minor too. Going to `v1.0.0` is a deliberate step: run
the Release workflow by hand with `version: v1.0.0`; from then on every rule
here applies.

## Release workflow

Trunk-based: every pull request merges to `main` with a rebase merge, and
every merge is a release candidate.

**Labels.** Every pull request carries exactly one of:

| Label | Effect on merge |
|-------|-----------------|
| `release:major` | `vX.Y.Z` → `v(X+1).0.0` (`v0.Y.Z` → `v0.(Y+1).0` before 1.0) |
| `release:minor` | `vX.Y.Z` → `vX.(Y+1).0` |
| `release:patch` | `vX.Y.Z` → `vX.Y.(Z+1)` |
| `release:none` | no release, no deploy |

Dependabot pull requests get `release:patch` (npm) or `release:none`
(GitHub Actions) from `.github/dependabot.yml`.

**On every pull request** (`.github/workflows/release-label.yml`, check name
`Release label`): fails unless exactly one `release:*` label is set, and
writes the version the merge will produce into the job summary. It re-runs
when labels change, and a just-opened pull request gets up to a minute for
its label to arrive. Make it a required status check on `main`
(Settings → Branches) so a pull request cannot merge without a decision.

**After CI passes on `main`** (`.github/workflows/release.yml`, triggered by
the `ministoregen` workflow completing successfully for a push): collects the
pull requests merged since the latest `v*` tag and takes the highest
`release:*` label among them. If that is above `release:none`, it computes
the next version (`scripts/next-version.sh`), builds the site with the
version stamped in, deploys it to GitHub Pages, tags the commit and
publishes a GitHub Release with the release notes and the built site as a
zip. Consequences:

- GitHub Pages always serves a released version; a `release:none` merge is
  not deployed;
- a red `main` never releases; the next green merge releases everything
  since the last tag, with the highest bump among them;
- runs are serialised and a commit already contained in a tag is skipped;
- a commit pushed to `main` without a pull request counts as `release:none`;
- `Run workflow` on the Release workflow re-plans a commit by hand (for
  example after a failed run), or publishes an exact `version` (for example
  `v1.0.0` when leaving `0.x`).

**Release notes** are written for the people using the app, not for its
developers: every pull request body has a `## User notes` section saying in
plain words what changes for them (a sentence or a few bullets), without PR
numbers, links, package or code names. It stays empty when nobody notices
the change. `scripts/release-notes.sh` collects the sections of the pull
requests in the release, oldest first, into the release body ("Minor
improvements and fixes." when none has one).

**Starting point.** With no tag yet, the base is `0.0.0`; the pull request
that introduces this workflow is labelled `release:minor`, so its merge
publishes `v0.1.0`.

## Version in the app

The header shows the version next to the name. `vite.config.js` stamps it
into the build as `__APP_VERSION__` (`src/version.js`):

- releases: the tag, e.g. `v0.2.0`, linked to its release notes;
- pull request previews: `preview #17`, linked to the pull request;
- local builds and the dev server: `git describe`, e.g. `v0.2.0-3-gabc1234`,
  or `dev` without git.
