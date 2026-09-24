import AppTabs from '@/components/app-tabs';

/**
 * Performance is the anchor (initial route) of the tab group — which is
 * also what Android's hardware back lands on from any other tab, via
 * `backBehavior: 'initialRoute'` in app-tabs.tsx.
 *
 * Without this, expo-router picks the anchor itself, and its rule is not
 * the order the tabs are listed in: `sortRoutes` orders plain routes by
 * ROUTE-NAME LENGTH (expo-router/build/sortRoutes.js — `a.route.length -
 * b.route.length`). For this group that put `vsi` (3 characters) first,
 * ahead of `more` (4), `mf-xray` (7), `holdings`/`segments` (8) and
 * `performance` (11) — so the tab router's default `backBehavior:
 * 'firstRoute'` sent every back press to the VSI tab, and a back press
 * on VSI itself had nowhere left to go (reported 22 Sep: "doing back is
 * VSI Indicator the screen… ideally should be Performance"). Naming the
 * anchor explicitly fixes the order at the source rather than relying on
 * that length rule, which would shift again the moment a tab is renamed.
 */
export const unstable_settings = {
  anchor: 'performance',
};

export default function TabsLayout() {
  return <AppTabs />;
}
