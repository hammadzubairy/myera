import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MealType } from '@myera/shared';
import { Screen } from '../../src/components/ui';
import { CalorieRing } from '../../src/components/CalorieRing';
import { api } from '../../src/lib/api';
import { notify } from '../../src/lib/notify';
import { decodeHtmlEntities } from '../../src/lib/text';
import { runTabFocusLoad } from '../../src/lib/tabFocus';
import { fluidEase } from '../../src/components/motion';
import { colors, fonts } from '../../src/theme';

const MEALS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export default function FoodScreen() {
  const [day, setDay] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const date = new Date().toISOString().slice(0, 10);
  const dayRef = useRef(day);
  dayRef.current = day;

  const load = useCallback(async () => {
    try {
      const r = await api.getFoodDay(date);
      setDay(r.day);
    } catch (e) {
      console.warn(e);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      return runTabFocusLoad('food', !!dayRef.current, load);
    }, [load])
  );

  const goal = day?.calorie_goal_kcal ?? 1600;
  const eaten = day?.calories_eaten ?? 0;
  const left = Math.max(0, goal - eaten);
  const pct = goal > 0 ? Math.min(1, Math.max(0, eaten / goal)) : 0;
  const logs: any[] = day?.logs || [];

  const proteinGoal = 110;
  const carbsGoal = 150;
  const fatGoal = 55;
  const protein = day?.protein_g ?? 0;
  const carbs = day?.carbs_g ?? 0;
  const fat = day?.fat_g ?? 0;

  async function removeLog(id: string) {
    try {
      await api.deleteFoodLog(id);
      await load();
    } catch (e: any) {
      notify('Could not remove', e.message || String(e));
    }
  }

  function confirmRemove(id: string, name: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Remove ${name}?`)) removeLog(id);
      return;
    }
    Alert.alert('Remove food', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLog(id) },
    ]);
  }

  function openAdd(meal: MealType) {
    router.push({
      pathname: '/food-search',
      params: { meal, date },
    });
  }

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
              tintColor={colors.foodAccent}
            />
          }
        >
          <View style={styles.top}>
            <Text style={styles.title}>Food</Text>
            <Pressable
              onPress={() => router.push('/calorie-goal')}
              hitSlop={8}
              style={styles.todayPill}
              accessibilityLabel="Today"
            >
              <Text style={styles.todayPillText}>Today</Text>
            </Pressable>
          </View>

          <View style={styles.calCard}>
            <View style={styles.calRow}>
              <CalorieRing left={left} progress={pct} />
              <View style={styles.macroCol}>
                <MacroBar label="Protein" value={protein} goal={proteinGoal} color={colors.foodAccent} />
                <MacroBar label="Carbs" value={carbs} goal={carbsGoal} color={colors.foodGold} />
                <MacroBar label="Fat" value={fat} goal={fatGoal} color={colors.foodAccent} last />
              </View>
            </View>
          </View>

          {MEALS.map((meal) => {
            const items = logs.filter((l) => l.meal_type === meal.key);
            const mealCal = Math.round(items.reduce((s, i) => s + Number(i.calories), 0));
            return (
              <View key={meal.key} style={styles.mealCard}>
                <Pressable
                  style={styles.mealHeader}
                  onPress={() => openAdd(meal.key)}
                  accessibilityLabel={`Add food to ${meal.label}`}
                >
                  <Text style={styles.mealTitle}>{meal.label}</Text>
                  <Text style={styles.mealCal}>{mealCal} kcal</Text>
                </Pressable>
                {items.map((item, index) => (
                  <Pressable
                    key={item.id}
                    style={[styles.itemRow, index > 0 && styles.itemRowBorder]}
                    onLongPress={() =>
                      confirmRemove(item.id, decodeHtmlEntities(item.food_name))
                    }
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.itemName}>
                        {decodeHtmlEntities(item.food_name)}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {item.servings} × {item.serving_label}
                      </Text>
                    </View>
                    <Text style={styles.itemCal}>{Math.round(Number(item.calories))}</Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
          <Text style={styles.hint}>Long-press an item to remove it.</Text>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
  last,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  last?: boolean;
}) {
  const w = Math.min(100, (value / Math.max(goal, 1)) * 100);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(w, { duration: 640, easing: fluidEase });
  }, [fill, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));
  return (
    <View style={{ marginBottom: last ? 0 : 19 }}>
      <View style={styles.macroHead}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroVal}>
          <Text style={styles.macroValInk}>{Math.round(value)} / </Text>
          <Text style={styles.macroValMuted}>{goal} g</Text>
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <Animated.View style={[styles.macroFill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 23,
    paddingBottom: Platform.OS === 'web' ? 150 : 180,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 36,
    fontWeight: '700',
    color: colors.onBg,
  },
  todayPill: {
    backgroundColor: colors.foodTodayPill,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  todayPillText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.todayPillText,
  },
  calCard: {
    backgroundColor: colors.todayCard,
    borderRadius: 25,
    paddingVertical: 23,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  calRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  macroCol: { flex: 1 },
  macroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  macroLabel: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.todayInk,
  },
  macroVal: { fontFamily: fonts.body, fontSize: 16 },
  macroValInk: { color: colors.todayInk, fontWeight: '600' },
  macroValMuted: { color: colors.todayMuted },
  macroTrack: {
    height: 8,
    backgroundColor: colors.foodTrack,
    borderRadius: 999,
    overflow: 'hidden',
  },
  macroFill: { height: 8, borderRadius: 999 },
  mealCard: {
    backgroundColor: colors.todayCard,
    borderRadius: 25,
    paddingVertical: 20,
    paddingHorizontal: 23,
    marginBottom: 15,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  mealTitle: {
    fontFamily: fonts.body,
    fontSize: 21,
    color: colors.todayInk,
    fontWeight: '700',
  },
  mealCal: {
    fontFamily: fonts.body,
    fontWeight: '500',
    fontSize: 18,
    color: colors.todayMuted,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    paddingVertical: 16,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.foodDivider,
  },
  itemName: {
    fontFamily: fonts.body,
    color: colors.todayInk,
    fontSize: 19,
    fontWeight: '600',
  },
  itemMeta: {
    fontFamily: fonts.body,
    color: colors.todayMuted,
    fontSize: 16,
    marginTop: 3,
  },
  itemCal: {
    fontFamily: fonts.body,
    color: colors.todayInk,
    fontSize: 18,
    fontWeight: '500',
    marginTop: 1,
  },
  hint: {
    fontFamily: fonts.body,
    color: colors.onBgMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
});
