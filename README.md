# GAIGS — Global AI-enabled Decentralized Governance System

**Your world. Your decisions. Your power to act.**

Solo-founder interactive MVP. Planned community pilot in Islamabad, Pakistan. Seeking technical co-founders, pilot partners, grants and pre-seed.

GAIGS is a mobile-first social action and civic coordination platform. It brings
social publishing, encrypted messaging, nearby skills and services, communities,
maps, democratic proposals, transparent project accounts, emergency workflows,
science missions and a personal JARVIS assistant into one connected product.

- **GitHub Pages (primary):** [interactive demo](https://futureworldvision842-lgtm.github.io/Global-Ai-Decentralize-Governance-System-with-Blockchain-Transparency-and-Democracy/gaigs/) and [governance MVP](https://futureworldvision842-lgtm.github.io/Global-Ai-Decentralize-Governance-System-with-Blockchain-Transparency-and-Democracy/mvp.html)
- **External demo host (secondary):** <https://gaigs-jarvis-v2.qw01.chatgpt.site/gaigs/> — the AI explainer on this host is an external demo and may be unavailable
- **Android preview:** <https://gaigs-jarvis-v2.qw01.chatgpt.site/downloads/GAIGS-JARVIS-v2-preview.apk>
- **Privacy:** [privacy.html](https://futureworldvision842-lgtm.github.io/Global-Ai-Decentralize-Governance-System-with-Blockchain-Transparency-and-Democracy/privacy.html)
- **Account deletion:** [delete-account.html](https://futureworldvision842-lgtm.github.io/Global-Ai-Decentralize-Governance-System-with-Blockchain-Transparency-and-Democracy/delete-account.html)

## Mission

Move humanity from fragmented attention to coordinated, democratic action.
People should be able to document a real problem, connect the right community
and skills, make a transparent decision, organize resources and follow the work
to a verified outcome—without giving an administrator or an AI unchecked power.

## The GAIGS action loop

1. **Post** the problem with evidence, scope and a safe approximate location.
2. **Connect** relevant members, nearby skills and responsible community roles.
3. **Discuss** evidence, cost, risk and competing solutions in a visible room.
4. **Decide** through an eligible, rule-bound member vote.
5. **Fund** an approved project through its own transparent pilot account.
6. **Execute** measurable milestones with configured human approvals.
7. **Prove** the result with evidence, independent verification and an audit trail.

The older GAIGS source applications were not modified. This repository contains
the isolated, upgraded v2/JARVIS product. Open `gaigs/index.html` through HTTPS
or a local web server; `app.html` redirects to the same unified interface.

## What you can try today (status labelled)

Status words used below: **INTERACTIVE DEMO** (you can click through it), **SANDBOX** (simulated records, including “SIMULATION — NOT REAL MONEY” for credits), and **ROADMAP** (not available as a live service). There is no live pilot.

- **INTERACTIVE DEMO.** Installable, mobile-first PWA shell with explicit offline and cloud modes.
- **INTERACTIVE DEMO.** Email/password account creation. This demo does not collect a CNIC or a phone number. Email verification still needs a mail provider.
- **INTERACTIVE DEMO.** Profiles, approximate-location posts, media upload, scoped feed, comments,
  reactions, follow/save/report/block and community discovery.
- **INTERACTIVE DEMO.** Hybrid messaging: E2E-encrypted private envelopes online, device-local
  plaintext, delivery/read receipts, hash-chained conversation receipts,
  public auditable civic rooms, and opt-in Android Nearby Connections relay
  over Bluetooth/Wi-Fi when internet is unavailable.
- **INTERACTIVE DEMO.** A transparent recommendation model with visible weights for declared-interest
  relevance, coarse proximity, evidence, trust and freshness, plus Latest,
  Nearby and Verified Impact controls. Private chats and contacts are
  excluded from ranking. The demo does not collect CNIC or phone numbers.
- **INTERACTIVE DEMO.** Society registration, membership review,
  scoped roles, moderation and append-only admin audit entries.
- **INTERACTIVE DEMO.** Proposal records and one ballot per account. Turnout and eligibility stay empty unless a real eligible count is stored. A two-ballot approval path is labelled a demo rule.
- **INTERACTIVE DEMO.** A versioned people-first constitution: formation petitions,
  boundary evidence, elected clerk mandates, recall and society-to-city federation.
- **INTERACTIVE DEMO.** Role-scoped society/city/country/global/system operations access. Viewing a
  scope does not grant operator authority.
- **INTERACTIVE DEMO.** Leaflet/OpenStreetMap rendering for registered centers, the private device
  location and opt-in approximate post pins. The map does not invent member or turnout totals.
- **INTERACTIVE DEMO.** Voice-first JARVIS navigation commands plus an external explainer proxy.
  The AI explainer may be unavailable. JARVIS cannot vote, publish, approve or move money.
- **SANDBOX.** An interactive Three.js/Cannon-es Humanity Lab physics run with touch controls,
  reproducible run hash and review submission. Completion does not mint money or
  certify science.
- **SANDBOX.** Emergency report, evidence upload, two-person independent verification,
  and a zero-balance relief account. SIMULATION — NOT REAL MONEY.
- **SANDBOX.** Civic project records created from approved proposals. SIMULATION — NOT REAL MONEY.
- **INTERACTIVE DEMO.** Company/public pages and a scoped news-and-evidence workspace.
- **ROADMAP.** A non-custodial Ethereum DAO gateway and the included contracts. They are not a live network, coin, or settlement rail.
- **SANDBOX.** Two interactive Humanity Lab sandboxes, including the deterministic Daily
  Resilience World for flood, water, shelter and energy planning.
- **INTERACTIVE DEMO.** In-app privacy controls and an account-deletion page. The mobile app, global network and people-owned coin remain roadmap items.

## Capability boundaries

- The local/offline account and wallet are sandbox records, not a bank or crypto
  wallet.
- Nearby mode is a GAIGS protocol inspired by public store-and-forward mesh
  designs; it is not wire-compatible with the independent bitchat app. Nearby
  peers must compare Android's verification code, and radio use remains subject
  to OS permissions, battery controls and real device range/density.
- Private DMs are encrypted on participant devices. City/country/global and
  proposal rooms are deliberately public/auditable and must never be presented
  as private chat.
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

It executes the complete deterministic logic/source test suite, compiles all four
production-direction Solidity contracts and builds the allow-listed web release.

Deployable Firebase configuration is included in `firebase.json`. Never switch
`firebaseProductionMode` to true until Auth, rules, indexes, Storage and Functions
have been deployed and exercised in staging.

## Licence

The code in this repository is released under the MIT License. Copyright (c) 2026 Muhammad Qureshi. See `LICENSE` and `NOTICE`.

Documentation and images created by Muhammad Qureshi are available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Third-party assets, decks and images he does not own are excluded from that grant. GAIGS / Future World Vision is not an incorporated company.
