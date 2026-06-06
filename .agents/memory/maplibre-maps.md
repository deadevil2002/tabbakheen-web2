---
name: MapLibre maps (mobile)
description: How the Tabbakheen mobile app does maps — MapLibre v11 + MapTiler, key constraints and the center-pin decision.
---

# MapLibre maps in `artifacts/mobile`

The mobile app's maps use `@maplibre/maplibre-react-native` v11 with MapTiler Free
tiles. It deliberately does NOT use `react-native-maps` / Google Maps (to avoid the
Android Google Maps dependency).

**Why:** migrated off `react-native-maps` specifically to drop the Google Maps
Android dependency. Do not reintroduce `react-native-maps` or any `googleMaps`
config block in `app.json`/`app.config.js`. The MapLibre Expo config plugin uses
its default `locationEngine` (NOT `"google"`), which is what keeps Google Play
Services out — don't change that.

**How to apply / gotchas:**
- MapTiler key comes ONLY from env `EXPO_PUBLIC_MAPTILER_KEY` (public Expo var,
  inlined at build). Never hardcode it. Without the key, `MAPTILER_STYLE_URL` is
  null and map screens fall back to their non-map placeholder UI instead of
  crashing — preserve that graceful gate (`isNativeMap` checks `!!MAPTILER_STYLE_URL`).
- All MapLibre coordinates are `[lng, lat]` (longitude first) — the opposite of
  react-native-maps `{latitude, longitude}`. `onRegionDidChange` gives
  `nativeEvent.center = [lng, lat]`.
- v11 `Marker` has NO `draggable`/`onDragEnd`. The location picker therefore uses a
  fixed center-pin overlay: the map pans under a static pin and `onRegionDidChange`
  writes the map center into `pinCoords` (saved coords = map center). This is the
  one interaction adaptation; keep it if editing the picker.
- MapLibre components are imported via `require()` inside try/catch and typed `any`,
  so JSX props are not type-checked — intentional (lets `mapStyle={string|null}`
  pass). Web is shimmed via `shims/maplibre.web.js` + a metro web resolver redirect;
  maps are gated off web with `Platform.OS !== 'web'`.
- Zoom is approximated from old react-native-maps deltas via `deltaToZoom` /
  `fitZoom` in `constants/maptiler.ts`. The route map must use `fitZoom` (both
  axes) — using longitudeDelta alone over-zooms north/south-heavy routes and pushes
  an endpoint off-screen.
