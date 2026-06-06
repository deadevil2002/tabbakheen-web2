import { AppAlert } from '@/components/AppDialog';
import { ComplaintNoteModal } from '@/components/ComplaintNoteModal';
import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, MapPin, Navigation2,
  Package, CheckCircle, XCircle, AlertTriangle, Clock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonStyles as cs } from '@/constants/sharedStyles';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import DeliveryRouteMap from '@/components/DeliveryRouteMap';
import { Order } from '@/types';
import { formatPrice, formatDate, formatDistance } from '@/utils/helpers';
import { sendLocalNotification } from '@/services/notifications';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function DriverDeliveryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const {
    getOrdersByDriver, getProviderById,
    updateDeliveryStatusAsDriver, raiseDeliveryComplaint, hasComplaint,
  } = useData();
  const r = isRTL;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [complaintOrder, setComplaintOrder] = useState<Order | null>(null);

  const order = useMemo(
    () => (user ? getOrdersByDriver(user.uid).find((o) => o.id === id) : undefined),
    [user, getOrdersByDriver, id],
  );
  const provider = useMemo(
    () => (order ? getProviderById(order.providerUid) : undefined),
    [order, getProviderById],
  );

  const handlePickedUp = useCallback(async () => {
    if (!order) return;
    AppAlert.alert(
      t('pickedUpBtn'),
      locale === 'ar' ? 'هل تم استلام الطلب من الطباخ؟' : 'Have you picked up the order from the provider?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            try {
              await updateDeliveryStatusAsDriver(order.id, 'picked_up');
              void sendLocalNotification(t('pickedUpFromProvider'), t('pickedUpFromProviderBody'));
              AppAlert.alert(t('success'), locale === 'ar' ? 'تم تأكيد الاستلام' : 'Pickup confirmed');
            } catch (e: any) {
              AppAlert.alert(t('error'), t('orderUpdateError'));
            }
          },
        },
      ],
    );
  }, [order, updateDeliveryStatusAsDriver, t, locale]);

  const handleArrived = useCallback(async () => {
    if (!order) return;
    AppAlert.alert(
      t('arrivedBtn'),
      locale === 'ar' ? 'هل وصلت لموقع العميل؟' : 'Have you arrived at the customer location?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            try {
              await updateDeliveryStatusAsDriver(order.id, 'arrived');
              void sendLocalNotification(t('driverArrived'), t('driverArrivedBody'));
              AppAlert.alert(t('success'), locale === 'ar' ? 'تم تأكيد الوصول' : 'Arrival confirmed');
            } catch (e: any) {
              AppAlert.alert(t('error'), t('orderUpdateError'));
            }
          },
        },
      ],
    );
  }, [order, updateDeliveryStatusAsDriver, t, locale]);

  const handleDelivered = useCallback(async () => {
    if (!order) return;
    AppAlert.alert(
      t('deliveredBtn'),
      locale === 'ar' ? 'هل تم توصيل الطلب للعميل؟' : 'Has the order been delivered to the customer?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: async () => {
            try {
              await updateDeliveryStatusAsDriver(order.id, 'delivered_pending_confirmation');
              void sendLocalNotification(t('orderDeliveredTitle'), t('awaitingCustomerConfirmation'));
              AppAlert.alert(t('success'), t('awaitingCustomerConfirmation'));
            } catch (e: any) {
              AppAlert.alert(t('error'), t('orderUpdateError'));
            }
          },
        },
      ],
    );
  }, [order, updateDeliveryStatusAsDriver, t, locale]);

  const handleRejectDelivery = useCallback(async () => {
    if (!order) return;
    AppAlert.alert(
      t('rejectDeliveryAction'),
      t('confirmRejectDelivery'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDeliveryStatusAsDriver(order.id, 'driver_rejected');
              AppAlert.alert(t('success'), t('deliveryRejectedMsg'));
              router.back();
            } catch (e: any) {
              AppAlert.alert(t('error'), t('orderUpdateError'));
            }
          },
        },
      ],
    );
  }, [order, updateDeliveryStatusAsDriver, t, router]);

  const handleRaiseComplaint = useCallback(() => {
    if (order) setComplaintOrder(order);
  }, [order]);

  const handleSubmitComplaint = useCallback(async (note: string) => {
    if (!complaintOrder) return;
    try {
      await raiseDeliveryComplaint(complaintOrder, {
        source: 'driver',
        type: 'delivery_not_confirmed',
        note,
      });
      setComplaintOrder(null);
      AppAlert.alert(t('success'), t('complaintSent'));
    } catch (e: any) {
      setComplaintOrder(null);
      AppAlert.alert(t('error'), t('orderUpdateError'));
    }
  }, [complaintOrder, raiseDeliveryComplaint, t]);

  if (!order) {
    return (
      <View style={cs.container}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={[styles.headerRow, r && styles.rowRTL]}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
              <BackIcon size={22} color={Colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, r && styles.rtlText]}>{t('orderDetails')}</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
        <View style={styles.center}>
          <Text style={[styles.emptyText, r && styles.rtlText]}>{t('error')}</Text>
        </View>
      </View>
    );
  }

  const ds = order.deliveryStatus;
  const isActive = ds === 'driver_assigned' || ds === 'picked_up' || ds === 'arrived' || ds === 'in_transit';
  const canPickup = ds === 'driver_assigned';
  const canArrived = ds === 'picked_up';
  const canDeliver = ds === 'arrived';
  const canReject = ds === 'driver_assigned';
  const awaitingConfirmation = ds === 'delivered_pending_confirmation';

  const showMapPhase: 'to_provider' | 'to_customer' = ds === 'driver_assigned' ? 'to_provider' : 'to_customer';
  const mapOriginLat = showMapPhase === 'to_provider' ? (user?.location?.lat ?? null) : (order.providerLat ?? null);
  const mapOriginLng = showMapPhase === 'to_provider' ? (user?.location?.lng ?? null) : (order.providerLng ?? null);
  const mapDestLat = showMapPhase === 'to_provider' ? (order.providerLat ?? null) : (order.customerLat ?? null);
  const mapDestLng = showMapPhase === 'to_provider' ? (order.providerLng ?? null) : (order.customerLng ?? null);
  const mapOriginLabel = showMapPhase === 'to_provider' ? (locale === 'ar' ? 'موقعك' : 'Your location') : t('providerLocation');
  const mapDestLabel = showMapPhase === 'to_provider' ? t('providerLocation') : t('customerLocation');
  const deliveryStatusLabel = ds ? (t(ds as any) || ds) : '';

  return (
    <View style={cs.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={[styles.headerRow, r && styles.rowRTL]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <BackIcon size={22} color={Colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, r && styles.rtlText]}>{t('orderDetails')}</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView style={cs.flex1} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={[styles.cardTop, r && styles.rowRTL]}>
            <Text style={[styles.title, r && styles.rtlText]} numberOfLines={2}>{order.offerTitleSnapshot}</Text>
            <OrderStatusBadge status={order.status} size="small" />
          </View>
          {order.orderRef ? <Text style={[styles.ref, r && styles.rtlText]}>{order.orderRef}</Text> : null}
          {order.orderNumber ? <Row label={t('orderNumber')} value={order.orderNumber} r={r} /> : null}
          {ds ? <Row label={t('deliveryStatusLabel')} value={deliveryStatusLabel} r={r} /> : null}
          <Row label={locale === 'ar' ? 'أرباحك' : 'Earning'} value={formatPrice(order.deliveryFee, locale)} r={r} highlight />
          {order.deliveryDistanceKm > 0 ? <Row label={locale === 'ar' ? 'المسافة' : 'Distance'} value={formatDistance(order.deliveryDistanceKm, locale)} r={r} /> : null}
          <Row label={t('orderedOn')} value={formatDate(order.createdAt, locale)} r={r} />
        </View>

        <View style={styles.card}>
          {provider ? (
            <View style={[styles.locationRow, r && styles.rowRTL]}>
              <MapPin size={16} color={Colors.textTertiary} />
              <Text style={[styles.locationText, r && styles.rtlText]}>
                {t('pickupFrom')}: {provider.displayName}{provider.address ? ` - ${provider.address}` : ''}
              </Text>
            </View>
          ) : null}
          {order.dropoffAddress ? (
            <View style={[styles.locationRow, r && styles.rowRTL]}>
              <Navigation2 size={16} color={Colors.textTertiary} />
              <Text style={[styles.locationText, r && styles.rtlText]}>
                {t('deliverTo')}: {order.dropoffAddress}
              </Text>
            </View>
          ) : null}
        </View>

        {isActive && (
          <View style={styles.mapCard}>
            <DeliveryRouteMap
              originLat={mapOriginLat}
              originLng={mapOriginLng}
              originLabel={mapOriginLabel}
              destLat={mapDestLat}
              destLng={mapDestLng}
              destLabel={mapDestLabel}
              phase={showMapPhase}
            />
          </View>
        )}

        {canPickup && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.pickupBtnStyle, pressed && styles.btnPressed]}
            onPress={handlePickedUp}
          >
            <Package size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t('pickedUpBtn')}</Text>
          </Pressable>
        )}

        {canArrived && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.arrivedBtnStyle, pressed && styles.btnPressed]}
            onPress={handleArrived}
          >
            <Navigation2 size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t('arrivedBtn')}</Text>
          </Pressable>
        )}

        {canDeliver && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.deliverBtnStyle, pressed && styles.btnPressed]}
            onPress={handleDelivered}
          >
            <CheckCircle size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t('deliveredBtn')}</Text>
          </Pressable>
        )}

        {canReject && (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.rejectBtnStyle, pressed && styles.btnPressed]}
            onPress={handleRejectDelivery}
          >
            <XCircle size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>{t('rejectDeliveryAction')}</Text>
          </Pressable>
        )}

        {awaitingConfirmation && (
          <>
            <View style={[styles.awaitingBox, r && styles.rowRTL]}>
              <Clock size={16} color={Colors.warning} />
              <Text style={[styles.awaitingText, r && styles.rtlText]}>
                {t('awaitingCustomerConfirmation')}
              </Text>
            </View>
            {hasComplaint(order.id) ? (
              <View style={[styles.complaintRaisedBox, r && styles.rowRTL]}>
                <AlertTriangle size={16} color={Colors.textSecondary} />
                <Text style={[styles.complaintRaisedText, r && styles.rtlText]}>
                  {t('complaintRaisedLabel')}
                </Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.complaintBtnStyle, pressed && styles.btnPressed]}
                onPress={handleRaiseComplaint}
              >
                <AlertTriangle size={18} color={Colors.white} />
                <Text style={styles.actionBtnText}>{t('raiseComplaint')}</Text>
              </Pressable>
            )}
          </>
        )}

        <View style={cs.bottomSpacer} />
      </ScrollView>

      <ComplaintNoteModal
        visible={!!complaintOrder}
        title={t('raiseComplaint')}
        message={t('raiseComplaintMsg')}
        onCancel={() => setComplaintOrder(null)}
        onSubmit={handleSubmitComplaint}
      />
    </View>
  );
}

