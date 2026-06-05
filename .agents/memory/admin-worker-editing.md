---
name: Admin Worker editing gotchas
description: How to safely edit the cloned Tabbakheen admin Cloudflare Worker (.local/worker-src/worker.js)
---

# Editing the live admin Worker (`.local/worker-src/worker.js`)

Cloned from GitHub repo `deadevil2002/tabbakheen-api-worker`. Single esbuild-bundled file (`__name` wrappers), serves the `/admin` dashboard.

## Two gotchas that block naive edits

1. **File is uniformly CRLF (`\r\n`).** The `edit` tool matches verbatim LF and will fail with "did not appear verbatim" even when `read` shows the line. Workflow: strip to LF (`perl -i -pe 's/\r\n/\n/g'`), make edits, restore (`perl -i -pe 's/\n/\r\n/g'`). Round-tripping keeps the diff limited to changed lines (don't commit a whole-file CRLF→LF flip).

2. **The entire `/admin` dashboard HTML+JS is returned by `getAdminHTML()` as ONE template literal.** So inside dynamically-built `onclick` handlers, nested single quotes must be written as `\\'` in source (it resolves to `\'` in the delivered HTML, which the browser parses as a valid quoted string). Static HTML regions use plain `'...'`. Never introduce a backtick or `${` into injected dashboard JS.

**Why:** both cost repeated failed attempts before being diagnosed.
**How to apply:** any future edit to this worker — admin endpoints live INSIDE the `if (path.startsWith("/admin/api/"))` gate (auth + `accessToken` already in scope). Verify with `node --check` on a `.mjs` copy after restoring CRLF.

## Deploying (Cloudflare)

Deploy from `.local/worker-src` with `npx wrangler deploy` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets). The live URL `tabbakheen-api.tabbakheen.workers.dev` is the **default workers.dev subdomain**, served by `workers_dev = true` in `wrangler.toml` — NOT a custom domain. A `routes` entry with `custom_domain = true` pointing at the `*.workers.dev` host fails deploy ("Wildcard operators / Paths not allowed in Custom Domains"). `wrangler.toml` is also CRLF.
**Why:** the cloned `wrangler.toml` shipped an invalid custom_domain route that blocks every deploy until replaced with `workers_dev = true`.

## Admin "new/unreviewed" semantics (no explicit flags)
- There is NO `reviewedByAdmin`/`isNew`/`seen` field on users. "New user" = `createdAt` within last 7 days (NEW_USER_WINDOW_DAYS). Be consistent if extending.
- Invoices are ALWAYS created with `status:"issued"` — there is no "pending" invoice state in data. "Invoices pending" badge/row-highlight (status==='pending') is intentionally inert today (hides at 0), kept for future backend status transitions.
- Sidebar count badges + soft row highlight (`tr.row-new`) must share the SAME predicate per surface so badge count == highlighted-row count: isNewUser / isOpenComplaint (complaintEffStatus==='open') / isPendingInvoice / isPendingCrVerif (verificationStatus==='pending_review') + isPendingFreelanceFc (reviewStatus pending, missing treated as pending).
- Violation/confirmedComplaintCount columns & filters apply to provider/driver only — customer rows must show '-' and never be counted.
