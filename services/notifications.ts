import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getFirebaseFirestore } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { isFirebaseConfigured } from './firebase';
import { router } from 'expo-router';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform - skipping native permissions');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Existing permission status:', existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Notifications] Requested permission, new status:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return false;
    }

    console.log('[Notifications] Permission granted');
    return true;
  } catch (e) {
    console.log('[Notifications] Error requesting permissions:', e);
    return false;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform - no push token');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('[Notifications] Expo push token:', token);
    return token;
  } catch (e) {
    console.log('[Notifications] Error getting push token:', e);
    return null;
  }
}

export async function savePushTokenToFirestore(
  uid: string,
  token: string,
): Promise<void> {
  if (!isFirebaseConfigured() || !uid || !token) {
    console.log('[Notifications] Skipping token save - missing config/uid/token');
    return;
  }

  try {
    const db = getFirebaseFirestore();
    await updateDoc(doc(db, 'users', uid), {
      expoPushToken: token,
      pushNotificationsEnabled: true,
      lastPushTokenUpdatedAt: serverTimestamp(),
    });
    console.log('[Notifications] Push token saved to Firestore for user:', uid);
  } catch (e) {
    console.log('[Notifications] Error saving push token to Firestore:', e);
  }
}

export async function getAndStorePushToken(uid: string): Promise<string | null> {
  const token = await getExpoPushToken();
  if (token && uid) {
    await savePushTokenToFirestore(uid, token);
  }
  return token;
}

export async function clearPushToken(uid: string): Promise<void> {
  if (!isFirebaseConfigured() || !uid) return;
  try {
    const db = getFirebaseFirestore();
    await updateDoc(doc(db, 'users', uid), {
      expoPushToken: null,
      pushNotificationsEnabled: false,
    });
    console.log('[Notifications] Push token cleared for user:', uid);
  } catch (e) {
    console.log('[Notifications] Error clearing push token:', e);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform - skipping local notification:', title, body);
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: data ?? {},
      },
      trigger: null,
    });
    console.log('[Notifications] Local notification sent:', title);
  } catch (e) {
    console.log('[Notifications] Error sending local notification:', e);
  }
}

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
      console.log('[Notifications] Android notification channel created');
    } catch (e) {
      console.log('[Notifications] Error creating Android channel:', e);
    }
  }
}

export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content.data;
  console.log('[Notifications] Notification tapped, data:', JSON.stringify(data));

  if (!data) return;

  const { type, orderId, role } = data as {
    type?: string;
    orderId?: string;
    role?: string;
  };

  try {
    if (orderId && role === 'customer') {
      router.push(`/(customer)/orders/${orderId}` as any);
    } else if (orderId && role === 'provider') {
      router.push(`/(provider)/my-orders/${orderId}` as any);
    } else if (orderId && role === 'driver') {
      router.push(`/(driver)/my-deliveries/${orderId}` as any);
    } else if (type === 'new_delivery_available') {
      router.push('/(driver)/deliveries' as any);
    }
  } catch (e) {
    console.log('[Notifications] Error navigating from notification:', e);
  }
}

export function addNotificationResponseListener(): Notifications.EventSubscription | null {
  if (Platform.OS === 'web') return null;

  const subscription = Notifications.addNotificationResponseReceivedListener(
    handleNotificationResponse,
  );
  console.log('[Notifications] Response listener registered');
  return subscription;
}

export function addForegroundNotificationListener(
  callback?: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription | null {
  if (Platform.OS === 'web') return null;

  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log(
        '[Notifications] Foreground notification received:',
        notification.request.content.title,
      );
      if (callback) callback(notification);
    },
  );
  console.log('[Notifications] Foreground listener registered');
  return subscription;
}
