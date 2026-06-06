import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';

interface LoginRequiredProps {
  message: string;
  headerTitle?: string;
}

export default function LoginRequired({ message, headerTitle }: LoginRequiredProps) {
  const router = useRouter();
  const { t, isRTL } = useLocale();

  return (
    <View style={styles.container}>
      {headerTitle ? (
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{headerTitle}</Text>
        </SafeAreaView>
      ) : null}
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Lock size={40} color={Colors.primary} />
        </View>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('loginRequired')}</Text>
        <Text style={[styles.message, isRTL && styles.rtlText]}>{message}</Text>
        <Pressable
          style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
          onPress={() => router.push('/auth/login' as any)}
          testID="login-required-cta"
        >
          <Text style={styles.loginBtnText}>{t('login')}</Text>
        </Pressable>
      </View>
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
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  loginBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
