import {
  seedProfile, seedPosts, seedServices, seedCommunities, seedProposals, driveCollections, scopes,
} from "./seeds.js";
import { vault, vaultHealth, requestPersistentStorage } from "./local-vault.js";
import { appendEvent, ensureDeviceIdentity, matchesScope, saveRecord, verifyEventSet } from "./ledger-core.js";
import { announceChange, downloadBundle, exportSyncBundle, importSyncBundle, startLocalMesh } from "./mesh-core.js";
import { chainStatus, connectWallet as requestWallet } from "./blockchain-core.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { scope: localStorage.getItem("humanity-scope") || "personal", view: location.hash.slice(1) || "today", kind: "all", wallet: null, peers: new Map(), map: null, miniMap: null };
const typeLabels = { post: "Update", problem: "Problem", need: "Need", service: "Service", job: "Job", proposal: "Proposal", company: "Company", community: "Community" };

function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function toast(message, error = false) {
  const node = document.createElement("div"); node.className = `toast${error ? " error" : ""}`; node.textContent = message;
  $("#toasts").append(node); setTimeout(() => node.remove(), 4300);
}
function formatBytes(bytes) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function shortHash(value = "") { return `${value.slice(0, 9)}…${value.slice(-6)}`; }

function setScope(scope) {
  if (!scopes.includes(scope)) return;
  state.scope = scope; localStorage.setItem("humanity-scope", scope);
  $("#scopeCurrent strong").textContent = scope === "personal" ? "Personal" : scope;
  $("#scopeCurrent small").textContent = scope === "global" ? "Humanity" : "Your world";
  $("#scopeMenu").hidden = true;
  renderFeed();
}

