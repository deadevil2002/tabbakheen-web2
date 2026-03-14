import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import {
  requestNotificationPermissions,
  getAndStorePushToken,
  setupNotificationChannel,
} from "@/services/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NotificationInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    const init = async () => {
      await setupNotificationChannel();
      const granted = await requestNotificationPermissions();
      console.log('[Layout] Notification permission granted:', granted);
      if (granted && user?.uid) {
        await getAndStorePushToken(user.uid);
      }
    };
    init();
  }, [user?.uid]);

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
    SplashScreen.hideAsync();
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
