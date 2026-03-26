import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, UtensilsCrossed } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useRouter } from 'expo-router';

export default function AboutScreen() {
  const router = useRouter();
  const { t, isRTL } = useLocale();

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={[styles.headerRow, isRTL && styles.rowRTL]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            hitSlop={12}
          >
            <BackArrow size={22} color={Colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('aboutScreenTitle')}</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <UtensilsCrossed size={40} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>{t('appName')}</Text>
          <Text style={styles.tagline}>{t('appTagline')}</Text>
        </View>

        <View style={styles.bodyCard}>
          <Text style={[styles.bodyText, isRTL && styles.rtlText]}>
            {t('aboutBody1')}
          </Text>

          <View style={styles.separator} />

          <Text style={[styles.bodyText, isRTL && styles.rtlText]}>
            {t('aboutBody2')}
          </Text>

          <View style={styles.separator} />

          <Text style={[styles.bodyText, isRTL && styles.rtlText]}>
            {t('aboutBody3')}
          </Text>

          <View style={styles.separator} />

          <Text style={[styles.bodyText, isRTL && styles.rtlText]}>
            {t('aboutBody4')}
          </Text>
        </View>

        <Text style={styles.versionText}>
          {t('version')} 1.0.0
        </Text>
        <Text style={styles.poweredText}>
          {t('poweredBy')}
        </Text>

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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnPressed: {
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  bodyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 22,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 8,
    elevation: 2,
  },
  bodyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 16,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 28,
    fontWeight: '600' as const,
  },
  poweredText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  bottomSpacer: {
    height: 40,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
