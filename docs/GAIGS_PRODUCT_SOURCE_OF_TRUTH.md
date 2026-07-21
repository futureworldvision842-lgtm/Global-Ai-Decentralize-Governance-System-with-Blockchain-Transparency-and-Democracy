# GAIGS Product Source of Truth

This file reconciles the supplied GAIGS plans, investor material, Humanity OS
blueprints, prompts, conversations, and the current application into one build
contract. If an older screen or document conflicts with this file, this file is
the implementation default until a reviewed rule amendment replaces it.

## Product promise

GAIGS turns a verified person's local problem, skill, idea, or contribution into
a traceable path:

`identity -> community -> evidence -> discussion -> decision -> funding -> work -> proof`

The interface should feel as familiar as a social app, while every high-impact
action has stronger consent, authority, privacy, and audit boundaries than a
normal social network.

## Non-negotiable principles

1. One account can hold several separately verified roles.
2. Location is private by default. Public profiles expose city-level location
   only when the person opts in; exact residence evidence goes only to authorized
   society reviewers.
3. JARVIS may explain, summarize, compare, translate, draft, search, match,
   remind, and navigate. It may never cast a vote, approve a member, publish,
   change a rule, conceal a source, or move money for a person.
4. An administrator operates a process; an administrator does not own the
   community's decision or treasury.
5. Votes are one verified member, one vote. Individual ballot records are private;
   public results are aggregated and auditable.
6. Public financial records are append-only. A correction creates a new linked
   entry instead of erasing history.
7. No screen may describe a local record as a bank payment, crypto settlement, or
   blockchain transaction. Those labels require a connected licensed provider or
   confirmed network receipt.
8. Global reach is achieved through explicit geographic scopes: society, city,
   country, and global. A higher-level operator cannot rewrite a lower-level vote.
9. Emergency funds open only after an incident record is created; donations,
   allocations, receipts, delivery evidence, and disputes stay connected.
10. Offline mode is useful but honest: device-only records sync only after a
    verified account reconnects, and conflicts are resolved by server rules.

## Capability status language

- **Live pilot**: connected, multi-user, enforced by server rules, monitored, and
  suitable for a bounded real community pilot.
- **Connected sandbox**: talks to real test infrastructure but cannot move real
  money or create legally binding outcomes.
- **Offline sandbox**: stored on one device for safe exploration.
- **Roadmap**: designed but not yet implemented or independently verified.

No generic "working", "verified", "blockchain", or "live" badge should appear
without one of these precise states and its evidence.

## Roles and authority

| Role | May do | May not do |
|---|---|---|
| Member | post, discuss, submit evidence, propose, cast own eligible vote, apply for work | vote for others, approve own evidence, move public funds |
| Society moderator | review scoped content and reports | manage membership, change rules, decide votes |
| Society committee | review membership and milestones with recorded reasons | erase records, unilaterally release funds |
| Society treasurer | record approved allocations, receipts, and settlement references | invent approval, approve own high-value release |
| Society admin | configure the society workspace and assign permitted society roles | change ballots, decide outcomes, spend alone |
| City operator | maintain the city directory, escalations, cross-society missions | control society votes or treasuries |
| Country operator | maintain country programs, standards, and escalations | control city or society decisions |
| Global operator | coordinate global missions, emergency visibility, and shared standards | act as a world government or seize local authority |
| Auditor | inspect permitted logs, proofs, and controls | mutate source records |
| System admin | operate platform configuration, security, and abuse controls | cast user votes or move user/community money |

All operator assignments are server-issued, scoped, expiring, and auditable.

## Connected object model

- A post can become an issue, service request, emergency report, or proposal.
- A proposal references its scope, rule version, evidence, discussion, eligible
  population snapshot, ballots, aggregate tally, and outcome.
- An approved proposal can create a project.
- A project contains responsible roles, milestones, receipts, proof, verification,
  disputes, and linked ledger entries.
- A service request progresses through request, offers, selection, milestone,
  proof, rating, and dispute.
- An emergency connects incident verification, a relief account, donations,
  allocations, delivery proof, and a public final report.
- A Humanity Lab challenge connects constraints, datasets, teams, simulations,
  submissions, peer review, scoring, and any field pilot.

## Deliberately familiar UX

The mobile default has five primary destinations: Home, Explore, Create, Wallet,
and Profile. Complexity is progressively disclosed. Every screen answers three
questions first: what needs me, what can I do, and what proof/status exists.
Ranking prioritizes selected scope, safety, relevance, freshness, and diversity;
payment or sponsorship never silently outranks a more relevant local result.

## Release order

1. Verified identity, private profile, location consent, and community membership.
2. Scoped feed, evidence, discussion, notifications, and moderation.
3. Deterministic proposal lifecycle, private ballots, aggregate tally, and audit.
4. Project milestones and append-only double-entry public ledger.
5. Service marketplace lifecycle and regulated payment/user-wallet integration.
6. Verified emergency workflow and relief traceability.
7. Humanity Lab challenge workspace and scoring.
8. Native mobile packaging, offline conflict handling, security audit, and pilot.

Blockchain anchoring is an audit hardening step after the underlying identity,
authorization, ledger, recovery, dispute, and operational controls work correctly.
