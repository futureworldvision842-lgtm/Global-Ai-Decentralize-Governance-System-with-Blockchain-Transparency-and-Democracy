# GAIGS Play Data safety working draft

Do not submit this draft unchanged. Reconcile it against the exact production
Firebase, KYC, AI, analytics, crash-reporting, map, payment and hosting vendors
before every Play release.

## Data the planned production app handles

| Play data area | GAIGS use | Shared publicly or with members |
|---|---|---|
| Name, email, phone | Account, verification, security and contact | Name/profile fields only when the user publishes them |
| Government-ID metadata | KYC status, provider reference and CNIC last four | Never public; raw CNIC must remain at the authorized KYC provider |
| Approximate/precise location | Nearby societies/services and map actions | Precise device location stays private; posts expose only user-approved approximate location |
| Photos and videos | User posts, evidence, profile/company media | Only when the user publishes to a chosen scope |
| Audio/voice | JARVIS speech input on device or through the configured AI proxy | Not public; production provider retention must be disclosed |
| Messages and user content | Direct messages, posts, comments, votes and evidence | Per selected audience; direct messages remain participant-only |
| Professional information | Skills, services, work requests and company pages | User-controlled public or scoped profile fields |
| Financial activity | Project contribution and settlement receipts when a licensed provider is connected | Aggregate project totals can be public; private provider/payment details cannot |
| App interactions/diagnostics | Security, abuse prevention and reliability if production diagnostics are enabled | Not public |

GAIGS does not request contacts, SMS, call logs, background location or broad
photo/video-library access. Android uses the system picker for user-selected
media and foreground location permission for nearby features.

## Purpose declarations to verify in Play Console

- App functionality: accounts, communities, nearby discovery, messages,
  governance, services, projects, emergencies and JARVIS.
- Account management: authentication, verification, fraud/abuse prevention,
  security notices and deletion.
- Optional personalization: location/content relevance and skill matching. Do
  not describe paid ranking or ad targeting unless those features are added.
- Analytics and diagnostics: select only if the production build actually sends
  these events to a named provider.

## Required operator checks

- Confirm encryption in transit for every endpoint and provider.
- Confirm retention/deletion periods, processor contracts and cross-border data
  handling with counsel.
- Keep raw government ID, wallet private keys and seed phrases out of GAIGS.
- Test in-app deletion and the hosted `delete-account.html` request path.
- Publish `privacy.html` on the same verified production domain.
- Give Play review a non-privileged test account and explain gated/KYC features.
- Update this draft whenever a provider, SDK, permission or data flow changes.

Reference: https://support.google.com/googleplay/android-developer/answer/10787469
