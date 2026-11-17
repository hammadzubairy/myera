import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatHeightIn,
  formatWeightLb,
  type Units,
  weightUnitLabel,
} from '@myera/shared';
import { Btn, Card, Screen, Switch } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { api } from '../../src/lib/api';
import { colors, fonts } from '../../src/theme';
import { notify } from '../../src/lib/notify';
import { runTabFocusLoad } from '../../src/lib/tabFocus';
import {
  explainDeniedPermission,
  getRemindersEnabled,
  requestPermission,
  setRemindersEnabled,
  syncReminders,
} from '../../src/lib/injectionReminders';

export default function MeScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [communityNotifs, setCommunityNotifs] = useState(true);
  const [remindersOn, setRemindersOn] = useState(true);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [unitsSaving, setUnitsSaving] = useState(false);
  const hydratedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const cancelFocus = runTabFocusLoad('me', hydratedRef.current, async () => {
        try {
          const [{ prefs }, { schedules }, enabled] = await Promise.all([
            api.getPushPrefs(),
            api.getInjectionSchedules(),
            getRemindersEnabled(),
          ]);
          if (!alive) return;
          if (prefs) setCommunityNotifs(prefs.community !== false);
          setScheduleCount(schedules.length);
          setRemindersOn(enabled);
          hydratedRef.current = true;
        } catch (e) {
          console.warn(e);
        }
      });
      return () => {
        alive = false;
        cancelFocus();
      };
    }, [])
  );

  async function patchPrefs(patch: { community?: boolean }) {
    try {
      const { prefs } = await api.updatePushPrefs(patch);
      setCommunityNotifs(prefs.community !== false);
    } catch (e: any) {
      notify('Could not update', e.message || String(e));
    }
  }

  /** Master switch: off cancels every reminder, on restores them (asks permission if needed). */
  async function toggleReminders(next: boolean) {
    if (next) {
      const perm = await requestPermission();
      if (perm === 'denied') {
        explainDeniedPermission();
        return;
      }
    }
    setRemindersOn(next);
    await setRemindersEnabled(next);
    try {
      const { schedules } = await api.getInjectionSchedules();
      await syncReminders(schedules, next);
    } catch (e: any) {
      notify('Could not update reminders', e.message || String(e));
    }
  }

  const units: Units = profile?.units === 'kg_cm' ? 'kg_cm' : 'lb_in';
  const unitsLabel = units === 'kg_cm' ? 'kg, cm' : 'lb, in';
  const wLabel = weightUnitLabel(units);

  async function setUnits(next: Units) {
    if (next === units) {
      setUnitsOpen(false);
      return;
    }
    try {
      setUnitsSaving(true);
      await api.updateProfile({ units: next });
      await refreshProfile();
      setUnitsOpen(false);
    } catch (e: any) {
      notify('Could not update units', e.message || String(e));
    } finally {
      setUnitsSaving(false);
    }
  }

  async function deleteAccount() {
    const go = async () => {
      try {
        await api.deleteAccount();
        try {
          await signOut();
        } catch {
          /* the auth user is already gone */
        }
        notify('Account deleted', 'Your account and personal data have been removed.');
        router.replace('/(auth)/welcome');
      } catch (e: any) {
        notify('Could not delete', e.message || String(e));
      }
    };
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(
          'Permanently delete your account? This cannot be undone. Tracking data will be scrubbed.'
        )
      ) {
        await go();
      }
      return;
    }
    Alert.alert(
      'Delete account',
      'Permanently delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: go },
      ]
    );
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.top}>
            <Text style={styles.title}>Me</Text>
            <Btn title="Edit" variant="ghost" size="sm" onPress={() => router.push('/edit-profile')} />
          </View>

          <Card>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                {profile?.photo_url ? (
                  <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.letter}>
                    {(profile?.full_name || '?')[0]?.toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{profile?.full_name || 'Member'}</Text>
                <Text style={styles.email}>{profile?.email}</Text>
              </View>
            </View>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {formatHeightIn(profile?.height_in, units)}
                </Text>
                <Text style={styles.statLabel}>Height</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {formatWeightLb(profile?.start_weight_lb, units).replace(` ${wLabel}`, '')}
                </Text>
                <Text style={styles.statLabel}>Start {wLabel}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {formatWeightLb(profile?.goal_weight_lb, units).replace(` ${wLabel}`, '')}
                </Text>
                <Text style={styles.statLabel}>Goal {wLabel}</Text>
              </View>
            </View>
          </Card>

          <Card style={{ marginTop: 12, paddingVertical: 4, paddingHorizontal: 14 }}>
            <Row
              label="Daily calorie goal"
              value={
                profile?.calorie_goal_kcal
                  ? `${Number(profile.calorie_goal_kcal).toLocaleString()} kcal`
                  : '1,600 kcal'
              }
              onPress={() => router.push('/calorie-goal')}
            />
            <SwitchRow
              title="Community updates"
              subtitle="Likes and comments on your posts"
              value={communityNotifs}
              onValueChange={(v) => {
                setCommunityNotifs(v);
                patchPrefs({ community: v });
              }}
            />
            <SwitchRow
              title="Injection reminders"
              subtitle="Weekly notification on your injection days"
              value={remindersOn}
              onValueChange={toggleReminders}
            />
            <Row
              label="Injection days"
              value={scheduleCount ? `${scheduleCount} product${scheduleCount === 1 ? '' : 's'}` : 'Set up'}
              onPress={() => router.push('/injection-schedules')}
            />
            <Row label="Units" value={unitsLabel} onPress={() => setUnitsOpen(true)} />
            <Row
              label="Privacy and data"
              value=""
              onPress={() => notify('Privacy', 'Privacy policy will be linked for store listing.')}
              last
            />
          </Card>

          <Card style={{ marginTop: 12, paddingVertical: 4, paddingHorizontal: 14 }}>
            <Pressable
              style={styles.row}
              onPress={async () => {
                await signOut();
                router.replace('/(auth)/welcome');
              }}
            >
              <Text style={styles.rowLabel}>Sign out</Text>
            </Pressable>
            <Pressable style={[styles.row, styles.rowLast]} onPress={deleteAccount}>
              <Text style={[styles.rowLabel, { color: colors.danger }]}>Delete account</Text>
            </Pressable>
          </Card>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={unitsOpen} transparent animationType="fade" onRequestClose={() => setUnitsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUnitsOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Units</Text>
            <Text style={styles.modalSub}>Weights and heights stay stored as lb / in. This only changes what you see.</Text>
            <Pressable
              style={[styles.modalOption, units === 'lb_in' && styles.modalOptionOn]}
              onPress={() => setUnits('lb_in')}
              disabled={unitsSaving}
            >
              <Text style={[styles.modalOptionText, units === 'lb_in' && styles.modalOptionTextOn]}>
                Imperial — lb, in
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modalOption, units === 'kg_cm' && styles.modalOptionOn]}
              onPress={() => setUnits('kg_cm')}
              disabled={unitsSaving}
            >
              <Text style={[styles.modalOptionText, units === 'kg_cm' && styles.modalOptionTextOn]}>
                Metric — kg, cm
              </Text>
            </Pressable>
            <Btn title="Cancel" variant="ghost" onPress={() => setUnitsOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function formatTime12h(raw: string) {
  const part = (raw || '09:00').slice(0, 5);
  const [h, m] = part.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return part;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function Row({
  label,
  value,
  onPress,
  last,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, last && styles.rowLast]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!value && (
          <Text style={styles.rowSub} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  onPressSubtitle,
  last,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  onPressSubtitle?: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Pressable
        style={{ flex: 1, paddingRight: 10 }}
        onPress={onPressSubtitle}
        disabled={!onPressSubtitle}
      >
        <Text style={styles.rowLabel}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </Pressable>
      <Switch value={value} onValueChange={onValueChange} label={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 24 : 110 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 33,
    fontWeight: '500',
    color: colors.onBg,
    letterSpacing: -0.3,
  },
  identity: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.sageSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 70, height: 70 },
  letter: { fontFamily: fonts.display, fontSize: 28, color: colors.pine },
  name: { fontFamily: fonts.body, fontSize: 20, fontWeight: '700', color: colors.ink },
  email: { fontFamily: fonts.body, color: colors.muted, marginTop: 3, fontSize: 16 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontFamily: fonts.display, fontSize: 23, fontWeight: '500', color: colors.ink },
  statLabel: { fontFamily: fonts.sub, fontSize: 15, color: colors.muted, marginTop: 3 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.chartGrid,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.body, color: colors.ink, fontWeight: '700', fontSize: 14.5 },
  rowSub: {
    fontFamily: fonts.sub,
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: { fontFamily: fonts.sub, color: colors.muted, fontSize: 18, marginLeft: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 40, 45, 0.55)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    fontWeight: '500',
  },
  modalSub: {
    fontFamily: fonts.sub,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.sageSoft,
  },
  modalOptionOn: {
    backgroundColor: colors.pine,
  },
  modalOptionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  modalOptionTextOn: {
    color: colors.onBg,
  },
});
