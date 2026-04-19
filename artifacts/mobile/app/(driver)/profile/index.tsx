import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Switch, TextInput, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Phone, MapPin, Star, LogOut, Globe, Truck, HelpCircle, Info, Car, Bike, Hash, Navigation, Save, Camera, ImageIcon, Check, Crosshair } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { VehicleType } from '@/types';
import SupportDialog from '@/components/SupportDialog';
import MapLocationPicker from '@/components/MapLocationPicker';
import { pickImageFromGallery } from '@/utils/imagePicker';
import { uploadProviderAvatar, uploadVehicleImage } from '@/services/cloudinary';
import { Image } from 'expo-image';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { t, isRTL, locale, toggleLocale } = useLocale();
  const { user, logout, updateUser } = useAuth();
  const { updateDriverAvailability } = useData();
  const r = isRTL;

  const [isAvailable, setIsAvailable] = useState<boolean>(user?.isAvailable ?? false);
  const [showEditVehicle, setShowEditVehicle] = useState<boolean>(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>((user?.vehicleType as VehicleType) ?? 'car');
  const [plateNumber, setPlateNumber] = useState<string>(user?.vehiclePlateNumber ?? '');
  const [vehicleImageUrl, setVehicleImageUrl] = useState<string>(user?.vehicleImageUrl ?? '');
  const [isUploadingVehicle, setIsUploadingVehicle] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [city, setCity] = useState<string>(user?.city ?? '');
  const [maxDistance, setMaxDistance] = useState<string>(String(user?.maxDistanceKm ?? 20));
  const [showSupport, setShowSupport] = useState<boolean>(false);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);

  const handleSaveLocation = useCallback(async (coords: { lat: number; lng: number }) => {
    await updateUser({ location: coords });
    console.log('[DriverProfile] Location saved:', coords);
    Alert.alert(t('success'), t('locationSaved'));
  }, [updateUser, t]);

  const handleToggleAvailability = useCallback(async (value: boolean) => {
    if (!user) return;
    setIsAvailable(value);
    await updateDriverAvailability(user.uid, value);
    await updateUser({ isAvailable: value });
  }, [user, updateDriverAvailability, updateUser]);

  const handleChangeAvatar = useCallback(async () => {
    const result = await pickImageFromGallery();
    if (!result) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadProviderAvatar(result.uri);
      await updateUser({ photoUrl: url });
      Alert.alert(t('success'), t('profilePictureUpdated'));
    } catch (e) {
      console.log('[DriverProfile] Avatar upload error:', e);
      Alert.alert(t('error'), t('uploadError'));
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [updateUser, t]);

  const handlePickVehicleImage = useCallback(async () => {
    const result = await pickImageFromGallery();
    if (!result) return;
    setIsUploadingVehicle(true);
    try {
      const url = await uploadVehicleImage(result.uri);
      setVehicleImageUrl(url);
    } catch (e) {
      console.log('[DriverProfile] Vehicle image upload error:', e);
      Alert.alert(t('error'), t('uploadError'));
    } finally {
      setIsUploadingVehicle(false);
    }
  }, [t]);

  const handleSaveVehicle = useCallback(async () => {
    if (!plateNumber.trim()) { Alert.alert(t('error'), locale === 'ar' ? 'يرجى إدخال رقم اللوحة' : 'Please enter plate number'); return; }
    await updateUser({ vehicleType, vehiclePlateNumber: plateNumber.trim(), vehicleImageUrl: vehicleImageUrl.trim(), city: city.trim(), maxDistanceKm: parseInt(maxDistance, 10) || 20 });
    Alert.alert(t('success'), locale === 'ar' ? 'تم حفظ بيانات المركبة' : 'Vehicle info saved');
    setShowEditVehicle(false);
  }, [vehicleType, plateNumber, vehicleImageUrl, city, maxDistance, updateUser, t, locale]);

  const handleLogout = useCallback(() => {
    Alert.alert(t('logout'), locale === 'ar' ? 'هل تريد تسجيل الخروج؟' : 'Do you want to logout?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: async () => { await logout(); router.replace('/auth/login' as any); } },
    ]);
  }, [logout, t, locale]);

  const vehicleTypes: { value: VehicleType; label: string; Icon: any }[] = [
    { value: 'car', label: t('car'), Icon: Car },
    { value: 'motorcycle', label: t('motorcycle'), Icon: Bike },
    { value: 'bicycle', label: t('bicycle'), Icon: Navigation },
  ];

  return (
    <View style={cs.container}>
      <SafeAreaView edges={['top']} style={[cs.headerSafe, { paddingHorizontal: 20, paddingBottom: 12 }]}>
        <Text style={[cs.pageTitle, r && cs.rtlText]}>{t('profile')}</Text>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.profileCard}>
          <Pressable style={s.avatarWrap} onPress={handleChangeAvatar} disabled={isUploadingAvatar}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={s.avatarImg} contentFit="cover" />
            ) : (
              <View style={s.avatar}><Truck size={32} color={Colors.primary} /></View>
            )}
            <View style={s.avatarBadge}>
              {isUploadingAvatar ? <ActivityIndicator size="small" color={Colors.white} /> : <Camera size={14} color={Colors.white} />}
            </View>
          </Pressable>
          <Text style={s.profileName}>{user?.displayName}</Text>
          <Text style={s.profileRole}>{t('driver')}</Text>
          <View style={s.statsRow}>
            <View style={s.statItem}><Star size={16} color={Colors.star} /><Text style={s.statValue}>{user?.ratingAverage?.toFixed(1) || '0.0'}</Text><Text style={s.statLabel}>{t('rating')}</Text></View>
            <View style={s.statDivider} />
            <View style={s.statItem}><Text style={s.statValue}>{user?.ratingCount || 0}</Text><Text style={s.statLabel}>{t('reviews')}</Text></View>
          </View>
        </View>

        <View style={s.availCard}>
          <View style={[s.availRow, r && cs.rowRTL]}>
            <View style={cs.flex1}>
              <Text style={[s.availTitle, r && cs.rtlText]}>{t('isAvailable')}</Text>
              <Text style={[s.availDesc, r && cs.rtlText]}>{isAvailable ? (locale === 'ar' ? 'أنت متاح لاستقبال طلبات التوصيل' : 'You are available for delivery requests') : (locale === 'ar' ? 'لن تظهر في قائمة السائقين المتاحين' : 'You will not appear in available drivers')}</Text>
            </View>
            <Switch value={isAvailable} onValueChange={handleToggleAvailability} trackColor={{ false: Colors.border, true: Colors.successLight }} thumbColor={isAvailable ? Colors.success : Colors.textTertiary} />
          </View>
          <View style={[s.statusIndicator, { backgroundColor: isAvailable ? Colors.successLight : Colors.errorLight }]}>
            <View style={[s.statusDot, { backgroundColor: isAvailable ? Colors.success : Colors.error }]} />
            <Text style={{ fontSize: 13, fontWeight: '600' as const, color: isAvailable ? Colors.success : Colors.error }}>{isAvailable ? t('isAvailable') : t('notAvailable')}</Text>
          </View>
        </View>

        <View style={cs.menuSection}>
          <View style={[cs.infoRow, r && cs.rowRTL]}><Mail size={18} color={Colors.textSecondary} /><Text style={[cs.infoText, r && cs.rtlText]}>{user?.email}</Text></View>
          <View style={[cs.infoRow, r && cs.rowRTL]}><Phone size={18} color={Colors.textSecondary} /><Text style={[cs.infoText, r && cs.rtlText]}>{user?.phone || '-'}</Text></View>
          <View style={[cs.infoRow, r && cs.rowRTL, { borderBottomWidth: 0 }]}><MapPin size={18} color={Colors.textSecondary} /><Text style={[cs.infoText, r && cs.rtlText]}>{user?.address || '-'}</Text></View>
        </View>

        <Pressable style={[s.vehicleBtn, r && cs.rowRTL]} onPress={() => setShowLocationPicker(true)}>
          <Crosshair size={20} color={user?.location ? Colors.success : Colors.primary} />
          <View style={cs.flex1}>
            <Text style={[s.vehicleBtnTitle, r && cs.rtlText]}>{t('setMyLocation')}</Text>
            <Text style={[s.vehicleBtnSub, r && cs.rtlText]}>
              {user?.location ? t('locationAlreadySet') : t('setDriverLocationDesc')}
            </Text>
          </View>
          {user?.location ? (
            <Check size={18} color={Colors.success} />
          ) : (
            <MapPin size={18} color={Colors.textTertiary} />
          )}
        </Pressable>

        <Pressable style={[s.vehicleBtn, r && cs.rowRTL]} onPress={() => setShowEditVehicle(!showEditVehicle)}>
          <Car size={20} color={Colors.primary} />
          <View style={cs.flex1}>
            <Text style={[s.vehicleBtnTitle, r && cs.rtlText]}>{locale === 'ar' ? 'بيانات المركبة' : 'Vehicle Information'}</Text>
            {user?.vehiclePlateNumber && <Text style={[s.vehicleBtnSub, r && cs.rtlText]}>{user.vehiclePlateNumber} • {user.vehicleType}</Text>}
          </View>
        </Pressable>

        {showEditVehicle && (
          <View style={s.vehicleForm}>
            <Text style={[cs.formLabel, r && cs.rtlText]}>{t('vehicleType')}</Text>
            <View style={s.vtRow}>
              {vehicleTypes.map((vt) => (
                <Pressable key={vt.value} style={[s.vtChip, vehicleType === vt.value && s.vtActive]} onPress={() => setVehicleType(vt.value)}>
                  <vt.Icon size={18} color={vehicleType === vt.value ? Colors.white : Colors.text} />
                  <Text style={[s.vtText, vehicleType === vt.value && { color: Colors.white }]}>{vt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[cs.formLabel, r && cs.rtlText]}>{t('vehiclePlateNumber')}</Text>
            <TextInput style={[cs.formInput, r && cs.inputRTL]} placeholder={t('vehiclePlateHint')} placeholderTextColor={Colors.textTertiary} value={plateNumber} onChangeText={setPlateNumber} textAlign={r ? 'right' : 'left'} />
            <Text style={[cs.formLabel, r && cs.rtlText]}>{t('vehicleImage')}</Text>
            <Pressable style={s.imagePickerBtn} onPress={handlePickVehicleImage} disabled={isUploadingVehicle}>
              {isUploadingVehicle ? (
                <ActivityIndicator color={Colors.primary} />
              ) : vehicleImageUrl ? (
                <Image source={{ uri: vehicleImageUrl }} style={s.vehiclePreview} contentFit="cover" />
              ) : (
                <View style={s.imagePickerPlaceholder}>
                  <ImageIcon size={24} color={Colors.textTertiary} />
                  <Text style={s.imagePickerText}>{t('chooseVehicleImage')}</Text>
                </View>
              )}
            </Pressable>
            <Text style={[cs.formLabel, r && cs.rtlText]}>{t('city')}</Text>
            <TextInput style={[cs.formInput, r && cs.inputRTL]} placeholder={locale === 'ar' ? 'الرياض' : 'Riyadh'} placeholderTextColor={Colors.textTertiary} value={city} onChangeText={setCity} textAlign={r ? 'right' : 'left'} />
            <Text style={[cs.formLabel, r && cs.rtlText]}>{t('maxDeliveryDistance')} ({t('km')})</Text>
            <TextInput style={[cs.formInput, r && cs.inputRTL]} placeholder="20" placeholderTextColor={Colors.textTertiary} value={maxDistance} onChangeText={setMaxDistance} keyboardType="numeric" textAlign={r ? 'right' : 'left'} />
            <Pressable style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.9 }]} onPress={handleSaveVehicle}>
              <Save size={18} color={Colors.white} /><Text style={s.saveText}>{t('save')}</Text>
            </Pressable>
          </View>
        )}

        <View style={cs.menuSection}>
          <Pressable style={[cs.menuRow, r && cs.rowRTL]} onPress={toggleLocale}><Globe size={20} color={Colors.textSecondary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('language')}</Text><Text style={cs.menuValue}>{t('switchLang')}</Text></Pressable>
          <Pressable style={[cs.menuRow, r && cs.rowRTL]} onPress={() => setShowSupport(true)}><HelpCircle size={20} color={Colors.textSecondary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('supportTitle')}</Text></Pressable>
          <Pressable style={[cs.menuRow, r && cs.rowRTL, { borderBottomWidth: 0 }]} onPress={() => router.push('/(driver)/profile/about' as any)}><Info size={20} color={Colors.textSecondary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('aboutTitle')}</Text></Pressable>
        </View>

        <Pressable style={({ pressed }) => [cs.logoutBtn, pressed && cs.btnPressed]} onPress={handleLogout}>
          <LogOut size={20} color={Colors.error} /><Text style={cs.logoutText}>{t('logout')}</Text>
        </Pressable>
        <Text style={cs.versionText}>{t('poweredBy')}</Text>
        <View style={cs.bottomSpacer} />
      </ScrollView>
      <SupportDialog visible={showSupport} onClose={() => setShowSupport(false)} />
      <MapLocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSave={handleSaveLocation}
        initialLocation={user?.location}
      />
    </View>
  );
}

