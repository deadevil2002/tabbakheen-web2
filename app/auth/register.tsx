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
import { Mail, Lock, User, Phone, ShoppingBag, ChefHat, Truck } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { UserRole } from '@/types';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, isRTL, locale } = useLocale();

  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('customer');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleRegister = useCallback(async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert(
        t('error'),
        locale === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill in all required fields',
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        phone: phone.trim(),
        role,
      });
      if (user.role === 'customer') {
        router.replace('/(customer)/home' as any);
      } else if (user.role === 'driver') {
        router.replace('/(driver)/dashboard' as any);
      } else {
        router.replace('/(provider)/dashboard' as any);
      }
    } catch (e: any) {
      const msg = e?.message === 'EMAIL_EXISTS'
        ? (locale === 'ar' ? 'البريد الإلكتروني مسجل مسبقاً' : 'Email already exists')
        : t('error');
      Alert.alert(t('error'), msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [displayName, email, phone, password, role, register, locale, t]);

  const goToLogin = useCallback(() => {
    router.back();
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
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('register')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('selectRole')}</Text>

          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleCard, role === 'customer' && styles.roleCardActive]}
              onPress={() => setRole('customer')}
            >
              <ShoppingBag size={26} color={role === 'customer' ? Colors.primary : Colors.textTertiary} />
              <Text style={[styles.roleLabel, role === 'customer' && styles.roleLabelActive]}>
                {t('customer')}
              </Text>
              <Text style={styles.roleDesc}>{t('customerDesc')}</Text>
            </Pressable>
            <Pressable
              style={[styles.roleCard, role === 'provider' && styles.roleCardActive]}
              onPress={() => setRole('provider')}
            >
              <ChefHat size={26} color={role === 'provider' ? Colors.primary : Colors.textTertiary} />
              <Text style={[styles.roleLabel, role === 'provider' && styles.roleLabelActive]}>
                {t('provider')}
              </Text>
              <Text style={styles.roleDesc}>{t('providerDesc')}</Text>
            </Pressable>
            <Pressable
              style={[styles.roleCard, role === 'driver' && styles.roleCardActive]}
              onPress={() => setRole('driver')}
            >
              <Truck size={26} color={role === 'driver' ? Colors.primary : Colors.textTertiary} />
              <Text style={[styles.roleLabel, role === 'driver' && styles.roleLabelActive]}>
                {t('driver')}
              </Text>
              <Text style={styles.roleDesc}>{t('driverDesc')}</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={[styles.inputContainer, isRTL && styles.inputContainerRTL]}>
                <User size={20} color={Colors.textTertiary} />
                <TextInput
                  style={[styles.input, isRTL && styles.inputRTL]}
                  placeholder={t('fullName')}
                  placeholderTextColor={Colors.textTertiary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  textAlign={isRTL ? 'right' : 'left'}
                  testID="register-name"
                />
              </View>
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
                  textAlign={isRTL ? 'right' : 'left'}
                  testID="register-email"
                />
              </View>
              <View style={[styles.inputContainer, isRTL && styles.inputContainerRTL]}>
                <Phone size={20} color={Colors.textTertiary} />
                <TextInput
                  style={[styles.input, isRTL && styles.inputRTL]}
                  placeholder={t('phone')}
                  placeholderTextColor={Colors.textTertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  textAlign={isRTL ? 'right' : 'left'}
                  testID="register-phone"
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
                  testID="register-password"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
              onPress={handleRegister}
              disabled={isSubmitting}
              testID="register-submit"
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>{t('register')}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.loginRow}>
            <Text style={[styles.loginText, isRTL && styles.rtlText]}>{t('hasAccount')}</Text>
            <Pressable onPress={goToLogin}>
              <Text style={styles.loginLink}> {t('loginNow')}</Text>
            </Pressable>
          </View>
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
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: 3,
  },
  roleLabelActive: {
    color: Colors.primary,
  },
  roleDesc: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 14,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Colors.shadow.opacity,
    shadowRadius: 12,
    elevation: 4,
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
  submitButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
