---
name: Login error mapping (Tabbakheen mobile)
description: How Firebase Auth sign-in errors map to user-facing messages, and why invalid-credential is ambiguous.
---

Firebase Auth (with **Email Enumeration Protection**, ON by default on newer projects) returns `auth/invalid-credential` for BOTH a wrong password AND an unknown email — it no longer returns distinct `auth/user-not-found` / `auth/wrong-password`. Blindly mapping `invalid-credential` → "account not found" is wrong and was the original bug (correct email + wrong password showed "account not found").

Disambiguation lives in `contexts/AuthContext.tsx` `login()` catch:
- `auth/user-not-found` → throw `USER_NOT_FOUND`
- `auth/wrong-password` → throw `WRONG_PASSWORD`
- `auth/invalid-credential` → `fsUserExistsByEmail(email)` (Firestore `users` query): `true` → `WRONG_PASSWORD`, `false` → `USER_NOT_FOUND`, `null` (query failed/denied) → `INVALID_CREDENTIALS` (ambiguous, non-misleading)
- `auth/invalid-email` → `INVALID_EMAIL`; `auth/too-many-requests` → `TOO_MANY_REQUESTS`

`app/auth/login.tsx` switches on the thrown message → themed `AppAlert` with i18n keys (`userNotFound`, `wrongPassword`, `loginInvalidCredentials`, `invalidEmail`, `tooManyRequests`).

**Why:** modern Firebase intentionally hides which credential was wrong; the Firestore lookup restores accurate messaging while degrading safely when rules deny the query.

**How to apply:** keep this thrown-message contract stable across AuthContext and login.tsx. Note: the Firestore email lookup can re-enable account-enumeration ONLY if Firestore rules permit unauthenticated `users` email queries — if that's a concern, tighten rules (the code already degrades to the ambiguous message when denied).
