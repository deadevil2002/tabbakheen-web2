import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, Pressable, Linking } from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';

let MapLibreMap: any = null;
let MapLibreCamera: any = null;
let MapLibreMarker: any = null;
let MapLibreGeoJSONSource: any = null;
let MapLibreLayer: any = null;

try {
  const ml = require('@maplibre/maplibre-react-native');
  MapLibreMap = ml.Map;
  MapLibreCamera = ml.Camera;
  MapLibreMarker = ml.Marker;
  MapLibreGeoJSONSource = ml.GeoJSONSource;
  MapLibreLayer = ml.Layer;
} catch {
  console.log('[DeliveryRouteMap] @maplibre/maplibre-react-native not available');
}
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { MAPTILER_STYLE_URL, fitZoom } from '@/constants/maptiler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Visible map area: container marginHorizontal (20*2) + wrapper margin (14*2).
const ROUTE_MAP_WIDTH = SCREEN_WIDTH - 68;
const ROUTE_MAP_HEIGHT = 200;

interface Props {
  originLat: number | null;
  originLng: number | null;
  originLabel: string;
  destLat: number | null;
  destLng: number | null;
  destLabel: string;
  phase: 'to_provider' | 'to_customer';
}

function DeliveryRouteMapInner({
  originLat,
  originLng,
  originLabel,
  destLat,
  destLng,
  destLabel,
  phase,
}: Props) {
  const { t, isRTL } = useLocale();

  const openNavigation = useCallback(async () => {
    if (destLat === null || destLng === null) return;
    const latlng = `${destLat},${destLng}`;
    try {
      if (Platform.OS === 'web') {
        await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latlng}`);
        return;
      }
      if (Platform.OS === 'ios') {
        const googleUrl = `comgooglemaps://?daddr=${latlng}&directionsmode=driving`;
        const canGoogle = await Linking.canOpenURL(googleUrl);
        await Linking.openURL(
          canGoogle ? googleUrl : `http://maps.apple.com/?daddr=${latlng}&dirflg=d`,
        );
        return;
      }
      // Android: launch Google Maps turn-by-turn navigation.
      try {
        await Linking.openURL(`google.navigation:q=${latlng}`);
      } catch {
        await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latlng}`);
      }
    } catch (err) {
      console.log('[DeliveryRouteMap] Failed to open navigation:', err);
    }
  }, [destLat, destLng]);

  const region = useMemo(() => {
    if (originLat && originLng && destLat && destLng) {
      const midLat = (originLat + destLat) / 2;
      const midLng = (originLng + destLng) / 2;
      const latDelta = Math.abs(originLat - destLat) * 1.6 + 0.01;
      const lngDelta = Math.abs(originLng - destLng) * 1.6 + 0.01;
      return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
    }
    if (originLat && originLng) {
      return { latitude: originLat, longitude: originLng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    return { latitude: 24.7136, longitude: 46.6753, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  }, [originLat, originLng, destLat, destLng]);

  const hasOrigin = originLat !== null && originLng !== null;
  const hasDest = destLat !== null && destLng !== null;

  if (!hasOrigin && !hasDest) {
    return (
      <View style={styles.noMapContainer}>
        <MapPin size={24} color={Colors.textTertiary} />
        <Text style={styles.noMapText}>
          {isRTL ? 'لا تتوفر إحداثيات' : 'No coordinates available'}
        </Text>
      </View>
    );
  }

  const isNativeMap = MapLibreMap && Platform.OS !== 'web' && !!MAPTILER_STYLE_URL;

  const phaseLabel = phase === 'to_provider' ? t('goingToProvider') : t('goingToCustomer');

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && hasDest && styles.containerPressed]}
      onPress={openNavigation}
      disabled={!hasDest}
      accessibilityRole="button"
      accessibilityLabel={isRTL ? 'افتح الملاحة في الخرائط' : 'Open navigation in maps'}
    >
      <View style={[styles.phaseRow, isRTL && styles.rowRTL]}>
        <Navigation size={16} color={Colors.primary} />
        <Text style={[styles.phaseText, isRTL && styles.rtlText]}>{phaseLabel}</Text>
      </View>
      <View style={styles.mapWrapper} pointerEvents="none">
        {isNativeMap ? (
          <MapLibreMap
            style={styles.map}
            mapStyle={MAPTILER_STYLE_URL}
            compass={false}
            dragPan={false}
            touchZoom={false}
            touchPitch={false}
            touchRotate={false}
          >
            <MapLibreCamera
              initialViewState={{
                center: [region.longitude, region.latitude],
                zoom: fitZoom(
                  region.latitudeDelta,
                  region.longitudeDelta,
                  ROUTE_MAP_WIDTH,
                  ROUTE_MAP_HEIGHT,
                ),
              }}
            />
            {hasOrigin && MapLibreMarker && (
              <MapLibreMarker lngLat={[originLng!, originLat!]}>
                <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
              </MapLibreMarker>
            )}
            {hasDest && MapLibreMarker && (
              <MapLibreMarker lngLat={[destLng!, destLat!]}>
                <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
              </MapLibreMarker>
            )}
            {hasOrigin && hasDest && MapLibreGeoJSONSource && MapLibreLayer && (
              <MapLibreGeoJSONSource
                id="delivery-route"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: [
                      [originLng!, originLat!],
                      [destLng!, destLat!],
                    ],
                  },
                }}
              >
                <MapLibreLayer
                  id="delivery-route-line"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{
                    'line-color': Colors.primary,
                    'line-width': 3,
                    'line-dasharray': [6, 4],
                  }}
                />
              </MapLibreGeoJSONSource>
            )}
          </MapLibreMap>
        ) : (
          <View style={styles.webMapFallback}>
            <Navigation size={32} color={Colors.primary} />
            <Text style={styles.webMapText}>{originLabel} → {destLabel}</Text>
          </View>
        )}
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendItem, isRTL && styles.rowRTL]}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>{originLabel}</Text>
        </View>
        <View style={[styles.legendItem, isRTL && styles.rowRTL]}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>{destLabel}</Text>
        </View>
      </View>
      {hasDest && (
        <View style={[styles.navCta, isRTL && styles.rowRTL]}>
          <Navigation size={16} color={Colors.white} />
          <Text style={styles.navCtaText}>
            {isRTL ? 'ابدأ الملاحة' : 'Start navigation'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const DeliveryRouteMap = React.memo(DeliveryRouteMapInner);
export default DeliveryRouteMap;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: 'hidden' as const,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 8,
    elevation: 3,
  },
  containerPressed: {
    opacity: 0.92,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    paddingBottom: 0,
  },
  navCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: 14,
    marginBottom: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navCtaText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  phaseText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  mapWrapper: {
    height: 200,
    margin: 14,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  map: {
    flex: 1,
  },
  routeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  noMapContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 30,
    alignItems: 'center' as const,
    gap: 10,
  },
  noMapText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  webMapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    gap: 10,
    borderRadius: 14,
  },
  webMapText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
