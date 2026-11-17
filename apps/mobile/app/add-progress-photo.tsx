import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, IconBtn, Screen, Title } from '../src/components/ui';
import { KeyboardFormScroll } from '../src/components/KeyboardFormScroll';
import { api, uploadImage } from '../src/lib/api';
import { beginEditImageSession } from '../src/lib/editImageSession';
import { pickFromCamera, pickFromLibrary, type PickedImage } from '../src/lib/photos';
import { notify } from '../src/lib/notify';
import { colors, fonts } from '../src/theme';

export default function AddProgressPhotoScreen() {
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  async function pick(fromCamera: boolean) {
    // Keep the original 3:4 box crop. Edit Image is an extra pass if the frame looks off.
    const picked = fromCamera
      ? await pickFromCamera([3, 4])
      : (await pickFromLibrary({ aspect: [3, 4] }))[0];
    if (picked) setPhoto(picked);
  }

  async function openEditor() {
    if (!photo?.uri) return;
    const pending = beginEditImageSession();
    router.push({
      pathname: '/edit-image' as any,
      params: { uri: photo.uri },
    });
    const result = await pending;
    if (result) setPhoto(result);
  }

  async function save() {
    if (!photo) return notify('Photo', 'Pick a photo first.');
    try {
      setLoading(true);
      const up = await uploadImage(photo.uri, 'myera/progress', photo.base64, photo.mimeType);
      await api.createPhoto({
        taken_on: date,
        url: up.url,
        public_id: up.publicId,
      });
      router.back();
    } catch (e: any) {
      notify('Could not save photo', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen tab="progress">
      <SafeAreaView style={styles.safe}>
        <KeyboardFormScroll contentContainerStyle={styles.scroll}>
          <View style={styles.top}>
            <IconBtn onPress={() => router.back()}>
              <Text style={styles.back}>‹</Text>
            </IconBtn>
            <Title>Add photo</Title>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.preview}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.img} />
            ) : (
              <Text style={styles.placeholder}>Private by default — only you see this.</Text>
            )}
          </View>

          <View style={styles.row}>
            <Btn title="Camera" variant="ghost" size="sm" onPress={() => pick(true)} style={{ flex: 1 }} />
            <Btn title="Gallery" variant="ghost" size="sm" onPress={() => pick(false)} style={{ flex: 1 }} />
          </View>

          {photo ? (
            <Btn title="Edit Image" variant="ghost" onPress={openEditor} />
          ) : null}

          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
          <Btn title="Save photo" onPress={save} loading={loading} disabled={!photo} />
        </KeyboardFormScroll>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  scroll: { paddingBottom: 40, gap: 14 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 6,
  },
  back: { fontSize: 28, color: colors.pine, lineHeight: 30, marginTop: -2 },
  preview: {
    width: '72%',
    alignSelf: 'center',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: colors.sandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  placeholder: {
    fontFamily: fonts.sub,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontSize: 13,
  },
  row: { flexDirection: 'row', gap: 10 },
});
