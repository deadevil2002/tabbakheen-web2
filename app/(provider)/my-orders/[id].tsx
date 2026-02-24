import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, X, ChefHat, Package, CreditCard, Banknote, Building2, Truck, FileCheck, CheckCircle2, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { formatPrice, formatDate, getPaymentMethodColor, getPaymentStatusColor } from '@/utils/helpers';

export default function ProviderOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { orders, updateOrderStatus, confirmPayment, rejectPayment, isProviderSubscriptionValid, getDriverById } = useData();

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);
  const driver = useMemo(() => (order?.driverUid ? getDriverById(order.driverUid) : undefined), [order, getDriverById]);
  const isSubValid = useMemo(() => (user ? isProviderSubscriptionValid(user.uid) : false), [user, isProviderSubscriptionValid]);

  const [rejectComment, setRejectComment] = useState<string>('');
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  const hasPaymentProof = order?.paymentStatus === 'proof_sent';
  const canConfirmPayment = order?.paymentStatus === 'proof_sent';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const r = isRTL;

  const handleAccept = useCallback(async () => {
    if (!order) return;
    if (!isSubValid) { Alert.alert(t('error'), t('subscriptionRequired')); return; }
    await updateOrderStatus(order.id, 'accepted');
    Alert.alert(t('success'), locale === 'ar' ? 'تم قبول الطلب' : 'Order accepted');
  }, [order, updateOrderStatus, isSubValid, t, locale]);

  const handleReject = useCallback(async () => {
    if (!order) return;
    if (!rejectComment.trim()) { Alert.alert(t('error'), locale === 'ar' ? 'يرجى كتابة سبب الرفض' : 'Please write rejection reason'); return; }
    await updateOrderStatus(order.id, 'rejected', rejectComment.trim(), rejectComment.trim());
    setShowRejectInput(false);
    Alert.alert(t('success'), locale === 'ar' ? 'تم رفض الطلب' : 'Order rejected');
  }, [order, rejectComment, updateOrderStatus, t, locale]);

  const handleConfirmPayment = useCallback(async () => {
    if (!order) return;
    Alert.alert(t('confirmPayment'), t('confirmPaymentMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: async () => { await confirmPayment(order.id); Alert.alert(t('success'), t('paymentConfirmed')); } },
    ]);
  }, [order, confirmPayment, t]);

  const handleRejectPayment = useCallback(async () => {
    if (!order) return;
    Alert.alert(t('rejectPaymentAction'), t('rejectPaymentMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: async () => { await rejectPayment(order.id); Alert.alert(t('success'), t('paymentRejectedMsg')); } },
    ]);
  }, [order, rejectPayment, t]);

  const handleStartPreparing = useCallback(async () => {
    if (!order) return;
    await updateOrderStatus(order.id, 'preparing');
    Alert.alert(t('success'), locale === 'ar' ? 'تم بدء التحضير' : 'Preparation started');
  }, [order, updateOrderStatus, t, locale]);

  const handleMarkReady = useCallback(async () => {
    if (!order) return;
    Alert.alert(t('markReady'), locale === 'ar' ? 'هل الطلب جاهز للاستلام؟' : 'Is the order ready for pickup?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: async () => { await updateOrderStatus(order.id, 'ready_for_pickup'); Alert.alert(t('success'), locale === 'ar' ? 'الطلب جاهز للاستلام' : 'Order ready for pickup'); } },
    ]);
  }, [order, updateOrderStatus, t, locale]);

  if (!order) return (<SafeAreaView style={cs.centerSafe}><Text>{t('error')}</Text></SafeAreaView>);

  const paymentColors = getPaymentMethodColor(order.paymentMethod);
  const getPaymentLabel = () => {
    if (order.paymentMethod === 'stc_pay') return t('stcPay');
    if (order.paymentMethod === 'bank_transfer') return t('bankTransfer');
    return t('cashOnDelivery');
  };

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
        <View style={[cs.card, { marginBottom: 16 }]}>
          {order.orderNumber ? <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('orderNumber')}</Text><Text style={cs.orderNumber}>{order.orderNumber}</Text></View> : null}
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('statusLabel')}</Text><OrderStatusBadge status={order.status} /></View>
          <View style={cs.divider} />
          <Text style={[cs.dishTitle, r && cs.rtlText]}>{order.offerTitleSnapshot}</Text>
          <View style={cs.divider} />
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('foodPrice')}</Text><Text style={cs.priceValue}>{formatPrice(order.priceSnapshot, locale)}</Text></View>
          {order.deliveryMethod && (
            <>
              <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('deliveryFee')}</Text><Text style={cs.dateValue}>{order.deliveryFee === 0 ? t('free') : formatPrice(order.deliveryFee, locale)}</Text></View>
              <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('deliveryMethod')}</Text><Text style={cs.dateValue}>{order.deliveryMethod === 'self_pickup' ? t('selfPickup') : t('driverDelivery')}</Text></View>
            </>
          )}
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.totalLabel, r && cs.rtlText]}>{t('totalAmount')}</Text><Text style={cs.totalValue}>{formatPrice(order.totalAmount, locale)}</Text></View>
          <View style={cs.divider} />
          <View style={[cs.cardRow, r && cs.rowRTL]}>
            <Text style={[cs.label, r && cs.rtlText]}>{t('paymentMethod')}</Text>
            <View style={[cs.paymentBadge, { backgroundColor: paymentColors.bg }]}>
              {order.paymentMethod === 'stc_pay' ? <CreditCard size={14} color={paymentColors.text} /> : order.paymentMethod === 'bank_transfer' ? <Building2 size={14} color={paymentColors.text} /> : <Banknote size={14} color={paymentColors.text} />}
              <Text style={[cs.paymentBadgeText, { color: paymentColors.text }]}>{getPaymentLabel()}</Text>
            </View>
          </View>
          <View style={[cs.cardRow, r && cs.rowRTL]}>
            <Text style={[cs.label, r && cs.rtlText]}>{t('paymentStatus')}</Text>
            {(() => { const psC = getPaymentStatusColor(order.paymentStatus); return (
              <View style={[cs.statusBadge, { backgroundColor: psC.bg }]}>
                {order.paymentStatus === 'proof_sent' && <FileCheck size={13} color={psC.text} />}
                {(order.paymentStatus === 'paid' || order.paymentStatus === 'paid_confirmed') && <CheckCircle2 size={13} color={psC.text} />}
                {order.paymentStatus === 'payment_rejected' && <XCircle size={13} color={psC.text} />}
                <Text style={[cs.statusBadgeText, { color: psC.text }]}>{t(order.paymentStatus as any)}</Text>
              </View>); })()}
          </View>
          <View style={[cs.cardRow, r && cs.rowRTL]}><Text style={[cs.label, r && cs.rtlText]}>{t('orderedOn')}</Text><Text style={cs.dateValue}>{formatDate(order.createdAt, locale)}</Text></View>
          {order.note ? <><View style={cs.divider} /><Text style={[cs.label, r && cs.rtlText]}>{t('noteLabel')}</Text><Text style={[cs.noteText, r && cs.rtlText]}>{order.note}</Text></> : null}
          {order.providerComment ? <><View style={cs.divider} /><Text style={[cs.label, r && cs.rtlText]}>{t('providerNote')}</Text><Text style={[cs.noteText, r && cs.rtlText]}>{order.providerComment}</Text></> : null}
        </View>

        {driver && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('deliveryInfo')}</Text>
            <View style={[cs.driverRow, r && cs.rowRTL]}>
              <View style={cs.driverIconWrap}><Truck size={20} color={Colors.primary} /></View>
              <View style={cs.flex1}><Text style={[s.driverName, r && cs.rtlText]}>{driver.displayName}</Text><Text style={s.driverPhone}>{driver.phone}</Text></View>
              <Text style={s.driverRating}>{driver.ratingAverage?.toFixed(1) || '0.0'} ⭐</Text>
            </View>
          </View>
        )}

        {order.status === 'pending' && (
          <View style={[cs.sectionCard, { shadowOpacity: 0 }]}>
            <Text style={[s.actionsTitle, r && cs.rtlText]}>{t('orderActions')}</Text>
            {!isSubValid && <View style={s.subWarning}><Text style={[s.subWarningText, r && cs.rtlText]}>{t('subscriptionRequired')}</Text></View>}
            <View style={s.actionsRow}>
              <Pressable style={({ pressed }) => [s.acceptBtn, pressed && cs.btnPressed, !isSubValid && cs.btnDisabled]} onPress={handleAccept} disabled={!isSubValid}>
                <Check size={18} color={Colors.white} /><Text style={s.actionText}>{t('accept')}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.rejectBtn, pressed && cs.btnPressed]} onPress={() => setShowRejectInput(true)}>
                <X size={18} color={Colors.white} /><Text style={s.actionText}>{t('reject')}</Text>
              </Pressable>
            </View>
            {showRejectInput && (
              <View style={{ marginTop: 16 }}>
                <TextInput style={[s.rejectInput, r && cs.inputRTL]} placeholder={t('rejectReasonHint')} placeholderTextColor={Colors.textTertiary} value={rejectComment} onChangeText={setRejectComment} multiline numberOfLines={2} textAlignVertical="top" textAlign={r ? 'right' : 'left'} />
                <Pressable style={({ pressed }) => [s.confirmRejectBtn, pressed && cs.btnPressed]} onPress={handleReject}><Text style={s.confirmRejectText}>{t('confirm')}</Text></Pressable>
              </View>
            )}
          </View>
        )}

        {hasPaymentProof && (
          <View style={cs.sectionCard}>
            <Text style={[cs.sectionTitle, r && cs.rtlText]}>{t('customerPaymentProof')}</Text>
            {order.stcPayProofImageUrl ? <View style={s.proofDetail}><Text style={[s.proofLabel, r && cs.rtlText]}>{t('proofImage')}</Text><Text style={s.proofValue} numberOfLines={2}>{order.stcPayProofImageUrl}</Text></View> : null}
            {order.stcPayProofNote ? <View style={s.proofDetail}><Text style={[s.proofLabel, r && cs.rtlText]}>{t('proofNote')}</Text><Text style={[s.proofValue, r && cs.rtlText]}>{order.stcPayProofNote}</Text></View> : null}
            {order.paymentReference ? <View style={s.proofDetail}><Text style={[s.proofLabel, r && cs.rtlText]}>{t('paymentReferenceLabel')}</Text><Text style={s.proofValue}>{order.paymentReference}</Text></View> : null}
            {canConfirmPayment && (
              <View style={s.payActionsRow}>
                <Pressable style={({ pressed }) => [s.confirmPayBtn, pressed && cs.btnPressed]} onPress={handleConfirmPayment}><CheckCircle2 size={18} color={Colors.white} /><Text style={s.actionText}>{t('confirmPayment')}</Text></Pressable>
                <Pressable style={({ pressed }) => [s.rejectPayBtn, pressed && cs.btnPressed]} onPress={handleRejectPayment}><XCircle size={18} color={Colors.white} /><Text style={s.actionText}>{t('rejectPaymentAction')}</Text></Pressable>
              </View>
            )}
          </View>
        )}

        {!hasPaymentProof && (order.paymentMethod === 'stc_pay' || order.paymentMethod === 'bank_transfer') && order.paymentStatus === 'unpaid' && order.status !== 'rejected' && order.status !== 'cancelled' && (
          <View style={s.waitingCard}><FileCheck size={24} color={Colors.textTertiary} /><Text style={[s.waitingText, r && cs.rtlText]}>{t('waitingForProof')}</Text></View>
        )}

        {order.status === 'accepted' && (
          <Pressable style={({ pressed }) => [cs.actionBtnRow, { backgroundColor: Colors.preparing }, pressed && cs.btnPressed]} onPress={handleStartPreparing}>
            <ChefHat size={20} color={Colors.white} /><Text style={cs.actionBtnText}>{t('markPreparing')}</Text>
          </Pressable>
        )}

        {order.status === 'preparing' && (
          <Pressable style={({ pressed }) => [cs.actionBtnRow, { backgroundColor: Colors.readyForPickup }, pressed && cs.btnPressed]} onPress={handleMarkReady}>
            <Package size={20} color={Colors.white} /><Text style={cs.actionBtnText}>{t('markReady')}</Text>
          </Pressable>
        )}

        <View style={cs.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  driverName: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 2 },
  driverPhone: { fontSize: 13, color: Colors.textTertiary },
  driverRating: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  actionsTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  subWarning: { backgroundColor: Colors.errorLight, borderRadius: 10, padding: 12, marginBottom: 12 },
  subWarningText: { fontSize: 13, color: Colors.error, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  acceptBtn: { flex: 1, flexDirection: 'row', backgroundColor: Colors.success, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  rejectBtn: { flex: 1, flexDirection: 'row', backgroundColor: Colors.error, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionText: { color: Colors.white, fontSize: 16, fontWeight: '700' as const },
  rejectInput: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, fontSize: 14, color: Colors.text, minHeight: 60, borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 12 },
  confirmRejectBtn: { backgroundColor: Colors.error, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmRejectText: { color: Colors.white, fontSize: 15, fontWeight: '700' as const },
  proofDetail: { marginBottom: 12 },
  proofLabel: { fontSize: 12, color: Colors.textTertiary, marginBottom: 4 },
  proofValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  payActionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confirmPayBtn: { flex: 1, flexDirection: 'row', backgroundColor: Colors.success, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  rejectPayBtn: { flex: 1, flexDirection: 'row', backgroundColor: Colors.error, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  waitingCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, marginHorizontal: 20, marginBottom: 16, alignItems: 'center', gap: 10 },
  waitingText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});
