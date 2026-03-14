import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowRight, MapPin, ShoppingCart, CreditCard, Banknote, Building2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { RatingStars } from '@/components/RatingStars';
import { formatPrice } from '@/utils/helpers';
import { PaymentMethod } from '@/types';
import { requireAuth } from '@/utils/authGuard';

export default function OfferDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { offers, providers, createOrder } = useData();

  const [note, setNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isOrdering, setIsOrdering] = useState<boolean>(false);

  const offer = useMemo(() => offers.find((o) => o.id === id), [offers, id]);
  const provider = useMemo(
    () => (offer ? providers.find((p) => p.uid === offer.providerUid) : undefined),
    [providers, offer],
  );

  const availablePaymentMethods = useMemo(() => {
    const methods: PaymentMethod[] = ['cod'];
    if (provider?.paymentMethods?.stcPay?.enabled) {
      methods.unshift('stc_pay');
    }
    if (provider?.paymentMethods?.bankTransfer?.enabled) {
      methods.push('bank_transfer');
    }
    return methods;
  }, [provider]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleOrder = useCallback(async () => {
    if (!offer) return;
    if (!requireAuth(user, router, locale)) return;

    Alert.alert(t('confirmOrder'), t('orderConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        onPress: async () => {
          setIsOrdering(true);
          try {
            await createOrder({
              customerUid: user!.uid,
              providerUid: offer.providerUid,
              offerId: offer.id,
              offerTitleSnapshot: offer.title,
              priceSnapshot: offer.price,
              note: note.trim(),
              paymentMethod,
            });

            Alert.alert(t('success'), t('orderPlaced'), [
              { text: t('close'), onPress: () => router.back() },
            ]);
          } catch (err: any) {
            const errMsg = err?.message || err?.code || String(err);
            console.log('[OfferDetails] Order creation error:', errMsg, err);
            Alert.alert(t('error'), t('orderCreateError'));
          } finally {
            setIsOrdering(false);
          }
        },
      },
    ]);
  }, [offer, user, note, paymentMethod, createOrder, t, locale, router]);

  if (!offer) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.errorText}>{t('error')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: offer.imageUrl }} style={styles.heroImage} contentFit="cover" />

      <SafeAreaView style={styles.backButtonSafe} edges={['top']}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BackIcon size={22} color={Colors.text} />
        </Pressable>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mainCard}>
          <View style={[styles.titleRow, isRTL && styles.rowRTL]}>
            <Text style={[styles.title, isRTL && styles.rtlText, styles.titleFlex]}>
              {offer.title}
            </Text>
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>{formatPrice(offer.price, locale)}</Text>
            </View>
          </View>

          <Text style={[styles.description, isRTL && styles.rtlText]}>{offer.description}</Text>

          {provider && (
            <Pressable
              style={[styles.providerCard, isRTL && styles.rowRTL]}
              onPress={() => router.push(`/(customer)/home/provider/${provider.uid}` as any)}
            >
              <Image source={{ uri: provider.photoUrl }} style={styles.providerAvatar} contentFit="cover" />
              <View style={[styles.providerInfo, isRTL && { alignItems: 'flex-end' as const }]}>
                <Text style={[styles.providerName, isRTL && styles.rtlText]}>
                  {provider.displayName}
                </Text>
                <View style={[styles.providerMeta, isRTL && styles.rowRTL]}>
                  <RatingStars rating={Math.round(provider.ratingAverage)} size={14} />
                  <Text style={styles.ratingCount}>({provider.ratingCount})</Text>
                </View>
                <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
                  <MapPin size={12} color={Colors.textTertiary} />
                  <Text style={styles.locationText}>{provider.address}</Text>
                </View>
              </View>
            </Pressable>
          )}

          <View style={styles.paymentSection}>
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{t('selectPayment')}</Text>

            {availablePaymentMethods.includes('stc_pay') && (
              <Pressable
                style={[
                  styles.paymentOption,
                  paymentMethod === 'stc_pay' && styles.paymentOptionActive,
                  isRTL && styles.rowRTL,
                ]}
                onPress={() => setPaymentMethod('stc_pay')}
              >
                <View style={[styles.paymentIconWrap, { backgroundColor: Colors.stcPayBg }]}>
                  <CreditCard size={20} color={Colors.stcPay} />
                </View>
                <View style={styles.paymentTextWrap}>
                  <Text style={[styles.paymentTitle, isRTL && styles.rtlText]}>{t('stcPay')}</Text>
                  <Text style={[styles.paymentDesc, isRTL && styles.rtlText]}>
                    {locale === 'ar' ? 'حوّل عبر STC Pay للطباخ' : 'Transfer via STC Pay to chef'}
                  </Text>
                </View>
                <View style={[styles.radio, paymentMethod === 'stc_pay' && styles.radioActive]}>
                  {paymentMethod === 'stc_pay' && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            )}

            {availablePaymentMethods.includes('bank_transfer') && (
              <Pressable
                style={[
                  styles.paymentOption,
                  paymentMethod === 'bank_transfer' && styles.paymentOptionActive,
                  isRTL && styles.rowRTL,
                ]}
                onPress={() => setPaymentMethod('bank_transfer')}
              >
                <View style={[styles.paymentIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <Building2 size={20} color="#1D4ED8" />
                </View>
                <View style={styles.paymentTextWrap}>
                  <Text style={[styles.paymentTitle, isRTL && styles.rtlText]}>{t('bankTransfer')}</Text>
                  <Text style={[styles.paymentDesc, isRTL && styles.rtlText]}>
                    {locale === 'ar' ? 'تحويل بنكي مباشر للطباخ' : 'Direct bank transfer to chef'}
                  </Text>
                </View>
                <View style={[styles.radio, paymentMethod === 'bank_transfer' && styles.radioActive]}>
                  {paymentMethod === 'bank_transfer' && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.paymentOption,
                paymentMethod === 'cod' && styles.paymentOptionActive,
                isRTL && styles.rowRTL,
              ]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={[styles.paymentIconWrap, { backgroundColor: Colors.codBg }]}>
                <Banknote size={20} color={Colors.cod} />
              </View>
              <View style={styles.paymentTextWrap}>
                <Text style={[styles.paymentTitle, isRTL && styles.rtlText]}>{t('cashOnDelivery')}</Text>
                <Text style={[styles.paymentDesc, isRTL && styles.rtlText]}>
                  {locale === 'ar' ? 'ادفع نقداً عند استلام الطلب' : 'Pay cash when order arrives'}
                </Text>
              </View>
              <View style={[styles.radio, paymentMethod === 'cod' && styles.radioActive]}>
                {paymentMethod === 'cod' && <View style={styles.radioInner} />}
              </View>
            </Pressable>

            <View style={styles.paymentInfoNote}>
              <Text style={[styles.paymentInfoText, isRTL && styles.rtlText]}>
                {paymentMethod === 'cod' ? t('codNote') : t('paymentNote')}
              </Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{t('orderSummary')}</Text>
            <View style={[styles.summaryRow, isRTL && styles.rowRTL]}>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>{t('foodPrice')}</Text>
              <Text style={styles.summaryValue}>{formatPrice(offer.price, locale)}</Text>
            </View>
            <View style={[styles.summaryRow, isRTL && styles.rowRTL]}>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>{t('deliveryFee')}</Text>
              <Text style={styles.summaryValue}>
                {locale === 'ar' ? 'يُحدد لاحقاً' : 'Determined later'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={[styles.summaryRow, isRTL && styles.rowRTL]}>
              <Text style={[styles.summaryTotal, isRTL && styles.rtlText]}>{t('foodPrice')}</Text>
              <Text style={styles.summaryTotalValue}>{formatPrice(offer.price, locale)}</Text>
            </View>
          </View>

          <View style={styles.noteSection}>
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>{t('orderNote')}</Text>
            <TextInput
              style={[styles.noteInput, isRTL && styles.inputRTL]}
              placeholder={t('orderNoteHint')}
              placeholderTextColor={Colors.textTertiary}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.orderButton,
            pressed && styles.buttonPressed,
            !offer.isAvailable && styles.orderButtonDisabled,
          ]}
          onPress={handleOrder}
          disabled={isOrdering || !offer.isAvailable}
        >
          {isOrdering ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <ShoppingCart size={20} color={Colors.white} />
              <Text style={styles.orderButtonText}>
                {t('placeOrder')} - {formatPrice(offer.price, locale)}
              </Text>
            </>
          )}
        </Pressable>
      </SafeAreaView>
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
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  heroImage: {
    width: '100%',
    height: 260,
  },
  backButtonSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
    marginTop: -24,
  },
  mainCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  titleFlex: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  priceBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  priceText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    gap: 14,
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  providerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  paymentSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  paymentOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentTextWrap: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  paymentDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  paymentInfoNote: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  paymentInfoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  summarySection: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 8,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  noteSection: {
    marginBottom: 20,
  },
  noteInput: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inputRTL: {
    writingDirection: 'rtl',
  },
  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  orderButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  orderButtonDisabled: {
    backgroundColor: Colors.textTertiary,
  },
  orderButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
