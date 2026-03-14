import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  RefreshControl,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Search,
  Globe,
  Star,
  ChevronLeft,
  ChevronRight,
  MapPin,
  UtensilsCrossed,
  Cake,
  Salad,
  Croissant,
  Wine,
  MoreHorizontal,
  LayoutGrid,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Offer, OfferCategory } from '@/types';
import { formatPrice, calculateDistance, formatDistance } from '@/utils/helpers';

const AD_BANNER_URL =
  'https://res.cloudinary.com/dv6n9vnly/image/upload/v1769698754/67e13686-c891-4d70-96da-f11ac94351ca_zlsh8x.png';
const WHATSAPP_NUMBER = '966570758881';
const WHATSAPP_MESSAGE = encodeURIComponent('أبغى استفسر عن الاعلان');

type CategoryFilter = 'all' | OfferCategory;

interface CategoryItem {
  key: CategoryFilter;
  i18nKey: string;
  icon: React.ReactNode;
}

const CATEGORY_ICON_SIZE = 16;

const CATEGORY_ICON_MAP: Record<CategoryFilter, React.ComponentType<{ size: number; color: string }>> = {
  all: LayoutGrid,
  main: UtensilsCrossed,
  dessert: Cake,
  appetizer: Salad,
  pastry: Croissant,
  drinks: Wine,
  other: MoreHorizontal,
};

