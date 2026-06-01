---
name: Expo-router tab back-navigation
description: How to make Back return to the originating tab when opening a shared detail screen from multiple tabs.
---

# Returning Back to the originating tab (expo-router tabs)

When a detail screen (e.g. provider profile) is reachable from more than one tab, pushing
the route that lives in another tab's stack makes the OS Back button return to *that* tab,
not the one the user came from.

**Rule:** give each originating tab its own copy of the detail route inside its own stack,
and push the in-stack path. To avoid duplicating the screen, put the screen body in a shared
component under `components/` and have each route file re-export it:
`export { default } from '@/components/ProviderProfileScreen';`

**Why:** in Tabbakheen the customer map opened the profile via `/(customer)/home/provider/[id]`,
so Back dropped the user on the Home tab instead of the Map. Adding `/(customer)/map/provider/[id]`
(re-exporting the same shared screen) and pushing that path kept Back returning to the map.

**How to apply:** when a tab needs to open a detail page and keep its own back stack, add the
route under that tab's folder and re-export the shared screen component; navigate to the in-tab path.
