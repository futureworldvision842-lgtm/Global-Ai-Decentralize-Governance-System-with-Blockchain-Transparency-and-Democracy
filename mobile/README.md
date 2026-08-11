# GAIGS Android release

The Android app is a Capacitor 8 shell around the reviewed GAIGS web client. It
uses the system document/photo picker for user-selected media and requests
foreground location only after the user taps a location action. The optional
Nearby Mesh asks for Android nearby Wi-Fi/Bluetooth scan, connect and advertise
permissions after the member taps **Enable Nearby Mesh**. It does not ask for
broad storage, contacts, SMS, call-log or background-location permission.

Private online messages are encrypted on the sender device with ECDH P-256,
HKDF-SHA-256 and AES-256-GCM before upload. The hosted service stores encrypted
envelopes and receipt-chain metadata. Nearby messages use the same encrypted
payload inside a signed, TTL-limited relay packet. Android's six-digit Nearby
Connections authentication code must be confirmed on both phones. Public city,
country, global and proposal rooms are auditable public discussions, not private
messages.

## Build locally

1. Install JDK 21 and the current Android SDK (API 36).
2. Run `npm ci` in the repository root and in `mobile/`.
3. Run `npm run sync:android` in `mobile/`.
4. Put the upload keystore outside the repository and set the signing
   environment variables described in `PLAY_RELEASE_CHECKLIST.md`.
5. Run `android/gradlew.bat bundleRelease` from `mobile/` on Windows.

Never commit an upload keystore, password, Firebase Admin credential, AI key or
wallet private key.
