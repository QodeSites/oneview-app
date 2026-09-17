type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Fired by api.ts/reviewApi.ts's shared request helpers whenever qode-
 * oneview returns 401 on an authenticated call — the server-side session
 * cookie is gone or invalid (expired, cleared by a server restart, wiped
 * by switching dev builds) even though this device's own local `session`
 * flag (src/lib/auth.tsx) still says signed-in. Decoupled from auth.tsx
 * itself so the low-level request helpers don't need to import React/
 * expo-router — they just announce the fact; auth.tsx (the one listener)
 * decides what to do about it.
 */
export function notifySessionExpired(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
