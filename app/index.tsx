import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import Colors from '@/constants/colors';

export default function IndexScreen() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { isReady } = useLocale();

  useEffect(() => {
    if (isLoading || !isReady) return;

    const timeout = setTimeout(() => {
      if (!isAuthenticated || !user) {
        router.replace('/auth/login' as any);
      } else if (user.role === 'customer') {
        router.replace('/(customer)/home' as any);
      } else if (user.role === 'driver') {
        router.replace('/(driver)/dashboard' as any);
      } else {
        router.replace('/(provider)/dashboard' as any);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [isLoading, isReady, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>🍳</Text>
        <Text style={styles.appName}>طباخين</Text>
        <Text style={styles.tagline}>Tabbakheen</Text>
      </View>
      <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  loader: {
    marginTop: 40,
  },
});
