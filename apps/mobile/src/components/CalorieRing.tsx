import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { useRingProgress } from './motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Food diary ring — dark green arc on cream track + gold start cap (Image 1). */
export function CalorieRing({
  left,
  progress,
  size = 138,
}: {
  left: number;
  progress: number; // 0–1 eaten fraction
  size?: number;
}) {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const animatedProps = useRingProgress(c, clamped);
  // Cap sits at 12 o'clock (arc start after rotate -90)
  const capR = stroke / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={colors.foodTrack}
          strokeWidth={stroke}
          fill="none"
        />
        {clamped > 0 ? (
          <G transform={`rotate(-90 ${cx} ${cy})`}>
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={r}
              stroke={colors.foodAccent}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${c} ${c}`}
              animatedProps={animatedProps}
              strokeLinecap="round"
            />
          </G>
        ) : null}
        {clamped > 0 ? (
          <Circle cx={cx} cy={cy - r} r={capR} fill={colors.foodGold} />
        ) : null}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.num}>{Math.round(left)}</Text>
        <Text style={styles.label}>kcal left</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  num: {
    fontFamily: fonts.body,
    fontSize: 31,
    fontWeight: '700',
    color: colors.todayInk,
    lineHeight: 35,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.todayMuted,
    marginTop: 3,
  },
});
