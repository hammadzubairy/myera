import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from './api';

/** True when running inside Expo Go (no full native push modules on Android). */
function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    (Constants as any).executionEnvironment === 'storeClient'
  );
}

let responseSub: { remove: () => void } | null = null;

async function handleNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const type = data.type;
  if (type === 'shot_reminder') {
    if (data.action === 'snooze') {
      try {
        await api.snoozeShot(1);
      } catch (e) {
        console.warn('[push] snooze failed', e);
      }
      return;
    }
    router.push('/log-dose');
    return;
  }
  if (type === 'announcement') {
    router.push('/announcements');
  }
}

/**
 * Register for push. Safe no-op in Expo Go on Android (remote push removed since SDK 53)
 * and whenever the native module is missing.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android' && isExpoGo()) {
    console.info(
      '[push] Skipped: remote notifications are unavailable in Expo Go on Android. Use a development build later.'
    );
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Log dose / snooze deep-links on native builds
    if (responseSub) responseSub.remove();
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      // Prefer action identifier when present (native action buttons)
      const actionId = response.actionIdentifier;
      if (actionId === 'snooze_1h') {
        handleNotificationData({ type: 'shot_reminder', action: 'snooze' });
        return;
      }
      handleNotificationData(data);
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;
    try {
      await api.registerPushToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      });
    } catch (e) {
      console.warn('Failed to register push token', e);
    }
    return token;
  } catch (e) {
    console.warn('[push] Notifications unavailable in this build', e);
    return null;
  }
}