const CATEGORY_KEYS: { key: CategoryFilter; i18nKey: string }[] = [
  { key: 'all', i18nKey: 'categoryAll' },
  { key: 'main', i18nKey: 'categoryMain' },
  { key: 'dessert', i18nKey: 'categoryDessert' },
  { key: 'appetizer', i18nKey: 'categoryAppetizer' },
  { key: 'pastry', i18nKey: 'categoryPastry' },
  { key: 'drinks', i18nKey: 'categoryDrinks' },
  { key: 'other', i18nKey: 'categoryOther' },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { t, isRTL, locale, toggleLocale } = useLocale();
  const { user } = useAuth();
  const { availableOffers, providers, isLoading } = useData();
  const { width: screenWidth } = useWindowDimensions();

  const [search, setSearch] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  const numColumns = screenWidth < 380 ? 1 : 2;
  const cardGap = 12;
  const horizontalPadding = 20;
  const cardWidth =
    numColumns === 1
      ? screenWidth - horizontalPadding * 2
      : (screenWidth - horizontalPadding * 2 - cardGap) / 2;

  const getProvider = useCallback(
    (uid: string) => providers.find((p) => p.uid === uid),
    [providers],
  );

  const getDistanceToProvider = useCallback(
    (providerUid: string): number | null => {
      if (!user?.location?.lat || !user?.location?.lng) return null;
      const provider = providers.find((p) => p.uid === providerUid);
      if (!provider?.location?.lat || !provider?.location?.lng) return null;
      return calculateDistance(
        user.location.lat,
        user.location.lng,
        provider.location.lat,
        provider.location.lng,
      );
    },
    [user, providers],
  );

  const filteredOffers = useMemo(() => {
    let result = availableOffers;

    if (selectedCategory !== 'all') {
      result = result.filter((o) => {
        const cat = o.category || 'other';
        return cat === selectedCategory;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) => o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q),
      );
    }

    return result;
  }, [availableOffers, search, selectedCategory]);

  const handleOfferPress = useCallback(
    (offer: Offer) => {
      router.push(`/(customer)/home/offer/${offer.id}` as any);
    },
    [],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleAdBannerPress = useCallback(async () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('error'), t('adBannerWhatsappError'));
      }
    } catch (e) {
      console.log('[Home] WhatsApp open error:', e);
      Alert.alert(t('error'), t('adBannerWhatsappError'));
    }
  }, [t]);

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const renderOfferCard = useCallback(
    (offer: Offer) => {
      const provider = getProvider(offer.providerUid);
      const distance = getDistanceToProvider(offer.providerUid);

      return (
        <Pressable
          key={offer.id}
          style={({ pressed }) => [
            styles.offerCard,
            { width: cardWidth },
            pressed && styles.offerCardPressed,
          ]}
          onPress={() => handleOfferPress(offer)}
          testID={`offer-card-${offer.id}`}
        >
          <View style={styles.offerImageWrap}>
            <Image source={{ uri: offer.imageUrl }} style={styles.offerImage} contentFit="cover" />
            <View style={styles.offerPriceTag}>
              <Text style={styles.offerPriceText}>{formatPrice(offer.price, locale)}</Text>
            </View>
          </View>
          <View style={styles.offerContent}>
            <Text style={[styles.offerTitle, isRTL && styles.rtlText]} numberOfLines={1}>
              {offer.title}
            </Text>
            {provider && (
              <View style={[styles.offerProviderRow, isRTL && styles.rowRTL]}>
                {provider.photoUrl ? (
                  <Image source={{ uri: provider.photoUrl }} style={styles.offerProviderAvatar} />
                ) : (
                  <View style={[styles.offerProviderAvatar, styles.avatarPlaceholder]} />
                )}
                <Text style={[styles.offerProviderName, isRTL && styles.rtlText]} numberOfLines={1}>
                  {provider.displayName}
                </Text>
                <Star size={11} color={Colors.star} fill={Colors.star} />
                <Text style={styles.offerRatingText}>{provider.ratingAverage.toFixed(1)}</Text>
              </View>
            )}
            {distance !== null ? (
              <View style={[styles.offerDistanceRow, isRTL && styles.rowRTL]}>
                <MapPin size={11} color={Colors.textTertiary} />
                <Text style={styles.offerDistanceText}>{formatDistance(distance, locale)}</Text>
              </View>
            ) : (
              <View style={[styles.offerDistanceRow, isRTL && styles.rowRTL]}>
                <MapPin size={11} color={Colors.textTertiary} />
                <Text style={styles.offerDistanceText}>{t('distanceNotAvailable')}</Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [getProvider, getDistanceToProvider, cardWidth, locale, isRTL, t, handleOfferPress],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, isRTL && styles.rtlText]}>
              {t('welcome')} 👋
            </Text>
            <Text style={[styles.userName, isRTL && styles.rtlText]}>
              {user?.displayName || t('guest')}
            </Text>
          </View>
          <Pressable style={styles.langBtn} onPress={toggleLocale}>
            <Globe size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.searchContainer, isRTL && styles.searchContainerRTL]}>
          <Search size={20} color={Colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.inputRTL]}
            placeholder={t('searchOffers')}
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            textAlign={isRTL ? 'right' : 'left'}
            testID="home-search"
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Category filter bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
          style={styles.categoryScrollView}
        >
          {CATEGORY_KEYS.map((item) => {
            const isActive = selectedCategory === item.key;
            const IconComp = CATEGORY_ICON_MAP[item.key];
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(item.key)}
              >
                <IconComp
                  size={CATEGORY_ICON_SIZE}
                  color={isActive ? Colors.white : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryChipLabel,
                    isActive && styles.categoryChipLabelActive,
                  ]}
                >
                  {t(item.i18nKey as any)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Ad Banner */}
        <Pressable
          style={({ pressed }) => [styles.adBannerContainer, pressed && styles.adBannerPressed]}
          onPress={handleAdBannerPress}
        >
          <Image
            source={{ uri: AD_BANNER_URL }}
            style={styles.adBannerImage}
            contentFit="cover"
          />
        </Pressable>

        {/* Nearby Providers */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('nearbyProviders')}
            </Text>
            <Pressable
              style={[styles.seeAllBtn, isRTL && styles.seeAllBtnRTL]}
              onPress={() => router.push('/(customer)/map' as any)}
            >
              <Text style={styles.seeAllText}>{t('map')}</Text>
              <Arrow size={16} color={Colors.primary} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providersScroll}
          >
            {providers.map((provider) => (
              <Pressable
                key={provider.uid}
                style={({ pressed }) => [styles.providerChip, pressed && styles.chipPressed]}
                onPress={() => router.push(`/(customer)/home/provider/${provider.uid}` as any)}
              >
                <Image
                  source={{ uri: provider.photoUrl }}
                  style={styles.providerChipAvatar}
                  contentFit="cover"
                />
                <Text style={styles.providerChipName} numberOfLines={1}>
                  {provider.displayName}
                </Text>
                <View style={styles.providerChipRating}>
                  <Star size={10} color={Colors.star} fill={Colors.star} />
                  <Text style={styles.providerChipRatingText}>
                    {provider.ratingAverage.toFixed(1)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* All Offers */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText, styles.sectionTitlePadded]}>
            {t('allOffers')}
          </Text>
          <View style={styles.offersGrid}>
            {filteredOffers.map((offer) => renderOfferCard(offer))}
          </View>
          {filteredOffers.length === 0 && (
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('noOffers')}</Text>
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
  safeTop: {
    backgroundColor: Colors.surface,
    paddingBottom: 12,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  userName: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 46,
    gap: 10,
  },
  searchContainerRTL: {
    flexDirection: 'row-reverse',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  inputRTL: {
    writingDirection: 'rtl',
  },
  scrollView: {
    flex: 1,
  },
  categoryScrollView: {
    marginTop: 14,
    marginBottom: 6,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryChipLabelActive: {
    color: Colors.white,
  },
  adBannerContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 18,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  adBannerPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  adBannerImage: {
    width: '100%',
    aspectRatio: 16 / 7,
    borderRadius: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sectionTitlePadded: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllBtnRTL: {
    flexDirection: 'row-reverse',
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  providersScroll: {
    paddingHorizontal: 20,
  },
  providerChip: {
    width: 90,
    alignItems: 'center',
    marginRight: 14,
  },
  chipPressed: {
    opacity: 0.8,
  },
  providerChipAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.primaryFaded,
  },
  providerChipName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  providerChipRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  providerChipRatingText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  offersGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  offerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  offerCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  offerImageWrap: {
    position: 'relative',
  },
  offerImage: {
    width: '100%',
    height: 120,
  },
  offerPriceTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  offerPriceText: {
    color: Colors.white,
    fontWeight: '700' as const,
    fontSize: 12,
  },
  offerContent: {
    padding: 10,
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 5,
  },
  offerProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  offerProviderAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surfaceTertiary,
  },
  offerProviderName: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  offerRatingText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  offerDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  offerDistanceText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 40,
  },
  bottomSpacer: {
    height: 20,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
