/* Mobile-first, source-linked video feed built from Muhammad's public Drive library. */
(function () {
  "use strict";
  const library = window.GAIGSCreatorLibrary || { rootFiles: [], folders: [] };
  const categories = [
    { id: "mission", label: "GAIGS & Mission", pattern: /gaigs|humanity|future world|new dawn|governance|liberation|civilization|power/i },
    { id: "ideas", label: "Ideas & Learning", pattern: /podcast|afkar|tafkir|science|education|history|ai|technology|documentary/i },
    { id: "creator", label: "Creator Network", pattern: /hassam|ahmed|hamid|qureshi|one piece|virality|creator|journey/i },
    { id: "all", label: "All videos", pattern: /.*/ }
  ];
  const feedState = { category: "mission", query: "", limit: 12 };
  let lastActionSource = null;
  document.addEventListener("click", event => { const source = event.target.closest("[data-video-action]"); if (source) lastActionSource = source; }, true);

  function items() {
    const root = (library.rootFiles || []).map(item => ({ ...item, folder: "Drive root" }));
    const nested = (library.folders || []).flatMap(folder => (folder.items || []).map(item => ({ ...item, folder: folder.name, folderId: folder.id })));
    return [...root, ...nested].filter(item => item.type === "video" && item.id && item.url);
  }

  function filteredVideos() {
    const category = categories.find(item => item.id === feedState.category) || categories[0];
    const query = feedState.query.trim().toLowerCase();
    const matched = items().filter(item => category.pattern.test(`${item.name} ${item.folder}`) && (!query || `${item.name} ${item.folder}`.toLowerCase().includes(query)));
    return (matched.length ? matched : items()).slice(0, feedState.limit);
  }

  function humanTitle(name) {
    return String(name || "Untitled mission video")
      .replace(/\.(mp4|mov|mkv|webm)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 110);
  }

  function thumbnail(item) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w1200`;
  }

  function videoCard(item, index) {
    const title = humanTitle(item.name);
    const author = /hassam/i.test(item.name) ? "Hassam Creator Network" : /hamid/i.test(item.name) ? "Hamid Community" : /ahmed/i.test(item.name) ? "Ahmed Community" : "Muhammad Qureshi · Future World Vision";
    return `<article class="video-feed-card" data-video-id="${esc(item.id)}">
      <button class="video-cover" data-video-action="play" data-video-id="${esc(item.id)}" aria-label="Play ${esc(title)}">
        <img src="${esc(thumbnail(item))}" alt="Thumbnail for ${esc(title)}" loading="lazy" referrerpolicy="no-referrer">
        <span class="video-cover-shade"></span><span class="video-play">▶</span>
        <span class="video-order">${String(index + 1).padStart(2, "0")}</span>
        <span class="video-source-badge">PUBLIC DRIVE SOURCE</span>
      </button>
      <div class="video-feed-body">
        <div class="video-author"><span>${esc(author.split(" ").map(word => word[0]).join("").slice(0, 2))}</span><div><b>${esc(author)}</b><small>${esc(item.folder || "Drive root")} · source linked</small></div></div>
        <h3>${esc(title)}</h3>
        <p>Watch the original media, add your own context, then choose whether it belongs in a personal, society, city, country or global discussion.</p>
        <div class="video-feed-actions">
          <button data-video-action="play" data-video-id="${esc(item.id)}">▶ Watch</button>
          <button data-video-action="post" data-video-id="${esc(item.id)}">＋ Prepare post</button>
          <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>
        </div>
      </div>
    </article>`;
  }

  views.videoFeed = function () {
    const videos = filteredVideos();
    return `${pageHead("Humanity Video Feed", "A mobile-first stream from Muhammad's public Drive. Thumbnails lead to original files; JARVIS never republishes or invents ownership.", '<button class="action-btn" data-video-action="refresh">Refresh feed</button>')}
      <section class="video-feed-hero">
        <div><span class="overview-kicker"><b>264 VIDEOS INDEXED</b> SOURCE-FIRST MEDIA</span><h2>Scroll less.<br><em>Understand, discuss, act.</em></h2><p>This feed turns videos into transparent discussion starters. Every item keeps its Drive source, community context and human approval step.</p></div>
        <div class="video-feed-orbit" aria-hidden="true"><span>VOICE</span><span>PROBLEM</span><span>PROOF</span><b>J</b></div>
      </section>
      <section class="video-feed-toolbar"><label><span>⌕</span><input id="videoFeedSearch" type="search" value="${esc(feedState.query)}" placeholder="Search all indexed videos..."></label><div>${categories.map(category => `<button class="${feedState.category === category.id ? "active" : ""}" data-video-action="category" data-video-category="${category.id}">${esc(category.label)}</button>`).join("")}</div></section>
      <div class="video-feed-grid" id="videoFeedGrid">${videos.map(videoCard).join("")}</div>
      <div class="video-feed-more">${videos.length < items().length ? '<button class="ghost-btn" data-video-action="more">Load more source videos</button>' : ""}<a href="${esc(library.rootUrl || "#")}" target="_blank" rel="noopener noreferrer">Open the complete Drive ↗</a></div>`;
  };
  viewNames.videoFeed = "Humanity video feed";

  function itemById(id) { return items().find(item => item.id === id); }
  function openVideo(item) {
    const title = humanTitle(item.name);
    openModal(`<div class="video-modal-head"><span class="tag green">ORIGINAL PUBLIC SOURCE</span><h2>${esc(title)}</h2><p class="muted">Streaming from Google Drive. The file remains owned and hosted at its original source.</p></div><iframe class="drive-preview-frame video-feed-player" src="https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview" allow="autoplay; fullscreen" title="${esc(title)}"></iframe><div class="rule-actions"><button class="action-btn" data-video-action="post" data-video-id="${esc(item.id)}">Prepare a post</button><a class="ghost-btn" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open original source ↗</a></div>`);
  }

  const priorAction = action;
  action = function (type) {
    if (type !== "video" || !lastActionSource || !lastActionSource.dataset.videoAction) return priorAction(type);
    const videoAction = lastActionSource.dataset.videoAction;
    if (videoAction === "category") { feedState.category = lastActionSource.dataset.videoCategory || "all"; feedState.limit = 12; render(); return; }
    if (videoAction === "more") { feedState.limit += 12; render(); return; }
    if (videoAction === "refresh") { feedState.limit = 12; render(); toast("Video feed refreshed from the indexed public library."); return; }
    const item = itemById(lastActionSource.dataset.videoId);
    if (!item) return toast("This source video could not be found.");
    if (videoAction === "play") { openVideo(item); return; }
    if (videoAction === "post") {
      openModal(`<h2>Prepare a source-linked post</h2><p class="muted">Review the title, add your own explanation and choose a geographic scope. Nothing is published automatically.</p>${postForm()}`);
      const typeInput = $("#postType"), locationInput = $("#postLocation"), textInput = $("#postText");
      if (typeInput) typeInput.value = "Learning";
      if (locationInput) locationInput.value = `Public Drive · ${item.folder || "MQ Library"}`;
      if (textInput) textInput.value = `${humanTitle(item.name)}\n\nWhy this matters:\nAdd your context here.\n\nOriginal source: ${item.url}`;
      return;
    }
    return priorAction(type);
  };

  const priorBindDynamic = bindDynamic;
  bindDynamic = function () {
    priorBindDynamic();
    const search = $("#videoFeedSearch");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", () => { feedState.query = search.value; feedState.limit = 24; render(); });
    }
    $$('[data-video-action]').forEach(button => {
      if (button.dataset.videoBound) return;
      button.dataset.videoBound = "1";
      button.addEventListener("click", event => { if (button.tagName !== "A") { event.preventDefault(); action("video"); } });
    });
  };

  const priorOverview = views.overview;
  views.overview = function () {
    return priorOverview().replace(/<div class="home-actions([^"]*)">/, '<div class="home-actions video-home-actions$1"><button data-view="videoFeed"><i>▶</i><b>Video feed</b><span>264 public Drive videos with thumbnails</span></button>');
  };
  if (state.user) render();
})();
