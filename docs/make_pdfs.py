# Generates two PDFs: (1) technical platform documentation for the engineering team,
# (2) investor pitch. Pure reportlab, brand-styled.
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, HRFlowable, ListFlowable, ListItem)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import os

CYAN = colors.HexColor("#1877f2")
DARK = colors.HexColor("#0a1a2f")
GREEN = colors.HexColor("#1e9e57")
GOLD = colors.HexColor("#b57c0a")
MUTED = colors.HexColor("#5a6b7a")
LINE = colors.HexColor("#d6dde5")

OUT = os.path.dirname(os.path.abspath(__file__))

ss = getSampleStyleSheet()
def S(name, **kw):
    base = kw.pop("parent", ss["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

H0 = S("H0", fontName="Helvetica-Bold", fontSize=26, textColor=DARK, leading=30, spaceAfter=4)
SUB = S("SUB", fontName="Helvetica", fontSize=12, textColor=MUTED, leading=16, spaceAfter=2)
H1 = S("H1", fontName="Helvetica-Bold", fontSize=15, textColor=CYAN, leading=19, spaceBefore=14, spaceAfter=6)
H2 = S("H2", fontName="Helvetica-Bold", fontSize=11.5, textColor=DARK, leading=15, spaceBefore=8, spaceAfter=3)
BODY = S("BODY", fontSize=10, leading=15, textColor=colors.HexColor("#1c2733"), spaceAfter=5)
SMALL = S("SMALL", fontSize=8.5, leading=12, textColor=MUTED)
BULLET = S("BULLET", fontSize=10, leading=14, textColor=colors.HexColor("#1c2733"))
KICK = S("KICK", fontName="Helvetica-Bold", fontSize=9, textColor=CYAN, leading=12, spaceAfter=2)

def bullets(items, style=BULLET):
    return ListFlowable([ListItem(Paragraph(t, style), leftIndent=10, value="•") for t in items],
                        bulletType="bullet", start="•", leftIndent=12, spaceAfter=6)

def hr():
    return HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=4, spaceAfter=8)

def chip_table(rows, headers, col_w):
    data = [[Paragraph(f"<b>{h}</b>", S("th", fontSize=9, textColor=colors.white)) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), SMALL) for c in r])
    t = Table(data, colWidths=col_w, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), CYAN),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f2f6fa")]),
        ("GRID", (0,0), (-1,-1), 0.4, LINE),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20*mm, 12*mm, "NewDawn / OnePieceJourney — Muhammad Qureshi · onepiecejourney-crew.netlify.app")
    canvas.drawRightString(190*mm, 12*mm, "Page %d" % doc.page)
    canvas.setStrokeColor(LINE); canvas.line(20*mm, 15*mm, 190*mm, 15*mm)
    canvas.restoreState()

def cover(title, subtitle, tag):
    el = []
    el.append(Spacer(1, 60))
    el.append(Paragraph("⬡ NEWDAWN", S("logo", fontName="Helvetica-Bold", fontSize=13, textColor=CYAN, alignment=TA_CENTER)))
    el.append(Spacer(1, 10))
    el.append(Paragraph(tag, S("covtag", fontName="Helvetica-Bold", fontSize=9, textColor=GOLD, alignment=TA_CENTER)))
    el.append(Spacer(1, 8))
    el.append(Paragraph(title, S("covt", fontName="Helvetica-Bold", fontSize=28, textColor=DARK, alignment=TA_CENTER, leading=33)))
    el.append(Spacer(1, 12))
    el.append(Paragraph(subtitle, S("covs", fontSize=13, textColor=MUTED, alignment=TA_CENTER, leading=18)))
    el.append(Spacer(1, 26))
    el.append(HRFlowable(width="40%", thickness=1.2, color=CYAN, hAlign="CENTER"))
    el.append(Spacer(1, 20))
    el.append(Paragraph("Muhammad Qureshi — Naib Imam, Jamia Masjid-e-Nabawi Qureshi Hashmi, G-11/4 Islamabad<br/>"
                        "AI researcher · author · founder", S("cova", fontSize=10, textColor=MUTED, alignment=TA_CENTER, leading=15)))
    el.append(Spacer(1, 6))
    el.append(Paragraph("Live demo: onepiecejourney-crew.netlify.app", S("covl", fontSize=10, textColor=CYAN, alignment=TA_CENTER)))
    el.append(PageBreak())
    return el

