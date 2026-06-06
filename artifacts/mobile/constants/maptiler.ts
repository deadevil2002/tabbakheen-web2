import { Dimensions } from 'react-native';

/**
 * MapTiler key — read ONLY from the public env var. Never hardcode a key here.
 * Set it via `EXPO_PUBLIC_MAPTILER_KEY` (Expo inlines EXPO_PUBLIC_* at build time).
 */
export const MAPTILER_KEY: string = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

/**
 * Full MapLibre style URL (MapTiler "streets-v2", a free style).
 * Null when no key is configured so callers can fall back gracefully instead of
 * loading a broken/blank map. The OSM + MapTiler attribution is carried inside
 * this style and rendered by MapLibre's built-in attribution control.
 */
export const MAPTILER_STYLE_URL: string | null = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : null;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Approximate a react-native-maps `latitudeDelta`/`longitudeDelta` (degrees
 * visible across the viewport width) as a MapLibre Web Mercator zoom level, so
 * the migrated maps frame roughly the same area as before.
 */
export function deltaToZoom(delta: number): number {
  const safeDelta = delta > 0 ? delta : 0.02;
  return Math.log2((SCREEN_WIDTH * 360) / (256 * safeDelta));
}

/**
 * Pick a zoom level that keeps BOTH a latitude span and a longitude span visible
 * within a viewport of the given pixel size — the MapLibre equivalent of fitting
 * a react-native-maps region that supplies both deltas. Returns the more
 * zoomed-out of the two per-axis fits so neither endpoint is pushed off-screen.
 */
export function fitZoom(
  latitudeDelta: number,
  longitudeDelta: number,
  widthPx: number,
  heightPx: number,
): number {
  const safeLat = latitudeDelta > 0 ? latitudeDelta : 0.02;
  const safeLng = longitudeDelta > 0 ? longitudeDelta : 0.02;
  const zoomForWidth = Math.log2((widthPx * 360) / (256 * safeLng));
  const zoomForHeight = Math.log2((heightPx * 360) / (256 * safeLat));
  return Math.min(zoomForWidth, zoomForHeight);
}
