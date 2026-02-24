import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList, Truck, CheckCircle, Package, XCircle, Play } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Order, OrderStatus, DeliveryStatus } from '@/types';
import { formatPrice, formatDate } from '@/utils/helpers';

type DriverFilter = 'all' | 'active' | 'delivered';

export default function MyDeliveriesScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { getOrdersByDriver, updateDriverStatus, updateDeliveryStatusAsDriver } = useData();

  const [filter, setFilter] = useState<DriverFilter>('all');

  const allDeliveries = useMemo(
    () => (user ? getOrdersByDriver(user.uid) : []),
    [user, getOrdersByDriver],
  );

  const filteredDeliveries = useMemo(() => {
    if (filter === 'all') return allDeliveries;
    if (filter === 'active') {
      return allDeliveries.filter(
        (o) => o.status === 'assigned_to_driver' || o.status === 'picked_up',
      );
    }
    return allDeliveries.filter((o) => o.status === 'delivered');
  }, [allDeliveries, filter]);

  const getFilterLabel = (f: DriverFilter): string => {
    switch (f) {
      case 'all': return t('all');
      case 'active': return t('activeDelivery');
      case 'delivered': return t('delivered');
    }
  };

  const handlePickup = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('pickupOrder'),
        locale === 'ar' ? 'هل تم استلام الطلب من الطباخ؟' : 'Have you picked up the order?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              await updateDriverStatus(order.id, 'picked_up', 'picked_up');
              Alert.alert(t('success'), locale === 'ar' ? 'تم تأكيد الاستلام' : 'Pickup confirmed');
            },
          },
        ],
      );
    },
    [updateDriverStatus, t, locale],
  );

  const handleDeliver = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('markDelivered'),
        locale === 'ar' ? 'هل تم توصيل الطلب للعميل؟' : 'Has the order been delivered?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              await updateDriverStatus(order.id, 'delivered', 'delivered');
              Alert.alert(t('success'), locale === 'ar' ? 'تم تأكيد التوصيل' : 'Delivery confirmed');
            },
          },
        ],
      );
    },
    [updateDriverStatus, t, locale],
  );

  const handleStartDelivery = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('startDeliveryAction'),
        t('confirmStartDelivery'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                await updateDeliveryStatusAsDriver(order.id, 'in_transit');
                Alert.alert(t('success'), t('deliveryStarted'));
              } catch (e) {
                console.log('[MyDeliveries] start delivery error:', e);
                Alert.alert(t('error'), t('orderUpdateError'));
              }
            },
          },
        ],
      );
    },
    [updateDeliveryStatusAsDriver, t],
  );

  const handleDeliverViaStatus = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('markDelivered'),
        locale === 'ar' ? 'هل تم توصيل الطلب للعميل؟' : 'Has the order been delivered?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                await updateDeliveryStatusAsDriver(order.id, 'delivered');
                Alert.alert(t('success'), locale === 'ar' ? 'تم تأكيد التوصيل' : 'Delivery confirmed');
              } catch (e) {
                console.log('[MyDeliveries] deliver error:', e);
                Alert.alert(t('error'), t('orderUpdateError'));
              }
            },
          },
        ],
      );
    },
    [updateDeliveryStatusAsDriver, t, locale],
  );

  const handleRejectDelivery = useCallback(
    async (order: Order) => {
      Alert.alert(
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
                Alert.alert(t('success'), t('deliveryRejectedMsg'));
              } catch (e) {
                console.log('[MyDeliveries] reject delivery error:', e);
                Alert.alert(t('error'), t('orderUpdateError'));
              }
            },
          },
        ],
      );
    },
    [updateDeliveryStatusAsDriver, t],
  );

  const getDeliveryStatusLabel = useCallback((ds: string | null): string => {
    if (!ds) return '';
    return t(ds as any) || ds;
  }, [t]);

  const renderDelivery = useCallback(
    ({ item }: { item: Order }) => {
      const hasDeliveryStatus = !!item.deliveryStatus;
      const ds = item.deliveryStatus;
      const canStart = hasDeliveryStatus && (ds === 'pending_driver' || ds === 'driver_assigned');
      const canDeliver = hasDeliveryStatus && ds === 'in_transit';
      const canReject = hasDeliveryStatus && (ds === 'pending_driver' || ds === 'driver_assigned');
      const showOldActions = !hasDeliveryStatus;

      return (
        <View style={styles.deliveryCard}>
          <View style={[styles.cardHeader, isRTL && styles.rowRTL]}>
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]} numberOfLines={1}>
              {item.offerTitleSnapshot}
            </Text>
            <OrderStatusBadge status={item.status} size="small" />
          </View>

          {item.orderRef ? (
            <Text style={[styles.cardRef, isRTL && styles.rtlText]}>{item.orderRef}</Text>
          ) : null}

          <View style={[styles.cardMeta, isRTL && styles.rowRTL]}>
            <Text style={styles.cardDate}>{formatDate(item.createdAt, locale)}</Text>
            <Text style={styles.cardFee}>{formatPrice(item.deliveryFee, locale)}</Text>
          </View>

          {hasDeliveryStatus && (
            <View style={styles.deliveryStatusRow}>
              <Text style={styles.deliveryStatusLabel}>{t('deliveryStatusLabel')}:</Text>
              <Text style={styles.deliveryStatusValue}>{getDeliveryStatusLabel(ds)}</Text>
            </View>
          )}

          {canStart && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.pickupBtn, pressed && styles.btnPressed]}
              onPress={() => handleStartDelivery(item)}
            >
              <Play size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('startDeliveryAction')}</Text>
            </Pressable>
          )}

          {canDeliver && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.deliverBtn, pressed && styles.btnPressed]}
              onPress={() => handleDeliverViaStatus(item)}
            >
              <CheckCircle size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('markDelivered')}</Text>
            </Pressable>
          )}

          {canReject && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.rejectBtn, pressed && styles.btnPressed]}
              onPress={() => handleRejectDelivery(item)}
            >
              <XCircle size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('rejectDeliveryAction')}</Text>
            </Pressable>
          )}

          {showOldActions && item.status === 'assigned_to_driver' && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.pickupBtn, pressed && styles.btnPressed]}
              onPress={() => handlePickup(item)}
            >
              <Package size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('pickupOrder')}</Text>
            </Pressable>
          )}

          {showOldActions && item.status === 'picked_up' && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.deliverBtn, pressed && styles.btnPressed]}
              onPress={() => handleDeliver(item)}
            >
              <CheckCircle size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('markDelivered')}</Text>
            </Pressable>
          )}
        </View>
      );
    },
    [isRTL, locale, t, handlePickup, handleDeliver, handleStartDelivery, handleDeliverViaStatus, handleRejectDelivery, getDeliveryStatusLabel],
  );

  const filters: DriverFilter[] = ['all', 'active', 'delivered'];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('deliveries')}</Text>

        <View style={styles.filtersScroll}>
          {filters.map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {getFilterLabel(f)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderDelivery}
        contentContainerStyle={filteredDeliveries.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={<Truck size={32} color={Colors.primary} />}
            title={t('emptyDeliveriesTitle')}
            description={t('emptyDeliveriesDesc')}
          />
        }
      />
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
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 14,
  },
  filtersScroll: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
  },
  deliveryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 10,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  cardFee: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  actionBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickupBtn: {
    backgroundColor: Colors.info,
  },
  deliverBtn: {
    backgroundColor: Colors.success,
  },
  rejectBtn: {
    backgroundColor: Colors.error,
    marginTop: 6,
  },
  cardRef: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  deliveryStatusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  deliveryStatusValue: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  btnPressed: {
    opacity: 0.9,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
