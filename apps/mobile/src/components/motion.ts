import { useEffect } from 'react';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const fluidEase = Easing.bezier(0.22, 1, 0.36, 1);
export const fluidSpring = { damping: 18, stiffness: 210, mass: 0.7 };

export function useRingProgress(circumference: number, progress: number) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withTiming(Math.max(0, Math.min(1, progress || 0)), {
      duration: 760,
      easing: fluidEase,
    });
  }, [progress, value]);

  return useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));
}
