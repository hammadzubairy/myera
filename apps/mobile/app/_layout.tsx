import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_500Medium,
  Lora_500Medium_Italic,
  Lora_600SemiBold,
} from '@expo-google-fonts/lora';
import {
  Jost_300Light,
  Jost_400Regular,
  Jost_500Medium,
} from '@expo-google-fonts/jost';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/lib/auth';
import { InjectionDayModal } from '../src/components/InjectionDayModal';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  // Branding PDF: primary Lora (headers). App design HTML: Jost subheads, DM Sans body.
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [loaded] = useFonts({
    Lora: Lora_400Regular,
    LoraItalic: Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_500Medium_Italic,
    Lora_600SemiBold,
    Jost: Jost_400Regular,
    Jost_300Light,
    Jost_500Medium,
    DMSans: DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    // Don't block forever if a font CDN is slow — hide splash and continue
    if (loaded) {
      SplashScreen.hideAsync().catch(() => undefined);
      return;
    }
    const t = setTimeout(() => {
      setFontsTimedOut(true);
      SplashScreen.hideAsync().catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, [loaded]);

  if (!loaded && !fontsTimedOut) {
    return <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.sand }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 280,
            gestureEnabled: true,
            contentStyle: { backgroundColor: colors.sand },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding/profile" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="dose"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="log-dose"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="new-post"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="calorie-goal"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="change-dose"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="log-weight"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="add-measurement"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="edit-profile"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="injection-schedules"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="announcements"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="food-servings"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="food-search"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 320,
              contentStyle: { backgroundColor: colors.mealAddBackdrop },
            }}
          />
          <Stack.Screen
            name="compare-photos"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="edit-image"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="add-progress-photo"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
          <Stack.Screen
            name="post/[id]"
            options={{ presentation: 'card', animation: 'slide_from_right', animationDuration: 320 }}
          />
        </Stack>
        <InjectionDayModal />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
