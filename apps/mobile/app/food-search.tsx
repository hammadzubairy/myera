import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Screen } from '../src/components/ui';
import { api } from '../src/lib/api';
import { paramStr } from '../src/lib/foodDraft';
import { decodeHtmlEntities } from '../src/lib/text';
import { notify } from '../src/lib/notify';
import { colors, fonts } from '../src/theme';

type FoodHit = {
  code?: string;
  name: string;
  brand?: string | null;
  serving_label?: string;
  calories_per_serving?: number;
  protein_g_per_serving?: number;
  carbs_g_per_serving?: number;
  fat_g_per_serving?: number;
};

function mealTitle(meal: string) {
  if (meal === 'snack' || meal === 'snacks') return 'Add to snacks';
  if (meal === 'breakfast') return 'Add to breakfast';
  if (meal === 'lunch') return 'Add to lunch';
  if (meal === 'dinner') return 'Add to dinner';
  return 'Search food';
}

function Magnifier() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={colors.mealAddMuted} strokeWidth={1.8} />
      <Path
        d="M16.5 16.5L20 20"
        stroke={colors.mealAddMuted}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function FoodSearchScreen() {
  const raw = useLocalSearchParams<{ meal: string; date: string }>();
  const mealRaw = paramStr(raw.meal, 'snack');
  const meal = mealRaw === 'snacks' ? 'snack' : mealRaw;
  const date = paramStr(raw.date, new Date().toISOString().slice(0, 10));
  const title = mealTitle(meal);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodHit | null>(null);
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = q.trim();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await api.searchFood(query);
        if (cancelled) return;
        setResults((r.results || []) as FoodHit[]);
      } catch (e: any) {
        if (cancelled) return;
        setResults([]);
        setError(e?.message || 'Food search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.length < 2 ? 0 : 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const per = useMemo(
    () => ({
      cal: Number(selected?.calories_per_serving) || 0,
      protein: Number(selected?.protein_g_per_serving) || 0,
      carbs: Number(selected?.carbs_g_per_serving) || 0,
      fat: Number(selected?.fat_g_per_serving) || 0,
    }),
    [selected]
  );

  const qty = Math.max(0.5, Number(servings) || 0.5);
  const totals = {
    calories: Math.round(per.cal * qty * 10) / 10,
    protein_g: Math.round(per.protein * qty * 10) / 10,
    carbs_g: Math.round(per.carbs * qty * 10) / 10,
    fat_g: Math.round(per.fat * qty * 10) / 10,
  };

  function selectFood(item: FoodHit) {
    Keyboard.dismiss();
    setSelected({
      ...item,
      name: decodeHtmlEntities(item.name),
      brand: item.brand ? decodeHtmlEntities(item.brand) : item.brand,
    });
    setServings(1);
  }

  function dismissSheet() {
    setSelected(null);
    setServings(1);
  }

  async function commit() {
    if (!selected?.name?.trim()) {
      return notify('Could not add food', 'Pick a food from the list first.');
    }
    try {
      setSaving(true);
      const brand = selected.brand ? decodeHtmlEntities(String(selected.brand)) : '';
      const foodName = decodeHtmlEntities(selected.name);
      await api.createFoodLog({
        logged_on: date,
        meal_type: meal,
        food_name: brand ? `${foodName} (${brand})` : foodName,
        off_code: selected.code || null,
        servings: qty,
        serving_label: selected.serving_label || 'serving',
        ...totals,
      });
      if (router.canDismiss()) {
        router.dismissTo('/(tabs)/food');
      } else {
        router.replace('/(tabs)/food');
      }
    } catch (e: any) {
      notify('Could not add food', e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  const sheetOpen = !!selected;
  const servingLabel = selected?.serving_label || 'serving';

  return (
    <Screen style={{ backgroundColor: colors.mealAddBackdrop }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchWrap}>
          <Magnifier />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            placeholder="Search foods"
            placeholderTextColor={colors.mealAddMuted}
            value={q}
            onChangeText={setQ}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.mealAddAccent} style={{ marginVertical: 10 }} />
        ) : null}

        <View style={[styles.listCard, sheetOpen && styles.listCardWithSheet]}>
          <FlatList
            data={results}
            keyExtractor={(item, index) => String(item.code || item.name || index)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>
                  {error ||
                    (q.trim().length >= 2
                      ? 'No foods with calorie data found.'
                      : 'Suggestions will appear here.')}
                </Text>
              ) : null
            }
            renderItem={({ item, index }) => (
              <Pressable
                style={[styles.row, index > 0 && styles.rowBorder]}
                onPress={() => selectFood(item)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={2}>
                    {decodeHtmlEntities(item.name)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.serving_label || 'serving'},{' '}
                    {Math.round(Number(item.calories_per_serving) || 0)} kcal
                  </Text>
                </View>
                <Pressable
                  style={styles.plusBtn}
                  onPress={() => selectFood(item)}
                  hitSlop={6}
                  accessibilityLabel={`Select ${item.name}`}
                >
                  <Text style={styles.plusText}>+</Text>
                </Pressable>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>

      {sheetOpen ? (
        <KeyboardAvoidingView
          style={styles.sheetRoot}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          pointerEvents="box-none"
        >
          <Pressable style={styles.sheetDismiss} onPress={dismissSheet} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetTitleRow}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <Text style={styles.sheetName} numberOfLines={2}>
                  {selected?.name}
                </Text>
                <Text style={styles.sheetServing}>{servingLabel} per serving</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setServings(Math.max(0.5, Math.round((qty - 0.5) * 10) / 10))}
                >
                  <Text style={styles.stepGlyph}>−</Text>
                </Pressable>
                <Text style={styles.stepVal}>{qty}</Text>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setServings(Math.round((qty + 0.5) * 10) / 10)}
                >
                  <Text style={styles.stepGlyph}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.tiles}>
              <Tile value={String(Math.round(totals.calories))} label="kcal" />
              <Tile value={String(totals.protein_g)} label="protein g" />
              <Tile value={String(totals.carbs_g)} label="carbs g" />
              <Tile value={String(totals.fat_g)} label="fat g" />
            </View>

            <Pressable
              style={[styles.primary, saving && { opacity: 0.6 }]}
              onPress={commit}
              disabled={saving}
            >
              <Text style={styles.primaryText}>{saving ? 'Adding…' : title}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileVal}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.mealAddSheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontFamily: fonts.body,
    fontSize: 28,
    fontWeight: '500',
    color: colors.mealAddInk,
    lineHeight: 30,
    marginTop: -2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 21,
    fontWeight: '700',
    color: colors.onBg,
    marginHorizontal: 8,
  },
  searchWrap: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.mealAddSheet,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.mealAddInk,
    paddingVertical: 0,
  },
  listCard: {
    flex: 1,
    backgroundColor: colors.mealAddListBg,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: Platform.OS === 'web' ? 18 : 24,
  },
  listCardWithSheet: {
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.mealAddHairline,
  },
  rowName: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.mealAddInk,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.mealAddMuted,
    marginTop: 3,
  },
  plusBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.mealAddAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: colors.mealAddSheet,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: -1,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.mealAddMuted,
    textAlign: 'center',
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sheetRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  sheetDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.mealAddSheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 22 : 28,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.mealAddGrabber,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetName: {
    fontFamily: fonts.body,
    fontSize: 21,
    fontWeight: '700',
    color: colors.mealAddInk,
  },
  sheetServing: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.mealAddMuted,
    marginTop: 3,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mealAddStepper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: {
    fontFamily: fonts.body,
    fontSize: 20,
    fontWeight: '600',
    color: colors.mealAddInk,
    lineHeight: 22,
  },
  stepVal: {
    fontFamily: fonts.body,
    fontSize: 21,
    fontWeight: '700',
    color: colors.mealAddInk,
    minWidth: 40,
    textAlign: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.mealAddTile,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileVal: {
    fontFamily: fonts.body,
    fontSize: 21,
    fontWeight: '700',
    color: colors.mealAddInk,
  },
  tileLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.mealAddMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  primary: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.mealAddAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.mealAddSheet,
  },
});
