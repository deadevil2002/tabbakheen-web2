---
name: Driver delivery detail routing (mobile)
description: How the driver "delivery detail" is reached in the Tabbakheen Expo app — there is no per-id detail route.
---

# Driver delivery "detail" = the my-deliveries tab (inline expand)

The driver has no per-order detail route file. `app/(driver)/my-deliveries/`
contains only `index.tsx` + `_layout.tsx` (no `[id].tsx`). The "detail" view is
the **my-deliveries tab itself**, where each delivery card expands inline
(`expandedOrderId` state) to reveal `DeliveryRouteMap`.

**Rule:** To open a specific driver delivery from elsewhere (e.g. the dashboard
"آخر التوصيلات" cards), navigate to the tab route and pass the order id as a
param, then let the tab auto-expand it:
`router.push({ pathname: '/(driver)/my-deliveries', params: { focusId: order.id } })`.
The tab reads `useLocalSearchParams` (normalize `string | string[]`) and on a
present `focusId` sets `filter='all'` + `expandedOrderId=focusId`.

**Why:** Pushing to `/(driver)/my-deliveries/${id}` resolves to a non-existent
dynamic route → Expo Router shows "Page not found / الصفحة غير موجودة". This is a
recurring trap because the path *looks* like a valid nested detail route.

**How to apply:** Never link to `my-deliveries/<id>` as a path segment unless a
`[id].tsx` is actually added. The deliveries tab cards (available deliveries)
have only an Accept action — no navigation.
