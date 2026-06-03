---
name: Delivery completion gating (Tabbakheen mobile)
description: Who is allowed to finalize an order to 'delivered', and the required two-party confirmation for driver deliveries.
---

# Delivery completion gating

Driver-delivery orders must NOT be closed by the driver alone. The state machine is:
`arrived → delivered_pending_confirmation → delivered`, and the final `delivered`
transition happens ONLY when the customer confirms receipt.

- Driver sets `delivered_pending_confirmation` (never `delivered`). In that state the
  driver also gets a "Raise complaint / بلاغ" action that writes full order context to
  the Firestore `complaints` collection (used when the customer never confirms).
- Customer confirm-receipt button (shown only for `delivered_pending_confirmation`)
  calls `markOrderDelivered`, which performs the real finalization (status +
  deliveryStatus = 'delivered', COD → paid_confirmed).
- Provider "confirm delivered" is for SELF-PICKUP only (no `driverUid`). It must never
  appear for driver-delivery orders.

**Invariant enforced in `markOrderDelivered` (DataContext):** if an order has a
`driverUid` and its `deliveryStatus !== 'delivered_pending_confirmation'`, the call
throws. This is defense-in-depth so no UI path (provider or otherwise) can bypass the
customer-confirmation gate for driver deliveries.

**Why:** original flow let the driver (and the provider's confirm-delivered button) jump
straight to `delivered`, closing the order before the customer acknowledged receipt.

**How to apply:** when adding any new path that completes an order, route it through
`markOrderDelivered` and respect the driverUid/pending-confirmation invariant rather than
writing `deliveryStatus='delivered'` directly.

## Open items (not in repo)
- Firestore security rules are NOT in the repo (managed in Firebase console). The
  `complaints` collection likely needs a narrow rule: allow driver `create`, admin `read`.
- There is no admin UI to view/resolve `complaints` yet.
