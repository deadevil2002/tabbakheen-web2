---
name: Themed dialogs (Tabbakheen mobile)
description: How alerts/dialogs are unified and themed in artifacts/mobile; what to use for new dialogs.
---

All alerts in `artifacts/mobile` go through `components/AppDialog.tsx`:
- `AppAlert.alert(title, message?, buttons?)` is a drop-in replacement for React Native's `Alert.alert` (same signature/buttons/onPress).
- A single `<AppDialogHost/>` is mounted once in `app/_layout.tsx` (inside LocaleProvider/DataProvider) and renders one themed, RTL-aware Modal (cream/white surface, orange accent, rounded). It is the only place dialogs are rendered.
- `AppAlert` dispatches to the host via a module-level singleton dispatcher, so non-component callers (e.g. `utils/authGuard.ts`) can trigger dialogs. If the host is not mounted it falls back to native `Alert.alert`.

**Why:** the app previously mixed native (dark/system-looking) alerts with the orange/cream brand; unifying gives one consistent themed look.

**How to apply:** for any new dialog/alert in mobile, call `AppAlert.alert` and import it from `@/components/AppDialog` — never call RN `Alert.alert` directly (except the intentional fallback inside AppDialog.tsx, which must stay `Alert.alert` to avoid infinite recursion). Overlay-tap dismisses the dialog (acts like cancel); button `onPress` callbacks are preserved.