function Row({ label, value, r, highlight }: { label: string; value: string; r: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.row, r && styles.rowRTL]}>
      <Text style={[styles.rowLabel, r && styles.rtlText]}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight, r && styles.rtlText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerSafe: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rowRTL: { flexDirection: 'row-reverse' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' as const, color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  ref: { fontSize: 13, color: Colors.textTertiary, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  rowLabel: { fontSize: 13, color: Colors.textTertiary, minWidth: 96 },
  rowValue: { fontSize: 13, color: Colors.text, flex: 1, fontWeight: '500' as const },
  rowValueHighlight: { color: Colors.primary, fontWeight: '700' as const },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText: { fontSize: 13, color: Colors.text, flex: 1, fontWeight: '500' as const },
  mapCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.surface },
  actionBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickupBtnStyle: { backgroundColor: Colors.info },
  arrivedBtnStyle: { backgroundColor: Colors.assignedToDriver },
  deliverBtnStyle: { backgroundColor: Colors.success },
  rejectBtnStyle: { backgroundColor: Colors.error },
  complaintBtnStyle: { backgroundColor: Colors.warning },
  actionBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' as const },
  btnPressed: { opacity: 0.9 },
  awaitingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: Colors.warningLight,
  },
  awaitingText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: Colors.warning },
  complaintRaisedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: Colors.surfaceSecondary,
  },
  complaintRaisedText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
