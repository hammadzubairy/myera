import React, { useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { fluidSpring } from './motion';

export function CompareSlider({
  before,
  after,
  leftLabel,
  rightLabel,
  badge,
  height = 280,
}: {
  before: ImageSourcePropType;
  after: ImageSourcePropType;
  leftLabel?: string;
  rightLabel?: string;
  badge?: string;
  height?: number;
}) {
  const [layoutW, setLayoutW] = useState(0);
  const [layoutH, setLayoutH] = useState(0);
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const placed = useSharedValue(0);
  const dragging = useSharedValue(0);

  const gesture = Gesture.Pan()
    .minDistance(6)
    .onBegin(() => {
      dragging.value = withSpring(1, fluidSpring);
    })
    .onUpdate((e) => {
      const w = width.value;
      if (!w) return;
      x.value = Math.min(Math.max(e.x, 0), w);
    })
    .onFinalize(() => {
      dragging.value = withSpring(0, fluidSpring);
    });

  const clipStyle = useAnimatedStyle(() => ({
    width: x.value,
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - 22 },
      { scale: 1 + dragging.value * 0.06 },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.box, { height }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          setLayoutW(w);
          setLayoutH(e.nativeEvent.layout.height);
          width.value = w;
          if (placed.value === 0) {
            x.value = w * 0.5;
            placed.value = 1;
          }
        }}
      >
        <Image source={after} style={styles.full} />
        <Animated.View style={[styles.clip, clipStyle]}>
          <Image source={before} style={{ width: layoutW || 1, height: layoutH || height }} />
        </Animated.View>
        <Animated.View style={[styles.handle, handleStyle]}>
          <View style={styles.line} />
          <View style={styles.knob} />
        </Animated.View>
        {badge ? (
          <View style={styles.badgeWrap} pointerEvents="none">
            <Text style={styles.badge}>{badge}</Text>
          </View>
        ) : null}
        {leftLabel ? (
          <Text style={[styles.lbl, styles.lblL]} pointerEvents="none">
            {leftLabel}
          </Text>
        ) : null}
        {rightLabel ? (
          <Text style={[styles.lbl, styles.lblR]} pointerEvents="none">
            {rightLabel}
          </Text>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.sandDeep,
  },
  full: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  clip: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.white,
  },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: 'rgba(15,61,70,0.25)',
  },
  lbl: {
    position: 'absolute',
    bottom: 10,
    maxWidth: '46%',
    fontFamily: fonts.sub,
    fontSize: 11,
    color: colors.white,
    backgroundColor: 'rgba(15,61,70,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  lblL: { left: 10 },
  lblR: { right: 10 },
  badgeWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badge: {
    fontFamily: fonts.sub,
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
    backgroundColor: 'rgba(15,61,70,0.7)',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
});
