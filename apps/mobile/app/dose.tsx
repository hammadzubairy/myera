import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '../src/components/ui';
import { api } from '../src/lib/api';
import { confirmAsync, notify } from '../src/lib/notify';
import { colors, fonts } from '../src/theme';
import { isActiveDoseEndDate } from '@myera/shared';

function formatRange(start: string, end: string | null) {
  if (isActiveDoseEndDate(end)) return `${formatShort(start)} to now`;
  return `${formatShort(start)} to ${formatShort(end!)}`;
}

function formatShort(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DoseScreen() {
  const [regimens, setRegimens] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([api.getRegimens(), api.getDoseLogs()]);
    setRegimens(r.regimens || []);
    setLogs(l.logs || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(console.warn);
    }, [load])
  );

  const active = regimens.filter((r) => isActiveDoseEndDate(r.end_date));
  const medById = new Map(regimens.map((r) => [r.id, r.medication_name as string]));

  async function stop(r: any) {
    const ok = await confirmAsync(
      'Stop this dose?',
      `${r.medication_name} ${Number(r.amount_mg)} mg will close with today's date in your history.`,
      'Stop',
      true
    );
    if (!ok) return;
    try {
      await api.stopRegimen(r.id);
      await load();
    } catch (e: any) {
      notify('Could not stop dose', e.message || String(e));
    }
  }

  return (
    <Screen style={{ backgroundColor: colors.todayBg }} tab="today">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.todayAccent}
            />
          }
        >
          <View style={styles.top}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityLabel="Back"
            >
              <Text style={styles.backChev}>‹</Text>
            </Pressable>
            <Text style={styles.title}>Dose</Text>
            <View style={styles.backBtnGhost} />
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>You're on</Text>
            {active.length === 0 ? (
              <>
                <View style={styles.amountRow}>
                  <View style={styles.amountInline}>
                    <Text style={styles.amountEmpty}>—</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  No active dose yet. Add your medication to start tracking.
                </Text>
              </>
            ) : (
              active.map((r, i) => (
                <View key={r.id} style={[styles.activeRow, i > 0 && styles.activeRowDivider]}>
                  <View style={styles.amountRow}>
                    <View style={styles.amountInline}>
                      <Text style={[styles.amount, active.length > 1 && styles.amountSmall]}>
                        {Number(r.amount_mg)}
                      </Text>
                      <Text style={styles.unit}>mg</Text>
                    </View>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>Since {formatShort(r.start_date)}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>{r.medication_name}, once a week</Text>
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.btnPrimary}
                      onPress={() =>
                        router.push({ pathname: '/log-dose', params: { id: r.id } })
                      }
                      accessibilityLabel={`Log ${r.medication_name}`}
                    >
                      <Text style={styles.btnPrimaryText}>Log</Text>
                    </Pressable>
                    <Pressable
                      style={styles.btnGhost}
                      onPress={() =>
                        router.push({ pathname: '/change-dose', params: { id: r.id } })
                      }
                      accessibilityLabel={`Change ${r.medication_name} dose`}
                    >
                      <Text style={styles.btnGhostText}>Change</Text>
                    </Pressable>
                    <Pressable
                      style={styles.btnGhost}
                      onPress={() => stop(r)}
                      accessibilityLabel={`Stop ${r.medication_name}`}
                    >
                      <Text style={styles.btnGhostText}>Stop</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
            <Pressable
              style={[active.length ? styles.btnAdd : styles.btnPrimaryFull]}
              onPress={() => router.push('/change-dose')}
              accessibilityLabel={active.length ? 'Add another dose' : 'Add dose'}
            >
              <Text style={active.length ? styles.btnAddText : styles.btnPrimaryText}>
                {active.length ? '+ Add another dose' : 'Add dose'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Dose history</Text>
            {regimens.length === 0 ? (
              <Text style={styles.meta}>
                Changes will appear here with start and end dates.
              </Text>
            ) : (
              <View style={styles.timeline}>
                {regimens.length > 1 ? <View style={styles.timelineRail} /> : null}
                {regimens.map((r) => {
                  const isCurrent = isActiveDoseEndDate(r.end_date);
                  return (
                    <View key={r.id} style={styles.histRow}>
                      <View style={styles.markerCol}>
                        <View
                          style={[styles.marker, isCurrent ? styles.markerOn : styles.markerOff]}
                        />
                      </View>
                      <View style={styles.histText}>
                        <Text style={styles.histAmt}>
                          {Number(r.amount_mg)} mg
                          <Text style={styles.histMed}> · {r.medication_name}</Text>
                        </Text>
                        <Text style={styles.histRange}>
                          {formatRange(r.start_date, r.end_date)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Recent logs</Text>
            {logs.length === 0 ? <Text style={styles.meta}>No logs yet.</Text> : null}
            {logs.slice(0, 10).map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.logDate}>{formatShort(log.logged_on)}</Text>
                  {log.regimen_id && medById.get(log.regimen_id) ? (
                    <Text style={styles.logMed} numberOfLines={1}>
                      {medById.get(log.regimen_id)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.logAmt}>{Number(log.amount_mg)} mg ✓</Text>
              </View>
            ))}
            <Text style={styles.disclaimer}>
              This log is for your own records. Always follow your provider's instructions for your
              dose.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const MARKER = 12;
const ROW_H = 50;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'web' ? 120 : 145,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
    height: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.todayCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnGhost: { width: 40, height: 40 },
  backChev: {
    fontSize: 28,
    color: colors.todayInk,
    lineHeight: 30,
    marginTop: -2,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 27,
    fontWeight: '700',
    color: colors.onBg,
  },
  card: {
    backgroundColor: colors.todayCard,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 14,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
  },
  amountInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  amount: {
    fontFamily: fonts.body,
    fontSize: 42,
    fontWeight: '700',
    color: colors.todayInk,
    letterSpacing: -0.5,
  },
  amountEmpty: {
    fontFamily: fonts.body,
    fontSize: 42,
    fontWeight: '700',
    color: colors.todayMuted,
  },
  unit: {
    fontFamily: fonts.body,
    fontSize: 19,
    fontWeight: '600',
    color: colors.todayInk,
  },
  pill: {
    backgroundColor: colors.dosePillBg,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.dosePillText,
  },
  meta: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onBeige,
  },
  btnPrimaryFull: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  btnAdd: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.doseBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  btnAddText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.todayAccent,
  },
  activeRow: {
    paddingBottom: 4,
  },
  activeRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.doseRail,
    marginTop: 16,
    paddingTop: 14,
  },
  amountSmall: {
    fontSize: 32,
  },
  histMed: {
    fontWeight: '500',
    color: colors.todayMuted,
  },
  logMed: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.todayMuted,
    marginTop: 2,
  },
  btnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.todayCard,
    borderWidth: 1,
    borderColor: colors.doseBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.todayInk,
  },
  section: {
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '700',
    color: colors.todayInk,
    marginBottom: 14,
  },
  timeline: {
    position: 'relative',
    paddingLeft: 0,
  },
  timelineRail: {
    position: 'absolute',
    left: MARKER / 2 - 0.75,
    top: MARKER / 2 + 4,
    bottom: ROW_H / 2,
    width: 1.5,
    backgroundColor: colors.doseRail,
    zIndex: 0,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: ROW_H,
    gap: 14,
    zIndex: 1,
  },
  markerCol: {
    width: MARKER,
    alignItems: 'center',
    paddingTop: 4,
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
  },
  markerOn: {
    backgroundColor: colors.doseAmber,
    borderWidth: 0,
  },
  markerOff: {
    backgroundColor: colors.todayCard,
    borderWidth: 1.5,
    borderColor: colors.doseHollow,
  },
  histText: { flex: 1, paddingBottom: 12 },
  histAmt: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.todayInk,
  },
  histRange: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.todayMuted,
    marginTop: 2,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  logDate: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.todayInk,
  },
  logAmt: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.todayInk,
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.todayMuted,
    marginTop: 12,
    lineHeight: 18,
  },
});
