---
name: Admin unread notifications
description: How admin sidebar badges + row highlights work as true unread notifications (last-view timestamps in Firestore)
---

# Admin unread notifications (Cloudflare Worker)

Replaced the earlier static/status-based badge+highlight system with real unread
notifications driven by per-section "last viewed" timestamps.

**Storage:** Firestore doc `admin_state/main` with fields `lastViewedUsers`,
`lastViewedComplaints`, `lastViewedInvoices`, `lastViewedVerification` (epoch ms).
`updateFirestoreDocument` PATCH auto-creates the doc if missing (same as app_settings).

**API:** `GET /admin/api/views` → normalized `{users,complaints,invoices,verification}`
(0 default via `normalizeViews`). `POST /admin/api/views {section}` sets that section's
timestamp = Date.now(), returns updated views. Section is allowlisted.

**Counting:** an item is "unread" if its timestamp > `adminViews[section]`.
- users/complaints/invoices: `createdAt` > lastView (pure recency).
- verification: pending CR (`submittedAt||verifiedAt`) or pending freelance
  (`freelanceCertificate.submittedAt`) > lastView — keeps the pending filter because
  the verification page lists ALL providers, not just submissions.

**Why pending kept only for verification:** the other three collections are 1 doc = 1
real item, so recency alone is correct; verification rows include every provider, so
recency-only would count already-approved providers as unread on first load.

**Flow per section render:** capture `<section>HighlightSince = adminViews[section]`
(value BEFORE this visit) → render rows highlighting items newer than it → call
`markViewed(section)` (POSTs /views, updates `adminViews` from server, zeroes nav badge).
HighlightSince stays at the pre-visit value so highlights persist across in-page filter
changes but clear on the next visit.

**Badge freshness:** `refreshBadges()` fetches `/views` first, then counts. Runs on login
(`showMain`) and every 30s via `startBadgePolling()`; `stopBadgePolling()` on logout and on
401 (in `api()`). Polling is why a newly-created item makes the badge reappear after the
admin already opened that section.

**Kept untouched:** all filters, all columns, invoice Pending/Issued status cell (still
uses `isPendingInvoice`), confirmedComplaintCount column/filter, complaint/suspension logic.
