import { AppAlert } from '@/components/AppDialog';
import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Star, MapPin, Navigation, Crosshair, ChefHat } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { calculateDistance, formatDistance } from '@/utils/helpers';
import { User } from '@/types';
import { MAPTILER_STYLE_URL, deltaToZoom } from '@/constants/maptiler';
import LoginRequired from '@/components/LoginRequired';
import { VerifiedBadge } from '@/components/VerifiedBadge';

let MapLibreMap: any = null;
let MapLibreCamera: any = null;
let MapLibreMarker: any = null;
let MapLibreUserLocation: any = null;

try {
  const ml = require('@maplibre/maplibre-react-native');
  MapLibreMap = ml.Map;
  MapLibreCamera = ml.Camera;
  MapLibreMarker = ml.Marker;
  MapLibreUserLocation = ml.UserLocation;
} catch {
  console.log('@maplibre/maplibre-react-native not available');
}

let Location: any = null;
try {
  Location = require('expo-location');
} catch {
  console.log('expo-location not available');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RIYADH_LAT = 24.7136;
const RIYADH_LNG = 46.6753;

function hasValidCoords(p: User): boolean {
  const loc = p.location;
  if (!loc) return false;
  const { lat, lng } = loc;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  // Reject the "null island" (0,0) placeholder, but allow a single legitimate 0 axis.
  if (lat === 0 && lng === 0) return false;
  return true;
}

export default function CustomerMapScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { providers } = useData();
  const { user } = useAuth();

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);

  const currentLocation = userCoords ?? user?.location ?? { lat: RIYADH_LAT, lng: RIYADH_LNG };

  const providersWithLocation = useMemo(() => {
    return providers.filter(hasValidCoords);
  }, [providers]);

  const sortedProviders = useMemo(() => {
    return [...providersWithLocation]
      .map((p) => ({
        ...p,
        distance: p.location
          ? calculateDistance(currentLocation.lat, currentLocation.lng, p.location.lat, p.location.lng)
          : 999,
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [providersWithLocation, currentLocation]);

  const centerOnProvider = useCallback((provider: User) => {
    setSelectedUid(provider.uid);
    if (cameraRef.current && provider.location) {
      cameraRef.current.easeTo({
        center: [provider.location.lng, provider.location.lat],
        zoom: deltaToZoom(0.02),
        duration: 500,
      });
    }
  }, []);

  const handleViewProfile = useCallback(
    (uid: string) => {
      router.push(`/(customer)/map/provider/${uid}` as any);
    },
    [router],
  );

  const handleOpenRoute = useCallback(
    (provider: User) => {
      const loc = provider.location;
      if (!loc) return;
      const { lat, lng } = loc;
      const label = encodeURIComponent(provider.displayName || t('viewProviderPage'));
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

      if (Platform.OS === 'web') {
        Linking.openURL(webUrl).catch(() => {});
        return;
      }

      const nativeUrl =
        Platform.OS === 'ios'
          ? `maps://?daddr=${lat},${lng}&q=${label}`
          : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;

      Linking.canOpenURL(nativeUrl)
        .then((supported) => {
          const target = supported ? nativeUrl : webUrl;
          return Linking.openURL(target);
        })
        .catch(() => {
          Linking.openURL(webUrl).catch(() => {});
        });
    },
    [t],
  );

  const locateMe = useCallback(async () => {
    if (!Location) {
      if (Platform.OS === 'web') {
        try {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserCoords(coords);
              if (cameraRef.current) {
                cameraRef.current.easeTo({
                  center: [coords.lng, coords.lat],
                  zoom: deltaToZoom(0.04),
                  duration: 500,
                });
              }
              console.log('[Map] Web geolocation:', coords);
            },
            () => {
              AppAlert.alert(t('error'), t('locationError'));
            },
          );
        } catch {
          AppAlert.alert(t('error'), t('locationError'));
        }
      }
      return;
    }

    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        AppAlert.alert(t('error'), t('locationPermissionDenied'));
        setLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      setUserCoords(coords);
      console.log('[Map] Device location:', coords);

      if (cameraRef.current) {
        cameraRef.current.easeTo({
          center: [coords.lng, coords.lat],
          zoom: deltaToZoom(0.04),
          duration: 500,
        });
      }
    } catch (e) {
      console.log('[Map] Location error:', e);
      AppAlert.alert(t('error'), t('locationError'));
    } finally {
      setLocating(false);
    }
  }, [t]);

  const isNativeMap = MapLibreMap && Platform.OS !== 'web' && !!MAPTILER_STYLE_URL;

  if (!user) {
    return <LoginRequired message={t('mapGuestMsg')} headerTitle={t('nearbyProviders')} />;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('nearbyProviders')}</Text>
      </SafeAreaView>

      <View style={styles.mapContainer}>
        {isNativeMap ? (
          <>
            <MapLibreMap
              style={styles.map}
              mapStyle={MAPTILER_STYLE_URL}
              compass={false}
            >
              <MapLibreCamera
                ref={cameraRef}
                initialViewState={{
                  center: [currentLocation.lng, currentLocation.lat],
                  zoom: deltaToZoom(0.08),
                }}
              />
              <MapLibreUserLocation />
              {sortedProviders.map((provider) =>
                provider.location ? (
                  <MapLibreMarker
                    key={provider.uid}
                    lngLat={[provider.location.lng, provider.location.lat]}
                    onPress={() => centerOnProvider(provider)}
                  >
                    <View style={[
                      styles.markerContainer,
                      selectedUid === provider.uid && styles.markerSelected,
                    ]}>
                      {provider.photoUrl ? (
                        <Image
                          source={{ uri: provider.photoUrl }}
                          style={styles.markerImage}
                          contentFit="cover"
                        />
                      ) : (
                        <ChefHat size={18} color={Colors.white} />
                      )}
                    </View>
                  </MapLibreMarker>
                ) : null,
              )}
            </MapLibreMap>
            <Pressable
              style={({ pressed }) => [styles.locateBtn, pressed && styles.locateBtnPressed]}
              onPress={locateMe}
              testID="locate-me-btn"
            >
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Crosshair size={22} color={Colors.primary} />
              )}
            </Pressable>
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Navigation size={48} color={Colors.primary} />
            <Text style={styles.mapPlaceholderText}>
              {t('nearbyProviders')}
            </Text>
            <Text style={styles.mapPlaceholderSub}>
              {sortedProviders.length > 0
                ? `${sortedProviders.length} ${locale === 'ar' ? 'طباخ' : 'chefs'}`
                : t('emptyMapDesc')}
            </Text>
            {Platform.OS === 'web' && (
              <Pressable
                style={({ pressed }) => [styles.webLocateBtn, pressed && styles.locateBtnPressed]}
                onPress={locateMe}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Crosshair size={18} color={Colors.white} />
                    <Text style={styles.webLocateBtnText}>{t('locateMe')}</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={styles.listContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listScroll}
        >
          {sortedProviders.map((provider) => {
            const dist = provider.location
              ? calculateDistance(
                  currentLocation.lat,
                  currentLocation.lng,
                  provider.location.lat,
                  provider.location.lng,
                )
              : 0;
            const isSelected = selectedUid === provider.uid;
            return (
              <Pressable
                key={provider.uid}
                style={({ pressed }) => [
                  styles.providerCard,
                  isSelected && styles.providerCardSelected,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => centerOnProvider(provider)}
              >
                <View style={[styles.cardTopRow, isRTL && styles.rowRTL]}>
                  <Image
                    source={{ uri: provider.photoUrl }}
                    style={styles.providerAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.providerInfo}>
                    <View style={[styles.nameRow, isRTL && styles.rowRTL]}>
                      <Text style={[styles.providerName, { marginBottom: 0, flexShrink: 1 }, isRTL && styles.rtlText]} numberOfLines={1}>
                        {provider.displayName}
                      </Text>
                      <VerifiedBadge status={provider.verificationStatus} size={14} />
                    </View>
                    <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
                      <Star size={12} color={Colors.star} fill={Colors.star} />
                      <Text style={styles.metaText}>{provider.ratingAverage.toFixed(1)}</Text>
                      <View style={styles.metaDot} />
                      <MapPin size={12} color={Colors.textTertiary} />
                      <Text style={styles.metaText}>{formatDistance(dist, locale)}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.cardActions, isRTL && styles.rowRTL]}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnPrimary,
                      pressed && styles.actionBtnPressed,
                    ]}
                    onPress={() => handleViewProfile(provider.uid)}
                  >
                    <Text style={styles.actionBtnPrimaryText} numberOfLines={1}>
                      {t('viewProviderPage')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnOutline,
                      pressed && styles.actionBtnPressed,
                    ]}
                    onPress={() => handleOpenRoute(provider)}
                  >
                    <Navigation size={14} color={Colors.primary} />
                    <Text style={styles.actionBtnOutlineText} numberOfLines={1}>
                      {t('openRoute')}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
          {sortedProviders.length === 0 && (
            <View style={styles.emptyListItem}>
              <Text style={[styles.emptyListText, isRTL && styles.rtlText]}>{t('emptyMapDesc')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 8,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    gap: 10,
    paddingHorizontal: 32,
  },
  mapPlaceholderText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 4,
  },
  mapPlaceholderSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  markerContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  markerSelected: {
    borderColor: Colors.primaryDark,
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  markerImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  locateBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  locateBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  webLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
  },
  webLocateBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: 4,
  },
  listContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  listScroll: {
    paddingHorizontal: 16,
  },
  providerCard: {
    width: SCREEN_WIDTH * 0.72,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 12,
  },
  providerCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  cardPressed: {
    opacity: 0.95,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  actionBtnOutline: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  actionBtnPressed: {
    opacity: 0.8,
  },
  emptyListItem: {
    width: SCREEN_WIDTH - 64,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyListText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
