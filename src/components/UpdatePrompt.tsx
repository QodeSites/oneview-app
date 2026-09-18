import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/auth/BrandMark';
import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { useAppLock } from '@/lib/app-lock';
import { checkForUpdate, dismissUpdate, openStore, type UpdateStatus } from '@/lib/app-update';

/** How often a foregrounded app re-asks the server. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

/**
 * Tells the reader about a new store release (src/lib/app-update.ts):
 *
 * - available → a card over the app with "Update now" / "Later". "Later"
 *   hides it until the next release.
 * - required  → a full-screen notice with only "Update now"; the installed
 *   build is older than the server's minimum and can't carry on.
 *
 * Checked on launch and on returning to the app (at most every RECHECK_MS).
 * Waits while the app lock is up, so it never sits on top of the lock screen.
 */
export function UpdatePrompt() {
  const { locked, pending } = useAppLock();
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'none' });
  const lastCheckRef = useRef(0);

  useEffect(() => {
    const run = () => {
      if (Date.now() - lastCheckRef.current < RECHECK_MS) return;
      lastCheckRef.current = Date.now();
      void checkForUpdate().then(setStatus);
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, []);

  if (status.kind === 'none' || locked || pending) return null;

  const required = status.kind === 'required';

  const notes = status.notes.length ? (
    <View style={styles.notes}>
      <Text style={styles.notesTitle}>What&apos;s new</Text>
      {status.notes.map((n) => (
        <View key={n} style={styles.noteRow}>
          <View style={styles.bullet} />
          <Text style={styles.noteText}>{n}</Text>
        </View>
      ))}
    </View>
  ) : null;

  const updateButton = (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      onPress={() => void openStore()}>
      <Text style={styles.primaryText}>Update now</Text>
    </Pressable>
  );

  if (required) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
        <View style={styles.fullScreen}>
          <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.requiredBody}>
              <BrandMark size={34} showWordmark={false} glow />
              <Text style={styles.title}>Update required</Text>
              <Text style={styles.body}>
                This version of OneView is no longer supported. Update to version {status.latest} to keep using the
                app.
              </Text>
              {notes}
            </ScrollView>
            <View style={styles.requiredActions}>{updateButton}</View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  const later = () => {
    void dismissUpdate(status.latest);
    setStatus({ kind: 'none' });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={later} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={later} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>VERSION {status.latest}</Text>
          <Text style={styles.title}>A new version is available</Text>
          <Text style={styles.body}>Update OneView to get the latest improvements and fixes.</Text>
          {/* Scrolls on its own so a long list of notes can't push the
              buttons off a short screen. */}
          <ScrollView style={styles.notesScroll} bounces={false}>
            {notes}
          </ScrollView>
          <View style={styles.sheetActions}>
            {updateButton}
            <Pressable accessibilityRole="button" style={styles.quiet} onPress={later}>
              <Text style={styles.quietText}>Later</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: QodeColor.greenDeep,
  },
  safe: {
    flex: 1,
    paddingHorizontal: QodeSpace[5],
  },
  requiredBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: QodeSpace[3],
    paddingVertical: QodeSpace[6],
  },
  requiredActions: {
    paddingBottom: QodeSpace[5],
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  notesScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: QodeColor.green,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    paddingHorizontal: QodeSpace[5],
    paddingTop: QodeSpace[3],
    gap: QodeSpace[2],
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: QodeColor.controlBorder,
    marginBottom: QodeSpace[3],
  },
  eyebrow: {
    fontFamily: QodeFont.ui,
    fontSize: 11,
    letterSpacing: 1.2,
    color: QodeColor.accent,
  },
  title: {
    fontFamily: QodeFont.display,
    fontSize: 24,
    color: QodeColor.cream,
    textAlign: 'center',
  },
  body: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 15,
    lineHeight: 21,
    color: QodeColor.textSecondary,
    textAlign: 'center',
  },
  notes: {
    alignSelf: 'stretch',
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    borderRadius: QodeRadius.lg,
    padding: QodeSpace[4],
    gap: QodeSpace[2],
    marginTop: QodeSpace[2],
  },
  notesTitle: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.cream,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: QodeSpace[2],
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: QodeColor.accent,
    marginTop: 7,
  },
  noteText: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    lineHeight: 19,
    color: QodeColor.textSecondary,
  },
  sheetActions: {
    gap: QodeSpace[1],
    marginTop: QodeSpace[3],
    paddingBottom: QodeSpace[3],
  },
  primary: {
    backgroundColor: QodeColor.accent,
    borderRadius: QodeRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  primaryText: {
    fontFamily: QodeFont.ui,
    fontSize: 15,
    color: QodeColor.textOnAccent,
  },
  quiet: {
    alignItems: 'center',
    paddingVertical: QodeSpace[3],
  },
  quietText: {
    fontFamily: QodeFont.ui,
    fontSize: 14,
    color: QodeColor.textMuted,
  },
});
