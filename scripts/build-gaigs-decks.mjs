import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "file:///C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const ROOT = "E:/Muhammad's Work VP automation/anti gravity wrokd/gaigs-v2-jarvis";
const OUT = `${ROOT}/output/presentations`;
const RENDER = `${ROOT}/output/presentations/rendered`;
const HERO = `${ROOT}/gaigs/social-preview.png`;
const OVERVIEW = `${ROOT}/assets/presentation/gaigs-overview.png`;

const C = {
  navy: "#06111E", navy2: "#0A2133", panel: "#0D2A3D", ink: "#EAF7FF",
  muted: "#A9C4D5", cyan: "#20C9F4", blue: "#2F7FFF", green: "#4DE1A1",
  yellow: "#F6C85F", coral: "#FF7E78", line: "#1D5068", white: "#FFFFFF",
};

async function bytes(path) {
  const b = await fs.readFile(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function box(slide, x, y, w, h, fill = C.panel, radius = 22, line = C.line, opacity = 1) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function rule(slide, x, y, w, color = C.line, h = 2) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function txt(slide, value, x, y, w, h, size = 24, color = C.ink, bold = false, align = "left") {
  const s = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  s.text = value;
  s.text.style = { fontSize: size, color, bold, alignment: align, fontFamily: "Aptos" };
  return s;
}

function dot(slide, x, y, r = 9, color = C.cyan) {
  return slide.shapes.add({
    geometry: "ellipse",
    position: { left: x - r, top: y - r, width: r * 2, height: r * 2 },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function base(slide, title, eyebrow, index) {
  slide.background.fill = C.navy;
  txt(slide, eyebrow.toUpperCase(), 64, 42, 690, 24, 13, C.cyan, true);
  txt(slide, title, 64, 76, 1110, 62, 38, C.ink, true);
  rule(slide, 64, 144, 1152, C.line, 2);
  txt(slide, "NEWDAWN G.A.I.G.S.", 64, 679, 260, 18, 11, C.muted, true);
  txt(slide, String(index).padStart(2, "0"), 1160, 679, 56, 18, 11, C.muted, true, "right");
}

function notes(slide, sourceLines, talk = "") {
  slide.speakerNotes.textFrame.setText(`${talk}\n\n[Sources]\n${sourceLines.map((s) => `- ${s}`).join("\n")}\n[/Sources]`);
}

function addImage(slide, blob, alt, x, y, w, h, fit = "cover", radius = "rounded-2xl") {
  return slide.images.add({ blob, contentType: "image/png", alt, fit,
    position: { left: x, top: y, width: w, height: h }, geometry: "roundRect", borderRadius: radius });
}

function metric(slide, value, label, x, y, color = C.cyan) {
  txt(slide, value, x, y, 180, 54, 36, color, true);
  txt(slide, label, x, y + 50, 190, 58, 16, C.muted, false);
}

function statusRow(slide, y, name, live, pilot, roadmap) {
  txt(slide, name, 82, y, 330, 36, 18, C.ink, true);
  for (const [x, active, color] of [[540, live, C.green], [740, pilot, C.yellow], [955, roadmap, C.blue]]) {
    if (active) { dot(slide, x, y + 15, 8, color); rule(slide, x + 14, y + 14, 80, color, 2); }
    else dot(slide, x, y + 15, 5, C.line);
  }
}

function flow(slide, labels, y, accent = C.cyan) {
  const start = 70;
  const total = 1140;
  const gap = 20;
  const w = (total - gap * (labels.length - 1)) / labels.length;
  labels.forEach((label, i) => {
    const x = start + i * (w + gap);
    dot(slide, x + 18, y + 34, 14, i === labels.length - 1 ? C.green : accent);
    txt(slide, String(i + 1), x + 8, y + 23, 20, 20, 12, C.navy, true, "center");
    txt(slide, label, x + 40, y + 14, w - 44, 52, 17, C.ink, true);
    if (i < labels.length - 1) rule(slide, x + w - 2, y + 33, gap + 4, C.line, 2);
  });
}

function titleSlide(p, hero, subtitle, audience) {
  const s = p.slides.add();
  s.background.fill = C.navy;
  addImage(s, hero, "People gathered around a connected Earth representing the GAIGS action network", 660, 0, 620, 720);
  txt(s, "NEWDAWN G.A.I.G.S.", 70, 64, 420, 30, 15, C.cyan, true);
  txt(s, "Social media gave us a voice.\nGAIGS builds the power to act.", 70, 146, 690, 180, 48, C.white, true);
  txt(s, subtitle, 70, 350, 660, 96, 23, C.ink, false);
  rule(s, 70, 500, 300, C.cyan, 4);
  txt(s, audience, 70, 530, 480, 35, 16, C.green, true);
  txt(s, "Identity → Community → Decision → Funding → Proof", 70, 608, 760, 28, 18, C.white, true);
  notes(s, ["GAIGS current public build: https://gaigs-jarvis-v2.qw01.chatgpt.site/gaigs/", "GAIGS source briefs supplied by founder, accessed 2026-08-11"], "Open with the distinction between attention and coordinated action.");
}

function buildInvestor(hero, overview) {
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  titleSlide(p, hero, "A people-owned operating system for local action, work, governance and verifiable public benefit.", "INVESTOR BRIEF · MVP RELEASE 2.4.1");

  let s = p.slides.add(); base(s, "The gap is not voice. It is execution.", "Why now", 2);
  txt(s, "People already publish needs, discover work, raise money and debate decisions—across disconnected systems that lose context between the problem and the proof.", 64, 180, 1120, 92, 25, C.ink, false);
  rule(s, 110, 340, 1040, C.line, 3);
  const problems = [["ATTENTION", "A post is seen"], ["COORDINATION", "People and skills gather"], ["DECISION", "A rule produces consent"], ["EXECUTION", "Funds and work move"], ["PROOF", "The result is inspectable"]];
  problems.forEach((v, i) => { const x = 86 + i * 235; dot(s, x, 340, 12, i < 2 ? C.cyan : C.line); txt(s, v[0], x - 18, 384, 190, 30, 16, i < 2 ? C.cyan : C.muted, true); txt(s, v[1], x - 18, 422, 185, 60, 17, C.ink); });
  txt(s, "GAIGS connects the entire chain—and records where the chain is still incomplete.", 245, 560, 790, 45, 24, C.green, true, "center");
  notes(s, ["GAIGS Investor Pitch Memorandum v1 (founder-supplied)", "GAIGS MVP Plan (founder-supplied)"], "Frame GAIGS as an execution layer, not another generic social feed.");

  s = p.slides.add(); base(s, "One loop turns a local need into a verified result.", "The product loop", 3);
  flow(s, ["Secure identity", "Join a real community", "Share evidence", "Discuss and vote", "Fund and deliver", "Verify impact"], 220);
  txt(s, "JARVIS assists across the loop, while publication, voting and transfers remain human-approved.", 170, 390, 940, 56, 24, C.ink, true, "center");
  box(s, 210, 486, 860, 94, C.navy2, 26, C.cyan);
  txt(s, "North-star metric", 248, 507, 190, 22, 14, C.cyan, true);
  txt(s, "Verified Actions Completed", 460, 500, 520, 38, 28, C.green, true);
  notes(s, ["GAIGS Technical Master Plan v2 Visual (founder-supplied)", "Current product interaction model, accessed 2026-08-11"], "The loop is the product; individual modules exist to keep evidence and consent connected.");

  s = p.slides.add(); base(s, "The working MVP already carries the full product shape.", "Product evidence", 4);
  addImage(s, overview, "Authenticated GAIGS operations dashboard", 64, 176, 755, 425, "cover");
  txt(s, "LIVE NOW", 870, 178, 240, 26, 14, C.green, true);
  const liveItems = ["Account registration + login", "Dedicated GCR wallet", "Media posts + rewards", "Proposals, votes + project wallet", "Public web + installable Android preview"];
  liveItems.forEach((t, i) => { dot(s, 882, 240 + i * 62, 7, C.green); txt(s, t, 904, 226 + i * 62, 290, 42, 18, C.ink, i === 0); });
  notes(s, ["GAIGS live product: https://gaigs-jarvis-v2.qw01.chatgpt.site/gaigs/", "Automated production smoke test completed 2026-08-11"], "Use the live product rather than a conceptual mock-up. Avoid claiming regulated settlement or public-chain anchoring.");

  s = p.slides.add(); base(s, "One identity can serve personal, professional and civic life.", "Identity and locality", 5);
  const cx = 330, cy = 360;
  dot(s, cx, cy, 72, C.blue); txt(s, "YOU", cx - 48, cy - 20, 96, 40, 27, C.white, true, "center");
  const nodes = [["PROFILE", 120, 210], ["SKILLS", 150, 510], ["SOCIETY", 520, 200], ["COMPANY", 560, 500]];
  nodes.forEach(([label, x, y], i) => { rule(s, Math.min(cx,x)+20, Math.min(cy,y)+10, Math.abs(cx-x)+15, C.line, 3); dot(s, x, y, 34, [C.cyan,C.green,C.yellow,C.coral][i]); txt(s, label, x-56, y+46, 112, 28, 15, C.ink, true, "center"); });
  txt(s, "Location narrows discovery without making exact coordinates public by default.", 710, 220, 450, 70, 25, C.ink, true);
  txt(s, "Nearby communities", 710, 330, 210, 30, 18, C.cyan, true); txt(s, "Local services and work", 710, 382, 250, 30, 18, C.green, true); txt(s, "City and country missions", 710, 434, 280, 30, 18, C.yellow, true); txt(s, "Global collaboration when invited", 710, 486, 330, 30, 18, C.coral, true);
  notes(s, ["GAIGS Mobile App Investor Brief v1 (founder-supplied)", "GAIGS current privacy copy, accessed 2026-08-11"], "Identity is shared only by explicit scope and workflow; exact location remains controlled.");

  s = p.slides.add(); base(s, "Governance is a transparent workflow, not a permanent ruler.", "Community DAO", 6);
  flow(s, ["Problem + evidence", "Open discussion", "Eligible vote", "Rule-based outcome", "Project wallet", "Milestones + proof"], 190, C.blue);
  box(s, 96, 340, 490, 210, C.navy2, 24, C.line);
  txt(s, "Administrator", 130, 372, 200, 30, 20, C.cyan, true); txt(s, "A clerk with bounded permissions: verifies process, publishes records and can be replaced by member rules.", 130, 420, 400, 90, 21, C.ink);
  box(s, 686, 340, 490, 210, C.navy2, 24, C.line);
  txt(s, "Member sovereignty", 720, 372, 260, 30, 20, C.green, true); txt(s, "Members can inspect evidence, vote, see fund movements and challenge missing proof within their scope.", 720, 420, 400, 90, 21, C.ink);
  notes(s, ["GAIGS constitution and governance modules in current repository", "GAIGS Full Interactive Platform Technical Plan v3 (founder-supplied)"], "Current MVP approval threshold is intentionally simplified; production constitutions require community-specific eligibility and quorum rules.");

  s = p.slides.add(); base(s, "Accountability starts before a public blockchain.", "Wallet and trust layers", 7);
  const layers = [["USER WALLET", "Closed-loop GCR credits", C.cyan], ["PROJECT WALLET", "Funds tied to one approved plan", C.blue], ["LEDGER RECEIPTS", "Hash-linked records detect tampering", C.green], ["PUBLIC ANCHOR", "Planned after audit and regulation", C.yellow]];
  layers.forEach((v, i) => { const y=190+i*96; box(s, 100+i*34, y, 850-i*68, 70, C.navy2, 18, v[2]); txt(s,v[0],130+i*34,y+15,250,28,18,v[2],true); txt(s,v[1],410+i*15,y+15,470,30,18,C.ink); });
  txt(s, "GCR is currently a platform credit—not money, a bank account or a tradable crypto asset.", 930, 250, 260, 180, 24, C.coral, true, "center");
  notes(s, ["GAIGS production API implementation, deployed 2026-08-11", "GAIGS Technical Master Plan v2 Visual (founder-supplied)"], "This distinction protects credibility: live hash-chain integrity today; regulated settlement and public anchoring later.");

  s = p.slides.add(); base(s, "JARVIS is useful because it is bounded by human approval.", "Personal AI", 8);
  dot(s, 320, 360, 96, C.cyan); txt(s, "J", 270, 300, 100, 100, 72, C.navy, true, "center");
  const ai = [["EXPLAINS", "rules, evidence and options"], ["DRAFTS", "posts, proposals and plans"], ["NAVIGATES", "the relevant workspace"], ["REMEMBERS", "approved device preferences"]];
  ai.forEach((v,i)=>{ const y=190+i*92; txt(s,v[0],560,y,190,28,17,[C.cyan,C.blue,C.green,C.yellow][i],true); txt(s,v[1],750,y,380,34,22,C.ink); rule(s,560,y+48,560,C.line,2); });
  txt(s, "Never autonomous", 130, 545, 250, 30, 17, C.coral, true); txt(s, "People publish, vote and approve transfers.", 390, 541, 590, 36, 22, C.ink, true);
  notes(s, ["GAIGS personal JARVIS v2 module", "Current product UI and policy copy, accessed 2026-08-11"], "Reject the unsafe 'self-spreading' idea. The defensible product is consent-based assistance with revocable integrations.");

  s = p.slides.add(); base(s, "Local work can become the fastest path to daily utility.", "Services marketplace", 9);
  txt(s, "A resident posts a need", 86, 210, 260, 38, 23, C.ink, true); txt(s, "JARVIS ranks nearby matches", 390, 210, 320, 38, 23, C.ink, true); txt(s, "Provider completes verified work", 760, 210, 380, 38, 23, C.ink, true);
  rule(s, 250, 292, 750, C.line, 4); dot(s,250,294,15,C.cyan); dot(s,625,294,15,C.blue); dot(s,1000,294,15,C.green);
  txt(s, "Tailoring · food · transport · repair · tutoring · digital freelance · company pages", 130, 350, 1020, 40, 22, C.muted, false, "center");
  box(s, 180, 445, 920, 100, C.navy2, 24, C.green); txt(s, "Trust loop", 220, 476, 160, 28, 18, C.green, true); txt(s, "Identity + proximity + evidence + outcome + reputation", 400, 468, 620, 42, 27, C.ink, true);
  notes(s, ["GAIGS Marketplace module", "GAIGS Mobile App Investor Brief v1 (founder-supplied)"], "The immediate wedge is local service coordination; remote freelance and fulfillment depth can follow.");

  s = p.slides.add(); base(s, "Emergencies need coordination without invented certainty.", "Evidence and response", 10);
  const emergency = [["SIGNAL", "A public alert or member report"], ["VERIFY", "Source, time, place and evidence"], ["MISSION", "Needs, skills and response owners"], ["FUND", "A dedicated transparent project wallet"], ["PROOF", "Delivery evidence and public receipt"]];
  emergency.forEach((v,i)=>{const y=180+i*84; txt(s,String(i+1).padStart(2,"0"),80,y,50,28,15,C.cyan,true); txt(s,v[0],150,y,150,28,18,C.ink,true); txt(s,v[1],340,y,800,42,20,C.muted); if(i<4) rule(s,103,y+36,2,C.line,26);});
  notes(s, ["GAIGS Emergency Response module", "GDACS API quickstart, referenced by founder"], "External alerts should remain source-linked and clearly separated from member reports until verified.");

  s = p.slides.add(); base(s, "Humanity Lab turns unsolved problems into collaborative missions.", "Long-term engagement", 11);
  txt(s, "Not a game layered on top of reality.", 80, 190, 540, 42, 26, C.ink, true);
  txt(s, "A mission system where scientific puzzles, community problems and field verification generate reputation for useful contribution.", 80, 250, 520, 150, 23, C.muted);
  const mission = [["DISCOVER",C.cyan],["MODEL",C.blue],["TEST",C.yellow],["APPLY",C.green],["VERIFY",C.coral]];
  mission.forEach((v,i)=>{const x=700+(i%3)*170,y=190+Math.floor(i/3)*180; dot(s,x,y,48,v[1]); txt(s,v[0],x-70,y+66,140,26,16,C.ink,true,"center"); if(i<4) rule(s,x+48,y,75,C.line,3);});
  txt(s, "ROADMAP", 80, 500, 140, 25, 14, C.yellow, true); txt(s, "Pilot only after real mission review, safety rules and contribution scoring are tested.", 230, 493, 850, 42, 21, C.ink);
  notes(s, ["GAIGS Humanity Lab module", "Muhammad's revelationary idea (founder-supplied)"], "Position this as a retention and discovery layer, not as a claim that scientific problems are automatically solved.");

  s = p.slides.add(); base(s, "The architecture is local-first, shared where coordination requires it.", "System design", 12);
  const arch = [["DEVICE", "Private preferences\nOffline cache\nSecure token store", C.cyan], ["SHARED EDGE", "Accounts\nPosts + media\nVotes + wallets", C.blue], ["PUBLIC PROOF", "Hash receipts\nAuditable exports\nFuture chain anchor", C.green]];
  arch.forEach((v,i)=>{const x=70+i*400; box(s,x,200,330,300,C.navy2,26,v[2]); txt(s,v[0],x+32,228,270,30,18,v[2],true); txt(s,v[1],x+32,292,270,150,25,C.ink,true,"center"); if(i<2){rule(s,x+330,350,70,C.line,4); dot(s,x+365,352,9,v[2]);}});
  txt(s, "Cloudflare edge + D1 + object storage now · peer mesh and public anchoring later", 180, 555, 920, 35, 20, C.muted, true, "center");
  notes(s, ["GAIGS Full Interactive Platform Technical Plan v3 (founder-supplied)", "Current deployed Sites architecture, 2026-08-11"], "Phones are not silently turned into servers. Local-first data, opt-in sync and shared edge services are the safe MVP boundary.");

  s = p.slides.add(); base(s, "Credibility comes from separating live product from ambition.", "Release truth", 13);
  txt(s, "CAPABILITY", 82, 170, 330, 24, 13, C.muted, true); txt(s, "LIVE", 505, 170, 90, 24, 13, C.green, true); txt(s, "PILOT", 700, 170, 90, 24, 13, C.yellow, true); txt(s, "ROADMAP", 910, 170, 130, 24, 13, C.blue, true);
  statusRow(s,220,"Accounts, profiles and media",true,false,false); statusRow(s,280,"GCR wallet and receipt chain",true,false,false); statusRow(s,340,"Proposals and project wallets",true,false,false); statusRow(s,400,"Email/KYC provider integration",false,true,false); statusRow(s,460,"Encrypted peer messaging + mesh",false,true,false); statusRow(s,520,"Public-chain anchor + real money",false,false,true);
  notes(s, ["GAIGS production smoke test, 2026-08-11", "Current repository and release manifest"], "This slide is the diligence anchor. Do not collapse pilot or roadmap items into the live column.");

  s = p.slides.add(); base(s, "Start with one community, prove the loop, then copy the institution.", "Go-to-market", 14);
  const stages = [["01", "BEACHHEAD", "Jamia Masjid Nabvi Qureshi Hashmi", C.cyan], ["02", "NEARBY SOCIETIES", "Resident identity + local service liquidity", C.blue], ["03", "CITY NETWORK", "Shared missions and interoperable reputation", C.green], ["04", "COUNTRY / GLOBAL", "Federated standards and public proof", C.yellow]];
  stages.forEach((v,i)=>{const x=70+i*300; txt(s,v[0],x,185,70,36,20,v[3],true); rule(s,x,230,250,v[3],4); txt(s,v[1],x,260,250,38,19,C.ink,true); txt(s,v[2],x,315,245,100,19,C.muted);});
  metric(s,"1", "working community first", 160, 500, C.cyan); metric(s,"30%+", "weekly action completion target", 470, 500, C.green); metric(s,"< 24h", "time-to-first useful match target", 800, 500, C.yellow);
  notes(s, ["GAIGS Investor Pitch Memorandum v1 (founder-supplied)", "Founder-provided Jamia Masjid Nabvi model site"], "Targets are proposed pilot goals, not achieved traction.");

  s = p.slides.add(); base(s, "The business can monetize coordination without selling civic trust.", "Business model", 15);
  const rev = [["SERVICE FEES", "Optional fee on completed commercial work"], ["ORGANIZATION TOOLS", "Verified company and society workspaces"], ["AI ASSISTANCE", "Paid advanced JARVIS workflows"], ["PUBLIC-GOOD FUNDING", "Grants and mission partnerships"]];
  rev.forEach((v,i)=>{const y=185+i*98; txt(s,v[0],90,y,260,30,18,[C.cyan,C.blue,C.green,C.yellow][i],true); txt(s,v[1],390,y,760,44,22,C.ink); rule(s,90,y+56,1060,C.line,2);});
  txt(s, "Guardrail", 90, 585, 120, 24, 15, C.coral, true); txt(s, "No advertising model that rewards outrage or hides public decisions.", 235, 578, 850, 35, 21, C.ink, true);
  notes(s, ["GAIGS Investor Pitch Memorandum v1 (founder-supplied)"], "Pricing and unit economics remain to be validated in the community pilot.");

  s = p.slides.add(); base(s, "A focused seed round can turn the MVP into a governed pilot.", "Investment decision", 16);
  txt(s, "$750k–$1.5m", 80, 180, 500, 70, 48, C.green, true); txt(s, "illustrative 12–18 month seed range", 82, 255, 520, 34, 19, C.muted);
  const uses = [["35%","PRODUCT + MOBILE"],["25%","TRUST + SECURITY"],["20%","COMMUNITY PILOT"],["12%","DATA + AI"],["8%","LEGAL + OPS"]];
  let xpos=80; uses.forEach((v,i)=>{const widths=[360,255,205,125,95]; const w=widths[i]; box(s,xpos,360,w,80,[C.cyan,C.blue,C.green,C.yellow,C.coral][i],8,"none"); txt(s,v[0],xpos+14,374,w-28,28,22,C.navy,true); txt(s,v[1],xpos+14,406,w-28,18,11,C.navy,true); xpos+=w+8;});
  txt(s, "Milestones: audited identity + wallet controls · one measurable community pilot · repeatable society onboarding · Android store-ready build", 80, 510, 1100, 75, 22, C.ink, true);
  notes(s, ["GAIGS Investor Pitch Memorandum v1 (founder-supplied)"], "The range and allocation are illustrative and subject to an operating budget, legal review and investor diligence.");

  s = p.slides.add(); s.background.fill=C.navy; addImage(s,hero,"People-owned global action network",620,0,660,720,"cover",0); txt(s,"Build the first network\nwhere decisions end in proof.",70,105,590,155,44,C.white,true); txt(s,"The MVP is live. The next question is whether one community can complete the loop repeatedly, safely and measurably.",70,310,500,120,24,C.muted); rule(s,70,480,330,C.green,4); txt(s,"GAIGS",70,515,220,42,30,C.cyan,true); txt(s,"gaigs-jarvis-v2.qw01.chatgpt.site",70,570,480,30,17,C.ink,true); notes(s,["GAIGS current public build: https://gaigs-jarvis-v2.qw01.chatgpt.site/gaigs/"],"Close on the pilot decision, not a promise of global domination.");
  return p;
}

function buildPublic(hero, overview) {
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  titleSlide(p, hero, "One place to connect, work, decide, fund and prove positive action—starting with your real community.", "PUBLIC EXPLAINER · WHAT GAIGS IS");
  let s=p.slides.add(); base(s,"GAIGS is a social action network.","The simple idea",2); txt(s,"A post should be able to become a plan—not disappear into a feed.",80,190,1050,62,31,C.ink,true); flow(s,["Share the problem","Find people + skills","Decide together","Fund the plan","Prove the result"],330); txt(s,"Your identity, location and decisions stay under your control.",250,520,780,42,24,C.green,true,"center"); notes(s,["GAIGS public build and founder-supplied product brief"],"Explain the difference between social media attention and social action.");
  s=p.slides.add(); base(s,"Your dashboard begins with what is useful nearby.","Personal space",3); addImage(s,overview,"Authenticated GAIGS personal operations dashboard",64,176,760,430); txt(s,"COMMUNITY",870,190,280,28,15,C.cyan,true); txt(s,"See nearby societies and local missions.",870,224,310,64,21,C.ink,true); txt(s,"WORK",870,324,280,28,15,C.green,true); txt(s,"Offer skills or ask for a service.",870,358,310,64,21,C.ink,true); txt(s,"ACTION",870,458,280,28,15,C.yellow,true); txt(s,"Post evidence, vote and follow proof.",870,492,310,64,21,C.ink,true); notes(s,["GAIGS live product: https://gaigs-jarvis-v2.qw01.chatgpt.site/gaigs/"],"This is the actual authenticated MVP interface.");
  s=p.slides.add(); base(s,"Post the real problem—with media, place and evidence.","Action feed",4); txt(s,"Text",95,210,160,44,26,C.cyan,true); txt(s,"Photo",300,210,160,44,26,C.blue,true); txt(s,"Video",505,210,160,44,26,C.green,true); txt(s,"Location",710,210,180,44,26,C.yellow,true); txt(s,"Scope",945,210,160,44,26,C.coral,true); rule(s,120,300,970,C.line,4); [120,325,530,735,970].forEach((x,i)=>dot(s,x,302,14,[C.cyan,C.blue,C.green,C.yellow,C.coral][i])); txt(s,"Personal · Society · City · Country · Global",250,380,780,46,27,C.ink,true,"center"); txt(s,"The author chooses who can see the record. Exact location is not public by default.",210,478,860,70,22,C.muted,false,"center"); notes(s,["GAIGS social and upload modules, production release 2026-08-11"],"The current MVP accepts image/video uploads and location labels; audience scope is explicit.");
  s=p.slides.add(); base(s,"Turn skills into nearby work—or reach the world.","Services",5); const skills=[["LOCAL","Food, repair, transport, tailoring"],["PROFESSIONAL","Design, code, research, consulting"],["COMPANY","Create a page and receive requests"]]; skills.forEach((v,i)=>{const y=190+i*125; txt(s,v[0],85,y,220,28,18,[C.cyan,C.green,C.yellow][i],true); txt(s,v[1],340,y,780,44,24,C.ink,true); rule(s,85,y+66,1040,C.line,2);}); box(s,180,570,920,54,C.navy2,18,C.green); txt(s,"JARVIS can help match the request. People still agree the terms.",215,584,850,26,19,C.green,true,"center"); notes(s,["GAIGS marketplace module", "GAIGS Mobile App Investor Brief v1"],"Marketplace depth is an evolving module; local matching is the initial use case.");
  s=p.slides.add(); base(s,"A community decision stays connected to its money and proof.","Society governance",6); flow(s,["Evidence","Discussion","Vote","Project wallet","Milestones","Public proof"],220,C.blue); txt(s,"Admins manage the process—not the people.",250,395,780,48,27,C.green,true,"center"); txt(s,"Members can inspect, vote and replace bounded roles under the community constitution.",190,480,900,70,22,C.muted,false,"center"); notes(s,["GAIGS governance and constitution modules"],"Production-grade eligibility, quorum and appeals need community-specific legal review.");
  s=p.slides.add(); base(s,"Your wallet is an audit trail before it is a financial product.","Wallet",7); metric(s,"100 GCR","welcome platform credits",90,205,C.cyan); metric(s,"SHA-256","hash-linked receipts",410,205,C.green); metric(s,"0","hidden fund movements",760,205,C.yellow); txt(s,"Today",90,390,110,28,16,C.green,true); txt(s,"Closed-loop credits, member transfers, rewards and project wallets.",230,382,870,45,23,C.ink,true); txt(s,"Later",90,480,110,28,16,C.blue,true); txt(s,"Regulated settlement and public-chain anchoring after audit and legal readiness.",230,472,870,62,23,C.ink,true); notes(s,["GAIGS production API and ledger verification, 2026-08-11"],"GCR is not money, a bank account or a tradable token in the MVP.");
  s=p.slides.add(); base(s,"Your JARVIS helps everywhere—but never takes your vote.","Personal AI",8); dot(s,250,340,96,C.cyan); txt(s,"J",205,280,90,100,70,C.navy,true,"center"); const j=[["Explain","What a rule or proposal means"],["Draft","A post, plan or response"],["Navigate","Open the right workspace"],["Remember","Only approved device preferences"]]; j.forEach((v,i)=>{txt(s,v[0],500,190+i*90,160,30,20,[C.cyan,C.blue,C.green,C.yellow][i],true);txt(s,v[1],680,190+i*90,430,38,22,C.ink);}); txt(s,"YOU APPROVE: publish · vote · transfer",450,575,620,28,18,C.coral,true,"center"); notes(s,["GAIGS personal JARVIS v2 and policy modules"],"The assistant is designed around consent, revocable access and human approval.");
  s=p.slides.add(); base(s,"Disaster response deserves its own transparent mission.","Emergency response",9); flow(s,["Alert","Verify","List needs","Match help","Fund response","Show delivery"],230,C.coral); box(s,200,410,880,90,C.navy2,24,C.coral); txt(s,"Every alert keeps its source, timestamp, location scope and verification state.",245,435,790,42,23,C.ink,true,"center"); notes(s,["GAIGS emergency response module", "GDACS public alert model referenced by founder"],"External feeds are source signals, not automatically verified truth.");
  s=p.slides.add(); base(s,"Local control can still connect into a global network.","Federated scopes",10); const scopes=[["PERSONAL",130,C.cyan],["SOCIETY",220,C.blue],["CITY",310,C.green],["COUNTRY",400,C.yellow],["GLOBAL",490,C.coral]]; scopes.forEach((v,i)=>{const w=1000-i*150; box(s,140+i*75,v[1]+40,w,64,C.navy2,22,v[2]); txt(s,v[0],170+i*75,v[1]+56,220,28,18,v[2],true);}); txt(s,"A record travels outward only when its purpose and audience require it.",320,620,640,30,20,C.ink,true,"center"); notes(s,["GAIGS scope model and current interface"],"Federation is the design direction; full peer-to-peer synchronization remains a pilot.");
  s=p.slides.add(); base(s,"Privacy means control you can see and revoke.","Safety boundaries",11); const safe=[["DEVICE","Local preferences and offline cache",C.cyan],["SHARED","Only data needed for coordination",C.blue],["PUBLIC","Rules, decisions and proofs meant for inspection",C.green]]; safe.forEach((v,i)=>{const x=80+i*395; box(s,x,205,340,245,C.navy2,24,v[2]); txt(s,v[0],x+30,238,260,28,19,v[2],true); txt(s,v[1],x+30,302,270,90,24,C.ink,true,"center");}); txt(s,"CNIC is hashed; exact identity documents are not written into public posts or a blockchain.",160,530,960,70,23,C.muted,false,"center"); notes(s,["GAIGS production identity implementation, 2026-08-11"],"Provider-backed KYC and recovery flows remain pending before public onboarding at scale.");
  s=p.slides.add(); base(s,"Humanity Lab will reward useful thinking—not endless scrolling.","Science missions",12); txt(s,"A water problem in a mountain village can become a global challenge.",80,190,1080,48,28,C.ink,true); flow(s,["Define","Research","Model","Test","Apply","Verify"],315,C.green); txt(s,"Contribution earns reputation when the evidence survives review.",230,490,820,45,25,C.green,true,"center"); txt(s,"ROADMAP",520,565,240,28,15,C.yellow,true,"center"); notes(s,["GAIGS Humanity Lab module", "Founder-supplied scientific game concept"],"This is a roadmap concept requiring safety review and domain-expert validation.");
  s=p.slides.add(); base(s,"The MVP is real—and its limits are visible.","What works today",13); txt(s,"LIVE",90,185,160,32,18,C.green,true); txt(s,"Registration · login · profile · avatar · media posts · rewards · GCR wallet · transfers · proposals · votes · project wallet · public web · Android preview",90,230,1050,120,26,C.ink,true); txt(s,"NEXT",90,405,160,32,18,C.yellow,true); txt(s,"Email/KYC provider · encrypted messaging · community eligibility rules · app-store signing",90,450,1050,70,24,C.ink,true); txt(s,"LATER",90,560,160,32,18,C.blue,true); txt(s,"Public-chain anchoring · regulated money movement · broad peer mesh",260,552,850,42,22,C.ink,true); notes(s,["GAIGS production smoke test, 2026-08-11", "Current release manifest"],"The product deliberately labels unavailable capabilities instead of simulating success.");
  s=p.slides.add(); s.background.fill=C.navy; addImage(s,hero,"People connected through a people-owned action network",610,0,670,720,"cover",0); txt(s,"Your world.\nYour decisions.\nYour power to act.",70,90,560,190,46,C.white,true); txt(s,"Open the live platform, create a secure account and help prove one real action from problem to result.",70,350,500,120,24,C.ink); rule(s,70,510,330,C.cyan,4); txt(s,"OPEN GAIGS",70,545,220,28,16,C.green,true); txt(s,"gaigs-jarvis-v2.qw01.chatgpt.site",70,585,500,30,18,C.white,true); notes(s,["GAIGS live platform: https://gaigs-jarvis-v2.qw01.chatgpt.site/gaigs/"],"Invite participation while keeping the release limitations transparent.");
  return p;
}

async function exportDeck(presentation, stem) {
  const dir = `${RENDER}/${stem}`;
  await fs.mkdir(dir, { recursive: true });
  console.log(`${stem}: pptx`);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/${stem}.pptx`);
}

await fs.mkdir(OUT, { recursive: true });
console.log("loading assets");
const hero = await bytes(HERO);
const overview = await bytes(OVERVIEW);
console.log("building investor");
const investorDeck = buildInvestor(hero, overview);
console.log("exporting investor");
await exportDeck(investorDeck, "GAIGS-Investor-Deck-2026");
console.log("building public");
const publicDeck = buildPublic(hero, overview);
console.log("exporting public");
await exportDeck(publicDeck, "GAIGS-Public-Explainer-2026");
console.log("GAIGS decks exported.");
