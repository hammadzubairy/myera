import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Path, Text as SvgText, Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

type Point = { logged_on: string; weight_lb: number };
type Marker = { date: string; amount_mg: number };

export function WeightChart({
  points,
  doseChanges,
}: {
  points: Point[];
  doseChanges: Marker[];
}) {
  const W = 300;
  const H = 150;
  const pl = 30;
  const pr = 10;
  const pt = 12;
  const pb = 24;

  const { line, area, yTicks, markers, empty } = useMemo(() => {
    if (!points.length) {
      return { line: '', area: '', yTicks: [] as number[], markers: [] as any[], empty: true };
    }
    const weights = points.map((p) => Number(p.weight_lb));
    const min = Math.floor(Math.min(...weights)) - 1;
    const max = Math.ceil(Math.max(...weights)) + 1;
    const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(points.length - 1, 1);
    const y = (v: number) => pt + ((max - v) * (H - pt - pb)) / Math.max(max - min, 1);
    const pts = points.map((p, i) => `${x(i)},${y(Number(p.weight_lb))}`).join(' ');
    const linePath = `M${pts.replace(/ /g, ' L')}`;
    const areaPath = `M${x(0)},${H - pb} L${pts.replace(/ /g, ' L')} L${x(points.length - 1)},${H - pb} Z`;
    const dateIndex = new Map(points.map((p, i) => [p.logged_on, i]));
    const marks = doseChanges
      .map((d) => {
        const i = dateIndex.get(d.date);
        if (i == null) {
          // find nearest
          let best = -1;
          let bestDiff = Infinity;
          points.forEach((p, idx) => {
            const diff = Math.abs(new Date(p.logged_on).getTime() - new Date(d.date).getTime());
            if (diff < bestDiff) {
              bestDiff = diff;
              best = idx;
            }
          });
          if (best < 0) return null;
          return { x: x(best), y: y(Number(points[best].weight_lb)), amount: d.amount_mg };
        }
        return { x: x(i), y: y(Number(points[i].weight_lb)), amount: d.amount_mg };
      })
      .filter(Boolean);
    return {
      line: linePath,
      area: areaPath,
      yTicks: [min, (min + max) / 2, max].map((n) => Math.round(n)),
      markers: marks,
      empty: false,
      min,
      max,
      y,
    };
  }, [points, doseChanges]);

  if (empty) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Log weight to see your chart</Text>
      </View>
    );
  }

  const min = Math.min(...points.map((p) => Number(p.weight_lb))) - 1;
  const max = Math.max(...points.map((p) => Number(p.weight_lb))) + 1;
  const y = (v: number) => pt + ((max - v) * (H - pt - pb)) / Math.max(max - min, 1);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {yTicks.map((v) => (
        <React.Fragment key={v}>
          <Line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={colors.chartGrid} />
          <SvgText
            x={pl - 6}
            y={y(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill={colors.muted}
            fontFamily={fonts.sub}
          >
            {v}
          </SvgText>
        </React.Fragment>
      ))}
      <Path d={area} fill={colors.sage} opacity={0.45} />
      {points.length > 1 ? (
        <Path d={line} stroke={colors.pine} strokeWidth={2.4} fill="none" />
      ) : null}
      {points.map((p, i) => {
        const xi = pl + (i * (W - pl - pr)) / Math.max(points.length - 1, 1);
        const yi = y(Number(p.weight_lb));
        return <Circle key={p.logged_on + i} cx={xi} cy={yi} r={3.5} fill={colors.pine} />;
      })}
      {markers.map((m: any, i: number) => (
        <React.Fragment key={i}>
          <Line
            x1={m.x}
            x2={m.x}
            y1={pt}
            y2={H - pb}
            stroke={colors.gold}
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
          <Circle cx={m.x} cy={m.y} r={4} fill={colors.gold} />
        </React.Fragment>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
