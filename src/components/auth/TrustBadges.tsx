import { StyleSheet, Text, View } from 'react-native';
import { Path, Rect, Svg } from 'react-native-svg';

import { QodeColor, QodeFont } from '@/constants/qode-theme';

/**
 * Standard glyphs only — a lock, a shield, a bank — same rule TabIcons.tsx
 * states for its own icon set. Muted, not gold: these are reassurance, not
 * the primary action, and gold is reserved for that (see qode-theme.ts).
 */
function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={QodeColor.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 10.5V8a5 5 0 0 1 10 0v2.5" />
      <Rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
    </Svg>
  );
}

function ShieldCheckIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={QodeColor.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3.2l7 2.7v5.4c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2V5.9l7-2.7z" />
      <Path d="M8.7 12.2l2.2 2.2 4.4-4.6" />
    </Svg>
  );
}

function BankIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={QodeColor.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9.8L12 4l9 5.8" />
      <Path d="M5 10v8.2M10 10v8.2M14 10v8.2M19 10v8.2" />
      <Path d="M3 20.5h18" />
    </Svg>
  );
}

const ITEMS = [
  { Icon: LockIcon, label: 'Read-only' },
  { Icon: ShieldCheckIcon, label: 'Consent-based' },
  { Icon: BankIcon, label: 'RBI Account Aggregator' },
];

export function TrustBadges() {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {ITEMS.map(({ Icon, label }) => (
          <View key={label} style={styles.item}>
            <Icon />
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>No bank login required. Your data stays yours.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
    rowGap: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    color: QodeColor.textMuted,
  },
  note: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    color: QodeColor.textMuted,
    textAlign: 'center',
  },
});
