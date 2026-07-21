# GAIGS production activation

## Runtime modes

- **Offline sandbox:** works immediately as an installable local-first PWA. Records remain in that browser; balances and transfers are non-monetary drafts.
- **Cloud application:** becomes multi-user after a real Firebase project is configured, Auth is enabled, rules/indexes are deployed and `firebaseProductionMode` is set to `true`.
- **Regulated settlement:** stays disabled until a licensed payment provider or user-controlled wallet integration passes KYC/AML, reconciliation, dispute, custody/security and jurisdiction-specific legal review.

The browser contains no Gemini secret. Set `GEMINI_KEY` only in the server environment. JARVIS supports browser speech recognition and spoken replies; microphone availability requires browser permission and HTTPS.

The clone now contains working local-first flows plus production Firebase and JARVIS boundaries. Do not label production services live until this checklist is complete.

1. Serve the site over HTTPS or localhost. Do not use `file://` for authentication, media uploads, service workers, or location permissions.
2. In Firebase Authentication, enable Email/Password. Add the deployed hostname under Authorized domains. Configure the verification-email sender and template.
3. Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json`.
4. In `functions/`, run `npm install`, then deploy the Firebase functions. The exported functions now include scoped notifications, emergency-wallet creation, private-ballot aggregation, proposal initialization and the scheduled governance lifecycle.
5. Set `firebaseProductionMode: true` only after steps 1-4 pass in staging. Enable `firebaseDemoSync` only for a dedicated demo database with matching rules.
6. Never store raw CNIC in Firestore, Storage, analytics, logs, or localStorage. Use an authorized KYC/NADRA integration through a server-side provider. Store only provider reference, status, timestamps and minimal display metadata such as last four digits.
7. Run the safe `jarvis-bridge/gaigs_bridge.py` service with a long random token and restricted origins. Never expose `E:\jarvis\mobile_control.py` or its PC-control endpoints to the public internet.
8. Payment donations require a licensed payment provider, webhook signature verification, idempotency keys and double-entry ledger posting. The current UI remains clearly marked as simulated until that exists.

Governance pilot activation additionally requires a reviewed KYC workflow that changes
`users/{uid}.kycStatus` from `pending` to `verified` on the server. Never give the
browser permission to self-verify. Create city, country, global, auditor and system
roles as server-owned `scopeAssignments` documents; users can read only their own
active assignments.

The provider-agnostic `kycProviderWebhook` accepts only a minimal signed result
(`eventId`, `uid`, `status`, `providerReference`) using the
`GAIGS_KYC_WEBHOOK_SECRET` HMAC secret. It is replay-safe and never accepts a raw
CNIC. A chosen authorized KYC vendor must still supply the hosted verification
session and call this webhook after review.

Deployment skeleton is included in `firebase.json`:

`firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting`

## Release builds

Use `npm run verify` for the repeatable local quality gate. A real hosted build
must use `npm run build:production`; it intentionally fails until the Firebase
public configuration and legal operator contact variables listed in
`scripts/prepare-production.js` are present. This prevents a sandbox-labelled or
ownerless privacy policy from being published accidentally.

The Android source targets API 36. `npm run package:android:production` generates
the production account configuration for both web and Android, then refreshes
the native assets without replacing it with preview settings. The standard
Android workflow produces an unsigned QA bundle. The protected **Play signed
bundle** workflow produces the production AAB after the Firebase/operator and
`GAIGS_UPLOAD_*` secrets have been added; never commit the keystore or passwords.

The DAO deploy script defaults to Sepolia and refuses Ethereum mainnet unless
the explicit mainnet safety switch is set. Contract addresses must only be put
into production configuration after source verification, parameter review,
multisignature ownership setup, incident rehearsal and an independent audit.

Recommended staging command for the bridge:

`python -m uvicorn gaigs_bridge:app --host 127.0.0.1 --port 8781`
