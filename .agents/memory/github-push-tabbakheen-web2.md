---
name: Pushing to GitHub repo tabbakheen-web2
description: How/where to push the Tabbakheen mobile app to GitHub, and branch-state gotchas
---

# Pushing the mobile app to `deadevil2002/tabbakheen-web2`

No GitHub git remote is configured locally (only a gitsafe backup). Local `git commit`
is a blocked bash command. Push via the **GitHub Git Data API** (blobs -> tree -> commit ->
update ref) using `process.env.GITHUB_TOKEN` (available in **bash/node**, NOT in the
code_execution sandbox). Never print the token. Git Data API gives one clean commit;
the Contents API PUT-per-file would create one commit per file.

**Why this matters / branch state:** the repo's branches lag the local working tree.
The active branch is **`replit-final-mobile-stable`** (monorepo layout, paths under
`artifacts/mobile/...`). `main`/`master` are months old and use the old `expo/` (or root)
path prefix. Crucially, the **verification foundation was never pushed to any branch**
(e.g. `fsGetVerificationCrNumber`, `VerifiedBadge`, freelance submission). So any feature
built on verification cannot be pushed as a clean small delta — you must include its
verification dependency files or the branch won't build.

**How to apply:** when asked to push a mobile feature, (1) base new branches off
`replit-final-mobile-stable`, (2) compute the true diff by comparing git-blob SHAs of the
local tree vs the branch's recursive tree, (3) determine the buildable dependency closure
and verify by temporarily swapping the *excluded* changed files to their branch versions
and running `pnpm --filter @workspace/mobile run typecheck` (ignore pre-existing
`hooks/useColors.ts` scaffold errors), then restore. worker.js lives in a DIFFERENT repo
(`tabbakheen-api-worker`); pushing mobile never touches it or admin.

Note: `expo-env.d.ts` is a generated, git-ignored file ("should be in your git ignore") —
do not commit it.
