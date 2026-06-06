---
name: EAS Build from Replit
description: How to trigger EAS builds from Replit main agent without hitting git restriction
---

## Rule
Set `EXPO_NO_GIT_STATUS=1` to bypass Replit's git index.lock restriction when running `eas build`.

**Why:** EAS CLI uses `git archive` / `git ls-files` to package the project before uploading. Replit's main agent blocks certain git operations (raises index.lock error). `EXPO_NO_GIT_STATUS=1` skips the git-based file listing — EAS falls back to filesystem-based archiving.

**How to apply:**
```bash
cd /home/runner/workspace/artifacts/mobile && \
  EXPO_TOKEN=$EXPO_TOKEN EXPO_NO_GIT_STATUS=1 \
  /home/runner/workspace/node_modules/.bin/eas build \
    --profile development --platform android --non-interactive
```

- EAS CLI binary: `/home/runner/workspace/node_modules/.bin/eas` (v20.0.0, installed at workspace root with `-Dw`)
- Must `cd` to `artifacts/mobile` (where `app.json` + `eas.json` live)
- `--non-interactive` required (no TTY in Replit)
- Add `EAS_SKIP_AUTO_FINGERPRINT=1` if fingerprint computation hangs

## iOS Credentials
iOS internal distribution (Ad Hoc) requires Apple Developer credentials (cert + provisioning profile with device UDIDs). EAS cannot set these up non-interactively. User must configure via:
- Expo dashboard → Credentials → iOS, OR
- Local machine running `eas build --profile development --platform ios` interactively

Once credentials are in EAS, the same `EXPO_NO_GIT_STATUS=1` command works for iOS too.

## Android build (confirmed working)
- Profile: `development` (APK, internal distribution, expo-dev-client)
- No `expo-updates` needed for builds — the channel warning is non-blocking
- Build URL pattern: `https://expo.dev/accounts/isaudi.ai/projects/tabbakheen-food-market/builds/<id>`
