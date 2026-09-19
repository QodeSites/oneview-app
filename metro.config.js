// Expo's default Metro config, plus Sentry's serializer so each production
// bundle carries debug IDs that match the source maps uploaded at build time.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
