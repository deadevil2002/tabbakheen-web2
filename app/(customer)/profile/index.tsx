import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  LogOut,
  Globe,
  Mail,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Shield,
  Info,
  Camera,
  Edit3,
  Save,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import SupportDialog from '@/components/SupportDialog';
import { pickImageFromGallery } from '@/utils/imagePicker';
import { uploadProviderAvatar } from '@/services/cloudinary';

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { t, isRTL, locale, toggleLocale } = useLocale();
  const { user, logout, updateUser } = useAuth();

  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const [showSupport, setShowSupport] = useState<boolean>(false);

  if (!user) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('profile')}</Text>
        </SafeAreaView>
        <View style={styles.guestContainer}>
          <UserCircle size={48} color={Colors.textTertiary} />
          <Text style={[styles.guestTitle, isRTL && styles.rtlText]}>{t('loginRequired')}</Text>
          <Text style={[styles.guestDesc, isRTL && styles.rtlText]}>{t('loginRequiredMsg')}</Text>
          <Pressable
            style={({ pressed }) => [styles.guestLoginBtn, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/auth/login' as any)}
          >
            <Text style={styles.guestLoginBtnText}>{t('login')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(user?.displayName ?? '');
  const [editPhone, setEditPhone] = useState<string>(user?.phone ?? '');
  const [editCity, setEditCity] = useState<string>(user?.city ?? '');
  const [editAddress, setEditAddress] = useState<string>(user?.address ?? '');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleChangeAvatar = useCallback(async () => {
    const result = await pickImageFromGallery();
    if (!result) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadProviderAvatar(result.uri);
      await updateUser({ photoUrl: url });
      Alert.alert(t('success'), t('profilePictureUpdated'));
    } catch (e) {
      console.log('[Profile] Avatar upload error:', e);
      Alert.alert(t('error'), t('uploadError'));
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [updateUser, t]);

  const handleStartEdit = useCallback(() => {
    setEditName(user?.displayName ?? '');
    setEditPhone(user?.phone ?? '');
    setEditCity(user?.city ?? '');
    setEditAddress(user?.address ?? '');
    setIsEditing(true);
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (editName.trim() !== (user?.displayName ?? '')) updates.displayName = editName.trim();
      if (editPhone.trim() !== (user?.phone ?? '')) updates.phone = editPhone.trim();
      if (editCity.trim() !== (user?.city ?? '')) updates.city = editCity.trim();
      if (editAddress.trim() !== (user?.address ?? '')) updates.address = editAddress.trim();
      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        return;
      }
      console.log('[CustomerProfile] Saving profile updates:', JSON.stringify(updates));
      await updateUser(updates);
      Alert.alert(t('success'), t('profileUpdated'));
      setIsEditing(false);
    } catch (e) {
      console.log('[CustomerProfile] Save profile error:', e);
      Alert.alert(t('error'), t('profileUpdateError'));
    } finally {
      setIsSaving(false);
    }
  }, [editName, editPhone, editCity, editAddress, user, updateUser, t]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('logout'),
      locale === 'ar' ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login' as any);
          },
        },
      ],
    );
  }, [logout, t, locale]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('profile')}</Text>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <Pressable style={styles.avatarContainer} onPress={handleChangeAvatar} disabled={isUploadingAvatar}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <UserCircle size={48} color={Colors.primary} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Camera size={14} color={Colors.white} />
              )}
            </View>
          </Pressable>
          <Text style={[styles.name, isRTL && styles.rtlText]}>{user?.displayName}</Text>
          <Text style={[styles.role, isRTL && styles.rtlText]}>{t('customer')}</Text>
        </View>

        <View style={styles.infoSection}>
          {!isEditing ? (
            <>
              <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
                <Mail size={18} color={Colors.textTertiary} />
                <Text style={[styles.infoText, isRTL && styles.rtlText]}>{user?.email}</Text>
              </View>
              {user?.phone ? (
                <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
                  <Phone size={18} color={Colors.textTertiary} />
                  <Text style={[styles.infoText, isRTL && styles.rtlText]}>{user.phone}</Text>
                </View>
              ) : null}
              {user?.city ? (
                <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
                  <MapPin size={18} color={Colors.textTertiary} />
                  <Text style={[styles.infoText, isRTL && styles.rtlText]}>{user.city}</Text>
                </View>
              ) : null}
              {user?.address ? (
                <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
                  <MapPin size={18} color={Colors.textTertiary} />
                  <Text style={[styles.infoText, isRTL && styles.rtlText]}>{user.address}</Text>
                </View>
              ) : null}
              <Pressable style={styles.editBtn} onPress={handleStartEdit}>
                <Edit3 size={16} color={Colors.primary} />
                <Text style={styles.editBtnText}>{t('editProfile')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
                <Mail size={18} color={Colors.textTertiary} />
                <Text style={[styles.infoText, { color: Colors.textTertiary }]}>{user?.email}</Text>
              </View>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{t('displayName')}</Text>
              <TextInput style={[styles.input, isRTL && styles.rtlText]} value={editName} onChangeText={setEditName} placeholder={t('fullName')} placeholderTextColor={Colors.textTertiary} textAlign={isRTL ? 'right' : 'left'} />
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{t('phoneNumber')}</Text>
              <TextInput style={[styles.input, isRTL && styles.rtlText]} value={editPhone} onChangeText={setEditPhone} placeholder={t('phone')} placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" textAlign={isRTL ? 'right' : 'left'} />
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{t('cityLabel')}</Text>
              <TextInput style={[styles.input, isRTL && styles.rtlText]} value={editCity} onChangeText={setEditCity} placeholder={t('cityLabel')} placeholderTextColor={Colors.textTertiary} textAlign={isRTL ? 'right' : 'left'} />
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{t('addressLabel')}</Text>
              <TextInput style={[styles.input, isRTL && styles.rtlText]} value={editAddress} onChangeText={setEditAddress} placeholder={t('address')} placeholderTextColor={Colors.textTertiary} textAlign={isRTL ? 'right' : 'left'} />
              <View style={styles.editActions}>
                <Pressable style={styles.saveBtn} onPress={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator size="small" color={Colors.white} /> : <><Save size={16} color={Colors.white} /><Text style={styles.saveBtnText}>{t('save')}</Text></>}
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.menuSection}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, isRTL && styles.rowRTL, pressed && styles.menuPressed]}
            onPress={toggleLocale}
          >
            <Globe size={20} color={Colors.primary} />
            <Text style={[styles.menuText, isRTL && styles.rtlText, styles.menuTextFlex]}>{t('language')}</Text>
            <Text style={styles.menuValue}>{locale === 'ar' ? t('arabic') : t('english')}</Text>
            <Arrow size={18} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, isRTL && styles.rowRTL, pressed && styles.menuPressed]}
            onPress={() => router.push('/(customer)/profile/about' as any)}
          >
            <Info size={20} color={Colors.primary} />
            <Text style={[styles.menuText, isRTL && styles.rtlText, styles.menuTextFlex]}>{t('aboutTitle')}</Text>
            <Arrow size={18} color={Colors.textTertiary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, isRTL && styles.rowRTL, pressed && styles.menuPressed]}
            onPress={() => setShowSupport(true)}
          >
            <Shield size={20} color={Colors.primary} />
            <Text style={[styles.menuText, isRTL && styles.rtlText, styles.menuTextFlex]}>{t('supportTitle')}</Text>
            <Arrow size={18} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <LogOut size={20} color={Colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </Pressable>

        <Text style={styles.versionText}>
          {t('version')} 1.0.0 • {t('poweredBy')}
        </Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SupportDialog visible={showSupport} onClose={() => setShowSupport(false)} />
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 8,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  infoSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  infoText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  menuSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  menuPressed: {
    backgroundColor: Colors.background,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  menuTextFlex: {
    flex: 1,
  },
  menuValue: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginRight: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: 14,
    marginHorizontal: 20,
    padding: 16,
    gap: 10,
  },
  logoutPressed: {
    opacity: 0.9,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 24,
  },
  avatarBadge: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  bottomSpacer: {
    height: 30,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
    gap: 12,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 12,
  },
  guestDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  guestLoginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  guestLoginBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
