import React, { useCallback, useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompareSlider } from '../src/components/CompareSlider';
import { Btn, Card, IconBtn, Screen, Seg, Switch, Title } from '../src/components/ui';
import { api } from '../src/lib/api';
import { formatPhotoLabel } from '../src/lib/photoLabels';
import { notify } from '../src/lib/notify';
import { colors, fonts } from '../src/theme';

export default function ComparePhotosScreen() {
  const params = useLocalSearchParams<{ beforeId?: string; afterId?: string }>();
  const [photos, setPhotos] = useState<any[]>([]);
  const [beforeId, setBeforeId] = useState<string | null>(params.beforeId || null);
  const [afterId, setAfterId] = useState<string | null>(params.afterId || null);
  const [assignSide, setAssignSide] = useState<'before' | 'after'>('before');
  const [shareOn, setShareOn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.getPhotos();
      const list = r.photos || [];
      setPhotos(list);
      setBeforeId((prev) => prev || params.beforeId || (list.length ? list[list.length - 1].id : null));
      setAfterId((prev) => prev || params.afterId || (list.length ? list[0].id : null));
    } catch (e) {
      console.warn(e);
    }
  }, [params.afterId, params.beforeId]);

  useEffect(() => {
    load();
  }, [load]);

  const before = photos.find((p) => p.id === beforeId);
  const after = photos.find((p) => p.id === afterId);

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

  return (
    <Screen tab="progress">
      <SafeAreaView style={styles.safe}>
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
            <IconBtn onPress={() => router.back()}>
              <Text style={styles.back}>‹</Text>
            </IconBtn>
            <Title>Compare</Title>
            <View style={{ width: 36 }} />
          </View>

          {before?.url && after?.url ? (
            <>
              <CompareSlider
                before={{ uri: before.url }}
                after={{ uri: after.url }}
                height={300}
                leftLabel={`Before · ${formatPhotoLabel(before)}`}
                rightLabel={`After · ${formatPhotoLabel(after)}`}
              />
              <Text style={styles.hint}>Drag to compare</Text>
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
              <View style={styles.emptyCompare} />
              <Text style={styles.hint}>Add at least two photos to compare.</Text>
            </>
          )}

          <View style={styles.thumbs}>
            {photos.map((p) => {
              const isBefore = p.id === beforeId;
              const isAfter = p.id === afterId;
              const sel = isBefore || isAfter;
              const label = formatPhotoLabel(p).split(',')[0]?.trim() || '';
              return (
                <Pressable key={p.id} onPress={() => pickThumb(p.id)} style={styles.thumbWrap}>
                  <View style={[styles.thumbFrame, sel && styles.thumbSel]}>
                    <Image source={{ uri: p.url }} style={styles.thumbImg} />
                    <Text style={styles.thumbOverlay} numberOfLines={1}>
                      {label}
                    </Text>
                    {isBefore || isAfter ? (
                      <View style={styles.sideBadge}>
                        <Text style={styles.sideBadgeText}>{isBefore ? 'B' : 'A'}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Pressable style={styles.thumbAdd} onPress={() => router.push('/add-progress-photo')}>
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

          {before?.url && after?.url ? (
            <Btn
              title="Save comparison"
              style={{ marginTop: 12 }}
              onPress={() => {
                notify('Comparison saved', 'Your before and after photos are set.');
                router.back();
              }}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  scroll: { paddingBottom: Platform.OS === 'web' ? 40 : 120 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  emptyCompare: {
    height: 300,
    borderRadius: 20,
    backgroundColor: colors.sandDeep,
  },
  hint: {
    fontFamily: fonts.sub,
    color: colors.onBgMuted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
    fontSize: 12,
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
    color: colors.onBgMuted,
    textAlign: 'center',
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: { fontFamily: fonts.sub, fontSize: 14.5, color: colors.ink, fontWeight: '700' },
  meta: { fontFamily: fonts.sub, fontSize: 12, color: colors.muted, marginTop: 2 },
});
