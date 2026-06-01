---
name: Expo dev-client on Replit (no ngrok tunnel)
description: How to connect a physical-phone custom dev build (expo-dev-client) to Metro in this Replit Expo setup.
---

# Connecting a custom dev build (expo-dev-client) to Metro on Replit

**Do NOT use `expo start --tunnel` / `@expo/ngrok` here.** Replit already exposes Metro
on a public HTTPS domain via `$REPLIT_EXPO_DEV_DOMAIN` (port 443, reachable from any
phone on the internet). That domain *is* the tunnel. ngrok would conflict with Replit's
proxy and the env-injecting workflow.

**Do NOT run `npx expo start` directly** (skill rule) — it misses workflow-injected env
(`PORT`, `EXPO_PACKAGER_PROXY_URL`, etc.). Always drive Metro through the managed
workflow `artifacts/mobile: expo`.

**To serve a custom dev build instead of Expo Go:** add `--dev-client` to the mobile
`dev` script in `artifacts/mobile/package.json` (keep all the existing
`EXPO_PACKAGER_PROXY_URL=... --localhost --port $PORT` env). Restart the workflow.

**Verify reachability (proxy serves the dev-client manifest):**
- `curl https://$DOMAIN/status` → 200
- `curl -H "expo-platform: android" https://$DOMAIN/` → JSON manifest with
  `runtimeVersion: exposdk:54.0.0`, `scheme: tabbakheen`, and a `launchAsset.url` on the
  public domain. The installed dev build's SDK must match this runtimeVersion.
- Fetch `launchAsset.url` → 200 confirms the JS actually bundles (Android bundle ~17 MB,
  ~16s first build).

**Phone connection options (custom dev build, NOT Expo Go):**
- Deep link / QR: `tabbakheen://expo-development-client/?url=https%3A%2F%2F<DOMAIN>`
- Or open the installed dev build → "Enter URL manually" → paste `https://<DOMAIN>`.
- Replit's URL-bar QR is an Expo Go link (`exp://...`) — it will NOT work for the dev build.

**Why:** the dev build APK is a standalone native shell with no JS; it must fetch the JS
bundle from a running Metro. The error "cannot load JS bundle / Metro not reachable" just
means Metro wasn't started or the phone was pointed at the wrong URL.
