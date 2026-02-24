import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getFirebaseFirestore } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export async function getAndStorePushToken(uid: string): Promise<string | null> {
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

    if (isFirebaseConfigured() && uid) {
      try {
        const db = getFirebaseFirestore();
        await updateDoc(doc(db, 'users', uid), { expoPushToken: token });
        console.log('[Notifications] Push token saved to Firestore for user:', uid);
      } catch (e) {
        console.log('[Notifications] Error saving push token to Firestore:', e);
      }
    }

    return token;
  } catch (e) {
    console.log('[Notifications] Error getting push token:', e);
    return null;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
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
