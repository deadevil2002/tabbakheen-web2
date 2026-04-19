import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Star, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Offer, User } from '@/types';
import { useLocale } from '@/contexts/LocaleContext';
import { formatPrice } from '@/utils/helpers';

interface OfferCardProps {
  offer: Offer;
  provider?: User;
  onPress: (offer: Offer) => void;
  compact?: boolean;
}

function OfferCardComponent({ offer, provider, onPress, compact }: OfferCardProps) {
  const { locale, isRTL } = useLocale();

  const handlePress = useCallback(() => {
    onPress(offer);
  }, [offer, onPress]);

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}
        onPress={handlePress}
        testID={`offer-card-${offer.id}`}
      >
        <Image source={{ uri: offer.imageUrl }} style={styles.compactImage} contentFit="cover" />
        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, isRTL && styles.rtlText]} numberOfLines={1}>
            {offer.title}
          </Text>
          {provider && (
            <Text style={[styles.compactProvider, isRTL && styles.rtlText]} numberOfLines={1}>
              {provider.displayName}
            </Text>
          )}
          <Text style={[styles.compactPrice, isRTL && styles.rtlText]}>
            {formatPrice(offer.price, locale)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={handlePress}
      testID={`offer-card-${offer.id}`}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: offer.imageUrl }} style={styles.image} contentFit="cover" />
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatPrice(offer.price, locale)}</Text>
        </View>
        {!offer.isAvailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>
              {locale === 'ar' ? 'غير متاح' : 'Unavailable'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, isRTL && styles.rtlText]} numberOfLines={1}>
          {offer.title}
        </Text>
        <Text style={[styles.description, isRTL && styles.rtlText]} numberOfLines={2}>
          {offer.description}
        </Text>
        {provider && (
          <View style={[styles.providerRow, isRTL && styles.rowRTL]}>
            {provider.photoUrl ? (
              <Image source={{ uri: provider.photoUrl }} style={styles.providerAvatar} />
            ) : (
              <View style={[styles.providerAvatar, styles.avatarPlaceholder]} />
            )}
            <Text style={[styles.providerName, isRTL && styles.rtlText]} numberOfLines={1}>
              {provider.displayName}
            </Text>
            <View style={[styles.ratingContainer, isRTL && styles.rowRTL]}>
              <Star size={12} color={Colors.star} fill={Colors.star} />
              <Text style={styles.ratingText}>{provider.ratingAverage.toFixed(1)}</Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const OfferCard = React.memo(OfferCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 8,
    elevation: 3,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 180,
  },
  priceTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priceText: {
    color: Colors.white,
    fontWeight: '700' as const,
    fontSize: 14,
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  content: {
    padding: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  providerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.surfaceTertiary,
  },
  providerName: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  compactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    width: 160,
    marginRight: 12,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  compactImage: {
    width: '100%',
    height: 110,
  },
  compactContent: {
    padding: 10,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  compactProvider: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  compactPrice: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});
