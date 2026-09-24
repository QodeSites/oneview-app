import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Returns a ref to put on a tab screen's own `ScrollView`, which is sent
 * back to the top every time that tab is focused.
 *
 * Tab screens stay MOUNTED once visited — that is what makes switching
 * tabs instant, and it also means a screen keeps whatever scroll offset it
 * was left at. Scrolling halfway down Holdings, going to Segments and
 * coming back therefore dropped the reader into the middle of the page
 * with the heading off-screen, reading as "this page opened in the wrong
 * place" (reported 24 Sep). Each tab now opens where it starts.
 *
 * `animated: false` deliberately: the reader should find the page already
 * at the top on arrival, not watch it scroll there. Harmless on the first
 * focus after mount, where the offset is 0 already.
 *
 * Only for the tab screens. A pushed screen (upload-statement, link) has
 * its own lifecycle and is not re-focused the same way.
 */
export function useScrollToTopOnFocus() {
  const ref = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      ref.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return ref;
}
