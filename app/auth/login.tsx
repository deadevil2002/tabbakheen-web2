import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Globe } from 'lucide-react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, isRTL, toggleLocale, locale } = useLocale();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleLogin = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert(t('error'), locale === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role === 'customer') {
        router.replace('/(customer)/home' as any);
      } else if (user.role === 'driver') {
        router.replace('/(driver)/dashboard' as any);
      } else {
        router.replace('/(provider)/dashboard' as any);
      }
    } catch (e: any) {
      const msg = e?.message === 'USER_NOT_FOUND'
        ? (locale === 'ar' ? 'لم يتم العثور على حساب بهذا البريد' : 'No account found with this email')
        : t('error');
      Alert.alert(t('error'), msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login, locale, t]);

  const goToRegister = useCallback(() => {
    router.push('/auth/register' as any);
  }, []);


  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.langButton} onPress={toggleLocale}>
            <Globe size={18} color={Colors.textSecondary} />
            <Text style={styles.langText}>{t('switchLang')}</Text>
          </Pressable>

          <View style={styles.headerSection}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
            <Text style={[styles.appTitle, isRTL && styles.rtlText]}>
              {t('appName')}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t('appTagline')}
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.formTitle, isRTL && styles.rtlText]}>
              {t('login')}
            </Text>

            <View style={styles.inputGroup}>
              <View style={[styles.inputContainer, isRTL && styles.inputContainerRTL]}>
                <Mail size={20} color={Colors.textTertiary} />
                <TextInput
                  style={[styles.input, isRTL && styles.inputRTL]}
                  placeholder={t('email')}
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlign={isRTL ? 'right' : 'left'}
                  testID="login-email"
                />
              </View>

              <View style={[styles.inputContainer, isRTL && styles.inputContainerRTL]}>
                <Lock size={20} color={Colors.textTertiary} />
                <TextInput
                  style={[styles.input, isRTL && styles.inputRTL]}
                  placeholder={t('password')}
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textAlign={isRTL ? 'right' : 'left'}
                  testID="login-password"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.loginButton, pressed && styles.buttonPressed]}
              onPress={handleLogin}
              disabled={isSubmitting}
              testID="login-submit"
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.loginButtonText}>{t('login')}</Text>
              )}
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={[styles.registerText, isRTL && styles.rtlText]}>
                {t('noAccount')}
              </Text>
              <Pressable onPress={goToRegister}>
                <Text style={styles.registerLink}> {t('registerNow')}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.powered}>{t('poweredBy')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    gap: 6,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  langText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 36,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  formSection: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 14,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inputContainerRTL: {
    flexDirection: 'row-reverse',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  inputRTL: {
    writingDirection: 'rtl',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  powered: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 24,
    marginBottom: 8,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
