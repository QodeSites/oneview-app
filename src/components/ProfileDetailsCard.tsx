import { StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { dayLabel } from '@/lib/format';
import type { RealProfileData } from '@/lib/reviewApi';

/**
 * "Your details" — shown on both the Profile screen and More, so the two
 * can't drift apart.
 */
export function ProfileDetailsCard({ profile: p }: { profile: RealProfileData }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your details</Text>
      <DetailRow label="Name" value={p.name ?? '—'} />
      <DetailRow label="Mobile" value={p.phone} />
      <DetailRow label="PAN" value={p.panMasked ?? '—'} />
      <DetailRow label="Email" value={p.email ?? '—'} />
      <DetailRow label="Member since" value={dayLabel(p.memberSince)} />
      <Text style={styles.note}>
        To correct any of this, write to investor.relations@qodeinvest.com. Your mobile number cannot be changed
        here — it is what your accounts are linked against.
      </Text>
    </View>
  );
}

export function DetailRow({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
  },
  cardTitle: { fontFamily: QodeFont.display, fontSize: 17, color: QodeColor.cream, marginBottom: QodeSpace[2] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: QodeSpace[3],
    paddingVertical: QodeSpace[2],
    borderTopWidth: 1,
    borderTopColor: QodeColor.divider,
  },
  // The label keeps its width and a long value (an email) wraps, rather
  // than the value squeezing the label down to nothing.
  rowLeft: { flexShrink: 0, minWidth: 90, maxWidth: '45%' },
  rowLabel: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textPrimary },
  rowSub: { fontFamily: QodeFont.uiRegular, fontSize: 11, color: QodeColor.textMuted, marginTop: 1 },
  rowValue: { fontFamily: QodeFont.uiRegular, fontSize: 13, color: QodeColor.textSecondary, flex: 1, textAlign: 'right' },
  note: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11.5,
    lineHeight: 17,
    color: QodeColor.textMuted,
    marginTop: QodeSpace[3],
  },
});
