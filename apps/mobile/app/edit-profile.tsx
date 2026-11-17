import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  cmToIn,
  heightUnitLabel,
  inToCm,
  kgToLb,
  lbToKg,
  type Units,
  weightUnitLabel,
} from '@myera/shared';
import { Btn, Field, IconBtn, Screen, Title } from '../src/components/ui';
import { api, uploadImage } from '../src/lib/api';
import { pickFromLibrary } from '../src/lib/photos';
import { useAuth } from '../src/lib/auth';
import { colors } from '../src/theme';
import { notify } from '../src/lib/notify';

export default function EditProfileScreen() {
  const { profile, applyProfile } = useAuth();
  const units: Units = profile?.units === 'kg_cm' ? 'kg_cm' : 'lb_in';
  const wUnit = weightUnitLabel(units);
  const hUnit = heightUnitLabel(units);

  const initialHeight =
    profile?.height_in != null
      ? String(units === 'kg_cm' ? inToCm(Number(profile.height_in)) : Number(profile.height_in))
      : '';
  const initialStart =
    profile?.start_weight_lb != null
      ? String(
          units === 'kg_cm'
            ? lbToKg(Number(profile.start_weight_lb))
            : Number(profile.start_weight_lb)
        )
      : '';
  const initialGoal =
    profile?.goal_weight_lb != null
      ? String(
          units === 'kg_cm' ? lbToKg(Number(profile.goal_weight_lb)) : Number(profile.goal_weight_lb)
        )
      : '';

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [startWeight, setStartWeight] = useState(initialStart);
  const [goal, setGoal] = useState(initialGoal);
  const [height, setHeight] = useState(initialHeight);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photo64, setPhoto64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickPhoto() {
    const [picked] = await pickFromLibrary({ aspect: [1, 1] });
    if (!picked) return;
    setPhotoUri(picked.uri);
    setPhoto64(picked.base64);
    setPhotoMime(picked.mimeType);
  }

  async function save() {
    try {
      setLoading(true);
      const heightNum = height.trim() ? Number(height) : NaN;
      const startNum = startWeight.trim() ? Number(startWeight) : NaN;
      const goalNum = goal.trim() ? Number(goal) : NaN;
      const body: any = {
        full_name: fullName.trim(),
        height_in: Number.isFinite(heightNum)
          ? units === 'kg_cm'
            ? cmToIn(heightNum)
            : heightNum
          : undefined,
        start_weight_lb: Number.isFinite(startNum)
          ? units === 'kg_cm'
            ? kgToLb(startNum)
            : startNum
          : undefined,
        goal_weight_lb: goal.trim()
          ? Number.isFinite(goalNum)
            ? units === 'kg_cm'
              ? kgToLb(goalNum)
              : goalNum
            : null
          : null,
      };
      if (photoUri) {
        const up = await uploadImage(photoUri, 'myera/profiles', photo64, photoMime);
        body.photo_url = up.url;
        body.photo_public_id = up.publicId;
      }
      const { profile: next } = await api.updateProfile(body);
      applyProfile(next);
      router.back();
    } catch (e: any) {
      notify('Update failed', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen tab="me">
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.top}>
              <IconBtn onPress={() => router.back()}>
                <Text style={styles.back}>‹</Text>
              </IconBtn>
              <Title>Edit profile</Title>
              <View style={{ width: 36 }} />
            </View>
            <View style={styles.photoRow}>
              <View style={styles.avatar}>
                {(photoUri || profile?.photo_url) && (
                  <Image
                    source={{ uri: photoUri || profile.photo_url }}
                    style={styles.avatarImg}
                  />
                )}
              </View>
              <Btn title="Change photo" variant="ghost" size="sm" onPress={pickPhoto} />
            </View>
            <View style={styles.form}>
              <Field label="Full name" value={fullName} onChangeText={setFullName} />
              <Field
                label={`Height (${hUnit})`}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />
              <Field
                label={`Start weight (${wUnit})`}
                value={startWeight}
                onChangeText={setStartWeight}
                keyboardType="decimal-pad"
              />
              <Field
                label={`Goal weight (${wUnit})`}
                value={goal}
                onChangeText={setGoal}
                keyboardType="decimal-pad"
              />
              <Btn title="Save" onPress={save} loading={loading} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  scroll: { paddingBottom: 32 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.sageSoft,
    overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72 },
  form: { gap: 14 },
});
