# GAIGS unified platform clone

This is the development clone. The older source applications were not modified.
Open `gaigs/index.html` through HTTPS or a local web server; `app.html` redirects
to the same unified interface.

## What currently works

- Installable, mobile-first PWA shell with explicit offline and cloud modes.
- Email/password account creation and email verification when Firebase is
  configured; CNIC is reduced to last-four display metadata pending a real KYC
  provider.
- Profiles, approximate-location posts, media upload, scoped feed, comments,
  reactions, follow/save/report/block, messages and community discovery.
- Society registration, private residence join requests, membership review,
  scoped roles, moderation and append-only admin audit entries.
- Deterministic proposal rules, one immutable private ballot per eligible cloud
  account, server aggregate tally and scheduled lifecycle finalization.
- A versioned people-first constitution: verified resident formation petitions,
  boundary evidence, elected clerk mandates, recall and society-to-city federation.
- Role-scoped society/city/country/global/system operations access. Viewing a
  scope does not grant operator authority.
- Real Leaflet/OpenStreetMap rendering for registered centers, the private device
  location and opt-in approximate post pins. Fake global map counters are not
  used by the map workspace.
- Voice-first JARVIS navigation commands plus an authenticated server proxy for
  AI explanations. JARVIS cannot vote, publish, approve or move money.
- An interactive Three.js/Cannon-es Humanity Lab physics run with touch controls,
  reproducible run hash and review submission. Completion does not mint money or
  certify science.
- Emergency report, evidence upload, two-person independent verification,
  server-created zero-balance relief account and scoped notifications.
- Transparent civic projects created from approved proposals, with confirmed
  contributions, evidence-hashed milestones, independent verification and
  vote-authorized releases.
- Company/public pages and a scoped news-and-evidence workspace.
- A non-custodial Ethereum DAO gateway for the configured testnet. The included
  contracts implement verified membership, one-address-one-ballot governance,
  timelocked execution, pull-based milestone withdrawals and aggregate anchoring.
- Two interactive Humanity Lab sandboxes, including the deterministic Daily
  Resilience World for flood, water, shelter and energy planning.
- In-app privacy controls and authenticated account-deletion workflow, plus the
  public privacy and deletion pages needed for Play Console declarations.

## Capability boundaries

- The local/offline account and wallet are sandbox records, not a bank or crypto
  wallet.
- Real deposits, transfers, donations, escrow and withdrawals require a licensed
  provider or user-controlled wallet integration plus webhooks, idempotency,
  double-entry reconciliation, disputes, KYC/AML and legal/security review.
- Historical token/treasury prototypes remain non-deployable. The four
  production-direction contracts compile and are intentionally testnet-only
  until their deployment parameters, tests and independent security audit are
  complete.
- City, country, global, auditor and system operator roles are server-issued.
- `file://` is suitable only for visual exploration. Authentication, service
  workers, media, maps, microphone/location and shared records need HTTPS or
  localhost.

Read `docs/GAIGS_PRODUCT_SOURCE_OF_TRUTH.md` for the reconciled product contract
and `GAIGS_PRODUCTION_SETUP.md` for activation steps.

## Verification

Run the complete local verification suite:

`npm run verify`

It executes 30 deterministic logic/source tests, compiles all four
production-direction Solidity contracts and builds the allow-listed web release.

Deployable Firebase configuration is included in `firebase.json`. Never switch
`firebaseProductionMode` to true until Auth, rules, indexes, Storage and Functions
have been deployed and exercised in staging.
