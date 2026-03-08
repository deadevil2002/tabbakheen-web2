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
import { Truck, CheckCircle, Package, XCircle, MapPin, Navigation2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import DeliveryRouteMap from '@/components/DeliveryRouteMap';
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/utils/helpers';
import { sendLocalNotification } from '@/services/notifications';

type DriverFilter = 'all' | 'active' | 'delivered';

export default function MyDeliveriesScreen() {
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { getOrdersByDriver, updateDeliveryStatusAsDriver, getProviderById } = useData();

  const [filter, setFilter] = useState<DriverFilter>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const allDeliveries = useMemo(
    () => (user ? getOrdersByDriver(user.uid) : []),
    [user, getOrdersByDriver],
  );

  const filteredDeliveries = useMemo(() => {
    if (filter === 'all') return allDeliveries;
    if (filter === 'active') {
      return allDeliveries.filter(
        (o) => o.deliveryStatus === 'driver_assigned' || o.deliveryStatus === 'picked_up' || o.deliveryStatus === 'arrived' || o.deliveryStatus === 'in_transit',
      );
    }
    return allDeliveries.filter((o) => o.deliveryStatus === 'delivered');
  }, [allDeliveries, filter]);

  const getFilterLabel = (f: DriverFilter): string => {
    switch (f) {
      case 'all': return t('all');
      case 'active': return t('activeDelivery');
      case 'delivered': return t('delivered');
    }
  };

  const handlePickedUp = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('pickedUpBtn'),
        locale === 'ar' ? 'هل تم استلام الطلب من الطباخ؟' : 'Have you picked up the order from the provider?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                await updateDeliveryStatusAsDriver(order.id, 'picked_up');
                void sendLocalNotification(
                  t('pickedUpFromProvider'),
                  t('pickedUpFromProviderBody'),
                );
                console.log('[MyDeliveries] Order picked up:', order.id);
                Alert.alert(t('success'), locale === 'ar' ? 'تم تأكيد الاستلام' : 'Pickup confirmed');
              } catch (e: any) {
                console.log('[MyDeliveries] pickup error:', e?.message || e);
                Alert.alert(t('error'), t('orderUpdateError'));
              }
            },
          },
        ],
      );
    },
    [updateDeliveryStatusAsDriver, t, locale],
  );

  const handleArrived = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('arrivedBtn'),
        locale === 'ar' ? 'هل وصلت لموقع العميل؟' : 'Have you arrived at the customer location?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                await updateDeliveryStatusAsDriver(order.id, 'arrived');
                void sendLocalNotification(
                  t('driverArrived'),
                  t('driverArrivedBody'),
                );
                console.log('[MyDeliveries] Driver arrived:', order.id);
                Alert.alert(t('success'), locale === 'ar' ? 'تم تأكيد الوصول' : 'Arrival confirmed');
              } catch (e: any) {
                console.log('[MyDeliveries] arrived error:', e?.message || e);
                Alert.alert(t('error'), t('orderUpdateError'));
              }
            },
          },
        ],
      );
    },
    [updateDeliveryStatusAsDriver, t, locale],
  );

  const handleDelivered = useCallback(
    async (order: Order) => {
      Alert.alert(
        t('deliveredBtn'),
        locale === 'ar' ? 'هل تم توصيل الطلب للعميل؟' : 'Has the order been delivered to the customer?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                await updateDeliveryStatusAsDriver(order.id, 'delivered');
                void sendLocalNotification(
                  t('orderDeliveredTitle'),
                  t('orderDeliveredBody'),
                );
                console.log('[MyDeliveries] Order delivered:', order.id);
                Alert.alert(t('success'), locale === 'ar' ? 'تم تأكيد التوصيل' : 'Delivery confirmed');
              } catch (e: any) {
                console.log('[MyDeliveries] deliver error:', e?.message || e);
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
              } catch (e: any) {
                console.log('[MyDeliveries] reject delivery error:', e?.message || e);
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
      const ds = item.deliveryStatus;
      const provider = getProviderById(item.providerUid);
      const isExpanded = expandedOrderId === item.id;

      const canPickup = ds === 'driver_assigned';
      const canArrived = ds === 'picked_up';
      const canDeliver = ds === 'arrived';
      const canReject = ds === 'driver_assigned';
      const isActive = ds === 'driver_assigned' || ds === 'picked_up' || ds === 'arrived' || ds === 'in_transit';

      const showMapPhase: 'to_provider' | 'to_customer' =
        ds === 'driver_assigned' ? 'to_provider' : 'to_customer';

      const mapOriginLat = showMapPhase === 'to_provider' ? (user?.location?.lat ?? null) : (item.providerLat ?? null);
      const mapOriginLng = showMapPhase === 'to_provider' ? (user?.location?.lng ?? null) : (item.providerLng ?? null);
      const mapDestLat = showMapPhase === 'to_provider' ? (item.providerLat ?? null) : (item.customerLat ?? null);
      const mapDestLng = showMapPhase === 'to_provider' ? (item.providerLng ?? null) : (item.customerLng ?? null);
      const mapOriginLabel = showMapPhase === 'to_provider'
        ? (locale === 'ar' ? 'موقعك' : 'Your location')
        : t('providerLocation');
      const mapDestLabel = showMapPhase === 'to_provider'
        ? t('providerLocation')
        : t('customerLocation');

      return (
        <View style={styles.deliveryCard}>
          <Pressable
            onPress={() => setExpandedOrderId(isExpanded ? null : item.id)}
            style={[styles.cardHeader, isRTL && styles.rowRTL]}
          >
            <Text style={[styles.cardTitle, isRTL && styles.rtlText]} numberOfLines={1}>
              {item.offerTitleSnapshot}
            </Text>
            <OrderStatusBadge status={item.status} size="small" />
          </Pressable>

          {item.orderRef ? (
            <Text style={[styles.cardRef, isRTL && styles.rtlText]}>{item.orderRef}</Text>
          ) : null}

          <View style={[styles.cardMeta, isRTL && styles.rowRTL]}>
            <Text style={styles.cardDate}>{formatDate(item.createdAt, locale)}</Text>
            <Text style={styles.cardFee}>{formatPrice(item.deliveryFee, locale)}</Text>
          </View>

          {ds && (
            <View style={styles.deliveryStatusRow}>
              <Text style={styles.deliveryStatusLabel}>{t('deliveryStatusLabel')}:</Text>
              <Text style={styles.deliveryStatusValue}>{getDeliveryStatusLabel(ds)}</Text>
            </View>
          )}

          {provider && (
            <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
              <MapPin size={14} color={Colors.textTertiary} />
              <Text style={[styles.locationText, isRTL && styles.rtlText]}>
                {t('pickupFrom')}: {provider.displayName} - {provider.address || ''}
              </Text>
            </View>
          )}

          {item.dropoffAddress ? (
            <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
              <Navigation2 size={14} color={Colors.textTertiary} />
              <Text style={[styles.locationText, isRTL && styles.rtlText]}>
                {t('deliverTo')}: {item.dropoffAddress}
              </Text>
            </View>
          ) : null}

          {isActive && isExpanded && (
            <View style={{ marginHorizontal: -18, marginTop: 12 }}>
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

          {isActive && !isExpanded && (
            <Pressable style={styles.showMapBtn} onPress={() => setExpandedOrderId(item.id)}>
              <MapPin size={16} color={Colors.primary} />
              <Text style={styles.showMapText}>{t('deliveryRoute')}</Text>
            </Pressable>
          )}

          {canPickup && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.pickupBtnStyle, pressed && styles.btnPressed]}
              onPress={() => handlePickedUp(item)}
            >
              <Package size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('pickedUpBtn')}</Text>
            </Pressable>
          )}

          {canArrived && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.arrivedBtnStyle, pressed && styles.btnPressed]}
              onPress={() => handleArrived(item)}
            >
              <Navigation2 size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('arrivedBtn')}</Text>
            </Pressable>
          )}

          {canDeliver && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.deliverBtnStyle, pressed && styles.btnPressed]}
              onPress={() => handleDelivered(item)}
            >
              <CheckCircle size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('deliveredBtn')}</Text>
            </Pressable>
          )}

          {canReject && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.rejectBtnStyle, pressed && styles.btnPressed]}
              onPress={() => handleRejectDelivery(item)}
            >
              <XCircle size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>{t('rejectDeliveryAction')}</Text>
            </Pressable>
          )}
        </View>
      );
    },
    [isRTL, locale, t, user, expandedOrderId, getProviderById, handlePickedUp, handleArrived, handleDelivered, handleRejectDelivery, getDeliveryStatusLabel],
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  locationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  showMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 10,
    backgroundColor: Colors.primaryFaded,
  },
  showMapText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  actionBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  pickupBtnStyle: {
    backgroundColor: Colors.info,
  },
  arrivedBtnStyle: {
    backgroundColor: Colors.assignedToDriver,
  },
  deliverBtnStyle: {
    backgroundColor: Colors.success,
  },
  rejectBtnStyle: {
    backgroundColor: Colors.error,
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
