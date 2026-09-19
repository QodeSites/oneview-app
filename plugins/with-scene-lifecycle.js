/**
 * Adopts the UIScene life cycle on iOS.
 *
 * An app built with the iOS 27 SDK (Xcode 27) is killed at launch on iOS 27
 * unless it uses scenes — UIKit's `_UIApplicationEvaluateRuntimeIssueFor
 * NoSceneLifecycleAdoption` traps before any JS runs (TestFlight build 13,
 * 18 Sep 2026). Expo 57.0.24 ships `ExpoAppSceneDelegate` for this, but the
 * SDK 57 native template doesn't use it yet, so this plugin wires it in:
 *
 * - Info.plist: a scene manifest naming `EXExpoAppSceneDelegate` (the class's
 *   Objective-C name), so no Swift file of our own is needed.
 * - AppDelegate.swift: conform to `ExpoReactNativeFactoryProvider` and stop
 *   creating the window / starting React Native in didFinishLaunching — the
 *   scene delegate does both once UIKit connects the scene.
 *
 * Throws if the AppDelegate no longer matches the template it patches, rather
 * than silently producing an app that launches to a blank window.
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const START_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle: expected a Swift AppDelegate.');
    }
    let src = cfg.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      const decl = 'class AppDelegate: ExpoAppDelegate {';
      if (!src.includes(decl) || !src.includes(START_BLOCK)) {
        throw new Error('with-scene-lifecycle: AppDelegate.swift no longer matches the SDK 57 template.');
      }
      src = src.replace(decl, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
      src = src.replace(START_BLOCK, '    // Window + React Native start in ExpoAppSceneDelegate (with-scene-lifecycle).\n');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
