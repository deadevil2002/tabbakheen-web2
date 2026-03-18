import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { Order, OrderStatus } from '@/types';
import { formatPrice, formatDate } from '@/utils/helpers';

const STATUS_FILTERS: (OrderStatus | 'all')[] = ['all', 'pending', 'accepted', 'preparing', 'ready_for_pickup', 'delivered', 'rejected'];

export default function ProviderOrdersScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { getOrdersByProvider } = useData();

  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const allOrders = useMemo(
    () => (user ? getOrdersByProvider(user.uid) : []),
    [user, getOrdersByProvider],
  );

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return allOrders;
    return allOrders.filter((o) => o.status === filter);
  }, [allOrders, filter]);

  const handleOrderPress = useCallback(
    (order: Order) => {
      router.push(`/(provider)/my-orders/${order.id}` as any);
    },
    [],
  );

  const getFilterLabel = (f: OrderStatus | 'all'): string => {
    if (f === 'all') return t('all');
    return t(f as any);
  };

  const renderOrder = useCallback(
    ({ item }: { item: Order }) => (
      <Pressable
        style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}
        onPress={() => handleOrderPress(item)}
      >
        <View style={[styles.orderHeader, isRTL && styles.rowRTL]}>
          <Text style={[styles.orderTitle, isRTL && styles.rtlText]} numberOfLines={1}>
            {item.offerTitleSnapshot}
          </Text>
          <OrderStatusBadge status={item.status} size="small" />
        </View>
        <View style={[styles.orderFooter, isRTL && styles.rowRTL]}>
          <Text style={styles.orderDate}>{formatDate(item.createdAt, locale)}</Text>
          <Text style={styles.orderPrice}>{formatPrice(item.totalAmount, locale)}</Text>
        </View>
      </Pressable>
    ),
    [isRTL, locale, handleOrderPress],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('myOrders')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {STATUS_FILTERS.map((f) => (
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
        </ScrollView>
      </SafeAreaView>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={filteredOrders.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={<ClipboardList size={32} color={Colors.primary} />}
            title={t('emptyOrdersTitle')}
            description={t('emptyOrdersDesc')}
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
  orderCard: {
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
  cardPressed: {
    opacity: 0.95,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  orderTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 10,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  orderPrice: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
