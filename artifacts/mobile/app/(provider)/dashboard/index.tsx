import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Star,
  UtensilsCrossed,
  TrendingUp,
  Globe,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { formatPrice, formatDateShort } from '@/utils/helpers';

export default function ProviderDashboardScreen() {
  const router = useRouter();
  const { t, isRTL, locale, toggleLocale } = useLocale();
  const { user } = useAuth();
  const { getOrdersByProvider, getOffersByProvider } = useData();

  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const providerOrders = useMemo(
    () => (user ? getOrdersByProvider(user.uid) : []),
    [user, getOrdersByProvider],
  );

  const providerOffers = useMemo(
    () => (user ? getOffersByProvider(user.uid) : []),
    [user, getOffersByProvider],
  );

  const stats = useMemo(() => {
    const total = providerOrders.length;
    const pending = providerOrders.filter((o) => o.status === 'pending').length;
    const completed = providerOrders.filter((o) => o.status === 'delivered').length;
    const activeOffers = providerOffers.filter((o) => o.isAvailable).length;
    return { total, pending, completed, activeOffers };
  }, [providerOrders, providerOffers]);

  const recentOrders = useMemo(
    () => providerOrders.slice(0, 5),
    [providerOrders],
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <View>
            <Text style={[styles.greeting, isRTL && styles.rtlText]}>
              {t('welcomeBack')} 👨‍🍳
            </Text>
            <Text style={[styles.name, isRTL && styles.rtlText]}>
              {user?.displayName}
            </Text>
          </View>
          <Pressable style={styles.langBtn} onPress={toggleLocale}>
            <Globe size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.primaryFaded }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.primary }]}>
                <ShoppingCart size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('totalOrders')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.pendingBg }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.pending }]}>
                <Clock size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{stats.pending}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('pendingOrders')}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.acceptedBg }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.accepted }]}>
                <CheckCircle size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{stats.completed}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('completedOrders')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.secondaryFaded }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.secondary }]}>
                <Star size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>
                {user?.ratingAverage?.toFixed(1) || '0.0'}
              </Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('avgRating')}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.activeOffersCard}
          onPress={() => router.push('/(provider)/my-offers' as any)}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeOffersGradient}
          >
            <View style={[styles.activeOffersContent, isRTL && styles.rowRTL]}>
              <View style={styles.activeOffersIcon}>
                <UtensilsCrossed size={24} color={Colors.white} />
              </View>
              <View style={styles.activeOffersText}>
                <Text style={[styles.activeOffersTitle, isRTL && styles.rtlText]}>
                  {t('activeOffers')}
                </Text>
                <Text style={[styles.activeOffersCount, isRTL && styles.rtlText]}>
                  {stats.activeOffers} {locale === 'ar' ? 'عروض نشطة' : 'active offers'}
                </Text>
              </View>
              <TrendingUp size={24} color="rgba(255,255,255,0.6)" />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {locale === 'ar' ? 'آخر الطلبات' : 'Recent Orders'}
          </Text>
          {recentOrders.length === 0 ? (
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('noOrders')}</Text>
          ) : (
            recentOrders.map((order) => (
              <Pressable
                key={order.id}
                style={({ pressed }) => [styles.recentCard, pressed && styles.cardPressed]}
                onPress={() => router.push(`/(provider)/my-orders/${order.id}` as any)}
              >
                <View style={[styles.recentRow, isRTL && styles.rowRTL]}>
                  <View style={styles.recentInfo}>
                    <Text style={[styles.recentTitle, isRTL && styles.rtlText]} numberOfLines={1}>
                      {order.offerTitleSnapshot}
                    </Text>
                    <Text style={[styles.recentDate, isRTL && styles.rtlText]}>
                      {formatDateShort(order.createdAt, locale)}
                    </Text>
                  </View>
                  <View style={styles.recentRight}>
                    <OrderStatusBadge status={order.status} size="small" />
                    <Text style={styles.recentPrice}>
                      {formatPrice(order.priceSnapshot, locale)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  langBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    padding: 20,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  activeOffersCard: {
    marginHorizontal: 20,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
  },
  activeOffersGradient: {
    padding: 20,
  },
  activeOffersContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  activeOffersIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeOffersText: {
    flex: 1,
  },
  activeOffersTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  activeOffersCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  recentSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.95,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentInfo: {
    flex: 1,
    marginRight: 12,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  recentDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  recentRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recentPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 30,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
