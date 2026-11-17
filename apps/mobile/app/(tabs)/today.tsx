import React, { useCallback, useRef, useState } from 'react';
import {
  Image,
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
import {
  formatWeightLb,
  greetingForHour,
  lbToKg,
  weightUnitLabel,
  type Units,
} from '@myera/shared';
import { Card, Screen } from '../../src/components/ui';
import { ProgressRing } from '../../src/components/ProgressRing';
import { QuickIcon } from '../../src/components/QuickIcons';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { runTabFocusLoad } from '../../src/lib/tabFocus';
import { colors, fonts } from '../../src/theme';

const QUICK: { label: 'Weight' | 'Meal' | 'Photo' | 'Post win'; href: string }[] = [
  { label: 'Weight', href: '/log-weight' },
  { label: 'Meal', href: '/(tabs)/food' },
  { label: 'Photo', href: '/add-progress-photo' },
  { label: 'Post win', href: '/new-post' },
];

export default function TodayScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      const t = await api.getToday();
      setData(t);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return runTabFocusLoad('today', !!dataRef.current, load);
    }, [load])
  );

  const firstName = (data?.profile?.full_name || profile?.full_name || 'there').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = greetingForHour(hour, firstName);
  const units: Units =
    (data?.profile?.units || profile?.units) === 'kg_cm' ? 'kg_cm' : 'lb_in';
  const wUnit = weightUnitLabel(units);
  const current = data?.profile?.current_weight_lb;
  const goal = data?.profile?.goal_weight_lb;
  const start = data?.profile?.start_weight_lb;
  const progress =
    start != null && goal != null && start !== goal
      ? Math.min(1, Math.max(0, (start - (current ?? start)) / (start - goal)))
      : 0;
  const lbLost = data?.lb_lost ?? null;
  const lostDisplay =
    lbLost == null ? null : units === 'kg_cm' ? lbToKg(Number(lbLost)) : Number(lbLost);
  const toGoDisplay =
    data?.to_go_lb == null
      ? null
      : units === 'kg_cm'
        ? lbToKg(Number(data.to_go_lb))
        : Number(data.to_go_lb);
  const doses: any[] = Array.isArray(data?.active_doses)
    ? data.active_doses
    : data?.active_dose
      ? [data.active_dose]
      : [];
  const dose = doses[0] ?? null;
  const multiDose = doses.length > 1;
  const goalKcal = data?.calorie_goal_kcal ?? 1600;
  const eaten = data?.calories_eaten ?? 0;
  const foodPct = Math.min(100, (eaten / goalKcal) * 100);
  const doseBadge = data?.next_shot_label || null;
  const medSchedule =
    dose?.medication_name != null ? `${dose.medication_name}, weekly` : null;
  const photoUrl = data?.profile?.photo_url || profile?.photo_url || null;

  return (
    <Screen style={{ backgroundColor: colors.todayBg }}>
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
              tintColor={colors.todayHero}
            />
          }
        >
          <View style={styles.top}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.week}>
                {data?.week_number ? `Week ${data.week_number} of your era` : 'Your era'}
              </Text>
              <Text style={styles.hello} numberOfLines={1}>
                {greeting}
              </Text>
            </View>
            <Pressable
              style={styles.avatar}
              onPress={() => router.push('/(tabs)/me')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              hitSlop={8}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFill} />
              )}
            </Pressable>
          </View>

          <View style={styles.hero}>
            <ProgressRing
              lbLost={lostDisplay}
              progress={progress}
              unitLabel={`${wUnit} lost`}
              valueColor={colors.todayInk}
              labelColor={colors.todayMuted}
            />
            <View style={styles.stats}>
              <View style={styles.statPair}>
                <Text style={styles.statLabel}>Now</Text>
                <Text style={styles.statVal}>{formatWeightLb(current, units)}</Text>
              </View>
              <View style={styles.statPair}>
                <Text style={styles.statLabel}>Goal</Text>
                <Text style={styles.statVal}>{formatWeightLb(goal, units)}</Text>
              </View>
              <View style={styles.statPair}>
                <Text style={styles.statLabel}>To go</Text>
                <Text style={styles.statVal}>
                  {toGoDisplay != null ? `${toGoDisplay} ${wUnit}` : '—'}
                </Text>
              </View>
            </View>
          </View>

          <Card style={styles.doseCard}>
            <Pressable
              onPress={() => router.push('/dose')}
              accessibilityLabel="Open dose"
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Current dose</Text>
                {dose && doseBadge ? (
                  <View style={styles.dosePill}>
                    <Text style={styles.dosePillText}>{doseBadge}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
            {multiDose ? (
              <>
                <Pressable
                  onPress={() => router.push('/dose')}
                  accessibilityLabel="Open dose details"
                  style={styles.doseList}
                >
                  {doses.map((d, i) => (
                    <View
                      key={d.id}
                      style={[styles.doseListRow, i > 0 && styles.doseListDivider]}
                    >
                      <Text style={styles.doseAmtSmall}>
                        {Number(d.amount_mg)}
                        <Text style={styles.doseUnitSmall}> mg</Text>
                      </Text>
                      <Text style={styles.doseListMeta} numberOfLines={1}>
                        {d.medication_name}, weekly
                      </Text>
                    </View>
                  ))}
                </Pressable>
                <Pressable
                  style={[styles.doseBtn, styles.doseBtnFull]}
                  onPress={() => router.push('/log-dose')}
                  accessibilityLabel="Log dose"
                >
                  <Text style={styles.doseBtnText}>Log dose</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.doseRow}>
                <Pressable
                  style={styles.doseLeft}
                  onPress={() => router.push('/dose')}
                  accessibilityLabel="Open dose details"
                >
                  {dose ? (
                    <>
                      <Text style={styles.doseAmt}>
                        {Number(dose.amount_mg)}
                        <Text style={styles.doseUnit}> mg</Text>
                      </Text>
                      {medSchedule ? <Text style={styles.doseMeta}>{medSchedule}</Text> : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.doseAmtEmpty}>—</Text>
                      <Text style={styles.doseMeta} numberOfLines={2}>
                        Add your medication to track weekly shots.
                      </Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={styles.doseBtn}
                  onPress={() =>
                    dose
                      ? router.push({ pathname: '/log-dose', params: { id: dose.id } })
                      : router.push('/dose')
                  }
                  accessibilityLabel={dose ? 'Log dose' : 'Add dose'}
                >
                  <Text style={styles.doseBtnText}>{dose ? 'Log dose' : 'Add dose'}</Text>
                </Pressable>
              </View>
            )}
          </Card>

          <Card style={styles.foodCard}>
            <Pressable onPress={() => router.push('/(tabs)/food')}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Today's food</Text>
                <Text style={styles.foodInline}>
                  <Text style={styles.foodInlineBold}>{Math.round(eaten).toLocaleString()}</Text>
                  {` of ${goalKcal.toLocaleString()} kcal`}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${foodPct}%` as any }]} />
              </View>
              <View style={styles.macroRow}>
                <Text style={styles.macroItem}>Protein {data?.protein_g ?? 0} g</Text>
                <Text style={styles.macroItem}>Carbs {data?.carbs_g ?? 0} g</Text>
                <Text style={styles.macroItem}>Fat {data?.fat_g ?? 0} g</Text>
              </View>
            </Pressable>
          </Card>

          <View style={styles.quick}>
            {QUICK.map((q) => (
              <Pressable
                key={q.label}
                style={styles.quickItem}
                onPress={() => router.push(q.href as any)}
              >
                <QuickIcon name={q.label} />
                <Text style={styles.quickLabel}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'web' ? 29 : 145,
    gap: 0,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 7,
    marginBottom: 22,
  },
  week: {
    fontFamily: fonts.body,
    color: colors.onBgMuted,
    fontSize: 16,
    marginBottom: 5,
  },
  hello: {
    fontFamily: fonts.body,
    fontSize: 36,
    fontWeight: '700',
    color: colors.onBg,
    letterSpacing: -0.5,
  },
  avatar: {
    width: 53,
    height: 53,
    borderRadius: 27,
    backgroundColor: colors.sage,
    overflow: 'hidden',
  },
  avatarImg: { width: 53, height: 53 },
  avatarFill: { flex: 1, backgroundColor: colors.sage },
  hero: {
    backgroundColor: colors.todayCream,
    borderRadius: 26,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginBottom: 19,
  },
  stats: { flex: 1, gap: 14, justifyContent: 'center' },
  statPair: { gap: 2 },
  statLabel: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 16,
  },
  statVal: {
    fontFamily: fonts.body,
    color: colors.todayInk,
    fontSize: 25,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  doseCard: {
    backgroundColor: colors.todayCard,
    borderRadius: 29,
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginBottom: 19,
    minHeight: 163,
  },
  dosePill: {
    backgroundColor: colors.todayPillBg,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  dosePillText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.todayPillText,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 14,
  },
  doseLeft: { flex: 1, minWidth: 0, paddingRight: 5 },
  doseAmt: {
    fontFamily: fonts.body,
    fontSize: 43,
    lineHeight: 48,
    color: colors.todayInk,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  doseAmtEmpty: {
    fontFamily: fonts.body,
    fontSize: 43,
    lineHeight: 48,
    color: colors.todayMuted,
    fontWeight: '700',
  },
  doseUnit: { fontSize: 24, fontWeight: '700' },
  doseMeta: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    marginTop: 7,
    fontSize: 17,
    lineHeight: 24,
  },
  doseBtn: {
    height: 53,
    paddingHorizontal: 24,
    borderRadius: 17,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doseBtnFull: {
    marginTop: 16,
    alignSelf: 'stretch',
  },
  doseList: { marginTop: 10 },
  doseListRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 8,
  },
  doseListDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.doseRail,
  },
  doseAmtSmall: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 34,
    color: colors.todayInk,
    fontWeight: '700',
    letterSpacing: -0.4,
    minWidth: 86,
  },
  doseUnitSmall: { fontSize: 17, fontWeight: '700' },
  doseListMeta: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 16,
  },
  doseBtnText: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.onBeige,
  },
  foodCard: {
    backgroundColor: colors.todayCard,
    borderRadius: 29,
    paddingVertical: 22,
    paddingHorizontal: 24,
    marginBottom: 19,
  },
  cardTitle: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 18,
    fontWeight: '600',
  },
  foodInline: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 17,
  },
  foodInlineBold: {
    fontFamily: fonts.body,
    color: colors.todayInk,
    fontSize: 20,
    fontWeight: '700',
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.todayBarTrack,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 17,
    marginBottom: 17,
  },
  barFill: { height: 8, backgroundColor: colors.todayAccent, borderRadius: 999 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 7 },
  macroItem: {
    fontFamily: fonts.body,
    color: colors.todayInk,
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  quick: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  quickItem: {
    flex: 1,
    height: 94,
    backgroundColor: colors.todayCard,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickLabel: {
    fontFamily: fonts.body,
    color: colors.todayInk,
    fontSize: 16,
    fontWeight: '600',
  },
});

