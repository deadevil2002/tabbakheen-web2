import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Crosshair, MapPin, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';

let MapView: any = null;
let Marker: any = null;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  console.log('[MapLocationPicker] react-native-maps not available');
}

let ExpoLocation: any = null;
try {
  ExpoLocation = require('expo-location');
} catch {
  console.log('[MapLocationPicker] expo-location not available');
}

const RIYADH_LAT = 24.7136;
const RIYADH_LNG = 46.6753;

interface MapLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSave: (coords: { lat: number; lng: number }) => Promise<void>;
  initialLocation?: { lat: number; lng: number } | null;
}

export default function MapLocationPicker({
  visible,
  onClose,
  onSave,
  initialLocation,
}: MapLocationPickerProps) {
  const { t, isRTL } = useLocale();
  const mapRef = useRef<any>(null);

  const fallback = { lat: RIYADH_LAT, lng: RIYADH_LNG };
  const startCoords = initialLocation ?? fallback;

  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number }>(startCoords);
  const [locating, setLocating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      const coords = initialLocation ?? fallback;
      setPinCoords(coords);
      setMapReady(false);
    }
  }, [visible, initialLocation]);

  const animateToCoords = useCallback((lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400,
      );
    }
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      if (Platform.OS === 'web') {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setPinCoords(coords);
            animateToCoords(coords.lat, coords.lng);
            setLocating(false);
            console.log('[MapLocationPicker] Web GPS:', coords);
          },
          () => {
            Alert.alert(t('error'), t('locationError'));
            setLocating(false);
          },
        );
        return;
      }

      if (!ExpoLocation) {
        Alert.alert(t('error'), t('locationError'));
        setLocating(false);
        return;
      }

      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('locationPermissionDenied'));
        setLocating(false);
        return;
      }

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setPinCoords(coords);
      animateToCoords(coords.lat, coords.lng);
      console.log('[MapLocationPicker] Device GPS:', coords);
    } catch (e) {
      console.log('[MapLocationPicker] GPS error:', e);
      Alert.alert(t('error'), t('locationError'));
    } finally {
      setLocating(false);
    }
  }, [t, animateToCoords]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(pinCoords);
      onClose();
    } catch (e) {
      console.log('[MapLocationPicker] Save error:', e);
      Alert.alert(t('error'), t('locationError'));
    } finally {
      setSaving(false);
    }
  }, [pinCoords, onSave, onClose, t]);

  const handleMarkerDragEnd = useCallback((e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinCoords({ lat: latitude, lng: longitude });
    console.log('[MapLocationPicker] Pin dragged to:', latitude, longitude);
  }, []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const isNativeMap = MapView && Platform.OS !== 'web';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={s.container}>
        <SafeAreaView edges={['top']} style={s.headerSafe}>
          <View style={[s.headerRow, isRTL && s.headerRowRTL]}>
            <Pressable style={s.closeBtn} onPress={onClose} testID="location-picker-close">
              <X size={22} color={Colors.text} />
            </Pressable>
            <Text style={s.headerTitle}>{t('locationPickerTitle')}</Text>
            <View style={s.closeBtn} />
          </View>
        </SafeAreaView>

        <View style={s.hintBar}>
          <MapPin size={16} color={Colors.primary} />
          <Text style={[s.hintText, isRTL && s.rtlText]}>{t('dragPinToSetLocation')}</Text>
        </View>

        <View style={s.mapWrap}>
          {isNativeMap ? (
            <>
              <MapView
                ref={mapRef}
                style={s.map}
                initialRegion={{
                  latitude: startCoords.lat,
                  longitude: startCoords.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onMapReady={handleMapReady}
                showsUserLocation
                showsMyLocationButton={false}
              >
                {mapReady && Marker && (
                  <Marker
                    coordinate={{
                      latitude: pinCoords.lat,
                      longitude: pinCoords.lng,
                    }}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                  >
                    <View style={s.pinOuter}>
                      <View style={s.pinInner}>
                        <MapPin size={20} color={Colors.white} />
                      </View>
                      <View style={s.pinTail} />
                    </View>
                  </Marker>
                )}
              </MapView>

              <Pressable
                style={({ pressed }) => [s.gpsBtn, pressed && s.gpsBtnPressed]}
                onPress={handleUseCurrentLocation}
                disabled={locating}
                testID="use-current-location-btn"
              >
                {locating ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Crosshair size={22} color={Colors.primary} />
                )}
              </Pressable>
            </>
          ) : (
            <View style={s.webFallback}>
              <MapPin size={48} color={Colors.primary} />
              <Text style={s.webTitle}>{t('locationPickerTitle')}</Text>
              <Text style={[s.webCoords, isRTL && s.rtlText]}>
                {pinCoords.lat.toFixed(6)}, {pinCoords.lng.toFixed(6)}
              </Text>
              <Pressable
                style={({ pressed }) => [s.webGpsBtn, pressed && { opacity: 0.85 }]}
                onPress={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Crosshair size={18} color={Colors.white} />
                    <Text style={s.webGpsBtnText}>{t('useCurrentLocation')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <SafeAreaView edges={['bottom']} style={s.bottomBar}>
          <View style={s.coordsRow}>
            <Text style={s.coordsLabel}>{pinCoords.lat.toFixed(6)}, {pinCoords.lng.toFixed(6)}</Text>
          </View>
          <View style={s.actionsRow}>
            <Pressable
              style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.8 }]}
              onPress={onClose}
            >
              <Text style={s.cancelBtnText}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.9 }, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              testID="save-location-btn"
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Check size={18} color={Colors.white} />
                  <Text style={s.saveBtnText}>{t('saveLocation')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRowRTL: {
    flexDirection: 'row-reverse',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryFaded,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primaryDark,
  },
  rtlText: {
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },
  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  pinOuter: {
    alignItems: 'center',
  },
  pinInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    marginTop: -2,
  },
  gpsBtn: {
    position: 'absolute',
    top: 16,
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
  gpsBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    gap: 12,
    paddingHorizontal: 32,
  },
  webTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 8,
  },
  webCoords: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  webGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  webGpsBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  coordsRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  coordsLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
