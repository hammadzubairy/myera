import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CommunitySlug, Gender, Units } from '@myera/shared';
import { cmToIn, kgToLb } from '@myera/shared';
import { colors, fonts } from '../../src/theme';
import { KeyboardFormScroll } from '../../src/components/KeyboardFormScroll';
import { api, uploadImage } from '../../src/lib/api';
import { pickFromLibrary } from '../../src/lib/photos';
import { useAuth } from '../../src/lib/auth';
import { registerForPushNotifications } from '../../src/lib/push';
import { notify } from '../../src/lib/notify';

type HeightUnit = 'ft_in' | 'in' | 'cm';
type WeightUnit = 'lb' | 'kg';

const HEIGHT_OPTIONS: { value: HeightUnit; label: string }[] = [
  { value: 'ft_in', label: 'ft + in' },
  { value: 'in', label: 'inches' },
  { value: 'cm', label: 'cm' },
];

const WEIGHT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];

function parseWeight(input: string): number | null {
  const match = input.trim().toLowerCase().match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function unitsFrom(heightUnit: HeightUnit, weightUnit: WeightUnit): Units {
  return heightUnit === 'cm' || weightUnit === 'kg' ? 'kg_cm' : 'lb_in';
}

function UnitDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <Pressable
        style={styles.unitDrop}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} unit`}
      >
        <Text style={styles.unitDropText}>{current}</Text>
        <Text style={styles.unitDropChev}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  style={[styles.modalOption, on && styles.modalOptionOn]}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, on && styles.modalOptionTextOn]}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function CardField({
  label,
  style,
  containerStyle,
  inputRef,
  trailing,
  ...props
}: TextInputProps & {
  label: string;
  containerStyle?: object;
  inputRef?: React.RefObject<TextInput | null>;
  trailing?: React.ReactNode;
}) {
  const localRef = useRef<TextInput>(null);
  const ref = inputRef || localRef;
  return (
    <View style={[styles.cardField, containerStyle]} accessibilityLabel={label}>
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{label}</Text>
        {trailing}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.setupLabel}
        style={[
          styles.cardValue,
          Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null,
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export default function ProfileSetupScreen() {
  const { applyProfile, user } = useAuth();
  const email = user?.email ?? '';
  const [fullName, setFullName] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('ft_in');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightTotalIn, setHeightTotalIn] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [gender] = useState<Gender>('woman');
  const [community] = useState<CommunitySlug>('women');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photo64, setPhoto64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const units = unitsFrom(heightUnit, weightUnit);
  const wUnit = weightUnit;

  function pickHeightUnit(next: HeightUnit) {
    setHeightUnit(next);
    if (next === 'cm') setWeightUnit('kg');
    else setWeightUnit('lb');
  }

  function pickWeightUnit(next: WeightUnit) {
    setWeightUnit(next);
    if (next === 'kg') setHeightUnit('cm');
    else if (heightUnit === 'cm') setHeightUnit('ft_in');
  }

  async function pickPhoto() {
    const [picked] = await pickFromLibrary({ aspect: [1, 1] });
    if (!picked) return;
    setPhotoUri(picked.uri);
    setPhoto64(picked.base64);
    setPhotoMime(picked.mimeType);
  }

  async function finish() {
    setError(null);

    let height_in: number | null = null;
    if (heightUnit === 'cm') {
      const cm = Number(heightCm);
      if (Number.isFinite(cm) && cm >= 91 && cm <= 244) {
        height_in = cmToIn(cm);
      }
    } else if (heightUnit === 'in') {
      const inches = Number(heightTotalIn);
      if (Number.isFinite(inches) && inches >= 36 && inches <= 96) {
        height_in = inches;
      }
    } else {
      const ft = Number(heightFt);
      const inches = Number(heightIn || '0');
      if (
        Number.isFinite(ft) &&
        ft >= 3 &&
        ft <= 8 &&
        Number.isFinite(inches) &&
        inches >= 0 &&
        inches < 12
      ) {
        height_in = ft * 12 + inches;
      }
    }

    const weightEntered = parseWeight(weight);
    const goalEntered = goal.trim() ? parseWeight(goal) : null;
    const current_weight_lb =
      weightEntered == null ? null : weightUnit === 'kg' ? kgToLb(weightEntered) : weightEntered;
    const goal_weight_lb =
      goalEntered == null ? null : weightUnit === 'kg' ? kgToLb(goalEntered) : goalEntered;

    if (!fullName.trim()) {
      setError('Enter your full name.');
      notify('Missing name', 'Enter your full name.');
      return;
    }
    if (height_in == null || height_in < 36 || height_in > 96) {
      const tip =
        heightUnit === 'cm'
          ? 'Enter height in cm (e.g. 168).'
          : heightUnit === 'in'
            ? 'Enter height in inches (e.g. 66).'
            : 'Enter height with feet and inches (e.g. 5 and 6).';
      setError(tip);
      notify('Height', tip);
      return;
    }
    if (!current_weight_lb) {
      setError(`Enter your current weight in ${wUnit}.`);
      notify('Weight', `Enter your current weight in ${wUnit}.`);
      return;
    }
    if (goal.trim() && goal_weight_lb == null) {
      setError(`Goal weight looks invalid. Use a number in ${wUnit}.`);
      notify('Goal weight', `Enter a number in ${wUnit}, or leave blank.`);
      return;
    }

    try {
      setLoading(true);
      let photo_url: string | null = null;
      let photo_public_id: string | null = null;
      if (photoUri) {
        const up = await uploadImage(photoUri, 'myera/profiles', photo64, photoMime);
        photo_url = up.url;
        photo_public_id = up.publicId;
      }

      const { profile } = await api.completeOnboarding({
        full_name: fullName.trim(),
        height_in,
        current_weight_lb,
        goal_weight_lb,
        gender,
        other_gender_text: null,
        community_slug: community,
        photo_url,
        photo_public_id,
      });

      let nextProfile = profile;
      try {
        const patched = await api.updateProfile({ units });
        nextProfile = patched.profile || nextProfile;
      } catch {
        /* units patch is best-effort after onboarding */
      }

      applyProfile(nextProfile);
      registerForPushNotifications().catch(() => undefined);
      router.replace('/(tabs)/today');
    } catch (e: any) {
      const msg = e.message || String(e);
      setError(msg);
      notify('Setup failed', msg);
      console.error('onboarding failed', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardFormScroll
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="on-drag"
        >
            <View style={styles.top}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backBtn}
                accessibilityLabel="Back"
              >
                <Text style={styles.backChev}>‹</Text>
              </Pressable>
              <Text style={styles.step}>Step 2 of 2</Text>
              <View style={styles.backBtnGhost} />
            </View>

            <Text style={styles.h1}>Set up your profile</Text>
            <Text style={styles.body}>
              Height and starting weight help us show your progress. Pick your units from the
              dropdowns — you can change these later in Profile.
            </Text>

            <View style={styles.photoRow}>
              <Pressable onPress={pickPhoto} accessibilityLabel="Profile photo">
                <View style={styles.avatar}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFill} />
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={pickPhoto}
                style={styles.addPhoto}
                accessibilityLabel="Add photo"
              >
                <Text style={styles.addPhotoText}>Add photo</Text>
              </Pressable>
            </View>

            <View style={styles.form}>
              <CardField
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                autoComplete="name"
                accessibilityLabel="Full name"
              />
              <CardField
                label="Email"
                value={email}
                editable={false}
                selectTextOnFocus={false}
                accessibilityLabel="Email"
              />

              {heightUnit === 'ft_in' ? (
                <View style={styles.twoCol}>
                  <CardField
                    label="Height (ft)"
                    value={heightFt}
                    onChangeText={setHeightFt}
                    keyboardType="number-pad"
                    placeholder="5"
                    accessibilityLabel="Height feet"
                    containerStyle={styles.col}
                    trailing={
                      <UnitDropdown
                        label="Height unit"
                        value={heightUnit}
                        options={HEIGHT_OPTIONS}
                        onChange={pickHeightUnit}
                      />
                    }
                  />
                  <CardField
                    label="Height (in)"
                    value={heightIn}
                    onChangeText={setHeightIn}
                    keyboardType="number-pad"
                    placeholder="6"
                    accessibilityLabel="Height inches"
                    containerStyle={styles.col}
                  />
                </View>
              ) : heightUnit === 'in' ? (
                <CardField
                  label="Height"
                  value={heightTotalIn}
                  onChangeText={setHeightTotalIn}
                  keyboardType="decimal-pad"
                  placeholder="66"
                  accessibilityLabel="Height inches"
                  trailing={
                    <UnitDropdown
                      label="Height unit"
                      value={heightUnit}
                      options={HEIGHT_OPTIONS}
                      onChange={pickHeightUnit}
                    />
                  }
                />
              ) : (
                <CardField
                  label="Height"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="168"
                  accessibilityLabel="Height centimeters"
                  trailing={
                    <UnitDropdown
                      label="Height unit"
                      value={heightUnit}
                      options={HEIGHT_OPTIONS}
                      onChange={pickHeightUnit}
                    />
                  }
                />
              )}

              <View style={styles.twoCol}>
                <CardField
                  label="Current weight"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder={weightUnit === 'kg' ? '100' : '221'}
                  accessibilityLabel="Current weight"
                  containerStyle={styles.col}
                  trailing={
                    <UnitDropdown
                      label="Weight unit"
                      value={weightUnit}
                      options={WEIGHT_OPTIONS}
                      onChange={pickWeightUnit}
                    />
                  }
                />
                <CardField
                  label="Goal (optional)"
                  value={goal}
                  onChangeText={setGoal}
                  keyboardType="decimal-pad"
                  placeholder={weightUnit === 'kg' ? '82' : '180'}
                  accessibilityLabel="Goal weight (optional)"
                  containerStyle={styles.col}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={finish}
                disabled={loading}
                style={[styles.cta, loading && { opacity: 0.55 }]}
                accessibilityLabel="Finish setup"
              >
                <Text style={styles.ctaText}>{loading ? 'Saving…' : 'Finish setup'}</Text>
              </Pressable>
            </View>
        </KeyboardFormScroll>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.setupBg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 20,
    height: 48,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.setupSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnGhost: { width: 48, height: 48 },
  backChev: {
    fontSize: 34,
    color: colors.setupInk,
    lineHeight: 36,
    marginTop: -2,
  },
  step: {
    fontFamily: fonts.body,
    color: colors.onBgMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  h1: {
    fontFamily: fonts.body,
    fontSize: 36,
    fontWeight: '700',
    color: colors.onBg,
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.onBgMuted,
    marginTop: 12,
    marginBottom: 18,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.sage,
    overflow: 'hidden',
  },
  avatarFill: {
    flex: 1,
    backgroundColor: colors.sage,
  },
  avatarImg: { width: 76, height: 76 },
  addPhoto: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.setupSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 33, 28, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.setupInk,
  },
  form: { gap: 16, paddingBottom: 8 },
  twoCol: { flexDirection: 'row', gap: 14 },
  col: { flex: 1 },
  cardField: {
    backgroundColor: colors.setupSurface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 86,
    justifyContent: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
    color: colors.setupLabel,
    flexShrink: 1,
  },
  cardValue: {
    fontFamily: fonts.body,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: colors.setupInk,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  unitDrop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 61, 70, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 33, 28, 0.14)',
  },
  unitDropText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.setupInk,
  },
  unitDropChev: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.setupLabel,
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 30, 28, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: colors.setupSurface,
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.setupInk,
    marginBottom: 4,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 61, 70, 0.06)',
  },
  modalOptionOn: { backgroundColor: colors.setupBg },
  modalOptionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.setupInk,
  },
  modalOptionTextOn: { color: colors.onBg },
  cta: {
    marginTop: 6,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.onBeige,
  },
  error: {
    fontFamily: fonts.body,
    color: '#F2B8B0',
    fontSize: 15,
  },
});
