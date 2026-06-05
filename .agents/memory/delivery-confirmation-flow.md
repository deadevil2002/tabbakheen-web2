---
name: Delivery completion gating + complaints (Tabbakheen mobile)
description: Who may finalize an order to 'delivered', the two-party confirmation for driver deliveries, and how delivery complaints are persisted under Firestore rules.
---

# Delivery completion gating

Driver-delivery orders must NOT be closed by the driver alone. The state machine is:
`arrived → delivered_pending_confirmation → delivered`, and the final `delivered`
transition happens ONLY when the customer confirms receipt.

- Driver sets `arrived`, then `delivered_pending_confirmation` (never `delivered`).
- Customer confirm-receipt button shows for `deliveryStatus` of EITHER
  `delivered_pending_confirmation` OR `arrived`, and calls `markOrderDelivered`.
  **Why both:** `delivered_pending_confirmation` is a newer intermediate state that
  does not always persist (a driver write can be rejected by Firestore rules, leaving
  the order stuck at `arrived` showing "وصل السائق" with no confirm button — the
  reported regression). `arrived` always persists, so keying the button on both makes
  the customer able to confirm once the driver has reached them. It still does NOT show
  while the driver is en route (`driver_assigned`/`picked_up`/`in_transit`).
- Customer also has a reject-receipt action in that state that raises a delivery
  complaint and does NOT finalize the order.
- Provider "confirm delivered" is for SELF-PICKUP only (no `driverUid`). It must never
  appear for driver-delivery orders.

**Invariants enforced in `markOrderDelivered` (DataContext):** the actor must be the
order's customer (`authUser.uid === order.customerUid`); and if an order has a
`driverUid` its `deliveryStatus` must be `delivered_pending_confirmation` OR `arrived`,
else it throws. The guard must stay in lockstep with the button condition above, or the
button shows but finalize fails. Defense-in-depth so no UI path can bypass the gate.

**Why:** original flow let the driver / provider's confirm-delivered button jump
straight to `delivered`, closing the order before the customer acknowledged receipt.

# Customer writes must survive Firestore rules (rules-resilient write pattern)

Firestore rules let the customer change delivery-only fields (proven: a customer
update of `{deliveryMethod, deliveryStatus, deliveryQuoteId}` succeeds) but appear to
DENY a customer changing `status` / `paymentStatus`. A single `updateDoc` mixing
allowed + denied fields fails entirely → the user saw `orderUpdateError`.

**Rule:** for any customer-initiated order completion, split the write: a *primary*
write of only the field(s) the customer is permitted to change (`{deliveryStatus:
'delivered'}` — the UI keys "delivered" off `deliveryStatus`), then a *best-effort*
try/catch write of the richer fields (`status`, `customerConfirmedAt`, `completedAt`,
`updatedAt`, COD→`paymentStatus`) that swallows rule denials. Never let the richer
write block confirmation.

# Delivery complaints → `delivery_complaints` (NOT `complaints`)

The admin dashboard (Cloudflare Worker) reads the **`delivery_complaints`** collection.
An earlier bug wrote to `complaints` with fields `resolved`/`driverNote`, so complaints
never appeared in admin. Always write complaints to `delivery_complaints` with
admin-compatible fields: `orderId, orderNumber, orderRef, customerUid, providerUid,
driverUid, status, deliveryStatus, complaintStatus:'pending', source, type, note,
createdAt/updatedAt`.

`raiseDeliveryComplaint(order, {source,type,note})` builds this payload — driver call
defaults `source='driver'`; customer reject uses `source='customer'`,
`type='customer_rejected_receipt'`.

**Admin compatibility:** the Worker's `complaintEffStatus()` only recognizes
`open/resolved/closed` and falls back to `'open'` for anything else, so
`complaintStatus:'pending'` displays under the admin "Open" filter. Do not change the
Worker for this.

## Open items (not in repo)
- Firestore security rules are NOT in the repo (Firebase console). Live success of
  complaint creation requires a rule allowing authed `create` on `delivery_complaints`;
  the richer confirm-receipt fields require customer update perms. Rules were NOT
  touched by this work — report the exact rule to the user if live writes still deny.
