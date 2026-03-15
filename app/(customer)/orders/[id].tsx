import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import { ArrowLeft, ArrowRight, CreditCard, Banknote, Building2, Truck, Phone, Copy, PackageCheck, MessageCircle, Upload, FileCheck, CheckCircle2, XCircle, ImageIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { RatingStars } from '@/components/RatingStars';
import { formatPrice, formatDate, getPaymentMethodColor, getPaymentStatusColor, formatSaudiPhoneForWhatsApp } from '@/utils/helpers';
import MapLocationPicker from '@/components/MapLocationPicker';
import { pickImageFreeAspect } from '@/utils/imagePicker';
import { uploadPaymentProof } from '@/services/cloudinary';
import { Image } from 'expo-image';

export default function CustomerOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { orders, getProviderById, getDriverById, submitRating, submitDriverRating, submitPaymentProof, setDeliveryMethod, computeDeliveryFee } = useData();

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);
  const provider = useMemo(() => (order ? getProviderById(order.providerUid) : undefined), [order, getProviderById]);
  const driver = useMemo(() => (order?.driverUid ? getDriverById(order.driverUid) : undefined), [order, getDriverById]);

  const [providerStars, setProviderStars] = useState<number>(0);
  const [providerComment, setProviderComment] = useState<string>('');
  const [driverStars, setDriverStars] = useState<number>(0);
  const [driverComment, setDriverComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [showPaymentProof, setShowPaymentProof] = useState<boolean>(false);
  const [proofImageUrl, setProofImageUrl] = useState<string>('');
  const [proofNote, setProofNote] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);

  const isDelivered = order?.status === 'delivered' || order?.deliveryStatus === 'delivered';
  const canRateProvider = isDelivered && !order?.providerHasRating && !order?.ratingSubmitted;
  const canRateDriver = isDelivered && !order?.driverHasRating && !order?.driverRatingSubmitted && !!order?.driverUid;
  const driverAccepted = !!order?.driverUid && order?.deliveryStatus !== 'ready_for_driver';
  const canChooseDelivery = order?.status === 'ready_for_pickup' && !order?.deliveryMethod && !order?.deliveryStatus;
  const canSubmitProof = order && (order.paymentMethod === 'stc_pay' || order.paymentMethod === 'bank_transfer') && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_confirmed' && order.paymentStatus !== 'proof_sent' && order.status !== 'rejected' && order.status !== 'cancelled';
  const hasProofSent = order?.paymentStatus === 'proof_sent';
  const isPaymentRejected = order?.paymentStatus === 'payment_rejected';

  const estimatedFee = useMemo(() => {
    if (!order || !provider) return 0;
    return computeDeliveryFee(order.providerUid, user?.location?.lat, user?.location?.lng);
  }, [order, provider, user, computeDeliveryFee]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleCopy = useCallback(async (text: string) => {
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(text); } else { await Clipboard.setStringAsync(text); }
      Alert.alert(t('success'), t('copied'));
    } catch { console.log('Copy failed'); }
  }, [t]);

  const handleSelfPickup = useCallback(async () => {
    if (!order) return;
    console.log('[OrderDetail] Customer chose self pickup for order:', order.id);
    try {
      await setDeliveryMethod(order.id, 'self_pickup');
      console.log('[OrderDetail] Self pickup persisted to Firestore successfully');
      Alert.alert(t('success'), t('selfPickupInfo'));
    } catch (err: any) {
      console.log('[OrderDetail] Self pickup error:', err?.message || err);
      Alert.alert(t('error'), t('orderUpdateError'));
    }
  }, [order, setDeliveryMethod, t]);

  const handleDriverDelivery = useCallback(async () => {
    if (!order) return;
    console.log('[OrderDetail] Customer chose driver delivery for order:', order.id);
    try {
      await setDeliveryMethod(order.id, 'driver');
      console.log('[OrderDetail] Driver delivery persisted to Firestore successfully');
      Alert.alert(t('success'), t('driverDeliveryRequested'));
    } catch (err: any) {
      console.log('[OrderDetail] Driver delivery error:', err?.message || err);
      Alert.alert(t('error'), t('orderUpdateError'));
    }
  }, [order, setDeliveryMethod, t]);

  const handlePickProofImage = useCallback(async () => {
    const result = await pickImageFreeAspect();
    if (!result) return;
    setIsUploadingProof(true);
    try {
      const url = await uploadPaymentProof(result.uri);
      setProofImageUrl(url);
      console.log('[OrderDetail] Proof image uploaded:', url);
    } catch (e) {
      console.log('[OrderDetail] Proof image upload error:', e);
      Alert.alert(t('error'), t('uploadError'));
    } finally {
      setIsUploadingProof(false);
    }
  }, [t]);

  const handleSubmitPaymentProof = useCallback(async () => {
    if (!order) return;
    if (!proofImageUrl.trim() && !proofNote.trim()) { Alert.alert(t('error'), locale === 'ar' ? 'يرجى إضافة صورة الإثبات أو ملاحظة' : 'Please add proof image or a note'); return; }
    setIsSubmitting(true);
    try { await submitPaymentProof(order.id, proofImageUrl.trim(), proofNote.trim(), paymentRef.trim()); Alert.alert(t('success'), t('proofSent')); setShowPaymentProof(false); setProofImageUrl(''); setProofNote(''); setPaymentRef(''); }
    catch { Alert.alert(t('error'), t('error')); }
    finally { setIsSubmitting(false); }
  }, [order, proofImageUrl, proofNote, paymentRef, submitPaymentProof, t, locale]);

  const handleWhatsAppProof = useCallback(() => {
    if (!order || !provider) return;
    const rawPhone = provider.paymentMethods?.stcPay?.phone || provider.phone;
    const phone = formatSaudiPhoneForWhatsApp(rawPhone);
    console.log('[OrderDetail] WhatsApp proof - raw:', rawPhone, 'formatted:', phone);
    const message = locale === 'ar'
      ? `إثبات دفع - طلب رقم: ${order.orderNumber}\nالمبلغ: ${order.priceSnapshot} ر.س\nطريقة الدفع: ${order.paymentMethod === 'stc_pay' ? 'STC Pay' : 'تحويل بنكي'}`
      : `Payment Proof - Order: ${order.orderNumber}\nAmount: ${order.priceSnapshot} SAR\nPayment: ${order.paymentMethod === 'stc_pay' ? 'STC Pay' : 'Bank Transfer'}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    console.log('[OrderDetail] Opening WhatsApp URL:', url);
    Linking.openURL(url).catch((err) => console.log('[OrderDetail] Cannot open WhatsApp:', err));
  }, [order, provider, locale]);

  const handleContactDriverWhatsApp = useCallback(async (coords?: { lat: number; lng: number }) => {
    if (!order || !driver) return;
    const driverPhone = formatSaudiPhoneForWhatsApp(driver.phone || '');
    console.log('[OrderDetail] Contact driver WhatsApp - raw:', driver.phone, 'formatted:', driverPhone);
    if (!driverPhone) {
      Alert.alert(t('error'), t('whatsappNotAvailable'));
      return;
    }
    let message = locale === 'ar'
      ? `${t('orderRefPrefix')}: ${order.orderRef || order.orderNumber}`
      : `${t('orderRefPrefix')}: ${order.orderRef || order.orderNumber}`;
    if (coords) {
      message += `\n${t('deliveryLocationMsg')}: https://maps.google.com/?q=${coords.lat},${coords.lng}`;
    }
    const url = `https://wa.me/${driverPhone}?text=${encodeURIComponent(message)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('error'), t('whatsappNotAvailable'));
      }
    } catch (e) {
      console.log('[OrderDetail] WhatsApp error:', e);
      Alert.alert(t('error'), t('whatsappNotAvailable'));
    }
  }, [order, driver, t, locale]);

  const handleShareLocationWithDriver = useCallback(() => {
    if (!driver) return;
    Alert.alert(
      t('shareLocationTitle'),
      '',
      [
        {
          text: t('useMyCurrentLocationOption'),
          onPress: async () => {
            try {
              if (Platform.OS === 'web') {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    void handleContactDriverWhatsApp({
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    });
                  },
                  () => {
                    Alert.alert(t('error'), t('locationPermissionDenied'));
                  },
                );
                return;
              }
              let ExpoLocation: any = null;
              try { ExpoLocation = require('expo-location'); } catch {}
              if (!ExpoLocation) {
                void handleContactDriverWhatsApp();
                return;
              }
              const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert(t('error'), t('locationPermissionDenied'));
                return;
              }
              const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
              void handleContactDriverWhatsApp({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            } catch (e) {
              console.log('[OrderDetail] GPS error:', e);
              Alert.alert(t('error'), t('locationError'));
            }
          },
        },
        {
          text: t('pickLocationOnMapOption'),
          onPress: () => setShowLocationPicker(true),
        },
        { text: t('cancel'), style: 'cancel' },
      ],
    );
  }, [driver, t, handleContactDriverWhatsApp]);

  const handleLocationPickerSave = useCallback(async (coords: { lat: number; lng: number }) => {
    void handleContactDriverWhatsApp(coords);
  }, [handleContactDriverWhatsApp]);



  const handleSubmitProviderRating = useCallback(async () => {
    if (!order || !user || providerStars === 0) { Alert.alert(t('error'), locale === 'ar' ? 'يرجى اختيار عدد النجوم' : 'Please select a rating'); return; }
    setIsSubmitting(true);
    try { await submitRating({ providerUid: order.providerUid, customerUid: user.uid, orderId: order.id, stars: providerStars, comment: providerComment.trim() }); Alert.alert(t('success'), t('ratingSubmitted')); }
    catch { Alert.alert(t('error'), t('error')); }
    finally { setIsSubmitting(false); }
  }, [order, user, providerStars, providerComment, submitRating, t, locale]);

  const handleSubmitDriverRating = useCallback(async () => {
    if (!order || !user || !order.driverUid || driverStars === 0) { Alert.alert(t('error'), locale === 'ar' ? 'يرجى اختيار عدد النجوم' : 'Please select a rating'); return; }
    setIsSubmitting(true);
    try { await submitDriverRating({ driverUid: order.driverUid, customerUid: user.uid, orderId: order.id, stars: driverStars, comment: driverComment.trim() }); Alert.alert(t('success'), t('ratingSubmitted')); }
    catch { Alert.alert(t('error'), t('error')); }
    finally { setIsSubmitting(false); }
  }, [order, user, driverStars, driverComment, submitDriverRating, t, locale]);

  if (!order) {
    return (<SafeAreaView style={cs.centerSafe}><Text>{t('error')}</Text></SafeAreaView>);
  }

  const paymentColors = getPaymentMethodColor(order.paymentMethod);
  const getPaymentLabel = () => {
    if (order.paymentMethod === 'stc_pay') return t('stcPay');
    if (order.paymentMethod === 'bank_transfer') return t('bankTransfer');
    return t('cashOnDelivery');
  };

  const r = isRTL;

  return (
    <View style={cs.container}>
      <SafeAreaView edges={['top']} style={cs.headerSafe}>
        <View style={[cs.header, r && cs.headerRTL]}>
          <Pressable style={cs.backBtn} onPress={() => router.back()}><BackIcon size={22} color={Colors.text} /></Pressable>
          <Text style={[cs.headerTitle, r && cs.rtlText]}>{t('orderDetails')}</Text>
          <View style={cs.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView style={cs.flex1} showsVerticalScrollIndicator={false}>
        <View style={cs.card}>
          {order.orderNumber ? <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('orderNumber')}</Text><Text style={cs.orderNumber}>{order.orderNumber}</Text></View> : null}
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('statusLabel')}</Text><OrderStatusBadge status={order.status} /></View>
          <View style={cs.divider} />
          <Text style={[cs.dishTitle, r && cs.rtlText]}>{order.offerTitleSnapshot}</Text>
          {provider ? <Text style={[s.providerName, r && cs.rtlText]}>{t('orderFrom')}: {provider.displayName}</Text> : null}
          <View style={cs.divider} />
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('foodPrice')}</Text><Text style={cs.priceValue}>{formatPrice(order.priceSnapshot, locale)}</Text></View>
          {order.deliveryMethod ? <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('deliveryFee')}</Text><Text style={cs.dateValue}>{order.deliveryFee === 0 ? t('free') : formatPrice(order.deliveryFee, locale)}</Text></View> : null}
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.totalLabel, r && cs.rtlText]}>{t('totalAmount')}</Text><Text style={cs.totalValue}>{formatPrice(order.totalAmount, locale)}</Text></View>
          <View style={cs.divider} />
          <View style={[cs.cardRow, r && cs.rowRTL]}>
            <Text style={[cs.label, r && cs.rtlText]}>{t('paymentMethod')}</Text>
            <View style={[cs.paymentBadge, { backgroundColor: paymentColors.bg }]}>
              {order.paymentMethod === 'stc_pay' ? <CreditCard size={14} color={paymentColors.text} /> : order.paymentMethod === 'bank_transfer' ? <Building2 size={14} color={paymentColors.text} /> : <Banknote size={14} color={paymentColors.text} />}
              <Text style={[cs.paymentBadgeText, { color: paymentColors.text }]}>{getPaymentLabel()}</Text>
            </View>
          </View>
          {order.deliveryMethod ? <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('deliveryMethod')}</Text><Text style={cs.dateValue}>{order.deliveryMethod === 'self_pickup' ? t('selfPickup') : t('driverDelivery')}</Text></View> : null}
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('orderedOn')}</Text><Text style={cs.dateValue}>{formatDate(order.createdAt, locale)}</Text></View>
          {order.note ? <><View style={cs.divider} /><Text style={[cs.label, r && cs.rtlText]}>{t('noteLabel')}</Text><Text style={[cs.noteText, r && cs.rtlText]}>{order.note}</Text></> : null}
          {order.providerComment ? <><View style={cs.divider} /><Text style={[cs.label, r && cs.rtlText]}>{t('providerNote')}</Text><Text style={[cs.noteText, r && cs.rtlText]}>{order.providerComment}</Text></> : null}
        </View>

        {order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'paid' && (
          <View style={cs.sectionCard}>
            <View style={[cs.cardRow, r && cs.rowRTL]}>
              <Text style={[cs.label, r && cs.rtlText]}>{t('paymentStatus')}</Text>
              {(() => { const psC = getPaymentStatusColor(order.paymentStatus); return (
                <View style={[cs.statusBadge, { backgroundColor: psC.bg }]}>
                  {order.paymentStatus === 'proof_sent' && <FileCheck size={14} color={psC.text} />}
                  {order.paymentStatus === 'paid_confirmed' && <CheckCircle2 size={14} color={psC.text} />}
                  {order.paymentStatus === 'payment_rejected' && <XCircle size={14} color={psC.text} />}
                  <Text style={[cs.statusBadgeText, { color: psC.text }]}>{t(order.paymentStatus as any)}</Text>
                </View>); })()}
            </View>
            {hasProofSent && <Text style={[s.proofDesc, { color: Colors.info }]}>{t('proofSentDesc')}</Text>}
            {isPaymentRejected && <Text style={[s.proofDesc, { color: Colors.error }]}>{locale === 'ar' ? 'تم رفض الإثبات من الطباخ. يرجى إعادة الإرسال.' : 'Proof rejected by the chef. Please resend.'}</Text>}
          </View>
        )}

        {(canSubmitProof || isPaymentRejected) && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('paymentProof')}</Text>
            <Pressable style={({ pressed }) => [s.whatsappBtn, pressed && cs.btnPressed]} onPress={handleWhatsAppProof}>
              <MessageCircle size={20} color="#FFFFFF" /><Text style={s.whatsappText}>{t('sendProofViaWhatsapp')}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [s.uploadToggle, pressed && cs.btnPressed]} onPress={() => setShowPaymentProof(!showPaymentProof)}>
              <Upload size={18} color={Colors.primary} /><Text style={s.uploadText}>{t('sendPaymentProof')}</Text>
            </Pressable>
            {showPaymentProof && (
              <View style={s.proofForm}>
                <Text style={[cs.formLabel, r && cs.rtlText]}>{t('proofImage')}</Text>
                <Pressable style={s.proofImagePicker} onPress={handlePickProofImage} disabled={isUploadingProof}>
                  {isUploadingProof ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : proofImageUrl ? (
                    <Image source={{ uri: proofImageUrl }} style={s.proofImagePreview} contentFit="cover" />
                  ) : (
                    <View style={s.proofImagePlaceholder}>
                      <ImageIcon size={24} color={Colors.textTertiary} />
                      <Text style={s.proofImageText}>{t('chooseProofImage')}</Text>
                    </View>
                  )}
                </Pressable>
                <Text style={[cs.formLabel, r && cs.rtlText]}>{t('proofNote')}</Text>
                <TextInput style={[cs.formInput, r && cs.inputRTL]} placeholder={t('proofNoteHint')} placeholderTextColor={Colors.textTertiary} value={proofNote} onChangeText={setProofNote} textAlign={r ? 'right' : 'left'} multiline numberOfLines={2} textAlignVertical="top" />
                <Text style={[cs.formLabel, r && cs.rtlText]}>{t('paymentReferenceLabel')}</Text>
                <TextInput style={[cs.formInput, r && cs.inputRTL]} placeholder={t('paymentReferenceHint')} placeholderTextColor={Colors.textTertiary} value={paymentRef} onChangeText={setPaymentRef} textAlign={r ? 'right' : 'left'} />
                <Pressable style={({ pressed }) => [cs.primaryBtn, { marginTop: 12 }, pressed && cs.btnPressed]} onPress={handleSubmitPaymentProof} disabled={isSubmitting}>
                  <Text style={cs.primaryBtnText}>{t('sendPaymentProof')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {(order.paymentMethod === 'stc_pay' || order.paymentMethod === 'bank_transfer') && provider && order.status !== 'rejected' && order.status !== 'cancelled' && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('paymentInstructions')}</Text>
            {order.paymentMethod === 'stc_pay' && provider.paymentMethods?.stcPay?.enabled && (
              <View style={s.payDetail}>
                <Text style={[s.payDetailLabel, r && cs.rtlText]}>{t('stcPayPhone')}</Text>
                <View style={[s.copyRow, r && cs.rowRTL]}>
                  <Text style={s.payDetailValue}>{provider.paymentMethods.stcPay.phone}</Text>
                  <Pressable style={s.copyBtn} onPress={() => handleCopy(provider.paymentMethods?.stcPay?.phone ?? '')}>
                    <Copy size={14} color={Colors.primary} /><Text style={s.copyText}>{t('copyToClipboard')}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {order.paymentMethod === 'bank_transfer' && provider.paymentMethods?.bankTransfer?.enabled && (
              <>
                <View style={s.payDetail}><Text style={[s.payDetailLabel, r && cs.rtlText]}>{t('bankName')}</Text><Text style={[s.payDetailValue, r && cs.rtlText]}>{provider.paymentMethods.bankTransfer.bankName}</Text></View>
                <View style={s.payDetail}><Text style={[s.payDetailLabel, r && cs.rtlText]}>{t('accountName')}</Text><Text style={[s.payDetailValue, r && cs.rtlText]}>{provider.paymentMethods.bankTransfer.accountName}</Text></View>
                <View style={s.payDetail}>
                  <Text style={[s.payDetailLabel, r && cs.rtlText]}>{t('iban')}</Text>
                  <View style={[s.copyRow, r && cs.rowRTL]}>
                    <Text style={s.payDetailValue} numberOfLines={1}>{provider.paymentMethods.bankTransfer.iban}</Text>
                    <Pressable style={s.copyBtn} onPress={() => handleCopy(provider.paymentMethods?.bankTransfer?.iban ?? '')}>
                      <Copy size={14} color={Colors.primary} /><Text style={s.copyText}>{t('copyToClipboard')}</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
            <Text style={[s.payNote, r && cs.rtlText]}>{t('paymentNote')}</Text>
          </View>
        )}

        {canChooseDelivery && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('orderReadyChooseDelivery')}</Text>
            <Pressable style={({ pressed }) => [s.deliveryOpt, pressed && cs.btnPressed]} onPress={handleSelfPickup}>
              <View style={[s.deliveryContent, r && cs.rowRTL]}>
                <View style={[s.deliveryIcon, { backgroundColor: Colors.deliveredBg }]}><PackageCheck size={22} color={Colors.delivered} /></View>
                <View style={cs.flex1}><Text style={[s.deliveryTitle, r && cs.rtlText]}>{t('selfPickup')}</Text><Text style={[s.deliveryDesc, r && cs.rtlText]}>{t('selfPickupDesc')}</Text></View>
                <Text style={s.deliveryFee}>{t('free')}</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [s.deliveryOpt, pressed && cs.btnPressed]} onPress={handleDriverDelivery}>
              <View style={[s.deliveryContent, r && cs.rowRTL]}>
                <View style={[s.deliveryIcon, { backgroundColor: Colors.assignedToDriverBg }]}><Truck size={22} color={Colors.assignedToDriver} /></View>
                <View style={cs.flex1}><Text style={[s.deliveryTitle, r && cs.rtlText]}>{t('driverDelivery')}</Text><Text style={[s.deliveryDesc, r && cs.rtlText]}>{t('driverDeliveryDesc')}</Text></View>
                <Text style={s.deliveryFee}>~{formatPrice(estimatedFee, locale)}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {order.deliveryMethod === 'self_pickup' && order.status === 'ready_for_pickup' && !driverAccepted && (
          <View style={cs.sectionCard}>
            <View style={s.selfPickupInfo}>
              <PackageCheck size={28} color={Colors.delivered} />
              <Text style={[s.selfPickupTitle, r && cs.rtlText]}>{t('selfPickup')}</Text>
              <Text style={[s.selfPickupDesc, r && cs.rtlText]}>{t('selfPickupInfo')}</Text>
              {provider && <Text style={[s.selfPickupAddress, r && cs.rtlText]}>{provider.address || provider.displayName}</Text>}
            </View>
          </View>
        )}

        {order.deliveryMethod === 'driver' && !driverAccepted && order.status === 'ready_for_pickup' && (
          <View style={cs.sectionCard}>
            <View style={s.waitingDriverInfo}>
              <Truck size={28} color={Colors.assignedToDriver} />
              <Text style={[s.waitingDriverTitle, r && cs.rtlText]}>{t('waitingForDriver')}</Text>
              <Text style={[s.waitingDriverDesc, r && cs.rtlText]}>{t('driverDeliveryDesc')}</Text>
            </View>
          </View>
        )}

        {driverAccepted && !driver && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('driverAcceptedYourOrder')}</Text>
          </View>
        )}

        {order.driverUid && order.deliveryStatus && order.deliveryStatus !== 'ready_for_driver' && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('deliveryStatusLabel')}</Text>
            <View style={s.trackingSteps}>
              {(['driver_assigned', 'picked_up', 'arrived', 'delivered'] as const).map((step, idx) => {
                const stepLabels: Record<string, string> = {
                  driver_assigned: t('driver_assigned'),
                  picked_up: t('picked_up'),
                  arrived: t('arrived'),
                  delivered: t('delivered'),
                };
                const stepOrder = ['driver_assigned', 'picked_up', 'arrived', 'delivered'];
                const currentIdx = stepOrder.indexOf(order.deliveryStatus ?? '');
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <View key={step} style={s.trackingStep}>
                    <View style={[s.trackingDot, isCompleted && s.trackingDotActive, isCurrent && s.trackingDotCurrent]} />
                    {idx < 3 && <View style={[s.trackingLine, isCompleted && idx < currentIdx && s.trackingLineActive]} />}
                    <Text style={[s.trackingLabel, isCompleted && s.trackingLabelActive, isCurrent && s.trackingLabelCurrent]}>{stepLabels[step]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {driver && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('driverInfoSection')}</Text>
            <View style={[cs.driverRow, r && cs.rowRTL]}>
              <View style={cs.driverIconWrap}><Truck size={20} color={Colors.primary} /></View>
              <View style={cs.flex1}>
                <Text style={[s.driverName, r && cs.rtlText]}>{driver.displayName}</Text>
                <View style={[s.driverMeta, r && cs.rowRTL]}><Phone size={12} color={Colors.textTertiary} /><Text style={s.driverDist}>{driver.phone}</Text></View>
              </View>
              <View style={{ alignItems: 'center' as const }}><Text style={s.driverRatingBig}>{driver.ratingAverage?.toFixed(1) || '0.0'}</Text><Text style={{ fontSize: 12 }}>⭐</Text></View>
            </View>
            <Pressable
              style={({ pressed }) => [s.whatsappDriverBtn, pressed && cs.btnPressed]}
              onPress={handleShareLocationWithDriver}
            >
              <MessageCircle size={20} color="#FFFFFF" />
              <Text style={s.whatsappText}>{t('contactDriverWhatsapp')}</Text>
            </Pressable>
          </View>
        )}



        {canRateProvider && (
          <View style={cs.sectionCard}>
            <Text style={[s.ratingTitle, r && cs.rtlText]}>{t('rateProvider')}</Text>
            <View style={s.starsRow}><RatingStars rating={providerStars} size={32} interactive onRate={setProviderStars} /></View>
            <TextInput style={[s.ratingInput, r && cs.inputRTL]} placeholder={t('ratingCommentHint')} placeholderTextColor={Colors.textTertiary} value={providerComment} onChangeText={setProviderComment} multiline numberOfLines={3} textAlignVertical="top" textAlign={r ? 'right' : 'left'} />
            <Pressable style={({ pressed }) => [cs.primaryBtn, pressed && cs.btnPressed]} onPress={handleSubmitProviderRating} disabled={isSubmitting}><Text style={cs.primaryBtnText}>{t('submitRating')}</Text></Pressable>
          </View>
        )}

        {canRateDriver && (
          <View style={cs.sectionCard}>
            <Text style={[s.ratingTitle, r && cs.rtlText]}>{t('rateDriver')}</Text>
            <View style={s.starsRow}><RatingStars rating={driverStars} size={32} interactive onRate={setDriverStars} /></View>
            <TextInput style={[s.ratingInput, r && cs.inputRTL]} placeholder={t('ratingCommentHint')} placeholderTextColor={Colors.textTertiary} value={driverComment} onChangeText={setDriverComment} multiline numberOfLines={3} textAlignVertical="top" textAlign={r ? 'right' : 'left'} />
            <Pressable style={({ pressed }) => [cs.primaryBtn, { backgroundColor: Colors.info }, pressed && cs.btnPressed]} onPress={handleSubmitDriverRating} disabled={isSubmitting}><Text style={cs.primaryBtnText}>{t('submitRating')}</Text></Pressable>
          </View>
        )}

        <View style={cs.bottomSpacer} />
      </ScrollView>
      <MapLocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSave={handleLocationPickerSave}
        initialLocation={user?.location}
      />
    </View>
  );
}

const s = StyleSheet.create({
  providerName: { fontSize: 14, color: Colors.textSecondary },
  proofDesc: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  whatsappBtn: { flexDirection: 'row', backgroundColor: '#25D366', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 12 },
  whatsappText: { color: Colors.white, fontSize: 16, fontWeight: '700' as const },
  uploadToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: Colors.primary },
  uploadText: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary },
  proofForm: { marginTop: 16 },
  proofImagePicker: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' as const, minHeight: 100, justifyContent: 'center' as const, alignItems: 'center' as const, marginBottom: 12 },
  proofImagePreview: { width: '100%' as any, height: 160, borderRadius: 12 },
  proofImagePlaceholder: { paddingVertical: 24, alignItems: 'center' as const, gap: 8 },
  proofImageText: { fontSize: 13, color: Colors.textTertiary },
  payDetail: { marginBottom: 12 },
  payDetailLabel: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  payDetailValue: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFaded, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  copyText: { fontSize: 12, color: Colors.primary, fontWeight: '600' as const },
  payNote: { fontSize: 12, color: Colors.textTertiary, marginTop: 4, lineHeight: 18 },
  deliveryOpt: { backgroundColor: Colors.background, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: Colors.borderLight },
  deliveryContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deliveryIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deliveryTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 2 },
  deliveryDesc: { fontSize: 12, color: Colors.textTertiary },
  deliveryFee: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 20 },
  driverCard: { backgroundColor: Colors.background, borderRadius: 14, padding: 14, marginBottom: 10 },
  driverName: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverRating: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' as const },
  driverDist: { fontSize: 12, color: Colors.textTertiary },
  driverRatingBig: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  selectBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  selectText: { color: Colors.white, fontSize: 13, fontWeight: '700' as const },
  whatsappDriverBtn: { flexDirection: 'row', backgroundColor: '#25D366', height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 },
  deliveryStatusText: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  pickupBtn: { flexDirection: 'row', backgroundColor: Colors.delivered, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 16 },
  ratingTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  starsRow: { alignItems: 'center', marginBottom: 16 },
  ratingInput: { backgroundColor: Colors.background, borderRadius: 14, padding: 16, fontSize: 14, color: Colors.text, minHeight: 80, marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight },
  trackingSteps: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 4 },
  trackingStep: { alignItems: 'center', flex: 1, position: 'relative' as const },
  trackingDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.border, marginBottom: 6 },
  trackingDotActive: { backgroundColor: Colors.success },
  trackingDotCurrent: { backgroundColor: Colors.primary, borderWidth: 3, borderColor: Colors.primaryFaded, width: 18, height: 18, borderRadius: 9 },
  trackingLine: { position: 'absolute' as const, top: 7, left: '57%' as any, right: '-43%' as any, height: 2, backgroundColor: Colors.border },
  trackingLineActive: { backgroundColor: Colors.success },
  trackingLabel: { fontSize: 10, color: Colors.textTertiary, textAlign: 'center' as const, maxWidth: 70 },
  trackingLabelActive: { color: Colors.success, fontWeight: '600' as const },
  trackingLabelCurrent: { color: Colors.primary, fontWeight: '700' as const },
  selfPickupInfo: { alignItems: 'center' as const, paddingVertical: 16, gap: 10 },
  selfPickupTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.delivered },
  selfPickupDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' as const, lineHeight: 20 },
  selfPickupAddress: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginTop: 4 },
  waitingDriverInfo: { alignItems: 'center' as const, paddingVertical: 16, gap: 10 },
  waitingDriverTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.assignedToDriver },
  waitingDriverDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' as const, lineHeight: 20 },
});
