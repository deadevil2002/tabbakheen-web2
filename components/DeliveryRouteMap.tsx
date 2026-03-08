import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MapPin, Navigation } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';

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

  const phaseLabel = phase === 'to_provider' ? t('goingToProvider') : t('goingToCustomer');

  return (
    <View style={styles.container}>
      <View style={[styles.phaseRow, isRTL && styles.rowRTL]}>
        <Navigation size={16} color={Colors.primary} />
        <Text style={[styles.phaseText, isRTL && styles.rtlText]}>{phaseLabel}</Text>
      </View>
      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          initialRegion={region}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {hasOrigin && (
            <Marker
              coordinate={{ latitude: originLat!, longitude: originLng! }}
              title={originLabel}
              pinColor={Colors.primary}
            />
          )}
          {hasDest && (
            <Marker
              coordinate={{ latitude: destLat!, longitude: destLng! }}
              title={destLabel}
              pinColor={Colors.success}
            />
          )}
          {hasOrigin && hasDest && (
            <Polyline
              coordinates={[
                { latitude: originLat!, longitude: originLng! },
                { latitude: destLat!, longitude: destLng! },
              ]}
              strokeColor={Colors.primary}
              strokeWidth={3}
              lineDashPattern={[6, 4]}
            />
          )}
        </MapView>
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
    </View>
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
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    paddingBottom: 0,
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
});