const s = StyleSheet.create({
  profileCard: { backgroundColor: Colors.surface, margin: 20, borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: Colors.shadow.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: Colors.shadow.opacity, shadowRadius: 8, elevation: 3 },
  avatarWrap: { marginBottom: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarBadge: { position: 'absolute' as const, bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 2, borderColor: Colors.surface },
  imagePickerBtn: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' as const, marginBottom: 8, minHeight: 100, justifyContent: 'center' as const, alignItems: 'center' as const },
  vehiclePreview: { width: '100%' as any, height: 140, borderRadius: 12 },
  imagePickerPlaceholder: { paddingVertical: 24, alignItems: 'center' as const, gap: 8 },
  imagePickerText: { fontSize: 13, color: Colors.textTertiary },
  profileName: { fontSize: 20, fontWeight: '800' as const, color: Colors.text, marginBottom: 4 },
  profileRole: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { alignItems: 'center', paddingHorizontal: 20, gap: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.divider },
  statValue: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textTertiary },
  availCard: { backgroundColor: Colors.surface, marginHorizontal: 20, marginBottom: 16, borderRadius: 18, padding: 18, shadowColor: Colors.shadow.color, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  availRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  availTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  availDesc: { fontSize: 13, color: Colors.textTertiary, lineHeight: 18 },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  vehicleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: 20, marginBottom: 4, borderRadius: 16, padding: 18, gap: 14 },
  vehicleBtnTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 2 },
  vehicleBtnSub: { fontSize: 12, color: Colors.textTertiary },
  vehicleForm: { backgroundColor: Colors.surface, marginHorizontal: 20, marginBottom: 16, marginTop: 4, borderRadius: 16, padding: 18 },
  vtRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  vtChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight },
  vtActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vtText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  saveBtn: { flexDirection: 'row', backgroundColor: Colors.primary, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  saveText: { color: Colors.white, fontSize: 16, fontWeight: '700' as const },
});
