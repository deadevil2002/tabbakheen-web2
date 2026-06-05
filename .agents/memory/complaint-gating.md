---
name: Delivery complaint gating (mobile)
description: How duplicate-complaint prevention works across customer/driver in the Tabbakheen mobile app.
---

# Delivery complaint gating

Complaints live in Firestore `delivery_complaints`. Each doc carries BOTH `customerUid`
and `driverUid` (plus `providerUid`), so every actor's per-UID subscription
(`fsSubscribeMyComplaints`) sees the same complaint for a shared order.

**Rule:** complaint button gating must be ORDER-LEVEL, not actor-level. Call
`hasComplaint(orderId)` WITHOUT a source argument so any existing active complaint
hides the button for all actors and shows "تم رفع بلاغ لهذا الطلب".

**Why:** spec requires "one active complaint per order" and "hide for all users". Passing
a `source` made gating actor-scoped, letting a second actor file a duplicate on the same order.

**Active only:** `ComplaintRef.complaintStatus` is read from the doc; `isComplaintActive()`
treats anything except `resolved`/`closed` as active (legacy docs with no status = active).
`raiseDeliveryComplaint` also pre-checks `myComplaints` for an active match and bails before write.

Provider has NO complaint button in this app (only customer + driver raise complaints).
