/* GAIGS transparent recommendation model.
 * Uses only public post fields plus the member's declared skills, coarse city,
 * selected scope and explicit follows. No contact scraping or hidden profiling.
 */
(function () {
  "use strict";
  const WEIGHTS = Object.freeze({ relevance: 30, proximity: 25, evidence: 20, trust: 15, freshness: 10 });
  let mode = localStorage.getItem("gaigsFeedModeV1") || "for-you";

  function tokens(value) {
    return new Set(String(value || "").toLowerCase().split(/[^a-z0-9+#]+/).filter(word => word.length > 2).slice(0, 80));
  }
  function overlap(left, right) {
    if (!left.size || !right.size) return 0;
    let matches = 0; for (const value of left) if (right.has(value)) matches += 1;
    return Math.min(1, matches / Math.max(2, Math.min(left.size, 8)));
  }
  function ageScore(post) {
    const parsed = Date.parse(post.createdAt || post.time || "");
    if (!Number.isFinite(parsed)) return .45;
    const hours = Math.max(0, (Date.now() - parsed) / 3600000);
    return Math.max(0, 1 - hours / (24 * 14));
  }
  function score(post) {
    const profile = tokens(`${state.user?.skills || ""} ${state.user?.mission || ""}`), content = tokens(`${post.type || ""} ${post.text || ""}`);
    const relevance = overlap(profile, content);
    const location = String(post.location || post.location_label || "").toLowerCase(), city = String(state.user?.city || "").toLowerCase();
    const sameCity = city && location.includes(city), scopeMatch = String(post.scope || "").toLowerCase() === String(state.scope || "").toLowerCase();
    const proximity = sameCity ? 1 : scopeMatch ? .72 : String(post.scope || "").toLowerCase() === "global" ? .25 : .4;
    const evidence = Math.min(1, (post.mediaUrl ? .5 : 0) + (post.location ? .25 : 0) + (Number(post.evidence || 0) > 0 ? .25 : 0));
    const trust = Math.min(1, (post.verified ? .55 : 0) + (Number(post.reward || post.reward_credits || 0) > 0 ? .25 : 0) + (post.authorId || post.id ? .2 : 0));
    const freshness = ageScore(post);
    let total = relevance * WEIGHTS.relevance + proximity * WEIGHTS.proximity + evidence * WEIGHTS.evidence + trust * WEIGHTS.trust + freshness * WEIGHTS.freshness;
    if (mode === "nearby") total = proximity * 60 + freshness * 20 + evidence * 20;
    if (mode === "latest") total = freshness * 85 + evidence * 15;
    if (mode === "impact") total = evidence * 45 + trust * 35 + relevance * 20;
    const reasons = [];
    if (sameCity) reasons.push(`near ${state.user.city}`); else if (scopeMatch) reasons.push(`${state.scope} scope`);
    if (relevance >= .2) reasons.push("matches declared interests");
    if (evidence >= .5) reasons.push("has public evidence");
    if (freshness >= .75) reasons.push("recent");
    return { post, score: Math.round(total), reasons: reasons.slice(0, 3) };
  }
  function ranked() {
    const queue = (state.posts || []).map(score).sort((a, b) => b.score - a.score), result = [];
    while (queue.length) {
      const recentAuthors = result.slice(-2).map(item => item.post.authorId || item.post.name);
      let index = queue.findIndex(item => !recentAuthors.includes(item.post.authorId || item.post.name));
      if (index < 0) index = 0;
      result.push(queue.splice(index, 1)[0]);
    }
    return result;
  }
  function rankedCards() {
    const items = ranked();
    if (!items.length) return feedPosts();
    return items.map(item => postCard(item.post).replace("</article>", `<div class="rank-explainer"><b>${item.score}/100</b><span>${esc(item.reasons.join(" · ") || "public chronological signal")}</span><button data-rank-explain>Why this?</button></div></article>`)).join("");
  }
  function explanation() {
    return `<div class="algorithm-sheet"><p>GAIGS ranks posts with five visible signals. You can switch to Latest at any time.</p>${Object.entries(WEIGHTS).map(([key, value]) => `<div><span>${key}</span><b>${value}%</b><i style="width:${value * 2}%"></i></div>`).join("")}<h3>Never used</h3><p>CNIC, private messages, phone contacts, microphone recordings, exact home address and wallet balance are excluded.</p><h3>Your controls</h3><p>Change mode, edit declared skills, disable public coarse location or use chronological Latest.</p></div>`;
  }

  views.feed = function () {
    return `${pageHead("Action Feed", "A transparent feed for problems, solutions, work and verified progress — not an attention trap.", `<button class="ghost-btn" data-algorithm-info>How ranking works</button><button class="action-btn" data-action="post">＋ Create post</button>`)}
      <div class="feed-mode-bar">${[["for-you", "For you"], ["nearby", "Nearby"], ["latest", "Latest"], ["impact", "Verified impact"]].map(([key, label]) => `<button class="${mode === key ? "active" : ""}" data-feed-mode="${key}">${label}</button>`).join("")}<span>Uses public content + your declared choices</span></div>
      <div class="dashboard-grid"><section class="span-8"><div class="feed-list">${rankedCards()}</div></section>
      ${card("Your feed controls", `<div class="algorithm-controls"><b>${mode === "for-you" ? "Balanced recommendation" : mode === "nearby" ? "Coarse-location priority" : mode === "latest" ? "Chronological order" : "Evidence and outcomes first"}</b><p>Nothing is ranked from private chat or CNIC data.</p><button class="ghost-btn" data-algorithm-info>Inspect all signals</button><button class="ghost-btn" data-view="settings">Privacy settings</button></div>`, 4)}
      ${card("Trending public missions", activityMini(), 4)}</div>`;
  };

  const previousBind = bindDynamic;
  bindDynamic = function () {
    previousBind();
    $$("[data-feed-mode]").forEach(button => button.addEventListener("click", () => { mode = button.dataset.feedMode; localStorage.setItem("gaigsFeedModeV1", mode); render(); }));
    $$("[data-algorithm-info],[data-rank-explain]").forEach(button => button.addEventListener("click", () => openModal(`<h2>Why you see this</h2>${explanation()}`)));
  };
  window.GAIGSFeedAlgorithm = { weights: WEIGHTS, score, ranked, getMode: () => mode, setMode: value => { if (["for-you", "nearby", "latest", "impact"].includes(value)) mode = value; } };
  if (state.user && state.view === "feed") render();
})();
