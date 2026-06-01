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