function setView(view, updateHash = true) {
  const page = $(`[data-page="${view}"]`) ? view : "today";
  state.view = page;
  $$(".view").forEach(node => node.classList.toggle("active", node.dataset.page === page));
  $$('[data-view]').forEach(node => node.classList.toggle("active", node.dataset.view === page));
  if (updateHash) history.replaceState(null, "", `#${page}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "explore") setTimeout(initWorldMap, 50);
  if (page === "wallet") renderLedger();
  if (page === "mesh") renderMesh();
}

async function localPosts() {
  return (await vault.list("records")).filter(record => record.recordType === "post").map(record => ({ ...record, id: record.id, author: seedProfile.name, initials: seedProfile.initials, authorId: seedProfile.id, time: "On this device", support: record.support || 0, comments: record.comments || 0, saves: record.saves || 0, tags: [typeLabels[record.type] || "Update", "Device signed"] }));
}

function postTemplate(post) {
  const source = post.source ? `<a class="post-source" href="${escapeHtml(post.source)}" target="_blank" rel="noopener">Open original source ↗</a>` : "";
  const media = post.image ? `<img class="post-media" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy">` : "";
  return `<article class="post-card" data-post-id="${escapeHtml(post.id)}">
    <div class="post-head"><span class="post-avatar">${escapeHtml(post.initials || "H")}</span><div><b>${escapeHtml(post.author)}</b><small>${escapeHtml(post.time)} · ${escapeHtml(post.location || post.scope)}</small></div><button class="post-menu" data-action="report" aria-label="Post options">•••</button></div>
    <span class="post-label">${escapeHtml(typeLabels[post.type] || post.type || "Update")}</span><h3>${escapeHtml(post.title)}</h3><p class="post-body">${escapeHtml(post.body)}</p>${media}
    <div class="post-tags">${(post.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>${source}
    <div class="post-actions"><button data-action="support">♡ Support · ${post.support || 0}</button><button data-action="comment">◌ Discuss · ${post.comments || 0}</button><button data-action="share">↗ Share</button><button data-action="save">◇ Save · ${post.saves || 0}</button></div>
  </article>`;
}

async function renderFeed() {
  const local = await localPosts().catch(() => []);
  const all = [...local, ...seedPosts];
  const filtered = all.filter(post => matchesScope(post, state.scope, { userId: seedProfile.id, city: seedProfile.city }));
  $("#feed").innerHTML = filtered.length ? filtered.map(postTemplate).join("") : `<div class="panel"><h2>No records in this scope yet.</h2><p>Change scope or create the first signed update.</p></div>`;
}

function renderWork() {
  $("#workGrid").innerHTML = seedServices.map(item => `<article class="work-tile"><div class="tile-meta"><span>${escapeHtml(item.kind.toUpperCase())}</span><span>${escapeHtml(item.distance)}</span></div><h3>${escapeHtml(item.title)}</h3><p>By ${escapeHtml(item.provider)} · ${escapeHtml(item.price)}</p><div class="skill-line">${item.skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}</div><div class="tile-actions"><button data-work="${item.id}">View details</button><button data-contact="${item.id}">${item.kind === "service" ? "Request" : "Respond"}</button></div></article>`).join("");
}

function renderCommunities() {
  $("#communityGrid").innerHTML = seedCommunities.map(item => `<article class="community-tile">${item.hero ? `<img class="community-hero" src="${escapeHtml(item.hero)}" alt="${escapeHtml(item.name)}" loading="lazy">` : ""}<div class="tile-meta"><span>${escapeHtml(item.level)} · ${escapeHtml(item.city)}</span><span>${item.members} members</span></div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.purpose)}</p>${item.project ? `<small>${escapeHtml(item.project.title)}</small><div class="progress"><i style="width:${item.project.raised}%"></i></div><small>${item.project.raised}${escapeHtml(item.project.unit.startsWith("%") ? "" : "/" + item.project.target)} ${escapeHtml(item.project.unit)}</small>` : ""}<div class="tile-actions">${item.source ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noopener">Public record ↗</a>` : `<button data-community-detail="${item.id}">View record</button>`}<button data-join="${item.id}">Request to join</button></div></article>`).join("");
}

function renderProposals() {
  $("#proposalGrid").innerHTML = seedProposals.map(item => `<article class="proposal-card" data-proposal-id="${item.id}"><div class="tile-meta"><span>${escapeHtml(item.scope.toUpperCase())} · ${escapeHtml(item.status)}</span><span>Closes ${escapeHtml(item.closes)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="proposal-tally"><span><b>${item.yes}</b>Yes</span><span><b>${item.no}</b>No</span><span><b>${item.abstain}</b>Abstain</span></div><small>${escapeHtml(item.rule)} · ${item.eligible} eligible</small><div class="vote-actions"><button data-vote="yes">Vote yes</button><button data-vote="no">Vote no</button><button data-vote="abstain">Abstain</button></div></article>`).join("");
}

function renderCreator() {
  $("#creatorGrid").innerHTML = driveCollections.map((item, index) => `<article class="creator-tile"><span class="source-icon">${escapeHtml(item.icon)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subtitle)}. Files remain at their public source until you review and publish a linked post.</p><div class="review-state"><i></i>Waiting for rights and context review</div><div class="tile-actions"><a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">Review source ↗</a><button data-create-from-source="${index}">Create draft</button></div></article>`).join("");
}

function renderExploreResults() {
  const query = ($("#exploreSearch")?.value || "").toLowerCase();
  const problems = seedPosts.filter(post => post.type === "problem").map(post => ({ ...post, kind: "problem", provider: post.location }));
  const items = [...problems, ...seedServices].filter(item => (state.kind === "all" || item.kind === state.kind || item.type === state.kind) && `${item.title} ${item.provider || item.body || ""} ${(item.skills || []).join(" ")}`.toLowerCase().includes(query));
  $("#exploreResults").innerHTML = items.map(item => `<button class="result-item" data-result="${escapeHtml(item.id)}"><span class="result-icon">${escapeHtml((item.kind || item.type || "H").slice(0, 3).toUpperCase())}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.provider || item.location || "Humanity OS")}</small></span><small>${escapeHtml(item.distance || "Open")}</small></button>`).join("") || `<p class="fine-print">No matching records. Try another word or scope.</p>`;
}

function mapPoints() {
  return [...seedPosts.filter(item => item.lat), ...seedServices.filter(item => item.lat)];
}
function addMapPoints(map) {
  if (!globalThis.L || !map) return;
  mapPoints().forEach(item => L.circleMarker([item.lat, item.lng], { radius: 8, color: item.type === "problem" || item.kind === "need" ? "#d9672f" : item.kind === "job" ? "#2262e6" : "#176b50", fillOpacity: .9, weight: 3, fillColor: "#fff" }).addTo(map).bindPopup(`<b>${escapeHtml(item.title)}</b><br>${escapeHtml(item.location || item.provider || "")}`));
}
function initMiniMap() {
  if (!globalThis.L || state.miniMap || !$("#miniMap")) return;
  state.miniMap = L.map("miniMap", { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([33.6844, 73.0479], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(state.miniMap); addMapPoints(state.miniMap);
}
function initWorldMap() {
  if (!globalThis.L || !$("#worldMap")) return;
  if (!state.map) { state.map = L.map("worldMap").setView([33.6844, 73.0479], 11); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(state.map); addMapPoints(state.map); }
  state.map.invalidateSize();
}

function openDetail(title, body, actions = "") {
  $("#detailContent").innerHTML = `<div class="dialog-head"><p class="eyebrow">Humanity record</p><button class="close-button" data-close-detail>×</button></div><div class="detail-body"><h2>${escapeHtml(title)}</h2>${body}${actions}</div>`;
  $("#detailDialog").showModal();
}

function openCompose(type = "post", prefill = {}) {
  const supported = ["post", "problem", "need", "service", "job", "proposal"];
  const active = supported.includes(type) ? type : "post";
  $("#composeForm").dataset.type = type;
  $("#composeTitle").textContent = type === "post" ? "Share something" : `Create ${typeLabels[type] || type}`;
  $$("#composeTypes button").forEach(button => button.classList.toggle("active", button.dataset.type === active));
  const form = $("#composeForm"); form.elements.title.value = prefill.title || ""; form.elements.body.value = prefill.body || ""; form.elements.scope.value = prefill.scope || state.scope;
  $("#composeDialog").showModal(); setTimeout(() => form.elements.title.focus(), 80);
}

async function handleCompose(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form); const media = data.get("media");
  if (media?.size > 20 * 1024 * 1024) return toast("Choose a file smaller than 20 MB for the device vault.", true);
  const id = crypto.randomUUID(); let mediaId = null;
  if (media?.size) { mediaId = `media:${id}`; await vault.put("media", { id: mediaId, blob: media, name: media.name, type: media.type, size: media.size, createdAt: new Date().toISOString() }); }
  const type = form.dataset.type || "post";
  const value = { id, type, title: String(data.get("title")).trim(), body: String(data.get("body")).trim(), scope: String(data.get("scope")), location: String(data.get("location") || "").trim(), mediaId, createdAt: new Date().toISOString() };
  const { event: ledgerEvent } = await saveRecord(type === "company" || type === "community" ? type : "post", value, { eventType: `${type}.published`, actorId: seedProfile.id, scope: value.scope });
  announceChange(ledgerEvent); form.reset(); $("#composeDialog").close(); await renderFeed(); await renderLedger();
  toast(`${typeLabels[type] || "Record"} signed and saved to this device.`); setView(type === "company" ? "profile" : type === "community" ? "communities" : "today");
}

async function reactToPost(button, postId, action) {
  button.classList.toggle("selected");
  await appendEvent(`post.${action}`, { postId, action, scope: state.scope }, { actorId: seedProfile.id, scope: state.scope });
  if (action === "comment") openDetail("Join the discussion", `<p>Your comment becomes a signed local record. Shared delivery needs an enabled cloud or peer channel.</p><form id="commentForm"><label>Comment<textarea name="comment" rows="4" required></textarea></label><button class="primary-button">Sign comment</button></form>`);
  else if (action === "share") { await navigator.share?.({ title: "Humanity OS record", text: "See this Humanity OS record", url: location.href }).catch(() => {}); if (!navigator.share) await navigator.clipboard?.writeText(location.href); toast("Share link prepared."); }
  else toast(`${action[0].toUpperCase() + action.slice(1)} recorded in your device ledger.`);
}

async function vote(card, choice) {
  const proposalId = card.dataset.proposalId; const key = `vote:${proposalId}`;
  if (await vault.get("meta", key)) return toast("This device identity has already recorded a ballot for this proposal.", true);
  const ballot = { id: key, proposalId, choice, voterDevice: (await ensureDeviceIdentity()).fingerprint, createdAt: new Date().toISOString() };
  await vault.put("meta", ballot); const event = await appendEvent("governance.ballot_cast", { proposalId, choice, scope: "society" }, { actorId: seedProfile.id, scope: "society" }); announceChange(event);
  card.querySelectorAll("[data-vote]").forEach(button => { button.disabled = true; button.classList.toggle("selected", button.dataset.vote === choice); });
  toast(`Ballot “${choice}” signed locally. It is not counted by an authority until synced to an eligible governance network.`);
}

async function joinCommunity(id) {
  const community = seedCommunities.find(item => item.id === id); if (!community) return;
  const { event } = await saveRecord("join-request", { id: `${id}-${crypto.randomUUID()}`, communityId: id, scope: "society", status: "pending", residence: "not supplied", createdAt: new Date().toISOString() }, { eventType: "community.join_requested", actorId: seedProfile.id, scope: "society" }); announceChange(event);
  toast(`Join request saved for ${community.name}. Residence verification remains pending.`);
}

async function renderLedger() {
  const events = (await vault.list("events")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const html = events.length ? events.slice(0, 20).map(event => `<div class="receipt"><span class="receipt-icon">✓</span><span><b>${escapeHtml(event.type.replaceAll(".", " "))}</b><small>${new Date(event.createdAt).toLocaleString()} · ${escapeHtml(event.scope)}</small></span><code>${shortHash(event.hash)}</code></div>`).join("") : `<div class="panel"><p>No signed events yet. Your first action will create the genesis receipt.</p></div>`;
  if ($("#walletReceipts")) $("#walletReceipts").innerHTML = html;
  if ($("#ledgerTable")) $("#ledgerTable").innerHTML = html;
}

async function renderMesh() {
  const [health, identity, events] = await Promise.all([vaultHealth(), ensureDeviceIdentity(), vault.list("events")]);
  $("#vaultSummary").textContent = `${health.records} records · ${events.length} signed events`;
  $("#deviceId").textContent = `Device ${identity.fingerprint} · private key remains in this browser vault`;
  $("#storageEstimate").textContent = `${formatBytes(health.usage)} used of approximately ${formatBytes(health.quota)} browser storage. ${health.persistent ? "Offline copy is protected from routine eviction." : "Persistence has not been granted yet."}`;
  await renderLedger();
}

async function verifyLedger() {
  const result = await verifyEventSet(await vault.list("events"));
  $("#integrityScore").textContent = result.total ? Math.round(result.verified / result.total * 100) : 100;
  toast(result.valid ? `${result.verified} signed event(s) verified. Chain integrity is valid.` : `${result.failures.length} event(s) failed verification.`, !result.valid);
  return result;
}

function jarvisIntent(text) {
  const input = text.toLowerCase(); let response = "I can help you navigate this device copy. Ask about problems, jobs, communities, wallet, votes or the ledger.";
  if (/water|problem|nearby/.test(input)) { setScope("nearby"); setView("explore"); response = "I opened nearby activity and filtered your world around Islamabad. Map pins are source or seed previews until peers publish live records."; }
  else if (/job|work|skill|service/.test(input)) { setView("work"); response = "I opened work and skills. You can offer a service or respond to a need; each action creates a signed local record."; }
  else if (/community|society|masjid/.test(input)) { setView("communities"); response = "I opened communities. Jamia Masjid Nabvi is linked to its public source; other memberships require verification."; }
  else if (/vote|decision|govern/.test(input)) { setView("governance"); response = "I opened active decisions. Ballots are one device preview per proposal and must sync to an eligible network before authoritative counting."; }
  else if (/ledger|verify|audit|chain/.test(input)) { setView("mesh"); setTimeout(verifyLedger, 100); response = "I opened the integrity view and started verification of hashes, signatures and previous-event links."; }
  else if (/wallet|money|crypto/.test(input)) { setView("wallet"); response = "I opened the wallet boundary. The external wallet keeps custody; live money stays disabled until audited contracts and compliant payment rails are configured."; }
  else if (/create.*job/.test(input)) openCompose("job"); else if (/create|report|post/.test(input)) openCompose(/problem/.test(input) ? "problem" : "post");
  $("#jarvisResponse").textContent = response; return response;
}

async function initIntegrity() {
  const identity = await ensureDeviceIdentity();
  if (!(await vault.get("meta", "app-initialized"))) { const event = await appendEvent("app.device_initialized", { version: 1, scope: "personal" }, { actorId: seedProfile.id }); await vault.put("meta", { id: "app-initialized", at: new Date().toISOString() }); announceChange(event); }
  const mesh = await startLocalMesh(message => {
    if (message.type === "peer.hello") { state.peers.set(message.deviceId, message.at); $("#peerStatus").innerHTML = `<i class="status-dot"></i>${state.peers.size} local peer${state.peers.size === 1 ? "" : "s"}`; }
    if (message.type === "ledger.event") { toast("A local tab announced a new signed event."); renderLedger(); }
  });
  $("#peerStatus").innerHTML = `<i class="status-dot"></i>${mesh.transport}`; return identity;
}

function wireEvents() {
  document.addEventListener("click", async event => {
    const viewTarget = event.target.closest("[data-view]"); if (viewTarget) setView(viewTarget.dataset.view);
    const scopeTarget = event.target.closest("[data-scope]"); if (scopeTarget) setScope(scopeTarget.dataset.scope);
    const composeTarget = event.target.closest("[data-open-compose]"); if (composeTarget) openCompose(composeTarget.dataset.openCompose);
    const type = event.target.closest("#composeTypes [data-type]"); if (type) { $("#composeForm").dataset.type = type.dataset.type; $("#composeTitle").textContent = `Create ${typeLabels[type.dataset.type]}`; $$("#composeTypes button").forEach(button => button.classList.toggle("active", button === type)); }
    const postAction = event.target.closest(".post-actions [data-action]"); if (postAction) await reactToPost(postAction, postAction.closest(".post-card").dataset.postId, postAction.dataset.action);
    const report = event.target.closest('[data-action="report"]'); if (report) openDetail("Post controls", `<p>You can save, report, mute, or export a receipt. Hiding shared content requires a logged moderation record.</p><div class="button-row"><button class="danger-button" data-report-confirm>Report for review</button><button class="secondary-button" data-close-detail>Cancel</button></div>`);
    const work = event.target.closest("[data-work]"); if (work) { const item = seedServices.find(value => value.id === work.dataset.work); openDetail(item.title, `<p><b>${escapeHtml(item.provider)}</b> · ${escapeHtml(item.distance)}</p><p>${escapeHtml(item.price)}. This source is a launch preview; confirm identity, terms and payment before starting.</p><div class="skill-line">${item.skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join("")}</div>`); }
    const contact = event.target.closest("[data-contact]"); if (contact) { await appendEvent("marketplace.contact_requested", { listingId: contact.dataset.contact, scope: "nearby" }, { actorId: seedProfile.id, scope: "nearby" }); setView("inbox"); toast("A local contact request was created. Shared delivery needs a connected peer or cloud channel."); }
    const join = event.target.closest("[data-join]"); if (join) await joinCommunity(join.dataset.join);
    const voteButton = event.target.closest("[data-vote]"); if (voteButton) await vote(voteButton.closest(".proposal-card"), voteButton.dataset.vote);
    const sourceDraft = event.target.closest("[data-create-from-source]"); if (sourceDraft) { const source = driveCollections[Number(sourceDraft.dataset.createFromSource)]; openCompose("post", { title: source.title, body: `Source-linked draft from ${source.subtitle}. Review context, consent and publishing rights before sharing.\n\nSource: ${source.href}`, scope: "personal" }); }
    if (event.target.closest("[data-close-detail]")) $("#detailDialog").close();
    if (event.target.closest("[data-report-confirm]")) { await appendEvent("moderation.report_submitted", { reason: "member review", scope: state.scope }, { actorId: seedProfile.id }); $("#detailDialog").close(); toast("Report signed and added to the local moderation outbox."); }
    const prompt = event.target.closest(".prompt-row button"); if (prompt) jarvisIntent(prompt.textContent);
    const copyInvite = event.target.closest(".claim-row button"); if (copyInvite) { await navigator.clipboard?.writeText(`${location.origin}${location.pathname}#claim-invite`); toast("Claim invitation copied. The profile remains unclaimed until consent and verification."); }
  });
  $("#composeForm").addEventListener("submit", handleCompose);
  $("#scopeCurrent").addEventListener("click", () => $("#scopeMenu").hidden = !$("#scopeMenu").hidden);
  $("#scopePrev").addEventListener("click", () => setScope(scopes[(scopes.indexOf(state.scope) - 1 + scopes.length) % scopes.length]));
  $("#scopeNext").addEventListener("click", () => setScope(scopes[(scopes.indexOf(state.scope) + 1) % scopes.length]));
  $("#searchButton").addEventListener("click", () => { setView("explore"); setTimeout(() => $("#exploreSearch").focus(), 100); });
  $("#exploreSearch").addEventListener("input", renderExploreResults);
  $("#exploreFilters").addEventListener("click", event => { const button = event.target.closest("[data-kind]"); if (!button) return; state.kind = button.dataset.kind; $$("#exploreFilters button").forEach(item => item.classList.toggle("active", item === button)); renderExploreResults(); });
  $("#locateButton").addEventListener("click", () => navigator.geolocation?.getCurrentPosition(position => { initWorldMap(); state.map.setView([position.coords.latitude, position.coords.longitude], 14); L.circleMarker([position.coords.latitude, position.coords.longitude], { radius: 9, color: "#14211d", fillColor: "#b9e769", fillOpacity: 1 }).addTo(state.map).bindPopup("Your approximate device location").openPopup(); toast("Map centred on your device. Location was not stored."); }, error => toast(`Location unavailable: ${error.message}`, true), { enableHighAccuracy: false, timeout: 10000 }));
  $("#jarvisForm").addEventListener("submit", event => { event.preventDefault(); const value = $("#jarvisInput").value.trim(); if (value) jarvisIntent(value); });
  $("#voiceButton").addEventListener("click", startVoice);
  $("#messageForm").addEventListener("submit", async event => { event.preventDefault(); const input = $("input", event.currentTarget); if (!input.value.trim()) return; await appendEvent("message.queued", { threadId: "water-pressure", bodyLength: input.value.trim().length, scope: "society" }, { actorId: seedProfile.id, scope: "society" }); input.value = ""; toast("Message encrypted intent saved to the local outbox; no remote recipient is connected yet."); });
  $("#connectWallet").addEventListener("click", connectExternalWallet);
  $("#verifyLedger").addEventListener("click", verifyLedger);
  $("#exportBundle").addEventListener("click", async () => { downloadBundle(await exportSyncBundle()); toast("Signed sync bundle exported."); });
  $("#importBundle").addEventListener("change", async event => { try { const bundle = JSON.parse(await event.target.files[0].text()); const result = await importSyncBundle(bundle); toast(`Verified bundle imported: ${result.addedEvents} events, ${result.addedRecords} records.`); await renderMesh(); await renderFeed(); } catch (error) { toast(error.message, true); } finally { event.target.value = ""; } });
  $("#persistStorage").addEventListener("click", async () => toast(await requestPersistentStorage() ? "Browser granted persistent offline storage." : "Browser did not grant persistence; export bundles regularly."));
  $("#clearLocalDrafts").addEventListener("click", async () => { if (!confirm("Clear local content drafts and media? Signed audit events will remain.")) return; await vault.clear("records"); await vault.clear("media"); await appendEvent("device.local_drafts_cleared", { scope: "personal" }, { actorId: seedProfile.id }); await renderMesh(); await renderFeed(); toast("Local drafts and media cleared. Audit events were preserved."); });
  $("#editProfile").addEventListener("click", () => openDetail("Private profile details", `<p>Authentication and encrypted personal fields require a configured identity provider. Public source-linked data can remain separate from CNIC, phone and residence evidence.</p><button class="secondary-button" data-close-detail>Close</button>`));
  window.addEventListener("hashchange", () => setView(location.hash.slice(1), false));
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return toast("Voice recognition is not available in this browser. Type your request below.", true);
  const recognition = new SpeechRecognition(); recognition.lang = "en-PK"; recognition.interimResults = false;
  $("#voiceButton b").textContent = "Listening…";
  recognition.onresult = event => { const text = event.results[0][0].transcript; $("#jarvisInput").value = text; jarvisIntent(text); };
  recognition.onerror = event => toast(`Voice input stopped: ${event.error}`, true);
  recognition.onend = () => $("#voiceButton b").textContent = "Hold the world in one conversation";
  recognition.start();
}

async function connectExternalWallet() {
  try { state.wallet = await requestWallet(); $("#walletAddress").textContent = `${state.wallet.short} · chain ${state.wallet.chainId}`; $("#chainStatus").textContent = "External wallet connected"; $("#connectWallet").textContent = state.wallet.short; await appendEvent("wallet.external_connected", { addressHashHint: `${state.wallet.address.slice(0, 8)}…`, chainId: state.wallet.chainId, scope: "personal" }, { actorId: seedProfile.id }); toast("External wallet connected. Humanity OS did not receive or store a private key."); }
  catch (error) { toast(error.message, true); }
}

async function bootstrap() {
  const menu = $("#scopeMenu"); menu.innerHTML = scopes.map(scope => `<button role="option" data-scope="${scope}">${scope}</button>`).join("");
  const date = new Intl.DateTimeFormat("en-PK", { weekday: "long", month: "short", day: "numeric" }).format(new Date()); $("#greeting").textContent = `${date} · Islamabad`;
  setScope(state.scope); renderWork(); renderCommunities(); renderProposals(); renderCreator(); renderExploreResults(); initMiniMap(); wireEvents(); setView(state.view, false);
  try { await initIntegrity(); await renderLedger(); const status = await chainStatus(); $("#chainStatus").textContent = status.label; if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {}); }
  catch (error) { toast(`Device vault could not start: ${error.message}`, true); }
}

bootstrap();
