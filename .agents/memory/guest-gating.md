---
name: Guest (logged-out) access gating — Tabbakheen mobile
description: What logged-out guests may and may not see in the customer-facing Tabbakheen app, and the gating pattern used.
---

# Guest access gating (Tabbakheen mobile customer app)

Guest = `user === null` from `AuthContext` (`isAuthenticated === !!user`). Guests land on
the customer home for limited browsing only.

**What guests MAY see:** the All-Offers grid showing ONLY offer image, title, and price.

**What guests MUST NOT see / access (login-gated):**
- Customer map screen, including provider markers/route/provider-page buttons.
- Provider profile/details screen.
- Full offer details screen (which also holds ordering/payment).
- On home offer cards: provider avatar/name/rating and distance row.
- The "Nearby Providers" horizontal rail (provider chips → only lead to a gated profile).

**Pattern:** a reusable themed `components/LoginRequired.tsx` (Lock icon, title, custom
message, CTA → `/auth/login`, RTL-aware, uses `Colors`). Screens render
`if (!user) return <LoginRequired .../>` placed AFTER all hooks (rules-of-hooks safe).
On home, fields are gated inline with `{user && ...}`; remember to add `user` to the
`renderOfferCard` useCallback deps when gating inside it.

**Why:** product decision to let guests preview offers but require login for anything that
exposes provider identity/location or enables ordering. Treat provider name/rating/photo
and distance as guest-private even though not secret, for consistency.