# =========================================================================
# PDF 1 — TECHNICAL PLATFORM DOCUMENTATION (for the engineering team)
# =========================================================================
def build_tech():
    doc = SimpleDocTemplate(os.path.join(OUT, "NewDawn-Platform-Technical-Documentation.pdf"),
        pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm,
        title="NewDawn Platform — Technical Documentation")
    e = []
    e += cover("Platform Technical<br/>Documentation",
               "What it is, what's built, and the full engineering roadmap",
               "FOR THE ENGINEERING TEAM · v1.0")

    e.append(Paragraph("1 · Executive Overview", H1)); e.append(hr())
    e.append(Paragraph("<b>NewDawn (a.k.a. OnePieceJourney)</b> is a people-owned civic operating system — a single "
        "platform that fuses the familiar mechanics of Facebook, Uber/inDrive, Reddit, Binance and online banking "
        "with decentralized governance, transparent community treasuries, AI assistance (JARVIS), and a "
        "problem→solution→vote→fund→execute→verify workflow. The guiding rule: <b>AI explains, people decide.</b>", BODY))
    e.append(Paragraph("Core hierarchy: <b>Individual → Community/Society → City → Country → Global</b>. "
        "Each level has its own members, rules (set by member vote), public wallet/treasury, proposals, projects "
        "and an open ledger. Content is scoped: a global issue reaches everyone; a country issue reaches that "
        "country; a city issue that city; a society issue only its members.", BODY))

    e.append(Paragraph("2 · The Product Idea (frontend formula)", H1)); e.append(hr())
    e.append(bullets([
        "<b>Facebook</b> — familiar profiles, feed, groups, posts, comments, uploads.",
        "<b>Uber / inDrive</b> — location, nearby activity, request, matching, live status, earn with your skills.",
        "<b>Reddit</b> — up/down voting, threaded discussions that turn into proposals.",
        "<b>Binance / online banking</b> — wallet, balances, transactions, transparent ledgers.",
        "<b>SiteDeck (desktop)</b> — command-center dashboard, live world map, modular panels.",
        "<b>JARVIS</b> — a personalized AI intelligence + action layer on every screen.",
    ]))
    e.append(Paragraph("Identity: <i>a familiar social app on mobile; a powerful civic command center on desktop; "
        "a personalized JARVIS inside both.</i>", BODY))

    e.append(Paragraph("3 · What is BUILT today (working demo)", H1)); e.append(hr())
    e.append(Paragraph("Live at onepiecejourney-crew.netlify.app — a fully interactive front-end demo where all "
        "data is stored on the user's own device (localStorage), embodying the \"your phone is the database\" model.", BODY))
    e.append(chip_table([
        ["Onboarding", "Name/phone/email → demo OTP → self-custody wallet (address + seed + tokens)", "LIVE"],
        ["Profile & identity", "Personal profile, role, skills, ownership shares (NDS)", "LIVE"],
        ["Societies", "Join request → admin approval; members list; per-location demo societies", "LIVE"],
        ["Society treasury", "Public DAO wallet visible to all members; moves only by vote; open ledger", "LIVE"],
        ["Governance", "Proposals, YES/NO/VETO (≥33% veto blocks), tiers, auto fund-release", "LIVE"],
        ["Discussions", "Reddit-style threads; upvotes; discussion → proposal", "LIVE"],
        ["Feed", "Facebook-style posts with purpose types; problem→Discuss/Ask-JARVIS/Propose/Support", "LIVE"],
        ["Daily brief", "Personalized \"here's what needs your attention\" + JARVIS suggestion", "LIVE"],
        ["Services", "Ride (inDrive-style bidding), food, P2P business directory (0% tax)", "LIVE"],
        ["Disaster relief", "Alert → relief account → receipts + ground reports on open ledger", "LIVE"],
        ["Science game", "Real-world problem quests → points + token bounties + leaderboard", "LIVE"],
        ["World map", "Canvas map: communities, creators, disaster zones", "LIVE"],
        ["Markets", "Live BTC/ETH/GOLD via public API (real data in the demo UI)", "LIVE"],
        ["Branch panels", "Global → Country → City → Society admin views + join approvals", "LIVE"],
        ["JARVIS (web)", "Serverless Gemini assistant; anyone can talk to it; key server-side", "LIVE"],
        ["PWA install", "Installable to home screen from the site; offline-capable", "LIVE"],
    ], ["Module", "What works in the demo", "Status"], [70, 300, 45]))

    e.append(PageBreak())
    e.append(Paragraph("4 · Current architecture (honest)", H1)); e.append(hr())
    e.append(Paragraph("The demo is a static, client-side application (HTML/CSS/vanilla JS) deployed on Netlify, "
        "plus one serverless function that proxies the AI so the API key stays server-side. There is intentionally "
        "no central database yet — state lives in the browser. This proves the UX and the \"phones-as-database\" "
        "concept, but it is NOT yet a multi-user networked system.", BODY))
    e.append(bullets([
        "Frontend: static HTML/CSS/JS; PWA (manifest + service worker); Facebook-light + ops-dark themes.",
        "AI: Netlify serverless function → Google Gemini (key in env var). Powers content + assistant.",
        "Hosting: Netlify (site) + optional Render/Oracle VM for a 24/7 WhatsApp JARVIS bot.",
        "Data: on-device localStorage (demo). No shared backend, no real blockchain yet.",
    ]))

    e.append(Paragraph("5 · Target architecture (what the team must build)", H1)); e.append(hr())
    e.append(Paragraph("To become a real multi-user platform, the following layers are required:", BODY))
    e.append(Paragraph("5.1 Frontend (modernize)", H2))
    e.append(bullets([
        "React + TypeScript, Tailwind, accessible component primitives.",
        "TanStack Query (server state) + Zustand (light client state); Framer Motion (restrained).",
        "MapLibre for the world map; Recharts for charts; PWA; i18n with RTL Urdu/Arabic.",
        "Mobile: 5-tab bottom nav (Home, Explore, Create, Wallet, Profile) + floating JARVIS orb.",
        "Desktop: top nav + collapsible left rail + modular workspace + right-side JARVIS panel.",
    ]))
    e.append(Paragraph("5.2 Backend & data", H2))
    e.append(bullets([
        "API: REST/GraphQL (Node/NestJS or similar). Auth (JWT), real OTP (Twilio/local SMS), roles & permissions.",
        "Database: Postgres (users, societies, proposals, votes, projects, ledger, services, discussions).",
        "Realtime: WebSockets for feed, votes, chat, live map, notifications.",
        "Storage: object storage (S3/Cloudflare R2) for media; IPFS for public evidence/receipts.",
        "Search & geo: geospatial queries for nearby societies/services (PostGIS).",
    ]))
    e.append(Paragraph("5.3 Blockchain layer (Ethereum ecosystem)", H2))
    e.append(bullets([
        "Smart contracts (Solidity): Society DAO (membership, roles), Voting (proposal, quorum, veto), "
        "Treasury (multi-sig, milestone releases), Project Registry (budgets, receipts, verification).",
        "Start on a testnet (Polygon/Base) — free; move to L2 mainnet for production.",
        "Wallets: WalletConnect/MetaMask; account-abstraction for smooth UX; keys on the user's device.",
        "Off-chain ↔ on-chain: index events (The Graph); IPFS hashes anchored on-chain for tamper-proof ledgers.",
    ]))
    e.append(Paragraph("5.4 Decentralized data (the \"phones-as-database\" vision)", H2))
    e.append(bullets([
        "Local-first storage on device; sync via CRDTs; peer replication so users' devices form the network.",
        "Public/verifiable data anchored to IPFS + chain; private data encrypted, key held by the user.",
        "Honest note: true full decentralization is a research-grade effort — recommend a hybrid (server + "
        "on-device + chain-anchored proofs) for the first funded version.",
    ]))
    e.append(Paragraph("5.5 JARVIS (intelligence layer)", H2))
    e.append(bullets([
        "Context service: permission-scoped user context (location, communities, skills, open votes, wallet).",
        "Actions: explain proposal, compare options, draft proposal, match services, summarize ledger, translate.",
        "Governance-safe: JARVIS advises only; it never casts votes or moves funds. Every AI output is labeled.",
        "Auto-update societies: when members vote a rule change, JARVIS drafts + propagates the updated ruleset.",
    ]))
    e.append(Paragraph("5.6 Mobile app / APK", H2))
    e.append(bullets([
        "Fastest path: ship the PWA as an installable app now (works today from the site).",
        "For an actual APK / Play Store: wrap the PWA (Capacitor/TWA) or build React Native — funded phase.",
    ]))

    e.append(PageBreak())
    e.append(Paragraph("6 · Governance & rules engine", H1)); e.append(hr())
    e.append(Paragraph("Workflow: <b>Issue → Evidence → AI analysis → Discussion → Proposal → Vote → Fund → "
        "Execute → Verify</b>. Each society defines its own rules (quorum %, veto threshold, spending limits, "
        "admin powers) by member vote; changes are versioned and audit-logged. Global/City/Country admins "
        "coordinate but cannot secretly control votes or funds — every admin action is on a public audit log.", BODY))

    e.append(Paragraph("7 · Recommended build order", H1)); e.append(hr())
    e.append(bullets([
        "1. Design system + app shell (React/TS).",
        "2. Auth + onboarding (real OTP, location consent, purpose, nearby societies).",
        "3. Home feed + purposeful posts.",
        "4. Community profile + join flow + members + public treasury.",
        "5. Proposal + discussion + voting + ledger (DB first, chain second).",
        "6. Project tracking + receipts + verification.",
        "7. JARVIS context service + actions.",
        "8. World map + tiered content scope.",
        "9. Marketplace (services, earn-with-skills).",
        "10. Emergency module. 11. Science Lab. 12. Admin panels (society→global).",
        "13. Smart contracts on testnet → integrate. 14. Harden, audit, pilot.",
    ]))

    e.append(Paragraph("8 · Status legend & honest scope", H1)); e.append(hr())
    e.append(chip_table([
        ["LIVE", "Working in the demo today (client-side)", "signup, profiles, societies, feed, voting, demo wallet, JARVIS, map, services, brief"],
        ["PILOT", "Next, with a small funded team", "real DB + auth, provider marketplace, AI policy analysis, KYC, community fund"],
        ["ROADMAP", "Funded multi-year build", "on-chain treasury, real crypto/fiat, cross-border, full ride/delivery ops, 3D science game, gov integration"],
    ], ["Tier", "Meaning", "Examples"], [45, 120, 250]))
    e.append(Spacer(1, 8))
    e.append(Paragraph("This honesty is a feature, not a weakness: it makes the platform investable and protects "
        "the founder's credibility. Nothing in the demo is presented as a finished, production, or at-scale system.", SMALL))

    e.append(Paragraph("9 · Team to hire", H1)); e.append(hr())
    e.append(bullets([
        "Frontend engineers (React/TS, maps, PWA), Backend engineers (Node, Postgres, realtime),",
        "Blockchain engineers (Solidity, L2, account abstraction), Mobile (RN/Capacitor),",
        "AI engineer (LLM integration, RAG, safety), DevOps/security, Product designer, and",
        "domain advisors (governance, Islamic finance/ethics, community pilots).",
    ]))

    doc.build(e, onFirstPage=lambda c,d: None, onLaterPages=footer)
    return "NewDawn-Platform-Technical-Documentation.pdf"

