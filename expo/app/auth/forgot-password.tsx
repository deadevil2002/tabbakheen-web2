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
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { isFirebaseConfigured, getFirebaseAuth } from '@/services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t, isRTL, locale } = useLocale();

  const [email, setEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleResetPassword = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert(t('error'), locale === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert(t('error'), t('invalidEmail'));
      return;
    }

    if (!isFirebaseConfigured()) {
      Alert.alert(t('error'), t('networkError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, trimmed);
      console.log('[ForgotPassword] Reset email sent to:', trimmed);
      setEmailSent(true);
    } catch (error: any) {
      console.log('[ForgotPassword] Error:', error.code, error.message);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        Alert.alert(t('error'), t('userNotFound'));
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert(t('error'), t('invalidEmail'));
      } else if (error.code === 'auth/too-many-requests') {
        Alert.alert(t('error'), t('tooManyRequests'));
      } else {
        Alert.alert(t('error'), t('authError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, locale, t]);

  if (emailSent) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successIcon}>
            <CheckCircle size={64} color={Colors.success} />
          </View>
          <Text style={[styles.successTitle, isRTL && styles.rtlText]}>
            {t('resetEmailSent')}
          </Text>
          <Text style={[styles.successDesc, isRTL && styles.rtlText]}>
            {t('resetEmailSentDesc')}
          </Text>
          <Text style={[styles.emailSentTo, isRTL && styles.rtlText]}>
            {email.trim()}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>{t('backToLogin')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          <Pressable style={styles.navBack} onPress={() => router.back()}>
            <BackIcon size={24} color={Colors.text} />
          </Pressable>

          <View style={styles.headerSection}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t('resetPassword')}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
              {t('resetPasswordDesc')}
            </Text>
          </View>

          <View style={styles.formSection}>
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
                testID="forgot-password-email"
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
              onPress={handleResetPassword}
              disabled={isSubmitting}
              testID="forgot-password-submit"
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>{t('sendResetLink')}</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.backToLoginRow}
              onPress={() => router.back()}
            >
              <Text style={[styles.backToLoginText, isRTL && styles.rtlText]}>
                {t('backToLogin')}
              </Text>
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
  navBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  headerSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
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
    marginBottom: 20,
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
    marginBottom: 16,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  backToLoginRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backToLoginText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  successContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  emailSentTo: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  backButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
