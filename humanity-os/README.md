# Humanity OS · Humanity Mosaic

Humanity OS is a new, isolated PWA under `/humanity-os/`. The existing `/gaigs/` application is intentionally unchanged.

## What works on a device

- Responsive social, problems, jobs/services, communities, governance, wallet-boundary, creator, inbox and JARVIS views.
- Create posts/problems/needs/services/jobs/proposals with optional local photo/video storage.
- IndexedDB device vault with generated ECDSA P-256 device identity.
- SHA-256 content hashes, signed append-only events and previous-event links.
- Local integrity verification, same-origin tab announcements, and signed JSON bundle export/import.
- External EIP-1193 wallet connection without private-key custody.
- Voice commands where the browser provides Web Speech recognition.
- Separate constitutional protocol console with signed, scoped, expiring, threshold action drafts.
- Source-linked public creator collections, founder profile and first community record.

## Production boundaries

This build does **not** claim that public identity, multi-user delivery, regulated fiat custody, live donations, authoritative vote counting or contract execution are online. Those features require a configured identity/cloud network, appropriate legal and payment providers, deployed/audited contracts, and independent operational keys. UI copy keeps those boundaries visible.

Ahmed and Hamid are represented only as unclaimed invitations until each person consents and verifies an account. Drive files remain at their public source and enter the app only as reviewable source-linked drafts.

## Routes

- `/humanity-os/` — Humanity Mosaic member app
- `/humanity-os/admin.html` — constitutional protocol steward console
- `/gaigs/` — preserved existing GAIGS app
