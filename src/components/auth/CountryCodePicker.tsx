import { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QodeColor, QodeFont, QodeRadius, QodeSpace } from '@/constants/qode-theme';
import { COUNTRIES, type Country } from '@/data/countries';

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]!;

/**
 * A real flag image, not an emoji one. Unicode flag emoji are two
 * "regional indicator" letters, and Android's system font frequently has
 * no combined glyph for a given pair — it falls back to showing the two
 * bare letters (which is exactly the "I'm getting initials, not a flag"
 * report this replaces). iOS renders them fine; Android is inconsistent
 * across OS versions and OEM skins, and that isn't something fixable
 * from JS/CSS.
 *
 * flagcdn.com is a free, widely-used public flag CDN (no key required) —
 * `h40` is a fixed 40px-tall source, cropped to a uniform small box here
 * via `resizeMode="cover"` so every country reads as the same tidy icon
 * regardless of its real flag's aspect ratio. `onError` falls back to the
 * ISO code as plain text, so a network hiccup shows something legible
 * rather than a broken-image icon.
 */
function FlagIcon({ iso2, height = 16 }: { iso2: string; height?: number }) {
  const [failed, setFailed] = useState(false);
  const width = Math.round(height * (4 / 3));

  if (failed) {
    return (
      <View style={[styles.flagFallback, { width, height }]}>
        <Text style={styles.flagFallbackText}>{iso2}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `https://flagcdn.com/h40/${iso2.toLowerCase()}.png` }}
      style={[styles.flagImage, { width, height }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * A tap target (flag + dial code) that opens a searchable sheet of every
 * country's calling code — the phone field's own "which country" answer,
 * since Qode's customers dial in from outside India too, not just a fixed
 * "+91" nobody can change. Plain RN `Modal` + `FlatList`, no new
 * dependency: ~190 rows doesn't need anything heavier.
 */
export function CountryCodePicker({ value, onChange }: { value: Country; onChange: (country: Country) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const qDigits = q.replace(/\D/g, '');
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || (qDigits.length > 0 && c.dialCode.startsWith(qDigits)),
    );
  }, [query]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Country code, currently ${value.name}, plus ${value.dialCode}`}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        onPress={() => setOpen(true)}>
        <FlagIcon iso2={value.iso2} height={16} />
        <Text style={styles.dialCode} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          +{value.dialCode}
        </Text>
        <Text style={styles.chevron} maxFontSizeMultiplier={1.3}>
          ▾
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setOpen(false)} accessibilityElementsHidden />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose a country</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                hitSlop={12}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search country or code"
              placeholderTextColor={QodeColor.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.iso2}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => {
                    onChange(item);
                    setQuery('');
                    setOpen(false);
                  }}>
                  <FlagIcon iso2={item.iso2} height={18} />
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowDial}>+{item.dialCode}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No matches.</Text>}
              style={styles.list}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // See holdings.tsx's own comment on this shared style.
  pressed: {
    opacity: 0.85,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    // `flexShrink: 0` is RN's own default for a row child with no `flex`
    // set — spelled out here because getting it wrong is exactly what
    // broke this: without it, the sibling phone TextInput (`flex: 1`) is
    // the only one that can shrink, so on a narrower screen or with the
    // system font size turned up (which grows "+91" here — capped below
    // via `maxFontSizeMultiplier`, but couldn't be relied on alone) this
    // row could still be pushed wider than the space available, clipping
    // the flag/dial code against the screen edge rather than the TextInput
    // giving up its own space first (reported 15 Sep, on a narrower phone).
    flexShrink: 0,
    gap: 4,
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  triggerPressed: {
    backgroundColor: QodeColor.surfaceRaised,
  },
  flagImage: {
    borderRadius: 2,
    backgroundColor: QodeColor.surfaceRaised,
  },
  flagFallback: {
    borderRadius: 2,
    backgroundColor: QodeColor.surfaceRaised,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagFallbackText: {
    fontFamily: QodeFont.ui,
    fontSize: 8,
    color: QodeColor.textMuted,
  },
  dialCode: {
    fontFamily: QodeFont.ui,
    fontSize: 16,
    color: QodeColor.textPrimary,
  },
  chevron: {
    fontSize: 11,
    color: QodeColor.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 32, 23, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: QodeColor.greenDeep,
    borderTopLeftRadius: QodeRadius.lg,
    borderTopRightRadius: QodeRadius.lg,
    borderWidth: 1,
    borderColor: QodeColor.surfaceBorder,
    maxHeight: '75%',
    paddingTop: QodeSpace[4],
    paddingBottom: QodeSpace[6],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: QodeSpace[5],
    marginBottom: QodeSpace[3],
  },
  sheetTitle: {
    fontFamily: QodeFont.display,
    fontSize: 17,
    color: QodeColor.cream,
  },
  closeText: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.accent,
  },
  search: {
    marginHorizontal: QodeSpace[5],
    marginBottom: QodeSpace[3],
    backgroundColor: QodeColor.surface,
    borderWidth: 1,
    borderColor: QodeColor.controlBorder,
    borderRadius: QodeRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: QodeFont.uiRegular,
    fontSize: 15,
    color: QodeColor.textPrimary,
  },
  list: {
    paddingHorizontal: QodeSpace[5],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: QodeSpace[3],
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: QodeColor.divider,
  },
  rowPressed: {
    backgroundColor: QodeColor.surface,
  },
  rowName: {
    flex: 1,
    fontFamily: QodeFont.uiRegular,
    fontSize: 14,
    color: QodeColor.textPrimary,
  },
  rowDial: {
    fontFamily: QodeFont.ui,
    fontSize: 13,
    color: QodeColor.textSecondary,
  },
  empty: {
    fontFamily: QodeFont.uiRegular,
    fontSize: 13,
    color: QodeColor.textMuted,
    textAlign: 'center',
    paddingVertical: QodeSpace[5],
  },
});
