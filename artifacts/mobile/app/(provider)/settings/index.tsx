import { AppAlert } from '@/components/AppDialog';
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LogOut, Globe, Mail, Phone, MapPin, ChevronLeft, ChevronRight, UserCircle, Shield, Info, CreditCard, Building2, Crown, AlertTriangle, Check, Camera, Navigation, BadgeCheck, FileText } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import SupportDialog from '@/components/SupportDialog';
import MapLocationPicker from '@/components/MapLocationPicker';
import { RatingStars } from '@/components/RatingStars';
import { ProviderPaymentMethods, SAUDI_BANKS } from '@/types';
import { formatPrice, formatDateOnly, daysRemaining, getSubscriptionStatusColor } from '@/utils/helpers';
import { SUBSCRIPTION_PRICE } from '@/mocks/data';
import { pickImageFromGallery, pickImageFreeAspect } from '@/utils/imagePicker';
import { uploadProviderAvatar, uploadFreelanceCertificate } from '@/services/cloudinary';
import { verifyCommercialRegistration, submitFreelanceCertificate } from '@/services/pushApi';
import { fsGetVerificationCrNumber, fsSubscribeToFreelanceCertificate } from '@/services/firestoreUsers';
import type { FreelanceCertReview } from '@/services/firestoreUsers';
import { VERIFIED_BLUE } from '@/components/VerifiedBadge';

