---
name: Complaint gating (mobile)
description: How complaint creation, deduplication, and My Complaints subscription work across roles.
---

## Complaint creation (raiseDeliveryComplaint in DataContext)

- source type: `'customer' | 'driver' | 'provider'`
- target type: `'provider' | 'driver' | 'customer'`
- Customer raises with source:'customer', target:'provider'|'driver'
- Driver raises with source:'driver', target is not used (type:'delivery_not_confirmed')
- Provider raises with source:'provider', type:'provider_complaint', target:'customer'|'driver'

## hasComplaint (DataContext)

- Reads from `myComplaints` state (populated via fsSubscribeMyComplaints by role UID field)
- `hasComplaint(orderId)` — no source filter — returns true if ANY complaint exists on that order
- `hasComplaint(orderId, 'provider')` — scoped to provider-created complaints
- Both driver and customer buttons use `hasComplaint(orderId)` (no source) to block double complaints per order

## My Complaints subscription (MyComplaintsView)

- Uses `fsSubscribeComplaintsByCreator(role, uid, cb)` from firestoreComplaints.ts
- Queries Firestore: `where('${role}Uid', '==', uid)`
- Client-side filter: `!c.source || c.source === role`
  - `!c.source` catches old complaints with empty/missing source field
  - `c.source === role` handles new complaints with correct source
- Shows ALL statuses (no status filter) — resolved/closed/old all shown

**Why:** Old complaints in Firestore may have been created before `source` was consistently set. Strict `source === role` filter would hide them. The `!c.source` fallback includes them without leaking other parties' complaints (source is non-empty for complaints from other parties).

## Complaint document fields (delivery_complaints collection)

Stored: orderId, orderNumber, orderRef, customerUid, providerUid, driverUid,
status, deliveryStatus, complaintStatus (always 'pending' on create), source,
target, type, note, createdAt, updatedAt, adminNote (set by admin)

No `creatorUid` field — ownership determined entirely by source + roleUid.
