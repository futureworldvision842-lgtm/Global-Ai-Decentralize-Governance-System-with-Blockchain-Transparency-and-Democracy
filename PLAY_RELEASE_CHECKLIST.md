# GAIGS Google Play release checklist

Status: release-candidate engineering package, not an approved production launch.

## Required before upload

- Replace the privacy-policy operator notice with the registered legal entity,
  postal address and monitored privacy email.
- Configure Firebase Authentication, Firestore, Storage, Functions, App Check,
  authorized domains, backups and alerting; deploy and emulator-test the included
  restrictive rules.
- Configure a supported KYC provider. Raw CNIC must stay out of public profiles,
  logs and blockchain records.
- Keep payment/crypto settlement disabled until provider onboarding, financial
  licensing review and an independent smart-contract/application security audit.
- Deploy the DAO to an Ethereum testnet, verify sources, test timelocks and
  incident pause procedures, then configure public contract addresses.
- Generate an Android upload key outside this repository, enroll in Play App
  Signing, sign the release AAB and protect the keystore in a secret manager.
- Add the required Firebase/operator and `GAIGS_UPLOAD_*` secrets to the protected
  GitHub `play-production` environment, then run the **Play signed bundle**
  workflow. Download its `gaigs-play-signed-aab` artifact.
- Create the app and perform its first AAB upload through Play Console. Google
  Play's publishing API cannot be used until the app already has an uploaded
  APK/AAB, and legal declarations still require Play Console review.
- Run closed/internal testing on physical Android devices, including low-memory,
  offline, denied-permission and account-deletion cases.

## Play Console declarations

- Target API 36 for submissions on/after 31 August 2026.
- Upload an Android App Bundle and enroll in Play App Signing.
- Complete the Data safety form for authentication, identity, location, media,
  messages, user content, financial/transaction and diagnostics data actually
  used by the configured providers.
- Provide `privacy.html` as the public privacy URL and `delete-account.html` as
  the external deletion URL.
- Declare foreground approximate/precise location. Do not declare background
  location or broad photo/video access unless the product changes and policy
  eligibility is independently established.
- Complete content rating, ads declaration, target audience, financial features,
  health/emergency disclaimers and app-access instructions for review accounts.
