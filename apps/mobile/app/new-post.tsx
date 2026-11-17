import React, { useCallback, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Card, Screen, Switch } from '../src/components/ui';
import { api, uploadImage } from '../src/lib/api';
import { pickFromLibrary, type PickedImage } from '../src/lib/photos';
import { useAuth } from '../src/lib/auth';
import { notify } from '../src/lib/notify';
import { colors, fonts, radii } from '../src/theme';

const MAX_PHOTOS = 3;

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NewPostScreen() {
  const params = useLocalSearchParams<{
    beforeUrl?: string;
    afterUrl?: string;
    includeBeforeAfter?: string;
  }>();
  const { profile } = useAuth();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [includeWeight, setIncludeWeight] = useState(false);
  const [includeBeforeAfter, setIncludeBeforeAfter] = useState(
    params.includeBeforeAfter === '1'
  );
  const [includeDose, setIncludeDose] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weightSub, setWeightSub] = useState('—');
  const [beforeAfterSub, setBeforeAfterSub] = useState('—');
  const [doseSub, setDoseSub] = useState('—');
  const [baBeforeUrl, setBaBeforeUrl] = useState<string | null>(params.beforeUrl || null);
  const [baAfterUrl, setBaAfterUrl] = useState<string | null>(params.afterUrl || null);
  const [canShareBa, setCanShareBa] = useState(
    Boolean(params.beforeUrl && params.afterUrl)
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const [today, photosRes, regimens] = await Promise.all([
            api.getToday(),
            api.getPhotos(),
            api.getRegimens(),
          ]);
          if (!alive) return;

          const since = formatShortDate(today.profile?.onboarding_completed_at);
          if (today.lb_lost != null) {
            const sign = today.lb_lost >= 0 ? '−' : '+';
            setWeightSub(`${sign}${Math.abs(today.lb_lost)} lb since ${since}`);
          } else {
            setWeightSub(`Since ${since}`);
          }

          const list = (photosRes.photos || []).slice().sort((a: any, b: any) => {
            return String(a.taken_on).localeCompare(String(b.taken_on));
          });
          if (params.beforeUrl && params.afterUrl) {
            setBaBeforeUrl(params.beforeUrl);
            setBaAfterUrl(params.afterUrl);
            setCanShareBa(true);
            setBeforeAfterSub('From your comparison');
          } else if (list.length >= 2) {
            const first = list[0];
            const last = list[list.length - 1];
            setBaBeforeUrl(first.url);
            setBaAfterUrl(last.url);
            setCanShareBa(true);
            setBeforeAfterSub(
              `${formatShortDate(first.taken_on)} → ${formatShortDate(last.taken_on)}`
            );
          } else {
            setBaBeforeUrl(null);
            setBaAfterUrl(null);
            setCanShareBa(false);
            setBeforeAfterSub(
              list.length === 1
                ? 'Need at least 2 progress photos'
                : 'Add progress photos first'
            );
            if (includeBeforeAfter) setIncludeBeforeAfter(false);
          }

          const activeList: any[] =
            (Array.isArray(today.active_doses) && today.active_doses.length
              ? today.active_doses
              : (regimens.regimens || []).filter((r: any) => {
                  const e = r.end_date;
                  return e == null || e === '' || String(e) >= '9000-01-01';
                })) || [];
          if (activeList.length) {
            setDoseSub(
              activeList
                .map((r) =>
                  r.amount_mg != null ? `${Number(r.amount_mg)} mg` : r.medication_name
                )
                .join(' + ')
            );
          }
        } catch (e) {
          console.warn(e);
        }
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function addPhoto() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      notify('Photo limit', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const picked = await pickFromLibrary({ multiple: true, limit: remaining });
    if (!picked.length) return;
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function post() {
    if (!body.trim()) return notify('Post', 'Write something to share.');
    if (includeBeforeAfter && (!baBeforeUrl || !baAfterUrl)) {
      return notify(
        'Before & after',
        'Turn off Before and after, or add at least two progress photos first.'
      );
    }
    try {
      setLoading(true);
      const photo_urls: string[] = [];
      for (const photo of photos.slice(0, MAX_PHOTOS)) {
        const up = await uploadImage(photo.uri, 'myera/posts', photo.base64, photo.mimeType);
        photo_urls.push(up.url);
      }
      await api.createPost({
        body: body.trim(),
        photo_urls,
        include_weight_change: includeWeight,
        include_before_after: includeBeforeAfter && Boolean(baBeforeUrl && baAfterUrl),
        include_dose: includeDose,
        before_url: includeBeforeAfter ? baBeforeUrl : null,
        after_url: includeBeforeAfter ? baAfterUrl : null,
      });
      router.replace('/(tabs)/community');
    } catch (e: any) {
      notify('Could not post', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const communityName = profile?.community?.name || 'your community';

  return (
    <Screen tab="community">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.top}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>New post</Text>
            <Btn
              title="Post"
              size="sm"
              onPress={post}
              loading={loading}
              style={{ alignSelf: 'center', minWidth: 90 }}
            />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Card style={styles.composeCard}>
              <TextInput
                style={styles.input}
                placeholder="Share a win…"
                placeholderTextColor={colors.muted}
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.photoHint}>
                Photos {photos.length}/{MAX_PHOTOS} — only what you pick here is posted
              </Text>
              <View style={styles.thumbRow}>
                {photos.map((photo) => (
                  <Pressable key={photo.uri} onPress={() => removePhoto(photo.uri)}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} />
                    <Text style={styles.removeHint}>Tap to remove</Text>
                  </Pressable>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable
                    style={styles.addThumb}
                    onPress={addPhoto}
                    accessibilityLabel="Add photo"
                  >
                    <Text style={styles.addThumbPlus}>+</Text>
                    <Text style={styles.addThumbLabel}>Add</Text>
                  </Pressable>
                )}
              </View>
            </Card>

            <Card style={styles.progressCard}>
              <Text style={styles.sectionTitle}>Add from your progress</Text>
              <Text style={styles.sectionSub}>
                Optional. Nothing is shared unless you switch it on — and before/after only uses
                photos you already saved in Progress.
              </Text>
              <ToggleRow
                label="Weight change"
                subtitle={weightSub}
                value={includeWeight}
                onValueChange={setIncludeWeight}
              />
              <ToggleRow
                label="Before and after"
                subtitle={beforeAfterSub}
                value={includeBeforeAfter}
                onValueChange={(v) => {
                  if (v && !canShareBa) {
                    notify(
                      'Before & after',
                      'Add at least two progress photos first, or share from Compare.'
                    );
                    return;
                  }
                  setIncludeBeforeAfter(v);
                }}
              />
              <ToggleRow
                label="Current dose"
                subtitle={doseSub}
                value={includeDose}
                onValueChange={setIncludeDose}
                last
              />

              {includeBeforeAfter && baBeforeUrl && baAfterUrl ? (
                <View style={styles.baPreview}>
                  <View style={styles.baCol}>
                    <Text style={styles.baCaption}>Before</Text>
                    <Image source={{ uri: baBeforeUrl }} style={styles.baImg} />
                  </View>
                  <View style={styles.baCol}>
                    <Text style={styles.baCaption}>After</Text>
                    <Image source={{ uri: baAfterUrl }} style={styles.baImg} />
                  </View>
                </View>
              ) : null}
            </Card>

            <Text style={styles.disclaimer}>
              Posting to {communityName}. Only members of this community will see this. Be kind, no
              medical advice. Posts that break the rules can be reported and removed.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  last,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, last && styles.toggleRowLast]}>
      <View style={{ flex: 1, paddingRight: 15 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 15,
  },
  cancel: { fontFamily: fonts.sub, color: colors.onBgMuted, fontSize: 19, fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 25, color: colors.onBg },
  scroll: { paddingBottom: Platform.OS === 'web' ? 160 : 140 },
  composeCard: { padding: 18, marginBottom: 15 },
  input: {
    minHeight: 120,
    fontFamily: fonts.body,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 28,
    padding: 0,
  },
  photoHint: {
    fontFamily: fonts.sub,
    fontSize: 13,
    color: colors.muted,
    marginTop: 10,
  },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  thumb: { width: 80, height: 100, borderRadius: 15, backgroundColor: colors.sandDeep },
  removeHint: {
    fontFamily: fonts.sub,
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  addThumb: {
    width: 80,
    height: 100,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumbPlus: { fontFamily: fonts.sub, fontSize: 28, color: colors.muted, lineHeight: 30 },
  addThumbLabel: { fontFamily: fonts.sub, fontSize: 12, color: colors.muted, marginTop: 2 },
  progressCard: { paddingVertical: 15, paddingHorizontal: 18 },
  sectionTitle: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 19,
    color: colors.ink,
    marginBottom: 3,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
    marginBottom: 5,
    lineHeight: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.chartGrid,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  toggleLabel: { fontFamily: fonts.body, color: colors.ink, fontWeight: '700', fontSize: 18 },
  toggleSub: { fontFamily: fonts.sub, color: colors.muted, fontSize: 15, marginTop: 3 },
  baPreview: { flexDirection: 'row', gap: 10, marginTop: 12 },
  baCol: { flex: 1 },
  baCaption: {
    fontFamily: fonts.sub,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 6,
  },
  baImg: {
    width: '100%',
    height: 125,
    borderRadius: Math.round(radii.field * 1.25),
    backgroundColor: colors.sandDeep,
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.onBgMuted,
    lineHeight: 23,
    marginTop: 18,
  },
});
