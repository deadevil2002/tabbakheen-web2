import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowRight, MapPin, Star, MessageCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useData } from '@/contexts/DataContext';
import { OfferCard } from '@/components/OfferCard';
import { RatingStars } from '@/components/RatingStars';
import { Offer } from '@/types';
import { formatDate } from '@/utils/helpers';

export default function ProviderProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, locale } = useLocale();
  const { providers, getOffersByProvider, getRatingsByProvider } = useData();

  const provider = useMemo(() => providers.find((p) => p.uid === id), [providers, id]);
  const providerOffers = useMemo(
    () => (id ? getOffersByProvider(id).filter((o) => o.isAvailable) : []),
    [id, getOffersByProvider],
  );
  const providerRatings = useMemo(
    () => (id ? getRatingsByProvider(id) : []),
    [id, getRatingsByProvider],
  );

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleOfferPress = useCallback((offer: Offer) => {
    router.push(`/(customer)/home/offer/${offer.id}` as any);
  }, []);

  if (!provider) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text>{t('error')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <BackIcon size={22} color={Colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('providerProfile')}</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <Image source={{ uri: provider.photoUrl }} style={styles.avatar} contentFit="cover" />
          <Text style={[styles.name, isRTL && styles.rtlText]}>{provider.displayName}</Text>
          <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
            <MapPin size={14} color={Colors.textTertiary} />
            <Text style={styles.address}>{provider.address}</Text>
          </View>
          <View style={styles.ratingRow}>
            <RatingStars rating={Math.round(provider.ratingAverage)} size={20} />
            <Text style={styles.ratingText}>
              {provider.ratingAverage.toFixed(1)} ({provider.ratingCount})
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('allOffers')}</Text>
          <View style={styles.offersList}>
            {providerOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                provider={provider}
                onPress={handleOfferPress}
              />
            ))}
            {providerOffers.length === 0 && (
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('noOffers')}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('reviews')} ({providerRatings.length})
          </Text>
          {providerRatings.map((rating) => (
            <View key={rating.id} style={styles.reviewCard}>
              <View style={[styles.reviewHeader, isRTL && styles.rowRTL]}>
                <RatingStars rating={rating.stars} size={14} />
                <Text style={styles.reviewDate}>{formatDate(rating.createdAt, locale)}</Text>
              </View>
              {rating.comment ? (
                <Text style={[styles.reviewComment, isRTL && styles.rtlText]}>
                  {rating.comment}
                </Text>
              ) : null}
            </View>
          ))}
          {providerRatings.length === 0 && (
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('noRatings')}</Text>
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
  safe: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: Colors.primaryFaded,
  },
  name: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  address: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  offersList: {},
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 30,
  },
  bottomSpacer: {
    height: 20,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
