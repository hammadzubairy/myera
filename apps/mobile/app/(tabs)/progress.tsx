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
  lbToKg,
  type ChartRange,
  type Units,
  weightUnitLabel,
} from '@myera/shared';
import { brand } from '../../src/assets/brand';
import { Btn, Card, Screen, Seg, Switch } from '../../src/components/ui';
import { CompareSlider } from '../../src/components/CompareSlider';
import { WeightChart } from '../../src/components/WeightChart';
import { api, uploadImage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { beginEditImageSession } from '../../src/lib/editImageSession';
import { formatPhotoLabel } from '../../src/lib/photoLabels';
import { notify } from '../../src/lib/notify';
import { runTabFocusLoad } from '../../src/lib/tabFocus';
import { colors, fonts } from '../../src/theme';

const DEMO_THUMBS = [
  brand.before3,
  brand.before2,
  brand.before1,
  brand.after1,
  brand.after2,
  brand.after3,
] as const;

export default function ProgressScreen() {
  const { profile } = useAuth();
  const units: Units = profile?.units === 'kg_cm' ? 'kg_cm' : 'lb_in';
  const wUnit = weightUnitLabel(units);
  const [seg, setSeg] = useState<'weight' | 'measurements' | 'photos'>('weight');
  const [range, setRange] = useState<ChartRange>('2m');
  const [chart, setChart] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [assignSide, setAssignSide] = useState<'before' | 'after'>('before');
  const [shareOn, setShareOn] = useState(false);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [c, m, p] = await Promise.all([
        api.getWeightChart(range),
        api.getMeasurementSummary(),
        api.getPhotos(),
      ]);
      setChart(c);
      setMeasurements(m.measurements || []);
      const list = p.photos || [];
      setPhotos(list);
      setBeforeId((prev) => prev || (list.length ? list[list.length - 1].id : null));
      setAfterId((prev) => prev || (list.length ? list[0].id : null));
      hasDataRef.current = true;
    } catch (e) {
      console.warn(e);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      setShareOn(false);
      return runTabFocusLoad(`progress:${range}`, hasDataRef.current, load);
    }, [load, range])
  );

  const before = photos.find((p) => p.id === beforeId);
  const after = photos.find((p) => p.id === afterId);

  const deltaLabel = (() => {
    if (chart?.delta_lb == null) return '';
    const n = Number(chart.delta_lb);
    const converted = units === 'kg_cm' ? lbToKg(n) : n;
    const sign = converted > 0 ? '+' : '−';
    const abs = Math.abs(converted).toFixed(1);
    if (range === '1m') return `${sign}${abs} ${wUnit} in the last month`;
    if (range === '2m') return `${sign}${abs} ${wUnit} in the last 2 months`;
    return `${sign}${abs} ${wUnit} since start`;
  })();

  // Weight tile on the Measurements tab
  const weightPoints: any[] = chart?.points || [];
  const lastWeighIn: string | null = weightPoints.length
    ? weightPoints[weightPoints.length - 1].logged_on
    : null;
  const weightChange = (() => {
    if (chart?.delta_lb == null || weightPoints.length < 2) return null;
    const n = Number(chart.delta_lb);
    return units === 'kg_cm' ? lbToKg(n) : n;
  })();
  const weightRangeLabel =
    range === 'all' ? 'Since first log' : range === '1m' ? 'Last month' : 'Last 2 months';

  function pickThumb(id: string) {
    if (assignSide === 'before') {
      if (id === beforeId) return;
      if (id === afterId) {
        setAfterId(beforeId);
        setBeforeId(id);
        return;
      }
      setBeforeId(id);
      return;
    }
    if (id === afterId) return;
    if (id === beforeId) {
      setBeforeId(afterId);
      setAfterId(id);
      return;
    }
    setAfterId(id);
  }

  async function recropPhoto(p: { id: string; url: string }) {
    const pending = beginEditImageSession();
    router.push({
      pathname: '/edit-image' as any,
      params: { uri: p.url },
    });
    const result = await pending;
    if (!result) return;
    try {
      const up = await uploadImage(result.uri, 'myera/progress', result.base64, result.mimeType);
      const { photo } = await api.updatePhoto(p.id, { url: up.url, public_id: up.publicId });
      setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...photo } : x)));
      notify('Photo updated', 'Crop saved.');
    } catch (e: any) {
      notify('Could not update photo', e.message || String(e));
    }
  }

  return (
    <Screen>
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
              tintColor={colors.pine}
            />
          }
        >
          <View style={styles.top}>
            <Text style={styles.title}>Progress</Text>
          </View>

          <Seg
            options={[
              { key: 'weight', label: 'Weight' },
              { key: 'measurements', label: 'Measurements' },
              { key: 'photos', label: 'Photos' },
            ]}
            value={seg}
            onChange={(k) => setSeg(k as any)}
          />

          {seg === 'weight' && (
            <Card style={{ marginTop: 2 }}>
              <Text style={styles.big}>
                {formatWeightLb(chart?.latest_weight_lb, units)}
              </Text>
              <Text style={styles.delta}>{deltaLabel}</Text>
              <View style={{ marginVertical: 10 }}>
                <Seg
                  options={[
                    { key: '1m', label: '1M' },
                    { key: '2m', label: '2M' },
                    { key: 'all', label: 'All' },
                  ]}
                  value={range}
                  onChange={(k) => setRange(k as ChartRange)}
                />
              </View>
              <WeightChart
                points={chart?.points || []}
                doseChanges={chart?.dose_changes || []}
              />
              <View style={styles.legend}>
                <View style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: colors.pine }]} />
                  <Text style={styles.legendItem}>Weight</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: colors.gold }]} />
                  <Text style={styles.legendItem}>Dose changed</Text>
                </View>
              </View>
            </Card>
          )}

          {seg === 'measurements' && (
            <Card style={{ marginTop: 2 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.section}>Weight</Text>
                <Text style={styles.meta}>{weightRangeLabel}</Text>
              </View>
              <Pressable
                style={styles.mRow}
                onPress={() => router.push('/log-weight')}
                accessibilityLabel="Log weight"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.mLabel}>Weight</Text>
                  <Text style={styles.meta}>{lastWeighIn ?? 'No weigh-ins yet'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.mVal}>
                    {chart?.latest_weight_lb != null
                      ? formatWeightLb(chart.latest_weight_lb, units)
                      : '—'}
                  </Text>
                  {weightChange != null && (
                    <Text
                      style={[
                        styles.change,
                        { color: weightChange <= 0 ? colors.pineSoft : colors.roseDeep },
                      ]}
                    >
                      {weightChange > 0 ? '+' : '−'}
                      {Math.abs(weightChange).toFixed(1)} {wUnit}
                    </Text>
                  )}
                </View>
              </Pressable>
              <Pressable style={styles.addBtn} onPress={() => router.push('/log-weight')}>
                <Text style={styles.addText}>Log weight</Text>
              </Pressable>
            </Card>
          )}

          {(seg === 'weight' || seg === 'measurements') && (
            <Card style={{ marginTop: 12 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.section}>Measurements</Text>
                <Text style={styles.meta}>Since first log</Text>
              </View>
              {measurements
                .filter((m) => m.latest_value_in != null || m.type.is_system)
                .map((m) => (
                  <View key={m.type.id} style={styles.mRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mLabel}>{m.type.label}</Text>
                      {!m.type.is_system && (
                        <Text style={styles.custom}>Custom, added by you</Text>
                      )}
                      {m.latest_logged_on && (
                        <Text style={styles.meta}>{m.latest_logged_on}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.mVal}>
                        {m.latest_value_in != null ? `${m.latest_value_in} in` : '—'}
                      </Text>
                      {m.change_in != null && (
                        <Text
                          style={[
                            styles.change,
                            { color: m.change_in <= 0 ? colors.pineSoft : colors.roseDeep },
                          ]}
                        >
                          {m.change_in > 0 ? '+' : '−'}
                          {Math.abs(m.change_in).toFixed(1)} in
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              <Pressable style={styles.addBtn} onPress={() => router.push('/add-measurement')}>
                <Text style={styles.addText}>Add a measurement</Text>
              </Pressable>
            </Card>
          )}

          {seg === 'photos' && (
            <View style={{ marginTop: 2 }}>
              {photos.length >= 2 && before?.url && after?.url ? (
                <>
                  <CompareSlider
                    before={{ uri: before.url }}
                    after={{ uri: after.url }}
                    height={300}
                    leftLabel={`Before · ${formatPhotoLabel(before)}`}
                    rightLabel={`After · ${formatPhotoLabel(after)}`}
                  />
                  <Text style={styles.dragHint}>Drag to compare</Text>
                  <View style={styles.assignSeg}>
                    <Seg
                      options={[
                        { key: 'before', label: 'Before' },
                        { key: 'after', label: 'After' },
                      ]}
                      value={assignSide}
                      onChange={(k) => setAssignSide(k as 'before' | 'after')}
                    />
                  </View>
                </>
              ) : (
                <>
                  <CompareSlider
                    before={brand.before3}
                    after={brand.after1}
                    height={300}
                    leftLabel="Before · Jun 1, 221 lb"
                    rightLabel="After · Oct 12, 196.6 lb"
                    badge="Example"
                  />
                  <Text style={styles.dragHint}>
                    Drag to try the slider · add your own photos below
                  </Text>
                </>
              )}

              <View style={styles.thumbs}>
                {photos.length === 0
                  ? DEMO_THUMBS.map((src, i) => (
                      <View key={i} style={styles.thumbWrap}>
                        <View style={[styles.thumbFrame, i < 2 && styles.thumbSel]}>
                          <Image source={src} style={styles.thumbImg} />
                          {i < 2 ? (
                            <Text style={styles.thumbOverlay}>
                              {i === 0 ? 'Jun 1' : 'Oct 12'}
                            </Text>
                          ) : null}
                          {i === 0 ? (
                            <View style={styles.sideBadge}>
                              <Text style={styles.sideBadgeText}>B</Text>
                            </View>
                          ) : null}
                          {i === 1 ? (
                            <View style={styles.sideBadge}>
                              <Text style={styles.sideBadgeText}>A</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    ))
                  : photos.map((p) => {
                      const isBefore = p.id === beforeId;
                      const isAfter = p.id === afterId;
                      const sel = isBefore || isAfter;
                      const label = formatPhotoLabel(p).split(',')[0]?.trim() || '';
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => pickThumb(p.id)}
                          style={styles.thumbWrap}
                        >
                          <View style={[styles.thumbFrame, sel && styles.thumbSel]}>
                            <Image source={{ uri: p.url }} style={styles.thumbImg} />
                            <Text style={styles.thumbOverlay} numberOfLines={1}>
                              {label}
                            </Text>
                            {isBefore || isAfter ? (
                              <View style={styles.sideBadge}>
                                <Text style={styles.sideBadgeText}>
                                  {isBefore ? 'B' : 'A'}
                                </Text>
                              </View>
                            ) : null}
                            <Pressable
                              style={styles.editChip}
                              onPress={() => recropPhoto(p)}
                              hitSlop={6}
                            >
                              <Text style={styles.editChipText}>Edit</Text>
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                <Pressable
                  style={styles.thumbAdd}
                  onPress={() => router.push('/add-progress-photo')}
                >
                  <Text style={styles.thumbAddLabel}>+ Add photo</Text>
                </Pressable>
              </View>

              <Card style={{ marginTop: 12 }}>
                <View style={styles.shareRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.section}>Share to community</Text>
                    <Text style={styles.meta}>Off by default. Only you see your photos.</Text>
                  </View>
                  <Switch
                    value={shareOn}
                    onValueChange={(next) => {
                      setShareOn(next);
                      if (!next) return;
                      if (!before?.url || !after?.url) {
                        setShareOn(false);
                        return;
                      }
                      router.push({
                        pathname: '/new-post',
                        params: {
                          beforeUrl: before.url,
                          afterUrl: after.url,
                          includeBeforeAfter: '1',
                        },
                      });
                    }}
                    label="Share comparison to community"
                  />
                </View>
              </Card>

              {photos.length >= 2 && before?.url && after?.url ? (
                <Btn
                  title="Save comparison"
                  style={{ marginTop: 12 }}
                  onPress={() =>
                    notify('Comparison saved', 'Your before and after photos are set.')
                  }
                />
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 24 : 110 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 14,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.onBg, fontWeight: '500' },
  big: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, fontWeight: '500' },
  delta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4, fontSize: 13 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendItem: { fontFamily: fonts.sub, fontSize: 12, color: colors.muted },
  section: { fontFamily: fonts.sub, fontSize: 14.5, color: colors.ink, fontWeight: '700' },
  meta: { fontFamily: fonts.sub, fontSize: 12, color: colors.muted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.chartGrid,
  },
  mLabel: { fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  custom: { fontFamily: fonts.sub, fontSize: 11, color: colors.gold, marginTop: 2 },
  mVal: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, fontWeight: '500' },
  change: { fontFamily: fonts.sub, fontSize: 12, marginTop: 2 },
  addBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  addText: { fontFamily: fonts.sub, color: colors.pine },
  dragHint: {
    fontFamily: fonts.sub,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  assignSeg: { marginBottom: 12 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  sideBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  sideBadgeText: {
    fontFamily: fonts.sub,
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
  },
  thumbWrap: { flex: 1, minWidth: 0, maxWidth: 118, maxHeight: 156 },
  thumbFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 156,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.sandDeep,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbSel: { borderColor: colors.pine },
  editChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15,61,70,0.82)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editChipText: {
    fontFamily: fonts.sub,
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  thumbOverlay: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    fontFamily: fonts.sub,
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  thumbAdd: {
    flex: 1,
    minWidth: 0,
    maxWidth: 118,
    aspectRatio: 3 / 4,
    maxHeight: 156,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.onBgLine,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  thumbAddLabel: {
    fontFamily: fonts.sub,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
