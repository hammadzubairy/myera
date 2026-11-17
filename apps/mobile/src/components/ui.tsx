import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, radii } from '../theme';
import { StandaloneTabBar } from './TabBar';
import { fluidEase, fluidSpring } from './motion';

export function Screen({
  children,
  style,
  tab,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Show floating bottom nav; value is the active tab name (today/progress/food/community/me). */
  tab?: 'today' | 'progress' | 'food' | 'community' | 'me';
}) {
  return (
    <View style={[styles.screen, style]}>
      {children}
      {tab ? <StandaloneTabBar active={tab} /> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'dark';
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Btn({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: BtnProps) {
  const vStyle =
    variant === 'primary' ? styles.btnPrimary : variant === 'dark' ? styles.btnDark : styles.btnGhost;
  const tStyle = variant === 'ghost' ? styles.btnGhostText : styles.btnLightText;
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 90, easing: fluidEase });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, fluidSpring);
        }}
        style={[
          styles.btn,
          size === 'sm' && styles.btnSm,
          vStyle,
          (disabled || loading) && { opacity: 0.55 },
          { alignSelf: 'stretch' },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'dark' ? colors.white : colors.onBeige} />
        ) : (
          <Text style={[styles.btnText, size === 'sm' && styles.btnTextSm, tStyle]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  containerStyle?: ViewStyle;
  /** Show eye toggle; manages secureTextEntry internally. */
  secureToggle?: boolean;
};

/** Form field — never uses flex:1 by default (that broke stacked forms). */
export function Field({ label, containerStyle, style, secureToggle, secureTextEntry, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const isSecure = secureToggle ? !visible : secureTextEntry;

  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={secureToggle ? styles.fieldInputRow : undefined}>
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.field, secureToggle && styles.fieldWithToggle, style]}
          secureTextEntry={isSecure}
          {...props}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            style={styles.fieldToggle}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Two fields side-by-side without collapsing on Android/web. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  children,
  tone = 'sage',
}: {
  children: React.ReactNode;
  tone?: 'sage' | 'rose';
}) {
  return (
    <View style={[styles.pill, tone === 'rose' && styles.pillRose]}>
      <Text style={[styles.pillText, tone === 'rose' && styles.pillTextRose]}>{children}</Text>
    </View>
  );
}

export function Seg({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useSharedValue(0);
  const count = Math.max(options.length, 1);
  const itemW = width > 0 ? (width - 6) / count : 0;

  useEffect(() => {
    x.value = withSpring(index * itemW, fluidSpring);
  }, [index, itemW, x]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={styles.seg} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {itemW > 0 ? (
        <Animated.View style={[styles.segIndicator, { width: itemW }, indicator]} />
      ) : null}
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={styles.segItem}>
          <Text style={[styles.segText, value === o.key && styles.segTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function IconBtn({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn}>
      {children}
    </Pressable>
  );
}

/** Design `.switch` — pine when on. */
export function Switch({
  value,
  onValueChange,
  label,
  onDark,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
  /** Switch sits directly on the green background (not inside a white card). */
  onDark?: boolean;
}) {
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, fluidSpring);
  }, [on, value]);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * 17 }],
  }));
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], onDark ? [colors.onBgLine, colors.beige] : [colors.line, colors.pine]),
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onValueChange(!value)}
    >
      <Animated.View style={[styles.switchTrack, track]}>
        <Animated.View style={[styles.switchThumb, onDark && { backgroundColor: colors.pine }, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconBtn onPress={onBack}>
          <Text style={styles.backChevron}>‹</Text>
        </IconBtn>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
  },
  btn: {
    borderRadius: radii.button,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 46,
  },
  btnSm: {
    borderRadius: radii.buttonSm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  btnPrimary: { backgroundColor: colors.beige },
  btnDark: { backgroundColor: colors.black },
  btnGhost: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  btnTextSm: { fontSize: 13 },
  btnLightText: { color: colors.onBeige },
  btnGhostText: { color: colors.onBeige },
  fieldWrap: {
    alignSelf: 'stretch',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: 'stretch',
  },
  fieldLabel: {
    fontFamily: fonts.sub,
    fontSize: 11,
    color: colors.onBgMuted,
    marginBottom: 6,
  },
  field: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.field,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    minHeight: 44,
    width: '100%',
  },
  fieldInputRow: {
    position: 'relative',
    width: '100%',
  },
  fieldWithToggle: {
    paddingRight: 44,
  },
  fieldToggle: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.chip,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 4,
  },
  chipOn: {
    backgroundColor: colors.beige,
    borderColor: colors.beige,
  },
  chipText: {
    fontFamily: fonts.sub,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  chipTextOn: { color: colors.onBeige },
  pill: {
    backgroundColor: colors.sageSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.chip,
  },
  pillRose: { backgroundColor: colors.softRose },
  pillText: {
    fontFamily: fonts.sub,
    fontSize: 12,
    fontWeight: '600',
    color: colors.pine,
  },
  pillTextRose: { color: colors.roseDeep },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.sandDeep,
    borderRadius: 12,
    padding: 3,
    alignSelf: 'stretch',
    marginBottom: 12,
    position: 'relative',
  },
  segIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 9,
    backgroundColor: colors.card,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 9,
    zIndex: 1,
  },
  segText: {
    fontFamily: fonts.sub,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  segTextOn: { color: colors.ink, fontWeight: '600' },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '500',
    color: colors.onBg,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onBgMuted,
    lineHeight: 20,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.iconBtn,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '500',
    color: colors.onBg,
  },
  headerSpacer: { width: 36, height: 36 },
  backChevron: { fontSize: 28, color: colors.onBeige, lineHeight: 30, marginTop: -2 },
  switchTrack: {
    width: 42,
    height: 25,
    borderRadius: 99,
    backgroundColor: colors.line,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
