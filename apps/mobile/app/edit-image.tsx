import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Btn, IconBtn } from '../src/components/ui';
import {
  cancelEditImageSession,
  completeEditImageSession,
} from '../src/lib/editImageSession';
import { notify } from '../src/lib/notify';
import { colors, fonts } from '../src/theme';

const ASPECT_W = 3;
const ASPECT_H = 4;

export default function EditImageScreen() {
  const params = useLocalSearchParams<{ uri?: string }>();
  const uri = typeof params.uri === 'string' ? params.uri : '';

  const [localUri, setLocalUri] = useState('');
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const screen = Dimensions.get('window');
  const cropW = Math.min(screen.width - 40, 340);
  const cropH = (cropW * ASPECT_H) / ASPECT_W;

  const baseW = useSharedValue(cropW);
  const baseH = useSharedValue(cropH);
  const cropWSV = useSharedValue(cropW);
  const cropHSV = useSharedValue(cropH);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  useEffect(() => {
    cropWSV.value = cropW;
    cropHSV.value = cropH;
  }, [cropW, cropH, cropWSV, cropHSV]);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    (async () => {
      let source = uri;
      if (/^https?:/i.test(uri) && FileSystem.cacheDirectory && Platform.OS !== 'web') {
        try {
          const dest = `${FileSystem.cacheDirectory}edit-image-${Date.now()}.jpg`;
          const downloaded = await FileSystem.downloadAsync(uri, dest);
          source = downloaded.uri;
        } catch {
          source = uri;
        }
      }
      if (cancelled) return;
      setLocalUri(source);
      Image.getSize(
        source,
        (w, h) => {
          if (cancelled) return;
          const s = Math.max(cropW / w, cropH / h);
          baseW.value = w * s;
          baseH.value = h * s;
          scale.value = 1;
          tx.value = 0;
          ty.value = 0;
          setImgSize({ w, h });
          setReady(true);
        },
        () => notify('Edit Image', 'Could not load image size.')
      );
    })().catch((e: any) => notify('Edit Image', e.message || String(e)));
    return () => {
      cancelled = true;
    };
  }, [uri, cropW, cropH, baseW, baseH, scale, tx, ty]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      'worklet';
      const dispW = baseW.value * scale.value;
      const dispH = baseH.value * scale.value;
      const maxX = Math.max(0, (dispW - cropWSV.value) / 2);
      const maxY = Math.max(0, (dispH - cropHSV.value) / 2);
      const nx = startTx.value + e.translationX;
      const ny = startTy.value + e.translationY;
      tx.value = Math.min(maxX, Math.max(-maxX, nx));
      ty.value = Math.min(maxY, Math.max(-maxY, ny));
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      'worklet';
      const nextScale = Math.min(4, Math.max(1, startScale.value * e.scale));
      scale.value = nextScale;
      const dispW = baseW.value * nextScale;
      const dispH = baseH.value * nextScale;
      const maxX = Math.max(0, (dispW - cropWSV.value) / 2);
      const maxY = Math.max(0, (dispH - cropHSV.value) / 2);
      tx.value = Math.min(maxX, Math.max(-maxX, startTx.value));
      ty.value = Math.min(maxY, Math.max(-maxY, startTy.value));
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const imageStyle = useAnimatedStyle(() => ({
    width: baseW.value * scale.value,
    height: baseH.value * scale.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  function goBack(result: null | { uri: string; base64: string | null; mimeType: string | null }) {
    if (result) completeEditImageSession(result);
    else cancelEditImageSession();
    if (router.canGoBack()) router.back();
    else router.replace('/add-progress-photo');
  }

  async function applyCrop() {
    if (!localUri || !imgSize) return;
    try {
      setSaving(true);
      const s = scale.value;
      const dispW = baseW.value * s;
      const dispH = baseH.value * s;
      const imgLeft = (cropW - dispW) / 2 + tx.value;
      const imgTop = (cropH - dispH) / 2 + ty.value;

      let originX = ((0 - imgLeft) / dispW) * imgSize.w;
      let originY = ((0 - imgTop) / dispH) * imgSize.h;
      let width = (cropW / dispW) * imgSize.w;
      let height = (cropH / dispH) * imgSize.h;

      originX = Math.max(0, Math.min(imgSize.w - 1, originX));
      originY = Math.max(0, Math.min(imgSize.h - 1, originY));
      width = Math.max(1, Math.min(imgSize.w - originX, width));
      height = Math.max(1, Math.min(imgSize.h - originY, height));

      const targetRatio = ASPECT_W / ASPECT_H;
      const currentRatio = width / height;
      if (currentRatio > targetRatio) {
        const newW = height * targetRatio;
        originX += (width - newW) / 2;
        width = newW;
      } else if (currentRatio < targetRatio) {
        const newH = width / targetRatio;
        originY += (height - newH) / 2;
        height = newH;
      }

      originX = Math.max(0, originX);
      originY = Math.max(0, originY);
      width = Math.min(width, imgSize.w - originX);
      height = Math.min(height, imgSize.h - originY);

      const result = await manipulateAsync(
        localUri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.max(1, Math.round(width)),
              height: Math.max(1, Math.round(height)),
            },
          },
        ],
        { compress: 0.7, format: SaveFormat.JPEG, base64: true }
      );

      goBack({
        uri: result.uri,
        base64: result.base64 ?? null,
        mimeType: 'image/jpeg',
      });
    } catch (e: any) {
      notify('Crop failed', e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <IconBtn onPress={() => goBack(null)}>
            <Text style={styles.back}>‹</Text>
          </IconBtn>
          <Text style={styles.title}>Edit Image</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.hint}>Drag and pinch inside the box. The photo stays upright.</Text>

        <View style={styles.stage}>
          {!ready ? (
            <ActivityIndicator color={colors.todayCream} />
          ) : (
            <GestureDetector gesture={gesture}>
              <View style={[styles.crop, { width: cropW, height: cropH }]}>
                <Animated.Image
                  source={{ uri: localUri }}
                  style={[styles.image, imageStyle]}
                  resizeMode="stretch"
                />
                <View style={styles.frame} pointerEvents="none" />
              </View>
            </GestureDetector>
          )}
        </View>

        <View style={styles.actions}>
          <Btn title="Cancel" variant="ghost" onPress={() => goBack(null)} style={{ flex: 1 }} />
          <Btn
            title={saving ? 'Saving…' : 'Done'}
            onPress={applyCrop}
            loading={saving}
            disabled={!ready || saving}
            style={{ flex: 1 }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.todayBg },
  safe: { flex: 1, paddingHorizontal: 16 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  back: { fontSize: 28, color: colors.todayCream, lineHeight: 30, marginTop: -2 },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.todayCream,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.todayMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crop: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
  },
  frame: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 18,
    paddingTop: 12,
  },
});
