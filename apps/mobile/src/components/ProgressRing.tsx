import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { useRingProgress } from './motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  lbLost,
  progress,
  size = 144,
  valueLabel,
  unitLabel = 'lb lost',
  valueColor = colors.todayCream,
  labelColor = colors.todayMintMuted,
}: {
  lbLost: number | null;
  progress: number;
  size?: number;
  valueLabel?: string;
  unitLabel?: string;
  valueColor?: string;
  labelColor?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const animatedProps = useRingProgress(c, clamped);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          // Same teal as the page background, faded, so the ring is one green hue
          stroke={colors.background}
          strokeOpacity={0.2}
          strokeWidth={stroke}
          fill="none"
        />
        {clamped > 0 ? (
          <G transform={`rotate(-90 ${cx} ${cy})`}>
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={r}
              stroke={colors.background}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${c} ${c}`}
              animatedProps={animatedProps}
              strokeLinecap="round"
            />
          </G>
        ) : null}
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.num, { color: valueColor }]}>
          {valueLabel ?? (lbLost != null ? lbLost.toFixed(1) : '—')}
        </Text>
        <Text style={[styles.label, { color: labelColor }]}>{unitLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center' },
  num: { fontFamily: fonts.body, fontWeight: '700', fontSize: 36 },
  label: { fontFamily: fonts.body, fontSize: 14 },
});
