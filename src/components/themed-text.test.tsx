import { render, screen } from '@testing-library/react-native';

import { ThemedText } from './themed-text';

// Throwaway smoke test proving the Jest + RNTL harness works end to end.
// Deliberately NOT under src/app/: Expo Router treats every file there as
// a route (including *.test.tsx), so component tests live next to the
// component instead — see https://docs.expo.dev/develop/unit-testing/.
// Superseded once a real test exists (see PhoneEntryForm.test.tsx).
it('renders themed text', async () => {
  // RNTL v14: render() is async by default and must be awaited before
  // querying `screen` — see callstack's v14 migration guide.
  await render(<ThemedText>Hello</ThemedText>);
  expect(screen.getByText('Hello')).toBeTruthy();
});
