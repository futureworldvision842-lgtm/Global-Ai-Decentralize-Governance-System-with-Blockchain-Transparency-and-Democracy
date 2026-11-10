export const DRIVE_ROOT = "https://drive.google.com/drive/folders/1Jr_BeXJ-oZaSM3qPmAUvAOFy5GTpwZFX?usp=sharing";
export const PODCASTS_FOLDER = "https://drive.google.com/drive/folders/18CA3Sj4jwhvDGbYseg-Rmql-0Ub5GUPR";

export const seedProfile = {
  id: "muhammad-qureshi",
  name: "Muhammad Qureshi",
  handle: "@muhammad",
  initials: "MQ",
  city: "Islamabad",
  country: "Pakistan",
  headline: "Founder, Fikr o Nizam · GAIGS builder · Community systems",
  skills: ["Systems thinking", "Community governance", "Writing", "AI workflows"],
  verified: "source-linked",
  source: "https://www.linkedin.com/in/muhammad-qureshi-9939b1383/",
};

export const seedProfiles = [
  seedProfile,
  { id: "ahmed-invite", name: "Ahmed", initials: "AH", city: "Islamabad", headline: "Invited collaborator", skills: ["Community support"], verified: "claimable" },
  { id: "hamid-invite", name: "Hamid", initials: "HM", city: "Islamabad", headline: "Invited collaborator", skills: ["Field coordination"], verified: "claimable" },
  { id: "sara-khan", name: "Sara Khan", initials: "SK", city: "Islamabad", headline: "Water systems engineer", skills: ["Water quality", "Civil engineering"], verified: "demo" },
  { id: "ali-raza", name: "Ali Raza", initials: "AR", city: "Rawalpindi", headline: "Electrician & solar technician", skills: ["Electrical", "Solar"], verified: "demo" },
];

export const seedPosts = [
  {
    id: "post-water-1", type: "problem", scope: "society", authorId: "sara-khan", author: "Sara Khan", initials: "SK",
    time: "18 min", location: "I-10, Islamabad", title: "Water pressure drops every evening",
    body: "Three lanes reported the same pressure drop. Add your observation or offer an inspection so we can verify the cause before funding repairs.",
    tags: ["Water", "Needs evidence"], support: 38, comments: 12, saves: 9, priority: "urgent", lat: 33.643, lng: 73.033,
  },
  {
    id: "post-isb-pilot", type: "community", scope: "city", authorId: "isb-pilot", author: "Islamabad pilot community (planned)", initials: "IP",
    time: "1 hr", location: "Islamabad", title: "A planned community pilot",
    body: "SAMPLE DATA. A consenting Islamabad community is planned. This record is not a live membership roll.",
    tags: ["Community", "Sample"], support: 0, comments: 0, saves: 0, priority: "community",
    lat: 33.684, lng: 73.047,
  },
  {
    id: "post-job-1", type: "job", scope: "nearby", authorId: "muhammad-qureshi", author: "Muhammad Qureshi", initials: "MQ",
    time: "2 hr", location: "Islamabad · Hybrid", title: "Short-form editor for community impact stories",
    body: "Looking for a mobile-first editor who can turn field updates into clear 30–60 second evidence-led stories. Paid pilot, portfolio required.",
    tags: ["Video editing", "Paid"], support: 21, comments: 8, saves: 17, priority: "work", lat: 33.693, lng: 73.065,
  },
  {
    id: "post-creator-1", type: "story", scope: "global", authorId: "muhammad-qureshi", author: "Muhammad Qureshi", initials: "MQ",
    time: "Today", location: "Creator archive", title: "Conversations, calisthenics and ideas for a better system",
    body: "A source-linked preview from the creator archive. Open the public Drive collection to review original videos and podcasts before publishing a post.",
    tags: ["Podcast", "Source linked"], support: 76, comments: 14, saves: 28, priority: "story", source: PODCASTS_FOLDER,
  },
];

export const seedServices = [
  { id: "svc-electric", kind: "service", title: "Solar & electrical repair", provider: "Ali Raza", distance: "2.1 km", price: "Quote after inspection", rating: "4.8", skills: ["Solar", "Electrical"], lat: 33.667, lng: 73.021 },
  { id: "svc-water", kind: "service", title: "Water quality assessment", provider: "Sara Khan", distance: "3.8 km", price: "Community or private", rating: "4.9", skills: ["Water", "Engineering"], lat: 33.701, lng: 73.041 },
  { id: "job-editor", kind: "job", title: "Mobile video editor", provider: "Fikr o Nizam", distance: "Islamabad · Hybrid", price: "Paid pilot", rating: "New", skills: ["Editing", "Storytelling"], lat: 33.693, lng: 73.065 },
  { id: "job-plumber", kind: "need", title: "Inspect shared water pump", provider: "I-10 Neighbourhood", distance: "1.4 km", price: "Community vote", rating: "Urgent", skills: ["Plumbing", "Pump repair"], lat: 33.643, lng: 73.033 },
];

export const seedCommunities = [
  {
    id: "isb-pilot", name: "Islamabad pilot community (planned)", level: "Community", city: "Islamabad", members: null,
    status: "planned", purpose: "SAMPLE DATA. A future pilot community in Islamabad. Not open yet.",
    project: { title: "Pilot preparation record", raised: 0, target: 100, unit: "% evidence complete" },
  },
  { id: "i10-neighbours", name: "I-10 Neighbourhood Circle", level: "Society", city: "Islamabad", members: null, status: "forming", purpose: "SAMPLE DATA. Shared problems, evidence, proposals and local service coordination. Membership is not counted.", project: { title: "Water pressure investigation", raised: 0, target: 100, unit: "% evidence complete" } },
  { id: "islamabad-skills", name: "Islamabad Skills Exchange", level: "City", city: "Islamabad", members: null, status: "open", purpose: "SAMPLE DATA. Connect local needs with nearby skills. Membership is not counted." },
];

export const seedProposals = [
  { id: "vote-water", scope: "society", title: "Fund an independent water-pressure inspection", summary: "SAMPLE DATA. Release a sample amount only after a signed inspection report is attached.", yes: 0, no: 0, abstain: 0, eligible: null, closes: "2d 4h", status: "voting", rule: "Demo rule" },
  { id: "vote-library", scope: "city", title: "Open unused community room as evening study space", summary: "SAMPLE DATA. A 30-day trial with attendance and energy-use reporting.", yes: 0, no: 0, abstain: 0, eligible: null, closes: "5d", status: "discussion", rule: "Demo rule" },
];

export const driveCollections = [
  { title: "Podcasts and real records", subtitle: "Conversations and long-form recordings", href: PODCASTS_FOLDER, icon: "POD" },
  { title: "Calisthenics is freedom", subtitle: "Fitness and personal development series", href: PODCASTS_FOLDER, icon: "FIT" },
  { title: "Creator video shorts", subtitle: "Short-form drafts and edits", href: DRIVE_ROOT, icon: "VID" },
  { title: "Tafkeer-e-Afkaar", subtitle: "Ideas, reflection and research archive", href: DRIVE_ROOT, icon: "IDEA" },
  { title: "GAIGS source archive", subtitle: "Plans, visuals and platform material", href: DRIVE_ROOT, icon: "OS" },
];

export const seedAlerts = [
  { id: "alert-rain", level: "Watch", title: "Monsoon readiness", location: "Islamabad region", body: "Community preview: confirm local conditions through official sources before acting or donating.", sourceLabel: "Source required" },
];

export const scopes = ["personal", "nearby", "society", "city", "country", "global"];
