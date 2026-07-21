# GAIGS Android release

The Android app is a Capacitor 8 shell around the reviewed GAIGS web client. It
uses the system document/photo picker for user-selected media and requests
foreground location only after the user taps a location action. It does not ask
for broad storage, contacts, SMS, call-log or background-location permission.

## Build locally

1. Install JDK 21 and the current Android SDK (API 36).
2. Run `npm ci` in the repository root and in `mobile/`.
3. Run `npm run sync:android` in `mobile/`.
4. Put the upload keystore outside the repository and set the signing
   environment variables described in `PLAY_RELEASE_CHECKLIST.md`.
5. Run `android/gradlew.bat bundleRelease` from `mobile/` on Windows.

Never commit an upload keystore, password, Firebase Admin credential, AI key or
wallet private key.
