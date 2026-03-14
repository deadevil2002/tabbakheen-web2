import { Alert } from 'react-native';
import { Router } from 'expo-router';
import { User } from '@/types';

export function requireAuth(
  user: User | null,
  router: Router,
  locale: 'ar' | 'en' = 'ar',
): boolean {
  if (user) return true;

  const title = locale === 'ar' ? 'يجب تسجيل الدخول' : 'Login Required';
  const message = locale === 'ar' ? 'يرجى تسجيل الدخول للمتابعة' : 'Please log in to continue';
  const loginLabel = locale === 'ar' ? 'تسجيل الدخول' : 'Login';
  const cancelLabel = locale === 'ar' ? 'إلغاء' : 'Cancel';

  console.log('[AuthGuard] User not authenticated, prompting login');

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    {
      text: loginLabel,
      onPress: () => {
        console.log('[AuthGuard] Redirecting to login');
        router.push('/auth/login' as any);
      },
    },
  ]);

  return false;
}
