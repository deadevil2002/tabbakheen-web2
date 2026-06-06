---
name: Safe-area insets (Tabbakheen mobile)
description: Why a SafeAreaProvider is required and how bottom tab bars handle the Android nav bar.
---

The app originally mounted NO `SafeAreaProvider`, so `useSafeAreaInsets()` / `SafeAreaView` returned zero insets. Expo SDK 54 enables **Android edge-to-edge by default**, so content (incl. the bottom tab bar) draws behind the system navigation bar and gets overlapped by the 3-button / gesture nav.

Fix: mount `<SafeAreaProvider initialMetrics={initialWindowMetrics}>` once at root (`app/_layout.tsx`, inside GestureHandlerRootView). Tab layouts (`app/(customer|provider|driver)/_layout.tsx`) read `useSafeAreaInsets()` and set `tabBarStyle`: `height: 60 + insets.bottom`, `paddingBottom: Math.max(insets.bottom, 8)`, `paddingTop: 8`.

**Why:** without the provider the inset hooks silently return 0; with edge-to-edge that means overlap on Android. Inset-based sizing adapts to gesture nav, 3-button nav, iOS home indicator, and web (inset 0 → no break).

**How to apply:** any new full-bleed screen or custom bottom bar must account for `insets.bottom`; never hardcode a single fixed tab/footer height.
