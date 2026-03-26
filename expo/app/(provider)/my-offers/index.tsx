import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Switch,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Plus, Trash2, UtensilsCrossed, X, ImageIcon, Tag } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { EmptyState } from '@/components/EmptyState';
import { Offer, OfferCategory } from '@/types';
import { formatPrice } from '@/utils/helpers';
import { FOOD_IMAGES } from '@/mocks/data';
import { pickImageFreeAspect } from '@/utils/imagePicker';
import { uploadOfferImage } from '@/services/cloudinary';

export default function ProviderOffersScreen() {
  const { t, isRTL, locale } = useLocale();
  const { user } = useAuth();
  const { getOffersByProvider, createOffer, updateOffer, deleteOffer } = useData();

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<OfferCategory>('main');

  const CATEGORIES: OfferCategory[] = ['main', 'dessert', 'appetizer', 'pastry', 'drinks', 'other'];
  const categoryLabelKey: Record<OfferCategory, string> = {
    main: 'categoryMain',
    dessert: 'categoryDessert',
    appetizer: 'categoryAppetizer',
    pastry: 'categoryPastry',
    drinks: 'categoryDrinks',
    other: 'categoryOther',
  };

  const offers = useMemo(
    () => (user ? getOffersByProvider(user.uid) : []),
    [user, getOffersByProvider],
  );

  const handleToggleAvailability = useCallback(
    async (offer: Offer) => {
      await updateOffer(offer.id, { isAvailable: !offer.isAvailable });
    },
    [updateOffer],
  );

  const handleDelete = useCallback(
    (offer: Offer) => {
      Alert.alert(
        t('deleteOffer'),
        locale === 'ar' ? 'هل أنت متأكد من حذف هذا العرض؟' : 'Are you sure you want to delete this offer?',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () => deleteOffer(offer.id),
          },
        ],
      );
    },
    [deleteOffer, t, locale],
  );

  const handlePickOfferImage = useCallback(async () => {
    const result = await pickImageFreeAspect();
    if (!result) return;
    setIsUploadingImage(true);
    try {
      const url = await uploadOfferImage(result.uri);
      setNewImageUrl(url);
      console.log('[Offers] Image uploaded:', url);
    } catch (e) {
      console.log('[Offers] Image upload error:', e);
      Alert.alert(t('error'), t('uploadError'));
    } finally {
      setIsUploadingImage(false);
    }
  }, [t]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newPrice.trim() || !user) {
      Alert.alert(t('error'), locale === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
      return;
    }
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('error'), locale === 'ar' ? 'يرجى إدخال سعر صحيح' : 'Please enter a valid price');
      return;
    }

    try {
      await createOffer({
        providerUid: user.uid,
        title: newTitle.trim(),
        description: newDescription.trim(),
        price,
        imageUrl: newImageUrl.trim() || FOOD_IMAGES[Math.floor(Math.random() * FOOD_IMAGES.length)],
        isAvailable: true,
        category: newCategory,
      });

      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setNewImageUrl('');
      setNewCategory('main');
      setShowCreate(false);
    } catch (e) {
      console.log('[Offers] Create offer error:', e);
      Alert.alert(t('error'), t('offerCreateError'));
    }
  }, [newTitle, newDescription, newPrice, newImageUrl, user, createOffer, t, locale]);

  const renderOffer = useCallback(
    ({ item }: { item: Offer }) => (
      <View style={styles.offerCard}>
        <Image source={{ uri: item.imageUrl }} style={styles.offerImage} contentFit="cover" />
        <View style={styles.offerContent}>
          <View style={[styles.offerHeader, isRTL && styles.rowRTL]}>
            <Text style={[styles.offerTitle, isRTL && styles.rtlText]} numberOfLines={1}>
              {item.title}
            </Text>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={8}
            >
              <Trash2 size={16} color={Colors.error} />
            </Pressable>
          </View>
          <Text style={[styles.offerDesc, isRTL && styles.rtlText]} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={[styles.offerFooter, isRTL && styles.rowRTL]}>
            <Text style={styles.offerPrice}>{formatPrice(item.price, locale)}</Text>
            <View style={[styles.availRow, isRTL && styles.rowRTL]}>
              <Text style={styles.availLabel}>
                {item.isAvailable ? t('available') : t('unavailable')}
              </Text>
              <Switch
                value={item.isAvailable}
                onValueChange={() => handleToggleAvailability(item)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={item.isAvailable ? Colors.primary : Colors.textTertiary}
              />
            </View>
          </View>
        </View>
      </View>
    ),
    [isRTL, locale, t, handleDelete, handleToggleAvailability],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={[styles.header, isRTL && styles.rowRTL]}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('myOffers')}</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            onPress={() => setShowCreate(true)}
          >
            <Plus size={20} color={Colors.white} />
            <Text style={styles.addBtnText}>{t('addOffer')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        renderItem={renderOffer}
        contentContainerStyle={offers.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={<UtensilsCrossed size={32} color={Colors.primary} />}
            title={t('emptyOffersTitle')}
            description={t('emptyOffersDesc')}
          />
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalContent}>
              <View style={[styles.modalHeader, isRTL && styles.rowRTL]}>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t('createOffer')}</Text>
                <Pressable onPress={() => setShowCreate(false)}>
                  <X size={24} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, isRTL && styles.rtlText]}>{t('offerTitle')} *</Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.inputRTL]}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder={locale === 'ar' ? 'مثال: كبسة لحم' : 'e.g. Lamb Kabsa'}
                    placeholderTextColor={Colors.textTertiary}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, isRTL && styles.rtlText]}>{t('offerDescription')}</Text>
                  <TextInput
                    style={[styles.formInput, styles.formInputMulti, isRTL && styles.inputRTL]}
                    value={newDescription}
                    onChangeText={setNewDescription}
                    placeholder={locale === 'ar' ? 'وصف الطبق...' : 'Describe the dish...'}
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, isRTL && styles.rtlText]}>{t('offerPrice')} ({t('sar')}) *</Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.inputRTL]}
                    value={newPrice}
                    onChangeText={setNewPrice}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, isRTL && styles.rtlText]}>{t('category')} *</Text>
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        style={[
                          styles.categoryChip,
                          newCategory === cat && styles.categoryChipActive,
                        ]}
                        onPress={() => setNewCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            newCategory === cat && styles.categoryChipTextActive,
                          ]}
                        >
                          {t(categoryLabelKey[cat] as any)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, isRTL && styles.rtlText]}>{t('chooseDishImage')}</Text>
                  <Pressable style={styles.imagePickerBtn} onPress={handlePickOfferImage} disabled={isUploadingImage}>
                    {isUploadingImage ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : newImageUrl ? (
                      <Image source={{ uri: newImageUrl }} style={styles.imagePreview} contentFit="cover" />
                    ) : (
                      <View style={styles.imagePickerPlaceholder}>
                        <ImageIcon size={28} color={Colors.textTertiary} />
                        <Text style={styles.imagePickerText}>{t('chooseDishImage')}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}
                  onPress={handleCreate}
                >
                  <Text style={styles.createBtnText}>{t('createOffer')}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  addBtnPressed: {
    opacity: 0.9,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
  },
  offerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 6,
    elevation: 2,
  },
  offerImage: {
    width: '100%',
    height: 150,
  },
  offerContent: {
    padding: 16,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerPrice: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  formGroup: {
    marginBottom: 18,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  formInputMulti: {
    height: 90,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  inputRTL: {
    writingDirection: 'rtl',
  },
  imagePickerBtn: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden' as const,
    minHeight: 120,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  imagePreview: {
    width: '100%' as any,
    height: 160,
    borderRadius: 12,
  },
  imagePickerPlaceholder: {
    paddingVertical: 28,
    alignItems: 'center' as const,
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  createBtnPressed: {
    opacity: 0.9,
  },
  createBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  categoryGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  categoryChipActive: {
    backgroundColor: Colors.primaryFaded,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.primary,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
