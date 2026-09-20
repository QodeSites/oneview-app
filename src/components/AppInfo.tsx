import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { dayLabel } from '@/lib/format';

/**
 * Which build, and which over-the-air update, this phone is actually running
 * — the only way to answer "did my fix reach them?" for a tester or a support
 * question, since an OTA update changes the JS without changing the build
 * number (docs/releasing.md).
 *
 * `Updates.updateId` is null while the app runs the JS bundled into the build
 * itself, which is the normal state until the first update lands.
 */
export function AppInfo() {
  const version = Application.nativeApplicationVersion ?? '—';
  const build = Application.nativeBuildVersion ?? '—';
  const onEmbedded = !Updates.updateId || Updates.isEmbeddedLaunch;
  const updateLine = onEmbedded
    ? 'As shipped in this build'
    : `${Updates.updateId!.slice(0, 8)} · ${dayLabel(Updates.createdAt?.toISOString() ?? null)}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>App info</Text>
      <Row label="Version" value={`${version} (${build})`} />
      <Row label="Update" value={updateLine} />
      {Updates.channel ? <Row label="Channel" value={Updates.channel} /> : null}
      <Text style={styles.note}>Useful if you ever need to tell us which version you are on.</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
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
    gap: QodeSpace[2],
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 15,
    color: QodeColor.cream,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: QodeSpace[3],
  },
  label: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  value: {
    flexShrink: 1,
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textPrimary,
  },
  note: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    lineHeight: 16,
    color: QodeColor.faint,
  },
});
