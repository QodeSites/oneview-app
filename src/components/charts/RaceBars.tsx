import { StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont } from '@/constants/qode-theme';
import { signedPct } from '@/lib/format';
import type { RaceBar } from '@/lib/mock-data';

const ROLE_COLOR = {
  client: QodeColor.seriesClient,
  strategy: QodeColor.seriesStrategy,
  benchmark: QodeColor.seriesBenchmark,
} as const;

/**
 * Three bars on a return scale, zero-based — a simplified mobile version
 * of qode-oneview's <Columns> chart (the alpha bracket and curve overlay
 * are left out; the three bars and their percentages carry the same
 * comparison on a phone-sized card).
 */
export function RaceBars({ bars }: { bars: RaceBar[] }) {
  const values = bars.map((b) => b.value);
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = Math.max(hi - lo, 0.01);
  const barHeight = 120;

  return (
    <View style={styles.row}>
      {bars.map((b) => {
        const heightPx = (Math.abs(b.value) / span) * barHeight;
        const isUp = b.value >= 0;
        return (
          <View key={b.label} style={styles.col}>
            <Text style={[styles.pct, isUp ? styles.pctUp : styles.pctDown]}>{signedPct(b.value)}</Text>
            <View style={[styles.barTrack, { height: barHeight }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(heightPx, 2),
                    backgroundColor: ROLE_COLOR[b.role],
                    alignSelf: isUp ? 'flex-end' : 'flex-start',
                  },
                ]}
              />
            </View>
            <Text style={styles.label}>{b.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  col: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  barTrack: {
    width: 36,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 36,
    borderRadius: 4,
  },
  pct: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
  },
  pctUp: {
    color: QodeColor.success,
  },
  pctDown: {
    color: QodeColor.error,
  },
  label: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
    textAlign: 'center',
  },
});