# =========================================================================
# PDF 2 — INVESTOR PITCH
# =========================================================================
def build_pitch():
    doc = SimpleDocTemplate(os.path.join(OUT, "NewDawn-Investor-Pitch.pdf"),
        pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm,
        title="NewDawn — Investor Pitch")
    e = []
    e += cover("Investor Pitch",
               "A people-owned operating system for humanity",
               "CONFIDENTIAL · SEED ROUND · v1.0")

    e.append(Paragraph("The One-Liner", KICK))
    e.append(Paragraph("Social media gave us a voice. NewDawn gives us the power to <b>act</b>.", H0))
    e.append(Spacer(1, 4))
    e.append(Paragraph("One platform that connects people, communities, AI, transparent funding, voting, "
        "services and real-world problem-solving — owned by the people who use it.", SUB))
    e.append(hr())

    e.append(Paragraph("1 · The Problem", H1))
    e.append(bullets([
        "The world can <b>see</b> every injustice on social media — but can't <b>act</b>. Voice without power.",
        "Public money is untraceable; decisions are made without consent; a few control the many.",
        "Today's platforms extract ~30% and own your data, identity and attention.",
        "AI is concentrating power further — a fork in history with no people-owned alternative on the table.",
    ]))

    e.append(Paragraph("2 · The Solution", H1))
    e.append(Paragraph("A civic operating system: <b>Identity → Community → Discussion → Proposal → Vote → Fund "
        "→ Execute → Verify</b> — with AI that explains and people who decide. Five pillars:", BODY))
    e.append(bullets([
        "Decentralized, bottom-up governance (society → city → country → global).",
        "Radical transparency — every public coin on an open ledger; citizens can veto.",
        "AI as a public utility that informs, never decides.",
        "A global science game turning 2B+ gamers into problem-solvers.",
        "Education that frees, and services (rides, food, business) with ~0% platform tax.",
    ]))

    e.append(Paragraph("3 · Why Now", H1))
    e.append(bullets([
        "AI makes a one-person-plus-AI company possible — proven by the founder building JARVIS + this platform.",
        "Blockchain makes transparent, tamper-proof public treasuries real and cheap (L2s).",
        "Global trust in institutions and Big Tech is collapsing — demand for a people-owned option is rising.",
    ]))

    e.append(Paragraph("4 · Traction & Proof", H1))
    e.append(chip_table([
        ["Working demo", "Full interactive platform live: onepiecejourney-crew.netlify.app"],
        ["Content reach", "9M+ organic views on the founder's Afkaar shorts channel; 3K+ subscribers"],
        ["Execution proof", "JARVIS — a real, open-source AI operating system, built solo with AI"],
        ["Real community", "The Medina-model community running physically at the founder's mosque"],
        ["Live AI ambassador", "A public JARVIS on the site that pitches and answers 24/7"],
    ], ["", ""], [90, 300]))

    e.append(PageBreak())
    e.append(Paragraph("5 · Product", H1)); e.append(hr())
    e.append(Paragraph("Mobile feels like Facebook + Uber + Reddit + banking in one; desktop is a civic command "
        "center with a live world map. A personalized JARVIS lives inside both — explaining proposals, drafting "
        "them, matching services, and summarizing where every rupee went.", BODY))
    e.append(Paragraph("6 · Business Model (ethical, real)", H1)); e.append(hr())
    e.append(bullets([
        "Small, transparent transaction fee on marketplace/services (far below the ~30% incumbents take).",
        "Optional premium tools for creators, agencies and community admins (analytics, automation, AI).",
        "Treasury infrastructure & verification-as-a-service for institutions/NGOs wanting transparent funds.",
        "No selling of user data. No fake engagement. Value comes from real activity, not surveillance.",
    ]))

    e.append(Paragraph("7 · Market", H1)); e.append(hr())
    e.append(bullets([
        "Intersects social (billions of users), the creator economy, fintech/wallets, civic-tech and DAOs.",
        "Beachhead: community organizations (mosques, churches, unions, neighborhoods, diasporas) that "
        "already pool funds and make decisions — starting in Pakistan, then the global Muslim community, then all.",
    ]))

    e.append(Paragraph("8 · Roadmap & Use of Funds", H1)); e.append(hr())
    e.append(chip_table([
        ["Phase 1 (now)", "Working demo + audience", "DONE"],
        ["Phase 2 (seed)", "Real backend + auth, testnet treasury, marketplace, first pilots at partner communities", "6–12 mo"],
        ["Phase 3", "L2 on-chain treasury, mobile apps, AI policy analysis, multi-community scale", "12–24 mo"],
        ["Phase 4", "Global scale, science game, institutional/gov integrations", "24 mo+"],
    ], ["Phase", "Milestones", "Timeline"], [70, 275, 55]))
    e.append(Spacer(1, 6))
    e.append(Paragraph("Seed funds go to: a small engineering team (frontend, backend, blockchain, AI), security "
        "audits, community pilots, and content that grows the movement.", BODY))

    e.append(Paragraph("9 · The Ask", H1)); e.append(hr())
    e.append(Paragraph("We are raising a <b>seed round</b> to turn a proven demo + audience into a piloted, "
        "on-chain, multi-community product. We seek investors and a founding team who believe the next operating "
        "system for humanity should be owned by humanity.", BODY))
    e.append(Paragraph("Honest scope: today there is a working MVP/demo and strong organic traction — not a "
        "finished at-scale platform. That is exactly what this round builds.", SMALL))

    e.append(Spacer(1, 14))
    e.append(HRFlowable(width="100%", thickness=0.8, color=CYAN))
    e.append(Spacer(1, 8))
    e.append(Paragraph("Muhammad Qureshi · Founder", H2))
    e.append(Paragraph("WhatsApp REDACTED · linkedin.com/in/muhammad-qureshi-9939b1383<br/>"
        "Demo: onepiecejourney-crew.netlify.app · JARVIS: onepiecejourney-crew.netlify.app/jarvis.html", BODY))

    doc.build(e, onLaterPages=footer)
    return "NewDawn-Investor-Pitch.pdf"

if __name__ == "__main__":
    print("Built:", build_tech())
    print("Built:", build_pitch())
