import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert, Clock, Ban, LogOut, Mail, MessageCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLocale } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { AccountGateResult } from '@/utils/accountGating';

const SUPPORT_EMAIL = 'tabbakheen@gmail.com';
const WHATSAPP_NUMBER = '966570758881';

interface AccountGateScreenProps {
  gateResult: AccountGateResult & { allowed: false };
}

export default function AccountGateScreen({ gateResult }: AccountGateScreenProps) {
  const { t, isRTL, locale } = useLocale();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login' as any);
  };

  const getIcon = () => {
    switch (gateResult.reason) {
      case 'trial_expired':
        return <Clock size={48} color={Colors.warning} />;
      case 'suspended':
        return <Ban size={48} color={Colors.error} />;
      case 'disabled':
        return <ShieldAlert size={48} color={Colors.error} />;
      default:
        return <ShieldAlert size={48} color={Colors.error} />;
    }
  };

  const getTitle = () => {
    switch (gateResult.reason) {
      case 'trial_expired':
        return locale === 'ar' ? 'انتهت الفترة التجريبية' : 'Trial Period Expired';
      case 'suspended':
        return locale === 'ar' ? 'الحساب موقوف' : 'Account Suspended';
      case 'disabled':
        return locale === 'ar' ? 'الحساب معطل' : 'Account Disabled';
      default:
        return locale === 'ar' ? 'الحساب غير متاح' : 'Account Unavailable';
    }
  };

  const getDescription = () => {
    switch (gateResult.reason) {
      case 'trial_expired':
        return locale === 'ar'
          ? 'انتهت فترتك التجريبية المجانية (30 يوم). تواصل مع الإدارة لتفعيل حسابك.'
          : 'Your free 30-day trial has expired. Contact admin to activate your account.';
      case 'suspended':
        return locale === 'ar'
          ? 'تم إيقاف حسابك مؤقتاً. تواصل مع الدعم الفني للمزيد من المعلومات.'
          : 'Your account has been temporarily suspended. Contact support for more information.';
      case 'disabled':
        return locale === 'ar'
          ? 'تم تعطيل حسابك. تواصل مع الدعم الفني للمزيد من المعلومات.'
          : 'Your account has been disabled. Contact support for more information.';
      default:
        return locale === 'ar'
          ? 'حسابك غير متاح حالياً. تواصل مع الدعم الفني.'
          : 'Your account is currently unavailable. Contact support.';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{getTitle()}</Text>
        <Text style={[styles.description, isRTL && styles.rtlText]}>{getDescription()}</Text>

        {user?.disabledReason ? (
          <View style={styles.reasonCard}>
            <Text style={[styles.reasonLabel, isRTL && styles.rtlText]}>
              {locale === 'ar' ? 'السبب:' : 'Reason:'}
            </Text>
            <Text style={[styles.reasonText, isRTL && styles.rtlText]}>{user.disabledReason}</Text>
          </View>
        ) : null}

        <View style={styles.contactCard}>
          <Text style={[styles.contactLabel, isRTL && styles.rtlText]}>
            {locale === 'ar' ? 'للتواصل مع الإدارة:' : 'Contact admin:'}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.contactRow, isRTL && styles.rowRTL, pressed && styles.contactRowPressed]}
            onPress={async () => {
              const subject = encodeURIComponent(locale === 'ar' ? 'دعم تطبيق طباخين' : 'Tabbakheen App Support');
              const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
              try {
                if (Platform.OS === 'web') { window.open(url, '_blank'); return; }
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) { await Linking.openURL(url); }
              } catch { /* ignore */ }
            }}
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.infoLight }]}>
              <Mail size={18} color={Colors.info} />
            </View>
            <Text style={[styles.contactValue, isRTL && styles.rtlText]}>{SUPPORT_EMAIL}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.contactRow, isRTL && styles.rowRTL, pressed && styles.contactRowPressed]}
            onPress={async () => {
              const url = `https://wa.me/${WHATSAPP_NUMBER}`;
              try {
                if (Platform.OS === 'web') { window.open(url, '_blank'); return; }
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) { await Linking.openURL(url); }
              } catch { /* ignore */ }
            }}
          >
            <View style={[styles.contactIcon, { backgroundColor: '#E7F5EC' }]}>
              <MessageCircle size={18} color="#25D366" />
            </View>
            <Text style={[styles.contactValue, isRTL && styles.rtlText]}>+{WHATSAPP_NUMBER.replace('966', '966 ')}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.btnPressed]}
          onPress={handleLogout}
        >
          <LogOut size={20} color={Colors.white} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
    shadowColor: Colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  reasonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    width: '100%' as any,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  reasonLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    width: '100%' as any,
    marginBottom: 32,
    alignItems: 'center' as const,
  },
  contactLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 8,
  },
  rowRTL: {
    flexDirection: 'row-reverse' as const,
  },
  contactRowPressed: {
    opacity: 0.7,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.error,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 32,
    gap: 10,
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  logoutText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  rtlText: {
    textAlign: 'right' as const,
    writingDirection: 'rtl' as const,
  },
});
