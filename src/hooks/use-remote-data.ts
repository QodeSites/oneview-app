import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { ApiResult } from '@/lib/reviewApi';

export type RemoteState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/** How often a focused screen re-checks the server while the app is open. */
const REVALIDATE_MS = 30_000;

/**
 * Fetch-on-mount for the real `GET /api/mobile/*` endpoints (src/lib/
 * reviewApi.ts), with pull-to-refresh support via `refresh`. One shared
 * shape for every dashboard/profile screen's loading/error/ready states,
 * so each screen only has to render those three cases once instead of
 * re-inventing them.
 *
 * Also re-checks the server quietly (no spinner) whenever the screen
 * regains focus, the app returns to the foreground, and every 30s while
 * the screen is focused and the app is active. Without this, a change made
 * elsewhere — answers edited on web, data removed on the backend — never
 * showed until the screen was closed and reopened. A quiet re-check that
 * fails keeps the data already on screen rather than swapping it for an
 * error, and a response identical to what's shown is dropped so an
 * unchanged screen doesn't re-render every 30s.
 */
export function useRemoteData<T>(fetcher: () => Promise<ApiResult<T>>) {
  const [state, setState] = useState<RemoteState<T>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest request may write state — a slow older response must
  // not overwrite a newer one.
  const requestIdRef = useRef(0);
  const lastJsonRef = useRef<string | null>(null);

  const run = useCallback(
    (mode: 'initial' | 'refresh' | 'silent') => {
      const id = ++requestIdRef.current;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setState({ status: 'loading' });
      fetcher()
        .then((result) => {
          if (id !== requestIdRef.current) return;
          if (result.ok) {
            const json = JSON.stringify(result.data);
            if (mode === 'silent' && json === lastJsonRef.current) return;
            lastJsonRef.current = json;
            setState({ status: 'ready', data: result.data });
          } else if (mode === 'silent') {
            setState((cur) => (cur.status === 'ready' ? cur : { status: 'error', message: result.error }));
          } else {
            lastJsonRef.current = null;
            setState({ status: 'error', message: result.error });
          }
        })
        .finally(() => {
          if (mode === 'refresh') setRefreshing(false);
        });
    },
    [fetcher],
  );

  useEffect(() => {
    run('initial');
  }, [run]);

  // The mount effect above already covers the first focus.
  const skipFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusRef.current) skipFirstFocusRef.current = false;
      else run('silent');

      let appActive = AppState.currentState === 'active';
      const interval = setInterval(() => {
        if (appActive) run('silent');
      }, REVALIDATE_MS);
      const sub = AppState.addEventListener('change', (next) => {
        const wasActive = appActive;
        appActive = next === 'active';
        if (appActive && !wasActive) run('silent');
      });
      return () => {
        clearInterval(interval);
        sub.remove();
      };
    }, [run]),
  );

  return {
    state,
    refreshing,
    reload: () => run('initial'),
    refresh: () => run('refresh'),
    revalidate: () => run('silent'),
  };
}
