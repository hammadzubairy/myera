import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Card, Chip, Field, Muted, Screen, ScreenHeader, Switch } from '../src/components/ui';
import { api } from '../src/lib/api';
import { notify } from '../src/lib/notify';
import {
  cacheSchedules,
  explainDeniedPermission,
  formatSchedule,
  getRemindersEnabled,
  InjectionSchedule,
  requestPermission,
  syncReminders,
  WEEKDAY_SHORT,
} from '../src/lib/injectionReminders';
import { colors, fonts } from '../src/theme';

type Draft = { id?: string; product_name: string; weekdays: number[]; time: string; enabled: boolean };
const emptyDraft = (): Draft => ({ product_name: '', weekdays: [], time: '', enabled: true });

export default function InjectionSchedulesScreen() {
  const [schedules, setSchedules] = useState<InjectionSchedule[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { schedules: list } = await api.getInjectionSchedules();
      setSchedules(list);
      await cacheSchedules(list);
    } catch (e: any) {
      notify('Could not load schedules', e.message || String(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Re-create the on-device weekly notifications after any change. */
  async function resync(list: InjectionSchedule[]) {
    setSchedules(list);
    await cacheSchedules(list);
    await syncReminders(list, await getRemindersEnabled());
  }

  function toggleDay(d: number) {
    if (!draft) return;
    const has = draft.weekdays.includes(d);
    setDraft({ ...draft, weekdays: has ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d].sort() });
  }

  async function save() {
    if (!draft) return;
    const name = draft.product_name.trim();
    if (!name) return notify('Product name needed', 'Enter the name of the product you inject.');
    if (!draft.weekdays.length) return notify('Pick a day', 'Choose at least one day of the week.');
    const time = draft.time.trim();
    if (time && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) {
      return notify('Check the time', 'Use 24-hour time like 08:30, or leave it empty.');
    }
    const body = {
      product_name: name,
      weekdays: draft.weekdays,
      time_of_day: time ? time.padStart(5, '0') : null,
      enabled: draft.enabled,
    };
    setSaving(true);
    try {
      // sensible moment to ask: the first time the customer saves a schedule
      const perm = await requestPermission();
      if (perm === 'denied') explainDeniedPermission();
      const { schedule } = draft.id
        ? await api.updateInjectionSchedule(draft.id, body)
        : await api.createInjectionSchedule(body);
      await resync(
        draft.id ? schedules.map((s) => (s.id === schedule.id ? schedule : s)) : [...schedules, schedule]
      );
      setDraft(null);
    } catch (e: any) {
      notify('Could not save', e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteInjectionSchedule(id);
      await resync(schedules.filter((s) => s.id !== id));
      setDraft(null);
    } catch (e: any) {
      notify('Could not delete', e.message || String(e));
    }
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ScreenHeader title="Injection days" onBack={() => router.back()} />
            <Muted style={{ marginBottom: 14 }}>
              Choose the day or days you inject each product. We remind you every week on those days.
            </Muted>

            {draft ? (
              <View style={{ gap: 12 }}>
                <Field
                  label="Product name"
                  value={draft.product_name}
                  onChangeText={(t) => setDraft({ ...draft, product_name: t })}
                  placeholder="e.g. Semaglutide"
                  maxLength={120}
                />
                <View>
                  <Text style={styles.label}>Day(s) of the week</Text>
                  <View style={styles.days}>
                    {WEEKDAY_SHORT.map((d, i) => (
                      <Chip key={d} label={d} selected={draft.weekdays.includes(i)} onPress={() => toggleDay(i)} />
                    ))}
                  </View>
                </View>
                <Field
                  label="Time (optional, 24-hour)"
                  value={draft.time}
                  onChangeText={(t) => setDraft({ ...draft, time: t })}
                  placeholder="09:00"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <View style={styles.switchRow}>
                  <Text style={styles.onBgTitle}>Reminder on</Text>
                  <Switch value={draft.enabled} onValueChange={(v) => setDraft({ ...draft, enabled: v })} label="Reminder on" onDark />
                </View>
                <Btn title={draft.id ? 'Save changes' : 'Save schedule'} onPress={save} loading={saving} />
                <Btn title="Cancel" variant="ghost" onPress={() => setDraft(null)} />
                {draft.id ? (
                  <Pressable onPress={() => remove(draft.id!)} style={styles.deleteWrap}>
                    <Text style={styles.delete}>Delete schedule</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                {schedules.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() =>
                      setDraft({
                        id: s.id,
                        product_name: s.product_name,
                        weekdays: s.weekdays,
                        time: s.time_of_day ? s.time_of_day.slice(0, 5) : '',
                        enabled: s.enabled,
                      })
                    }
                  >
                    <Card style={styles.item}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{s.product_name}</Text>
                        <Text style={styles.rowSub}>
                          {formatSchedule(s)}
                          {s.enabled ? '' : ' · paused'}
                        </Text>
                      </View>
                      <Text style={styles.chev}>›</Text>
                    </Card>
                  </Pressable>
                ))}
                {loaded && !schedules.length ? (
                  <Card>
                    <Text style={styles.rowTitle}>No injection days yet</Text>
                    <Text style={styles.rowSub}>Add a product to start getting weekly reminders.</Text>
                  </Card>
                ) : null}
                <Btn title="Add a product" onPress={() => setDraft(emptyDraft())} style={{ marginTop: 14 }} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 120 },
  label: { fontFamily: fonts.sub, fontSize: 11, color: colors.onBgMuted, marginBottom: 6 },
  onBgTitle: { fontFamily: fonts.body, fontSize: 16, fontWeight: '600', color: colors.onBg },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rowTitle: { fontFamily: fonts.body, fontSize: 16, fontWeight: '600', color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  chev: { fontSize: 24, color: colors.muted },
  deleteWrap: { alignItems: 'center', paddingTop: 4 },
  delete: { fontFamily: fonts.body, fontSize: 14, color: '#F2B8B0', fontWeight: '600' },
});