export default function ProviderSettingsScreen() {
  const router = useRouter();
  const { t, isRTL, locale, toggleLocale } = useLocale();
  const { user, logout, updateUser } = useAuth();
  const { getSubscription, isProviderSubscriptionValid, updateProviderPaymentMethods } = useData();
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const r = isRTL;

  const subscription = useMemo(() => (user ? getSubscription(user.uid) : undefined), [user, getSubscription]);
  const isSubValid = useMemo(() => (user ? isProviderSubscriptionValid(user.uid) : false), [user, isProviderSubscriptionValid]);

  const [showPaymentSettings, setShowPaymentSettings] = useState<boolean>(false);
  const [stcEnabled, setStcEnabled] = useState<boolean>(user?.paymentMethods?.stcPay?.enabled ?? false);
  const [stcPhone, setStcPhone] = useState<string>(user?.paymentMethods?.stcPay?.phone ?? '');
  const [bankEnabled, setBankEnabled] = useState<boolean>(user?.paymentMethods?.bankTransfer?.enabled ?? false);
  const [bankIban, setBankIban] = useState<string>(user?.paymentMethods?.bankTransfer?.iban ?? '');
  const [bankAccountName, setBankAccountName] = useState<string>(user?.paymentMethods?.bankTransfer?.accountName ?? '');
  const [bankName, setBankName] = useState<string>(user?.paymentMethods?.bankTransfer?.bankName ?? '');
  const [showBankPicker, setShowBankPicker] = useState<boolean>(false);
  const [showSupport, setShowSupport] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [crNumber, setCrNumber] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showVerifyForm, setShowVerifyForm] = useState<boolean>(false);
  const [verifiedCr, setVerifiedCr] = useState<string | null>(null);
  const [verifyType, setVerifyType] = useState<'cr' | 'freelance'>('cr');
  const [certNumber, setCertNumber] = useState<string>('');
  const [certImageUri, setCertImageUri] = useState<string | null>(null);
  const [isSubmittingCert, setIsSubmittingCert] = useState<boolean>(false);
  const [freelanceCert, setFreelanceCert] = useState<FreelanceCertReview | null>(null);
  const verificationStatus = user?.verificationStatus;
  const flReviewStatus = freelanceCert?.reviewStatus;

  useEffect(() => {
    let active = true;
    if (user?.uid && verificationStatus === 'verified') {
      fsGetVerificationCrNumber(user.uid).then((cr) => { if (active) setVerifiedCr(cr); });
    } else {
      setVerifiedCr(null);
    }
    return () => { active = false; };
  }, [user?.uid, verificationStatus]);

  // Live-subscribe to the provider's own freelance certificate review state so
  // approve/reject decisions reflect immediately without logout/login.
  useEffect(() => {
    if (!user?.uid) { setFreelanceCert(null); return; }
    const unsub = fsSubscribeToFreelanceCertificate(user.uid, setFreelanceCert);
    return () => unsub();
  }, [user?.uid]);

  // After a rejection, default the form to the freelance tab so the provider can
  // resubmit a new certificate right away.
  useEffect(() => {
    if (flReviewStatus === 'rejected') setVerifyType('freelance');
  }, [flReviewStatus]);

  const handleChangeAvatar = useCallback(async () => {
    const result = await pickImageFromGallery();
    if (!result) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadProviderAvatar(result.uri);
      await updateUser({ photoUrl: url });
      AppAlert.alert(t('success'), t('profilePictureUpdated'));
    } catch (e) {
      console.log('[ProviderSettings] Avatar upload error:', e);
      AppAlert.alert(t('error'), t('uploadError'));
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [updateUser, t]);

  const handleSaveLocation = useCallback(async (coords: { lat: number; lng: number }) => {
    await updateUser({ location: coords });
    console.log('[ProviderSettings] Location saved:', coords);
    AppAlert.alert(t('success'), t('locationSaved'));
  }, [updateUser, t]);

  const handleSavePaymentSettings = useCallback(async () => {
    if (!user) return;
    if (stcEnabled && !stcPhone.trim()) { AppAlert.alert(t('error'), locale === 'ar' ? 'يرجى إدخال رقم STC Pay' : 'Please enter STC Pay number'); return; }
    if (bankEnabled && (!bankIban.trim() || !bankAccountName.trim() || !bankName.trim())) { AppAlert.alert(t('error'), locale === 'ar' ? 'يرجى إكمال بيانات التحويل البنكي' : 'Please complete bank transfer details'); return; }
    const paymentMethods: ProviderPaymentMethods = { stcPay: { enabled: stcEnabled, phone: stcPhone.trim() }, bankTransfer: { enabled: bankEnabled, iban: bankIban.trim(), accountName: bankAccountName.trim(), bankName } };
    await updateProviderPaymentMethods(user.uid, paymentMethods);
    await updateUser({ paymentMethods });
    AppAlert.alert(t('success'), t('paymentSettingsSaved'));
    setShowPaymentSettings(false);
  }, [user, stcEnabled, stcPhone, bankEnabled, bankIban, bankAccountName, bankName, updateProviderPaymentMethods, updateUser, t, locale]);

  const handleVerifyCr = useCallback(async () => {
    if (!user) return;
    const cr = crNumber.trim();
    if (!/^\d{10}$/.test(cr)) {
      AppAlert.alert(t('error'), t('crNumberInvalid'));
      return;
    }
    setIsVerifying(true);
    try {
      const result = await verifyCommercialRegistration(user.uid, cr);
      if (result.verificationStatus === 'verified') {
        AppAlert.alert(t('verified'), t('verificationSuccessMsg'));
      } else {
        AppAlert.alert(t('verifyBusiness'), t('verificationPendingMsg'));
      }
      setCrNumber('');
      setShowVerifyForm(false);
    } catch {
      AppAlert.alert(t('verifyBusiness'), t('verificationPendingMsg'));
      setCrNumber('');
      setShowVerifyForm(false);
    } finally {
      setIsVerifying(false);
    }
  }, [user, crNumber, t]);

  const handleChangeNumber = useCallback(() => {
    AppAlert.alert(t('changeVerificationTitle'), t('changeVerificationMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('continueAction'), style: 'default', onPress: () => { setCrNumber(''); setShowVerifyForm(true); } },
    ]);
  }, [t]);

  const handlePickCertImage = useCallback(async () => {
    const result = await pickImageFreeAspect();
    if (!result) return;
    setCertImageUri(result.uri);
  }, []);

  const handleSubmitFreelance = useCallback(async () => {
    if (!user) return;
    const num = certNumber.trim();
    if (num.length === 0) {
      AppAlert.alert(t('error'), t('freelanceCertNumberInvalid'));
      return;
    }
    if (!certImageUri) {
      AppAlert.alert(t('error'), t('certImageRequired'));
      return;
    }
    setIsSubmittingCert(true);
    try {
      const asset = await uploadFreelanceCertificate(certImageUri);
      const result = await submitFreelanceCertificate(user.uid, {
        certificateNumber: num,
        fileUrl: asset.url,
        publicId: asset.publicId,
        mimeType: 'image/jpeg',
        filename: 'certificate.jpg',
      });
      if (!result.success) {
        AppAlert.alert(t('error'), t('uploadError'));
        return;
      }
      AppAlert.alert(t('verifyBusiness'), t('freelanceSubmittedMsg'));
      setCertNumber('');
      setCertImageUri(null);
      setShowVerifyForm(false);
    } catch (e) {
      console.log('[ProviderSettings] Freelance submit error');
      AppAlert.alert(t('error'), t('uploadError'));
    } finally {
      setIsSubmittingCert(false);
    }
  }, [user, certNumber, certImageUri, t]);

  const handleLogout = useCallback(() => {
    AppAlert.alert(t('logout'), locale === 'ar' ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logoutShort'), style: 'destructive', onPress: async () => { await logout(); router.replace('/auth/login' as any); } },
    ]);
  }, [logout, t, locale]);

  const subStatusColors = subscription ? getSubscriptionStatusColor(subscription.status) : null;
  const getSubStatusLabel = (): string => {
    if (!subscription) return t('subscriptionExpired');
    const map: Record<string, string> = { trialing: t('subscriptionTrialing'), active: t('subscriptionActive'), expired: t('subscriptionExpired'), past_due: t('subscriptionPastDue'), canceled: t('subscriptionCanceled') };
    return map[subscription.status] || subscription.status;
  };

  return (
    <View style={cs.container}>
      <SafeAreaView edges={['top']} style={[cs.headerSafe, { paddingHorizontal: 20, paddingBottom: 12 }]}>
        <Text style={[cs.pageTitle, r && cs.rtlText]}>{t('settings')}</Text>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.profileSection}>
          <Pressable style={{ marginBottom: 12 }} onPress={handleChangeAvatar} disabled={isUploadingAvatar}>
            {user?.photoUrl ? <Image source={{ uri: user.photoUrl }} style={s.avatar} contentFit="cover" /> : (
              <View style={[s.avatar, s.avatarPlaceholder]}><UserCircle size={48} color={Colors.primary} /></View>
            )}
            <View style={s.avatarBadge}>
              {isUploadingAvatar ? <ActivityIndicator size="small" color={Colors.white} /> : <Camera size={14} color={Colors.white} />}
            </View>
          </Pressable>
          <Text style={[s.name, r && cs.rtlText]}>{user?.displayName}</Text>
          <Text style={[s.role, r && cs.rtlText]}>{t('provider')}</Text>
          <View style={s.ratingRow}><RatingStars rating={Math.round(user?.ratingAverage || 0)} size={16} /><Text style={s.ratingLabel}>{user?.ratingAverage?.toFixed(1) || '0.0'} ({user?.ratingCount || 0})</Text></View>
        </View>

        <View style={cs.sectionCard}>
          <View style={[s.subHeader, r && cs.rowRTL]}>
            <Crown size={22} color={isSubValid ? Colors.secondary : Colors.error} />
            <Text style={[s.subTitle, r && cs.rtlText]}>{t('subscription')}</Text>
            {subStatusColors && <View style={[s.subBadge, { backgroundColor: subStatusColors.bg }]}><Text style={[s.subBadgeText, { color: subStatusColors.text }]}>{getSubStatusLabel()}</Text></View>}
          </View>
          {!isSubValid && <View style={s.subWarning}><AlertTriangle size={16} color={Colors.error} /><Text style={[s.subWarningText, r && cs.rtlText]}>{t('subscriptionExpiredMsg')}</Text></View>}
          <View style={{ gap: 8 }}>
            <View style={[s.subRow, r && cs.rowRTL]}><Text style={[s.subLabel, r && cs.rtlText]}>{t('subscriptionPrice')}</Text><Text style={s.subValue}>{formatPrice(SUBSCRIPTION_PRICE, locale)} {t('subscriptionPerMonth')}</Text></View>
            {subscription?.status === 'trialing' && <View style={[s.subRow, r && cs.rowRTL]}><Text style={[s.subLabel, r && cs.rtlText]}>{t('trialDaysRemaining')}</Text><Text style={[s.subValue, { color: Colors.info }]}>{daysRemaining(subscription.trialEndsAt)} {locale === 'ar' ? 'يوم' : 'days'}</Text></View>}
            {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && <View style={[s.subRow, r && cs.rowRTL]}><Text style={[s.subLabel, r && cs.rtlText]}>{t('currentPeriodEnd')}</Text><Text style={s.subValue}>{formatDateOnly(subscription.currentPeriodEnd, locale)}</Text></View>}
          </View>
          {!isSubValid && <View style={s.renewInfo}><Text style={[s.renewText, r && cs.rtlText]}>{t('contactAdminToRenew')}</Text></View>}
          <Text style={[s.freeNote, r && cs.rtlText]}>{t('firstMonthFree')} ✨</Text>
        </View>

        <View style={[cs.menuSection, { padding: 16, gap: 14 }]}>
          <View style={[cs.infoRow, r && cs.rowRTL, { borderBottomWidth: 0, paddingHorizontal: 0, paddingVertical: 0 }]}><Mail size={18} color={Colors.textTertiary} /><Text style={[cs.infoText, r && cs.rtlText]}>{user?.email}</Text></View>
          {user?.phone ? <View style={[cs.infoRow, r && cs.rowRTL, { borderBottomWidth: 0, paddingHorizontal: 0, paddingVertical: 0 }]}><Phone size={18} color={Colors.textTertiary} /><Text style={[cs.infoText, r && cs.rtlText]}>{user.phone}</Text></View> : null}
          {user?.address ? <View style={[cs.infoRow, r && cs.rowRTL, { borderBottomWidth: 0, paddingHorizontal: 0, paddingVertical: 0 }]}><MapPin size={18} color={Colors.textTertiary} /><Text style={[cs.infoText, r && cs.rtlText]}>{user.address}</Text></View> : null}
        </View>

        <View style={cs.sectionCard}>
          <View style={[s.subHeader, r && cs.rowRTL]}>
            <BadgeCheck size={22} color={verificationStatus === 'verified' ? VERIFIED_BLUE : Colors.primary} />
            <Text style={[s.subTitle, r && cs.rtlText]}>{t('verifyBusiness')}</Text>
            {verificationStatus === 'verified' && (
              <View style={[s.subBadge, { backgroundColor: Colors.primaryFaded }]}>
                <Text style={[s.subBadgeText, { color: VERIFIED_BLUE }]}>{t('verified')}</Text>
              </View>
            )}
          </View>
          {flReviewStatus === 'pending' && (
            <View style={[s.flBanner, s.flBannerPending]}>
              <Text style={[s.flBannerText, r && cs.rtlText]}>{t('freelanceUnderReview')}</Text>
            </View>
          )}
          {flReviewStatus === 'approved' && (
            <View style={[s.flBanner, s.flBannerApproved]}>
              <Text style={[s.flBannerText, r && cs.rtlText]}>{t('freelanceApproved')}</Text>
            </View>
          )}
          {flReviewStatus === 'rejected' && (
            <View style={[s.flBanner, s.flBannerRejected]}>
              <Text style={[s.flBannerTitle, r && cs.rtlText]}>{t('freelanceRejected')}</Text>
              {freelanceCert?.internalReviewNote ? (
                <Text style={[s.flBannerText, r && cs.rtlText, { marginTop: 4 }]}>{t('freelanceRejectionReason')}: {freelanceCert.internalReviewNote}</Text>
              ) : null}
              <Text style={[s.flBannerText, r && cs.rtlText, { marginTop: 4 }]}>{t('freelanceResubmitNote')}</Text>
            </View>
          )}
          {verificationStatus === 'verified' && !showVerifyForm ? (
            <>
              <Text style={[s.verifyNote, r && cs.rtlText]}>{t('verificationSuccessMsg')}</Text>
              {verifiedCr ? (
                <View style={s.verifyCrBox}>
                  <Text style={[s.verifyCrLabel, r && cs.rtlText]}>{t('verifiedCrLabel')}</Text>
                  <Text style={[s.verifyCrValue, r && cs.rtlText]}>{verifiedCr}</Text>
                </View>
              ) : null}
              <Pressable
                style={({ pressed }) => [s.changeNumberBtn, r && cs.rowRTL, pressed && { opacity: 0.6 }]}
                onPress={handleChangeNumber}
              >
                <Text style={[s.changeNumberText, r && cs.rtlText]}>{t('changeNumber')}</Text>
              </Pressable>
            </>
          ) : verificationStatus === 'pending_review' && !showVerifyForm && flReviewStatus !== 'rejected' ? (
            <>
              {flReviewStatus !== 'pending' && (
                <Text style={[s.verifyNote, r && cs.rtlText]}>{t('verificationPendingDesc')}</Text>
              )}
              <Pressable
                style={({ pressed }) => [s.changeNumberBtn, r && cs.rowRTL, pressed && { opacity: 0.6 }]}
                onPress={() => { setCrNumber(''); setShowVerifyForm(true); }}
              >
                <Text style={[s.changeNumberText, r && cs.rtlText]}>{t('changeNumber')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {verificationStatus !== 'verified' && verificationStatus !== 'pending_review' && (
                <Text style={[s.verifyNote, r && cs.rtlText]}>{t('verifyOptionalNote')}</Text>
              )}
              <Text style={[s.verifyTypeLabel, r && cs.rtlText]}>{t('verificationTypeLabel')}</Text>
              <View style={[s.typeSelector, r && cs.rowRTL]}>
                <Pressable
                  style={[s.typeBtn, verifyType === 'cr' && s.typeBtnActive]}
                  onPress={() => setVerifyType('cr')}
                  disabled={isVerifying || isSubmittingCert}
                >
                  <Text style={[s.typeBtnText, verifyType === 'cr' && s.typeBtnTextActive]} numberOfLines={1}>{t('commercialRegistration')}</Text>
                </Pressable>
                <Pressable
                  style={[s.typeBtn, verifyType === 'freelance' && s.typeBtnActive]}
                  onPress={() => setVerifyType('freelance')}
                  disabled={isVerifying || isSubmittingCert}
                >
                  <Text style={[s.typeBtnText, verifyType === 'freelance' && s.typeBtnTextActive]} numberOfLines={1}>{t('freelanceCertificate')}</Text>
                </Pressable>
              </View>
              {verifyType === 'cr' ? (
                <>
                  <TextInput
                    style={[cs.formInput, r && cs.inputRTL, { marginTop: 12 }]}
                    placeholder={t('crNumberHint')}
                    placeholderTextColor={Colors.textTertiary}
                    value={crNumber}
                    onChangeText={setCrNumber}
                    keyboardType="number-pad"
                    maxLength={10}
                    textAlign={r ? 'right' : 'left'}
                    editable={!isVerifying}
                  />
                  <Pressable
                    style={({ pressed }) => [cs.primaryBtn, { marginTop: 12 }, pressed && { opacity: 0.9 }, isVerifying && { opacity: 0.7 }]}
                    onPress={handleVerifyCr}
                    disabled={isVerifying}
                  >
                    {isVerifying ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={cs.primaryBtnText}>{t('verify')}</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <TextInput
                    style={[cs.formInput, r && cs.inputRTL, { marginTop: 12 }]}
                    placeholder={t('freelanceCertNumberHint')}
                    placeholderTextColor={Colors.textTertiary}
                    value={certNumber}
                    onChangeText={setCertNumber}
                    textAlign={r ? 'right' : 'left'}
                    editable={!isSubmittingCert}
                  />
                  <Pressable
                    style={({ pressed }) => [s.uploadBtn, r && cs.rowRTL, pressed && { opacity: 0.8 }]}
                    onPress={handlePickCertImage}
                    disabled={isSubmittingCert}
                  >
                    <Camera size={18} color={Colors.primary} />
                    <Text style={[s.uploadBtnText, r && cs.rtlText]}>{certImageUri ? t('certImageSelected') : t('uploadCertificate')}</Text>
                    {certImageUri ? <Check size={18} color={Colors.success} /> : null}
                  </Pressable>
                  {certImageUri ? (
                    <Image source={{ uri: certImageUri }} style={s.certPreview} contentFit="cover" />
                  ) : null}
                  <Pressable
                    style={({ pressed }) => [cs.primaryBtn, { marginTop: 12 }, pressed && { opacity: 0.9 }, isSubmittingCert && { opacity: 0.7 }]}
                    onPress={handleSubmitFreelance}
                    disabled={isSubmittingCert}
                  >
                    {isSubmittingCert ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={cs.primaryBtnText}>{t('submitForReview')}</Text>}
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>

        <Pressable style={({ pressed }) => [s.paySettingsBtn, pressed && { backgroundColor: Colors.background }]} onPress={() => setShowLocationPicker(true)}>
          <View style={[s.paySettingsHeader, r && cs.rowRTL]}>
            <Navigation size={20} color={user?.location ? Colors.success : Colors.primary} />
            <View style={cs.flex1}>
              <Text style={[s.paySettingsTitle, r && cs.rtlText]}>{t('setMyLocation')}</Text>
              <Text style={[s.paySettingsDesc, r && cs.rtlText]}>
                {user?.location ? t('locationAlreadySet') : t('setLocationDesc')}
              </Text>
            </View>
            {user?.location ? (
              <Check size={18} color={Colors.success} />
            ) : (
              <MapPin size={18} color={Colors.textTertiary} />
            )}
          </View>
        </Pressable>

        <Pressable style={({ pressed }) => [s.paySettingsBtn, pressed && { backgroundColor: Colors.background }]} onPress={() => setShowPaymentSettings(!showPaymentSettings)}>
          <View style={[s.paySettingsHeader, r && cs.rowRTL]}>
            <CreditCard size={20} color={Colors.primary} />
            <View style={cs.flex1}><Text style={[s.paySettingsTitle, r && cs.rtlText]}>{t('paymentSettings')}</Text><Text style={[s.paySettingsDesc, r && cs.rtlText]}>{t('paymentSettingsDesc')}</Text></View>
            <Arrow size={18} color={Colors.textTertiary} />
          </View>
        </Pressable>

        {showPaymentSettings && (
          <View style={s.payForm}>
            <View style={{ marginBottom: 16 }}>
              <View style={[s.toggleRow, r && cs.rowRTL]}><Text style={[s.toggleLabel, r && cs.rtlText]}>{t('enableStcPay')}</Text><Switch value={stcEnabled} onValueChange={setStcEnabled} trackColor={{ false: Colors.border, true: Colors.primaryLight }} thumbColor={stcEnabled ? Colors.primary : Colors.textTertiary} /></View>
              {stcEnabled && <TextInput style={[cs.formInput, r && cs.inputRTL]} placeholder={t('stcPayPhoneHint')} placeholderTextColor={Colors.textTertiary} value={stcPhone} onChangeText={setStcPhone} keyboardType="phone-pad" textAlign={r ? 'right' : 'left'} />}
            </View>
            <View style={{ marginBottom: 16 }}>
              <View style={[s.toggleRow, r && cs.rowRTL]}><Text style={[s.toggleLabel, r && cs.rtlText]}>{t('enableBankTransfer')}</Text><Switch value={bankEnabled} onValueChange={setBankEnabled} trackColor={{ false: Colors.border, true: Colors.primaryLight }} thumbColor={bankEnabled ? Colors.primary : Colors.textTertiary} /></View>
              {bankEnabled && (
                <>
                  <TextInput style={[cs.formInput, r && cs.inputRTL, { marginBottom: 10 }]} placeholder={t('ibanHint')} placeholderTextColor={Colors.textTertiary} value={bankIban} onChangeText={setBankIban} textAlign={r ? 'right' : 'left'} autoCapitalize="characters" />
                  <TextInput style={[cs.formInput, r && cs.inputRTL, { marginBottom: 10 }]} placeholder={t('accountNameHint')} placeholderTextColor={Colors.textTertiary} value={bankAccountName} onChangeText={setBankAccountName} textAlign={r ? 'right' : 'left'} />
                  <Pressable style={[s.bankPickerBtn, r && cs.rowRTL]} onPress={() => setShowBankPicker(!showBankPicker)}>
                    <Building2 size={18} color={Colors.textSecondary} />
                    <Text style={[s.bankPickerText, r && cs.rtlText, !bankName && { color: Colors.textTertiary }]}>{bankName || t('selectBank')}</Text>
                    <Arrow size={16} color={Colors.textTertiary} />
                  </Pressable>
                  {showBankPicker && (
                    <View style={s.bankList}>
                      {SAUDI_BANKS.map((bank) => (
                        <Pressable key={bank} style={[s.bankItem, bankName === bank && s.bankItemActive]} onPress={() => { setBankName(bank); setShowBankPicker(false); }}>
                          <Text style={[s.bankItemText, bankName === bank && { color: Colors.primary, fontWeight: '600' as const }]}>{bank}</Text>
                          {bankName === bank && <Check size={16} color={Colors.primary} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
            <Pressable style={({ pressed }) => [cs.primaryBtn, pressed && { opacity: 0.9 }]} onPress={handleSavePaymentSettings}><Text style={cs.primaryBtnText}>{t('save')}</Text></Pressable>
          </View>
        )}

        <View style={cs.menuSection}>
          <Pressable style={({ pressed }) => [cs.menuRow, r && cs.rowRTL, pressed && { backgroundColor: Colors.background }]} onPress={toggleLocale}>
            <Globe size={20} color={Colors.primary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('language')}</Text><Text style={cs.menuValue}>{locale === 'ar' ? t('arabic') : t('english')}</Text><Arrow size={18} color={Colors.textTertiary} />
          </Pressable>
          <Pressable style={({ pressed }) => [cs.menuRow, r && cs.rowRTL, pressed && { backgroundColor: Colors.background }]} onPress={() => router.push('/(provider)/settings/my-complaints' as any)}>
            <FileText size={20} color={Colors.primary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('myComplaints')}</Text><Arrow size={18} color={Colors.textTertiary} />
          </Pressable>
          <Pressable style={({ pressed }) => [cs.menuRow, r && cs.rowRTL, pressed && { backgroundColor: Colors.background }]} onPress={() => router.push('/(provider)/settings/about' as any)}>
            <Info size={20} color={Colors.primary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('aboutTitle')}</Text><Arrow size={18} color={Colors.textTertiary} />
          </Pressable>
          <Pressable style={({ pressed }) => [cs.menuRow, r && cs.rowRTL, pressed && { backgroundColor: Colors.background }]} onPress={() => setShowSupport(true)}>
            <Shield size={20} color={Colors.primary} /><Text style={[cs.menuText, r && cs.rtlText]}>{t('supportTitle')}</Text><Arrow size={18} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Pressable style={({ pressed }) => [cs.logoutBtn, pressed && cs.btnPressed]} onPress={handleLogout}>
          <LogOut size={20} color={Colors.error} /><Text style={cs.logoutText}>{t('logout')}</Text>
        </Pressable>
        <Text style={cs.versionText}>{t('version')} 1.0.0 • {t('poweredBy')}</Text>
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
  profileSection: { alignItems: 'center', backgroundColor: Colors.surface, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { backgroundColor: Colors.primaryFaded, justifyContent: 'center', alignItems: 'center' },
  avatarBadge: { position: 'absolute' as const, bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 2, borderColor: Colors.surface },
  name: { fontSize: 22, fontWeight: '800' as const, color: Colors.text, marginBottom: 4 },
  role: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' as const, marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' as const },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  subTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  subBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  subBadgeText: { fontSize: 12, fontWeight: '700' as const },
  subWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.errorLight, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  subWarningText: { fontSize: 13, color: Colors.error, flex: 1, lineHeight: 18 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontSize: 14, color: Colors.textSecondary },
  subValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  renewInfo: { marginTop: 12, backgroundColor: Colors.warningLight, borderRadius: 10, padding: 12 },
  renewText: { fontSize: 13, color: Colors.warning, lineHeight: 18 },
  freeNote: { fontSize: 12, color: Colors.textTertiary, marginTop: 12, textAlign: 'center' },
  verifyNote: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  flBanner: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  flBannerPending: { backgroundColor: 'rgba(234, 88, 12, 0.08)', borderColor: 'rgba(234, 88, 12, 0.35)' },
  flBannerApproved: { backgroundColor: 'rgba(22, 163, 74, 0.08)', borderColor: 'rgba(22, 163, 74, 0.35)' },
  flBannerRejected: { backgroundColor: 'rgba(220, 38, 38, 0.08)', borderColor: 'rgba(220, 38, 38, 0.35)' },
  flBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.error },
  flBannerText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  verifyCrBox: { marginTop: 12, backgroundColor: Colors.primaryFaded, borderRadius: 12, padding: 12 },
  verifyCrLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  verifyCrValue: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, letterSpacing: 1 },
  changeNumberBtn: { marginTop: 12, alignSelf: 'flex-start' as const, paddingVertical: 6 },
  changeNumberText: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  verifyTypeLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary, marginTop: 12, marginBottom: 8 },
  typeSelector: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.background, alignItems: 'center' as const },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaded },
  typeBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  typeBtnTextActive: { color: Colors.primary, fontWeight: '700' as const },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: Colors.primary, backgroundColor: Colors.primaryFaded },
  uploadBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  certPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 12, backgroundColor: Colors.background },
  paySettingsBtn: { backgroundColor: Colors.surface, borderRadius: 16, marginHorizontal: 20, padding: 16, marginBottom: 4 },
  paySettingsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paySettingsTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 2 },
  paySettingsDesc: { fontSize: 12, color: Colors.textTertiary },
  payForm: { backgroundColor: Colors.surface, borderRadius: 16, marginHorizontal: 20, padding: 16, marginBottom: 16, marginTop: 4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toggleLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  bankPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 10 },
  bankPickerText: { fontSize: 14, color: Colors.text, flex: 1 },
  bankList: { backgroundColor: Colors.background, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 10 },
  bankItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  bankItemActive: { backgroundColor: Colors.primaryFaded },
  bankItemText: { fontSize: 14, color: Colors.text },
});
