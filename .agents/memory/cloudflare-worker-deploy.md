---
name: Cloudflare Worker deployment
description: How to deploy the tabbakheen-api worker from .local/worker-src/
---

## Deploy command

```bash
cd .local/worker-src
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}" npx wrangler deploy
```

**wrangler.toml must contain `account_id = "0e6461dc8ec69690ffda6c96d8cb0ac4"`.**

**Why:** The `CLOUDFLARE_ACCOUNT_ID` Replit secret is set to a wrong/stale value (`mJCh1QsJ…`). Wrangler reads that env var, gets a routing error (code 7003). The correct account ID (`0e6461dc8ec69690ffda6c96d8cb0ac4`) was confirmed via `GET /client/v4/accounts` with the API token. Keeping it hardcoded in wrangler.toml is the fix.

**How to apply:** Any time you deploy this worker, ensure `account_id` is in wrangler.toml. The `--account-id` CLI flag is not accepted in wrangler v4.

## Worker location
- Source: `.local/worker-src/worker.js` (CRLF line endings)
- Edit tool will FAIL on this file — use Python `str.replace()` script instead
- Deployed URL: https://tabbakheen-api.tabbakheen.workers.dev
- Admin panel: https://tabbakheen-api.tabbakheen.workers.dev/admin
