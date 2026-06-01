---
name: Mobile typecheck baseline (pre-existing failures)
description: Why `pnpm --filter @workspace/mobile run typecheck` exits non-zero even on clean changes
---

# Mobile typecheck has pre-existing scaffold errors

`pnpm --filter @workspace/mobile run typecheck` exits status 2 due to errors in
`hooks/useColors.ts` referencing `colors.light` and `colors.radius`, which don't
exist in this app's flat `constants/colors.ts` (the real app uses a flat color
object, not a light/dark palette). `useColors.ts` is scaffold leftover used only
by other scaffold leftovers (`components/ErrorFallback.tsx`,
`app/(tabs)/_layout.tsx`) — none are part of the real Tabbakheen routes.

**How to apply:** When verifying mobile changes, filter these out and confirm
your own files are clean:
`pnpm --filter @workspace/mobile run typecheck 2>&1 | grep -E "\.tsx?\(" | grep -v "useColors.ts"`
An empty result means your change is type-clean. Do NOT "fix" useColors.ts unless
the task is about it — it's out of scope and unrelated.
