---
name: Driver available deliveries (mobile)
description: How "available delivery orders" visibility is defined for drivers, and the deliveryMethod over-filter gotcha.
---

# Driver available-deliveries visibility

An order is available to a driver **iff** `deliveryStatus === 'ready_for_driver' && driverUid == null`.
This is the authoritative contract — it matches the Firestore security rules AND the Firestore
query in `fsSubscribeAvailableDeliveries` (services/firestoreOrders.ts).

**Do NOT also filter available deliveries by `deliveryMethod === 'driver'`.**

**Why:** `DeliveryMethod` allows BOTH `'driver'` and `'driver_delivery'`, and the codebase is
inconsistent: the customer/local path uses `'driver'` while the Firebase-mode `assignDriver` and the
server Worker (`/finalize-delivery`, external Cloudflare Worker, not in this repo) persist
`'driver_delivery'` — and `toOrder()` falls back to `null` if the field is absent. A strict
`deliveryMethod === 'driver'` equality in the client-side `getAvailableDeliveries()` silently
dropped every otherwise-valid order, so drivers saw zero available deliveries even though Firestore
returned them correctly. Root-cause fix was to drop that predicate.

**How to apply:** Keep `getAvailableDeliveries()` keyed on `deliveryStatus === 'ready_for_driver'`
and `!driverUid` only. Self-pickup never reaches `ready_for_driver` (it uses
`self_pickup_selected`), so pickups cannot leak in. Security is enforced server-side (rules +
subscription query), never by this client display filter.

Claim flow: `fsDriverAcceptOrder` sets `driverUid` + `deliveryStatus: 'driver_assigned'`, which
removes the order from the available pool and moves it to the driver's own deliveries.
