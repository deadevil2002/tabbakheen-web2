---
name: F-07 user profile privacy
description: How cross-user reads are sanitized; what fields are public vs private; where order-party phone contact is handled.
---

# Cross-user read architecture (post F-07 fix)

## Public profile (fsSubscribeByRole → toPublicUser)
Used for provider/driver lists loaded into DataContext `providers` and `drivers` arrays.

**Kept public:** uid, displayName, role, photoUrl, socialLink, location, address, city,
ratingAverage, ratingCount, isAvailable, verificationStatus/Source/At, vehicleType (type only),
paymentMethods (provider deliberately exposes for payment), createdAt.

**Stripped:** phone, email, fcmToken, expoPushToken, accountStatus, suspendedReason/At/By,
disabledReason, vehiclePlateNumber, vehicleImageUrl, hasAcceptedTerms, lastLoginAt,
maxDistanceKm, subscriptionStatus/Plan, trialEndsAt, subscriptionEndsAt, activatedByAdmin.

## Order-party contact phone
`fsGetOrderContactPhone(targetUid)` in `firestoreUsers.ts` — reads only `phone` from
`users/{uid}`. MUST only be called when caller has a confirmed order relationship with targetUid.
Currently client-enforced only; full server enforcement deferred to Firestore rules (follow-up).

Call sites:
- `app/(customer)/orders/[id].tsx` — fetches provider + driver phone on order load
- `app/(provider)/my-orders/[id].tsx` — fetches driver phone on order load
- Driver delivery detail (`app/(driver)/my-deliveries/[id].tsx`) — uses only provider.displayName/address, no phone needed

## Self-profile reads
`fsGetUser` / `fsSubscribeToUser` still use full `toUser()` mapper — own-profile only, called only by AuthContext.

**Why:** F-07 audit found every authenticated user received private fields (fcmToken = CRITICAL) for all providers/drivers on app launch via fsSubscribeByRole.
