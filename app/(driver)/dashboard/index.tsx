import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Truck,
  Clock,
  CheckCircle,
  Star,
  Package,
  Globe,
  Zap,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { formatPrice, formatDateShort } from '@/utils/helpers';

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { t, isRTL, locale, toggleLocale } = useLocale();
  const { user, updateUser } = useAuth();
  const { getOrdersByDriver, getAvailableDeliveries } = useData();

  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [isAvailable, setIsAvailable] = React.useState<boolean>(user?.isAvailable ?? false);

  const myDeliveries = useMemo(
    () => (user ? getOrdersByDriver(user.uid) : []),
    [user, getOrdersByDriver],
  );

  const availableDeliveries = useMemo(
    () => getAvailableDeliveries(),
    [getAvailableDeliveries],
  );

  const stats = useMemo(() => {
    const total = myDeliveries.length;
    const active = myDeliveries.filter(
      (o) => o.status === 'assigned_to_driver' || o.status === 'picked_up',
    ).length;
    const completed = myDeliveries.filter((o) => o.status === 'delivered').length;
    const totalEarnings = myDeliveries
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.deliveryFee, 0);
    return { total, active, completed, totalEarnings, available: availableDeliveries.length };
  }, [myDeliveries, availableDeliveries]);

  const recentDeliveries = useMemo(
    () => myDeliveries.slice(0, 5),
    [myDeliveries],
  );

  const handleToggleAvailability = React.useCallback(async (value: boolean) => {
    if (!user) return;
    setIsAvailable(value);
    try {
      await updateUser({ isAvailable: value });
    } catch (e) {
      console.log('[DriverDashboard] availability toggle error:', e);
      setIsAvailable(!value);
    }
  }, [user, updateUser]);

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
              {t('welcomeBack')} 🚗
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
        <View style={styles.availCard}>
          <View style={[styles.availRow, isRTL && styles.rowRTL]}>
            <View style={[styles.availDot, { backgroundColor: isAvailable ? Colors.success : Colors.error }]} />
            <Text style={[styles.availLabel, isRTL && styles.rtlText]}>
              {t('isAvailable')}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => handleToggleAvailability(!isAvailable)}>
              {isAvailable ? (
                <ToggleRight size={32} color={Colors.success} />
              ) : (
                <ToggleLeft size={32} color={Colors.textTertiary} />
              )}
            </Pressable>
          </View>
          <Text style={[styles.availDesc, isRTL && styles.rtlText]}>
            {isAvailable
              ? (locale === 'ar' ? 'أنت متاح لاستقبال طلبات التوصيل' : 'You are available for delivery requests')
              : (locale === 'ar' ? 'لن تظهر في قائمة السائقين المتاحين' : 'You will not appear in available drivers')}
          </Text>
        </View>

        {stats.available > 0 && (
          <Pressable
            style={styles.alertCard}
            onPress={() => router.push('/(driver)/deliveries' as any)}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.alertGradient}
            >
              <View style={[styles.alertContent, isRTL && styles.rowRTL]}>
                <View style={styles.alertIcon}>
                  <Zap size={24} color={Colors.white} />
                </View>
                <View style={styles.alertText}>
                  <Text style={[styles.alertTitle, isRTL && styles.rtlText]}>
                    {t('availableDeliveries')}
                  </Text>
                  <Text style={[styles.alertCount, isRTL && styles.rtlText]}>
                    {stats.available} {locale === 'ar' ? 'توصيلة متاحة' : 'available'}
                  </Text>
                </View>
                <Package size={24} color="rgba(255,255,255,0.6)" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.primaryFaded }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.primary }]}>
                <Truck size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('totalDeliveries')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.pendingBg }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.pending }]}>
                <Clock size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{stats.active}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('activeDelivery')}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.deliveredBg }]}>
              <View style={[styles.statIcon, { backgroundColor: Colors.delivered }]}>
                <CheckCircle size={18} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{stats.completed}</Text>
              <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t('completedDeliveries')}</Text>
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

        <View style={styles.earningsCard}>
          <Text style={[styles.earningsLabel, isRTL && styles.rtlText]}>{t('earnings')}</Text>
          <Text style={styles.earningsValue}>
            {formatPrice(stats.totalEarnings, locale)}
          </Text>
        </View>

        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {locale === 'ar' ? 'آخر التوصيلات' : 'Recent Deliveries'}
          </Text>
          {recentDeliveries.length === 0 ? (
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('noDeliveries')}</Text>
          ) : (
            recentDeliveries.map((order) => (
              <Pressable
                key={order.id}
                style={({ pressed }) => [styles.recentCard, pressed && styles.cardPressed]}
                onPress={() => router.push(`/(driver)/my-deliveries/${order.id}` as any)}
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
                      {formatPrice(order.deliveryFee, locale)}
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
  alertCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    overflow: 'hidden',
  },
  alertGradient: {
    padding: 20,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertText: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  alertCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
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
  earningsCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 8,
    elevation: 3,
  },
  earningsLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  earningsValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.primary,
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
  rowRTL: {
    flexDirection: 'row-reverse',
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
  availCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  availDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  availDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  bottomSpacer: {
    height: 30,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
