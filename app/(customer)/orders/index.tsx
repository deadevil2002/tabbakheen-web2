import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
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
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/utils/helpers';

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { getOrdersByCustomer, getProviderById } = useData();

  const orders = useMemo(
    () => (user ? getOrdersByCustomer(user.uid) : []),
    [user, getOrdersByCustomer],
  );

  const handleOrderPress = useCallback(
    (order: Order) => {
      router.push(`/(customer)/orders/${order.id}` as any);
    },
    [router],
  );

  const renderOrder = useCallback(
    ({ item }: { item: Order }) => {
      const provider = getProviderById(item.providerUid);
      return (
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
          {provider && (
            <Text style={[styles.orderProvider, isRTL && styles.rtlText]}>
              {t('orderFrom')}: {provider.displayName}
            </Text>
          )}
          <View style={[styles.orderFooter, isRTL && styles.rowRTL]}>
            <Text style={styles.orderDate}>{formatDate(item.createdAt, locale)}</Text>
            <Text style={styles.orderPrice}>{formatPrice(item.priceSnapshot, locale)}</Text>
          </View>
        </Pressable>
      );
    },
    [isRTL, locale, t, getProviderById, handleOrderPress],
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('orders')}</Text>
        </SafeAreaView>
        <View style={styles.guestContainer}>
          <ClipboardList size={48} color={Colors.textTertiary} />
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('orders')}</Text>
      </SafeAreaView>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContent}
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
    transform: [{ scale: 0.98 }],
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  orderProvider: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
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
});
