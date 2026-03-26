import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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

let MapView: any = null;
let Marker: any = null;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  console.log('react-native-maps not available');
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

export default function CustomerMapScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { providers } = useData();
  const { user } = useAuth();

  const [selectedProvider, setSelectedProvider] = useState<User | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const mapRef = useRef<any>(null);

  const currentLocation = userCoords ?? user?.location ?? { lat: RIYADH_LAT, lng: RIYADH_LNG };

  const providersWithLocation = useMemo(() => {
    return providers.filter((p) => p.location && p.location.lat && p.location.lng);
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

  const handleProviderPress = useCallback((provider: User) => {
    setSelectedProvider(provider);
    if (mapRef.current && provider.location) {
      mapRef.current.animateToRegion({
        latitude: provider.location.lat,
        longitude: provider.location.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  }, []);

  const handleViewProfile = useCallback(
    (uid: string) => {
      router.push(`/(customer)/home/provider/${uid}` as any);
    },
    [],
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
              if (mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: coords.lat,
                  longitude: coords.lng,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }, 500);
              }
              console.log('[Map] Web geolocation:', coords);
            },
            () => {
              Alert.alert(t('error'), t('locationError'));
            },
          );
        } catch {
          Alert.alert(t('error'), t('locationError'));
        }
      }
      return;
    }

    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('locationPermissionDenied'));
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

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }, 500);
      }
    } catch (e) {
      console.log('[Map] Location error:', e);
      Alert.alert(t('error'), t('locationError'));
    } finally {
      setLocating(false);
    }
  }, [t]);

  const initialRegion = {
    latitude: currentLocation.lat,
    longitude: currentLocation.lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('nearbyProviders')}</Text>
      </SafeAreaView>

      <View style={styles.mapContainer}>
        {MapView && Platform.OS !== 'web' ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {sortedProviders.map((provider) =>
                provider.location ? (
                  <Marker
                    key={provider.uid}
                    coordinate={{
                      latitude: provider.location.lat,
                      longitude: provider.location.lng,
                    }}
                    title={provider.displayName}
                    onPress={() => handleProviderPress(provider)}
                  >
                    <View style={[
                      styles.markerContainer,
                      selectedProvider?.uid === provider.uid && styles.markerSelected,
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
                  </Marker>
                ) : null,
              )}
            </MapView>
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

      {selectedProvider && (
        <View style={styles.selectedCard}>
          <Pressable
            style={({ pressed }) => [styles.selectedCardInner, pressed && styles.cardPressed]}
            onPress={() => handleViewProfile(selectedProvider.uid)}
          >
            <Image
              source={{ uri: selectedProvider.photoUrl }}
              style={styles.selectedAvatar}
              contentFit="cover"
            />
            <View style={styles.selectedInfo}>
              <Text style={[styles.selectedName, isRTL && styles.rtlText]} numberOfLines={1}>
                {selectedProvider.displayName}
              </Text>
              <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
                <Star size={13} color={Colors.star} fill={Colors.star} />
                <Text style={styles.metaText}>{selectedProvider.ratingAverage.toFixed(1)}</Text>
                {selectedProvider.location && (
                  <>
                    <View style={styles.metaDot} />
                    <MapPin size={13} color={Colors.textTertiary} />
                    <Text style={styles.metaText}>
                      {formatDistance(
                        calculateDistance(
                          currentLocation.lat,
                          currentLocation.lng,
                          selectedProvider.location.lat,
                          selectedProvider.location.lng,
                        ),
                        locale,
                      )}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <View style={styles.viewBtn}>
              <Text style={styles.viewBtnText}>{t('viewProviderPage')}</Text>
            </View>
          </Pressable>
        </View>
      )}

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
            return (
              <Pressable
                key={provider.uid}
                style={({ pressed }) => [
                  styles.providerCard,
                  selectedProvider?.uid === provider.uid && styles.providerCardSelected,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => {
                  handleProviderPress(provider);
                  handleViewProfile(provider.uid);
                }}
              >
                <Image
                  source={{ uri: provider.photoUrl }}
                  style={styles.providerAvatar}
                  contentFit="cover"
                />
                <View style={styles.providerInfo}>
                  <Text style={[styles.providerName, isRTL && styles.rtlText]} numberOfLines={1}>
                    {provider.displayName}
                  </Text>
                  <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
                    <Star size={12} color={Colors.star} fill={Colors.star} />
                    <Text style={styles.metaText}>{provider.ratingAverage.toFixed(1)}</Text>
                  </View>
                  <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
                    <MapPin size={12} color={Colors.textTertiary} />
                    <Text style={styles.metaText}>{formatDistance(dist, locale)}</Text>
                  </View>
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
  selectedCard: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  selectedCardInner: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  selectedAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.primaryFaded,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  viewBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewBtnText: {
    fontSize: 12,
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
    width: SCREEN_WIDTH * 0.55,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  providerCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  cardPressed: {
    opacity: 0.9,
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
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
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
