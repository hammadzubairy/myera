import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/** Quick-action icons matching design HTML Today `.quick` SVGs. */
export function QuickIcon({ name }: { name: 'Weight' | 'Meal' | 'Photo' | 'Post win' }) {
  const c = colors.todayInk;
  const sw = 1.9;
  if (name === 'Weight') {
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={4} width={16} height={16} rx={4} stroke={c} strokeWidth={sw} />
        <Path d="M9 10a3 3 0 0 1 6 0" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M12 10l1.4-1.6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'Meal') {
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        <Path d="M4 12h16a8 8 0 0 1-16 0z" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'Photo') {
    return (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={7} width={18} height={13} rx={3} stroke={c} strokeWidth={sw} />
        <Circle cx={12} cy={13.5} r={3.5} stroke={c} strokeWidth={sw} />
        <Path d="M9 7l1.5-3h3L15 7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"
        stroke={c}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
