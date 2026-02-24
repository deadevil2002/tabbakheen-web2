import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, MapPin, Truck } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { EmptyState } from '@/components/EmptyState';
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/utils/helpers';
import { sendLocalNotification } from '@/services/notifications';

export default function AvailableDeliveriesScreen() {
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { getAvailableDeliveries, driverAcceptDelivery, getProviderById } = useData();

  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const deliveries = useMemo(
    () => getAvailableDeliveries(),
    [getAvailableDeliveries],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleAcceptDelivery = useCallback(
    async (order: Order) => {
      if (!user) return;
      Alert.alert(
        t('acceptDelivery'),
        locale === 'ar'
          ? 'هل تريد قبول هذه التوصيلة؟'
          : 'Do you want to accept this delivery?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('confirm'),
            onPress: async () => {
              try {
                console.log('[AvailableDeliveries] Driver accepting order:', order.id, 'driverUid:', user.uid);
                await driverAcceptDelivery(order.id, user.uid);
                sendLocalNotification(
                  t('deliveryAccepted'),
                  t('deliveryAcceptedBody'),
                );
                Alert.alert(t('success'), locale === 'ar' ? 'تم قبول التوصيلة' : 'Delivery accepted');
              } catch (err: any) {
                console.log('[AvailableDeliveries] Accept error:', err?.message || err);
                Alert.alert(t('error'), t('error'));
              }
            },
          },
        ],
      );
    },
    [user, driverAcceptDelivery, t, locale],
  );

  const renderDelivery = useCallback(
    ({ item }: { item: Order }) => {
      const provider = getProviderById(item.providerUid);
      return (
        <View style={styles.deliveryCard}>
          <View style={[styles.cardHeader, isRTL && styles.rowRTL]}>
            <View style={styles.iconWrap}>
              <Package size={20} color={Colors.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardTitle, isRTL && styles.rtlText]} numberOfLines={1}>
                {item.offerTitleSnapshot}
              </Text>
              <Text style={[styles.cardDate, isRTL && styles.rtlText]}>
                {formatDate(item.createdAt, locale)}
              </Text>
            </View>
          </View>

          {provider && (
            <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
              <MapPin size={14} color={Colors.textTertiary} />
              <Text style={[styles.locationText, isRTL && styles.rtlText]}>
                {t('pickupFrom')}: {provider.displayName} - {provider.address}
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <View style={[styles.priceRow, isRTL && styles.rowRTL]}>
              <Text style={[styles.feeLabel, isRTL && styles.rtlText]}>{t('deliveryFee')}:</Text>
              <Text style={styles.feeValue}>{formatPrice(item.deliveryFee, locale)}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.btnPressed]}
              onPress={() => handleAcceptDelivery(item)}
            >
              <Truck size={18} color={Colors.white} />
              <Text style={styles.acceptBtnText}>{t('acceptDelivery')}</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [isRTL, locale, t, getProviderById, handleAcceptDelivery],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {t('availableDeliveries')}
        </Text>
      </SafeAreaView>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderDelivery}
        contentContainerStyle={deliveries.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginTop: 8,
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
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  locationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  feeValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  acceptBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.success,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnPressed: {
    opacity: 0.9,
  },
  acceptBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
