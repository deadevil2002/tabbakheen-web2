---
name: Delivery finalize persistence (mobile)
description: What the customer client may write when finalizing delivery, and which fields are Worker/Admin-owned.
---

# Delivery finalize persistence

When a customer finalizes delivery on the order details screen,
`setDeliveryMethod()` (contexts/DataContext.tsx, Firebase branch) must persist the
selection itself via `fsUpdateOrder` — it must NOT rely solely on the external
Cloudflare Worker, whose live deployment can be stale/unreachable and may silently
not persist, leaving the order `deliveryMethod=null / deliveryStatus=null` and
drivers seeing nothing.

## Field ownership (current Firestore rules)
The **customer client may only update these delivery fields**:
- `deliveryMethod`
- `deliveryStatus`
- `deliveryQuoteId`
- `deliveryPricingVersion`

The client must **NOT** write `driverUid`, `deliveryFee`, `totalAmount`, or
`deliveryDistanceKm` — those are rejected with `permission-denied` and are owned by
the **Worker/Admin SDK** (it also fires push notifications). Writing them from the
client is exactly what broke the flow before.

`driverUid` must already be `null` at order **creation** (createOrder sets it), because
`fsSubscribeAvailableDeliveries` queries `where('driverUid','==',null)` — a Firestore
equality-to-null only matches docs where the field exists. The customer never sets it.

## Correct client write
- driver: `{ deliveryMethod:'driver', deliveryStatus:'ready_for_driver' [, deliveryQuoteId] }`
- self-pickup: `{ deliveryMethod:'self_pickup', deliveryStatus:'self_pickup_selected' }`

**How to apply:** call the Worker best-effort (try/catch) for the quote + notifications,
then write ONLY the allowed fields. Gate success on (1) `fsUpdateOrder` succeeding AND
(2) a read-back (`fsGetOrder`) asserting `deliveryMethod`/`deliveryStatus` match and
`driverUid==null`; otherwise throw so the UI shows an error (no false success). Fee/total
are Worker-owned and may stay unset if the Worker is down — that is acceptable; do not
backfill them from the client.

The live Worker source (read-only local copy) is `.local/worker-src/worker.js`; its
`/finalize-delivery` handler persists correctly when reached — the failure is the live
deployment, which cannot be deployed from here.
