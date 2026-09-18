import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QodeColor, QodeFont, QodeSpace } from '@/constants/qode-theme';
import { dayLabel } from '@/lib/format';

/**
 * The page header every review screen carries — ported from
 * qode-oneview's Shell.tsx: a title + one-line subtitle per screen (same
 * copy, from Shell.tsx's own PAGES array), the "priced as at" date with a
 * refresh action, and the "data looks incomplete" banner pointing at the
 * statement-upload recovery path (Screen 12, SPEC-mobile-profile.md).
 *
 * Deliberately NOT included: the QA-mode test-account panel with CSV/JSON
 * exports and the formula-by-formula disclosure — those render only
 * behind `isQaMode()` in the real app (review/layout.tsx), gated to
 * internal accounts. They're debugging tooling, not a customer-facing
 * screen, so they don't belong in this preview.
 *
 * There used to be a "Fetch latest" text link here too. Every screen now
 * wraps its ScrollView in a pull-to-refresh RefreshControl instead — one
 * affordance for refreshing, not a small text link plus a gesture that did
 * the same thing.
 *
 * The "data looks incomplete" banner used to point at `/holdings` — a
 * placeholder that just landed on the plain Holdings tab and did nothing
 * (reported 16 Sep: "this goes to nothing"). It now opens the real
 * self-serve recovery screen (`src/app/upload-statement.tsx`), ported from
 * web's own `CasUpload.tsx` — see that screen's doc comment for the full
 * feature.
 */
export function PageHeader({
  title,
  subtitle,
  navAsOf,
}: {
  title: string;
  subtitle?: string;
  navAsOf: string | null;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaText}>
            {navAsOf ? `Priced as at · ${dayLabel(navAsOf)}` : 'No reporting date available'}
          </Text>
        </View>
      </View>

      <Link href="/upload-statement" asChild>
        {/* Link's asChild clones this via a Slot, which merges an
            incoming `style` by concatenating it into an array — fine for
            a plain object, but a FUNCTION style (tried here first, for
            the pressed-state dim) landed in that array as one of its
            entries, and RN's style resolution can't do anything with a
            function inside a style array: the whole style silently
            failed to apply — no padding, no background, no rounded
            corners (reported 18 Sep, on more.tsx's identically-broken
            list rows — same fix there). Tracking `pressed` by hand keeps
            this a plain, already-flattened object, which Slot's
            array-merge handles fine. */}
        <Pressable
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={StyleSheet.flatten([styles.dataBar, pressed && styles.pressed])}>
          <Text style={styles.dataBarText}>
            Data looks incomplete? Upload your CAMS/KFin or NSDL/CDSL statement →
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
  container: {
    gap: QodeSpace[3],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: QodeSpace[3],
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 26,
    color: QodeColor.cream,
  },
  subtitle: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: QodeColor.textMuted,
    marginTop: 2,
  },
  // Capped so a long date can't squeeze the title into breaking mid-word
  // on narrow phones — the date wraps instead.
  metaCol: {
    alignItems: 'flex-end',
    flexShrink: 1,
    maxWidth: '40%',
  },
  metaText: {
    textAlign: 'right',
    fontFamily: QodeFont.uiRegular,
    fontSize: 11,
    color: QodeColor.textMuted,
  },
  dataBar: {
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: 10,
    paddingVertical: QodeSpace[2],
    paddingHorizontal: QodeSpace[3],
  },
  dataBarText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 12,
    color: QodeColor.textSecondary,
  },
});
