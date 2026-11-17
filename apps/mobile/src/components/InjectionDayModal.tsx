import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn } from './ui';
import { brand } from '../assets/brand';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import {
  cacheSchedules,
  getCachedSchedules,
  getRemindersEnabled,
  initNotifications,
  InjectionSchedule,
  markPopupShown,
  popupsToShow,
  syncReminders,
} from '../lib/injectionReminders';
import { colors, fonts } from '../theme';

/**
 * Friendly "It is injection day" pop-up. Mounted once in the root layout.
 * Shows one pop-up per due product, one after the other, on app open / foreground
 * and when an injection-day notification is tapped.
 */
export function InjectionDayModal() {
  const { session, profile } = useAuth();
  const ready = !!session && !!profile?.onboarding_completed_at;
  const [queue, setQueue] = useState<InjectionSchedule[]>([]);
  const handledResponse = useRef<string | null>(null);

  const refresh = useCallback(
    async (force: boolean) => {
      if (!ready) return;
      let schedules: InjectionSchedule[];
      try {
        const { schedules: fresh } = await api.getInjectionSchedules();
        schedules = fresh as InjectionSchedule[];
        await cacheSchedules(schedules);
      } catch {
        schedules = await getCachedSchedules();
      }
      const enabled = await getRemindersEnabled();
      // keep the on-device weekly notifications in step with the server list
      syncReminders(schedules, enabled).catch((e) => console.warn('[reminders] sync', e));
      if (!enabled) return;
      const next = await popupsToShow(schedules, force);
      if (next.length) setQueue((q) => (q.length ? q : next));
    },
    [ready]
  );

  // app open + return to foreground
  useEffect(() => {
    if (!ready) return;
    initNotifications().catch(() => undefined);
    refresh(false);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh(false);
    });
    return () => sub.remove();
  }, [ready, refresh]);

  // notification taps: running/background app, and cold start
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const N = await import('expo-notifications');
        const onResponse = (r: { notification: { request: { identifier: string; content: { data?: any } } } }) => {
          const id = r.notification.request.identifier;
          if (r.notification.request.content.data?.type !== 'injection_day') return;
          if (handledResponse.current === id) return;
          handledResponse.current = id;
          refresh(true);
        };
        const sub = N.addNotificationResponseReceivedListener(onResponse);
        remove = () => sub.remove();
        const last = await N.getLastNotificationResponseAsync();
        if (!cancelled && last) onResponse(last);
      } catch (e) {
        console.warn('[reminders] response listener', e);
      }
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [ready, refresh]);

  const current = queue[0];

  function dismiss(openLog: boolean) {
    if (!current) return;
    markPopupShown(current.id);
    setQueue((q) => q.slice(1));
    if (openLog) router.push('/log-dose');
  }

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => dismiss(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Image source={brand.logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>It’s injection day</Text>
          <Text style={styles.product} numberOfLines={2}>
            {current?.product_name}
          </Text>
          <Text style={styles.body}>
            A gentle nudge from your future self. Take your dose when you’re ready, then log it to
            keep your progress on track.
          </Text>
          {queue.length > 1 ? (
            <Text style={styles.more}>{queue.length - 1} more to go after this one</Text>
          ) : null}
          <Btn title="Log my dose" onPress={() => dismiss(true)} style={styles.btn} />
          <Btn
            title={queue.length > 1 ? 'Next' : 'Got it'}
            variant="ghost"
            onPress={() => dismiss(false)}
            style={styles.btn}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,28,33,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.onBgLine,
    padding: 24,
    alignItems: 'center',
  },
  logo: { width: 120, height: 56, marginBottom: 14 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.onBg, textAlign: 'center' },
  product: {
    fontFamily: fonts.sub,
    fontSize: 16,
    fontWeight: '600',
    color: colors.onBg,
    marginTop: 10,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onBgMuted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  more: { fontFamily: fonts.sub, fontSize: 12, color: colors.onBgMuted, marginTop: 4 },
  btn: { marginTop: 12 },
});
