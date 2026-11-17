import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

export type InjectionSchedule = {
  id: string;
  product_name: string;
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  /** "HH:MM" or "HH:MM:SS"; null means the default time */
  time_of_day: string | null;
  enabled: boolean;
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DEFAULT_TIME = '09:00';
const CHANNEL_ID = 'injection-reminders';
const KEY_ENABLED = 'injection_reminders_enabled';
const KEY_SHOWN = 'injection_popup_shown';
const KEY_CACHE = 'injection_schedules_cache';

/** Generic copy only — never a medication name (shows on the lock screen). */
const NOTIFICATION_TITLE = 'It’s injection day';
const NOTIFICATION_BODY = 'Open My Era Rx to log your dose.';

export type PermissionState = 'granted' | 'denied' | 'unavailable';

async function loadNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch (e) {
    console.warn('[reminders] expo-notifications unavailable', e);
    return null;
  }
}

/** Show notifications while the app is open and create the Android channel. */
export async function initNotifications() {
  const N = await loadNotifications();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Injection day reminders',
      importance: N.AndroidImportance.HIGH,
      lightColor: colors.beige,
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function getPermission(): Promise<PermissionState> {
  const N = await loadNotifications();
  if (!N) return 'unavailable';
  const { status } = await N.getPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/** Ask for permission (Android 13+ POST_NOTIFICATIONS / iOS prompt). Channel is created first. */
export async function requestPermission(): Promise<PermissionState> {
  const N = await loadNotifications();
  if (!N) return 'unavailable';
  await initNotifications();
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

export function explainDeniedPermission() {
  Alert.alert(
    'Notifications are turned off',
    Platform.OS === 'ios'
      ? 'To get injection-day reminders, open Settings → My Era Rx → Notifications and allow notifications.'
      : 'To get injection-day reminders, open Settings → Apps → My Era Rx → Notifications and allow notifications.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => undefined) },
    ]
  );
}

export async function getRemindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_ENABLED)) !== 'false';
  } catch {
    return true;
  }
}

export async function setRemindersEnabled(on: boolean) {
  try {
    await AsyncStorage.setItem(KEY_ENABLED, on ? 'true' : 'false');
  } catch (e) {
    console.warn('[reminders] could not persist toggle', e);
  }
}

export async function cacheSchedules(list: InjectionSchedule[]) {
  try {
    await AsyncStorage.setItem(KEY_CACHE, JSON.stringify(list));
  } catch {
    /* cache only */
  }
}

export async function getCachedSchedules(): Promise<InjectionSchedule[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CACHE);
    return raw ? (JSON.parse(raw) as InjectionSchedule[]) : [];
  } catch {
    return [];
  }
}

export function parseTime(t: string | null | undefined): { hour: number; minute: number } {
  const [h, m] = (t || DEFAULT_TIME).split(':');
  return { hour: Number(h) || 0, minute: Number(m) || 0 };
}

export function formatSchedule(s: Pick<InjectionSchedule, 'weekdays' | 'time_of_day'>) {
  const days = [...s.weekdays].sort().map((d) => WEEKDAY_SHORT[d]).join(', ');
  return s.time_of_day ? `${days} · ${s.time_of_day.slice(0, 5)}` : days;
}

/**
 * Cancel everything and re-create one weekly notification per (schedule, weekday).
 * Called after every create/edit/delete, on toggle, and on app start.
 */
export async function syncReminders(
  schedules: InjectionSchedule[],
  enabled: boolean
): Promise<number> {
  const N = await loadNotifications();
  if (!N) return 0;
  await N.cancelAllScheduledNotificationsAsync();
  if (!enabled) return 0;
  if ((await getPermission()) !== 'granted') return 0;
  await initNotifications();

  let count = 0;
  for (const s of schedules) {
    if (!s.enabled) continue;
    const { hour, minute } = parseTime(s.time_of_day);
    for (const day of s.weekdays) {
      await N.scheduleNotificationAsync({
        content: {
          title: NOTIFICATION_TITLE,
          body: NOTIFICATION_BODY,
          sound: 'default',
          color: colors.pine,
          data: { type: 'injection_day', scheduleId: s.id },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo: 1 = Sunday
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      });
      count += 1;
    }
  }
  return count;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dueToday(schedules: InjectionSchedule[], now = new Date()): InjectionSchedule[] {
  return schedules.filter((s) => s.enabled && s.weekdays.includes(now.getDay()));
}

async function readShown(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SHOWN);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Schedules due today whose pop-up has not been shown yet today (or all of them when forced). */
export async function popupsToShow(
  schedules: InjectionSchedule[],
  force = false,
  now = new Date()
): Promise<InjectionSchedule[]> {
  const due = dueToday(schedules, now);
  if (force) return due;
  const shown = await readShown();
  const today = dateKey(now);
  return due.filter((s) => shown[s.id] !== today);
}

export async function markPopupShown(id: string, now = new Date()) {
  try {
    const shown = await readShown();
    shown[id] = dateKey(now);
    await AsyncStorage.setItem(KEY_SHOWN, JSON.stringify(shown));
  } catch {
    /* best effort */
  }
}
