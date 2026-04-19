import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import {
  requestNotificationPermissions,
  getAndStorePushToken,
  setupNotificationChannel,
  addNotificationResponseListener,
  addForegroundNotificationListener,
} from "@/services/notifications";
import { Platform } from "react-native";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NotificationInitializer() {
  const { user } = useAuth();
  const responseListenerRef = useRef<any>(null);
  const foregroundListenerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const init = async () => {
      await setupNotificationChannel();
      const granted = await requestNotificationPermissions();
      console.log('[Layout] Notification permission granted:', granted);
      if (granted && user?.uid) {
        const token = await getAndStorePushToken(user.uid);
        console.log('[Layout] Push token registered:', token ? 'yes' : 'no');
      }
    };
    void init();
  }, [user?.uid]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    responseListenerRef.current = addNotificationResponseListener();
    foregroundListenerRef.current = addForegroundNotificationListener();

    return () => {
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
      if (foregroundListenerRef.current) {
        foregroundListenerRef.current.remove();
      }
    };
  }, []);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NotificationInitializer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" options={{ presentation: "modal" }} />
        <Stack.Screen name="auth/register" options={{ presentation: "modal" }} />
        <Stack.Screen name="auth/forgot-password" options={{ presentation: "modal" }} />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(provider)" />
        <Stack.Screen name="(driver)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LocaleProvider>
          <AuthProvider>
            <DataProvider>
              <RootLayoutNav />
            </DataProvider>
          </AuthProvider>
        </LocaleProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
