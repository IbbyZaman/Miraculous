/* MiraculousHub — page interactions and catalogue rendering */
(() => {
  "use strict";
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeImage = value => {
    const s = String(value || "");
    return /^(https:\/\/|\/)/i.test(s) ? s : "";
  };
  const whenReady = async () => {
    try { await (window.MH_CATALOG_READY || Promise.resolve()); } catch {}
  };

  // Shared responsive navigation.
  const menuButton = $("#mobileMenuToggle");
  const drawer = $("#mobileDrawer");
  const backdrop = $("#mobileNavBackdrop");
  function setMenu(open) {
    document.body.classList.toggle("mobile-nav-open", open);
    menuButton?.setAttribute("aria-expanded", String(open));
    menuButton?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    drawer?.setAttribute("aria-hidden", String(!open));
    backdrop?.setAttribute("aria-hidden", String(!open));
  }
  menuButton?.addEventListener("click", () => setMenu(!document.body.classList.contains("mobile-nav-open")));
  $("#mobileDrawerClose")?.addEventListener("click", () => setMenu(false));
  backdrop?.addEventListener("click", () => setMenu(false));
  $$("#mobileDrawer a").forEach(link => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setMenu(false);
  });
  const currentPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  $$(".nav a, .mobile-nav-links a").forEach(link => {
    const target = (link.getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();
    if (target && target === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  function episodeHref(ep) {
    if (ep.special || ep.season === "Special") return "watch.html?special=" + encodeURIComponent(ep.episode);
    if (ep.available === false) return "season7.html#s7e" + encodeURIComponent(ep.episode);
    return "watch.html?season=" + encodeURIComponent(ep.season) + "&episode=" + encodeURIComponent(ep.episode);
  }
  function episodeCode(ep) {
    if (ep.code) return ep.code;
    if (ep.special || ep.season === "Special") return "SPECIAL " + ep.episode;
    return "S" + String(ep.season).padStart(2,"0") + "E" + String(ep.episode).padStart(2,"0");
  }
  function fallbackArtwork(ep, code=episodeCode(ep)) {
    const seasonLabel = ep.season === "Special" ? "SPECIAL COLLECTION" : "SEASON " + String(ep.season || 1);
    return '<div class="mh-art-fallback"><span class="mh-art-kicker">MIRACULOUS HUB · ' + esc(seasonLabel) + '</span><strong>' +
      esc(code) + '</strong><small>' + esc(ep.title || "Episode") + '</small></div>';
  }
  function renderEpisodeCard(ep, progressItem=null) {
    const image = safeImage(ep.thumbnail);
    const code = episodeCode(ep);
    const percent = progressItem ? Math.max(0,Math.min(100,Number(progressItem.progress) || (Number(progressItem.duration) > 0 ? Number(progressItem.position)/Number(progressItem.duration)*100 : 0))) : 0;
    const upcoming = ep.available === false;
    return '<a class="mh-episode-card" href="' + episodeHref(ep) + '">' +
      '<div class="mh-episode-art" data-season="' + esc(ep.season || "1") + '">' +
      (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : fallbackArtwork(ep, code)) +
      '<span class="mh-episode-tag">' + esc(code) + '</span>' +
      (ep.new ? '<span class="mh-episode-tag mh-new-tag">NEW</span>' : '') +
      '<span class="mh-episode-play">' + (upcoming ? "⌛" : "▶") + '</span></div>' +
      (percent > 0 ? '<div class="mh-progress"><span style="width:' + percent.toFixed(1) + '%"></span></div>' : '') +
      '<div class="mh-episode-copy"><small>' + (upcoming ? "COMING SOON" : "SEASON " + esc(ep.season)) + '</small><strong>' + esc(ep.title || "Episode " + ep.episode) + '</strong><span>' + (upcoming ? "Release details" : "Watch episode") + ' · ' + esc(code) + '</span></div></a>';
  }
  function getAllEpisodes() {
    return Array.isArray(window.MH_EPISODES) ? window.MH_EPISODES.slice() : [];
  }
  function renderContinue() {
    const target = $("#homeContinueGrid");
    const section = $("#homeContinueSection");
    if (!target || !section) return;
    const progress = (window.mhGetProgress?.() || []).slice(0,8);
    if (!progress.length) {
      section.hidden = true;
      return;
    }
    const items = progress.map(item => {
      const anime = item.animeSlug && (window.MH_ANIME_SHOWS || []).find(show => show.slug === item.animeSlug);
      const known = anime?.episodes?.find(ep => Number(ep.episode) === Number(item.episode));
      const episode = getAllEpisodes().find(ep => Number(ep.season) === Number(item.season) && Number(ep.episode) === Number(item.episode));
      const meta = known || episode || {};
      const row = {
        ...meta,
        season: item.season,
        episode: item.episode,
        title: item.title || meta.title || "Continue watching",
        code: anime ? anime.title + " · E" + item.episode : episodeCode(item),
        thumbnail: meta.thumbnail || ""
      };
      let href = anime ? "watch.html?anime=" + encodeURIComponent(anime.slug) + "&episode=" + encodeURIComponent(item.episode) :
        (item.specialSlug ? "watch.html?special=" + item.episode : "watch.html?season=" + item.season + "&episode=" + item.episode);
      const percent = Number(item.progress) || (Number(item.duration) > 0 ? Number(item.position)/Number(item.duration)*100 : 0);
      const image = safeImage(row.thumbnail);
      return '<a class="mh-episode-card" href="' + href + '"><div class="mh-episode-art" data-season="' + esc(row.season || "1") + '">' +
        (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : fallbackArtwork(row, anime ? "EP " + item.episode : episodeCode(row))) +
        '<span class="mh-episode-tag">RESUME</span><span class="mh-episode-play">▶</span></div>' +
        '<div class="mh-progress"><span style="width:' + Math.max(2,Math.min(100,percent)).toFixed(1) + '%"></span></div>' +
        '<div class="mh-episode-copy"><small>CONTINUE WATCHING</small><strong>' + esc(row.title) + '</strong><span>' +
        Math.round(Math.max(0,Math.min(100,percent))) + '% complete' + (item.pendingCloud ? ' · saved on this device' : '') + '</span></div></a>';
    });
    target.innerHTML = items.join("");
    section.hidden = false;
  }

  async function initHome() {
    await whenReady();
    const all = getAllEpisodes();
    const latest = all.slice().reverse().filter(ep => ep.available !== false).slice(0,8);
    const rail = $("#homeEpisodeGrid");
    if (rail) rail.innerHTML = latest.map(ep => renderEpisodeCard(ep)).join("") || '<div class="mh-empty">Episodes will appear here when they are added to the library.</div>';
    renderContinue();
    ["mh-progress-synced","mh-cloud-playback-status","mh-playback-local-saved","mh-account-ready","mh-cloud-save-ok","mh-auth-changed"].forEach(name => window.addEventListener(name, renderContinue));
  }

  async function initEpisodes() {
    await whenReady();
    const grid = $("#episodeGridV2");
    if (!grid) return;
    const search = $("#episodeSearchV2");
    const count = $("#episodeCountV2");
    const seasonTabs = $$(".mh-chip[data-season]");
    const filterTabs = $$(".mh-chip[data-mode]");
    const params = new URLSearchParams(location.search);
    let season = params.get("season") || "0";
    if (!["0","1","2","3","4","5","6","7","specials"].includes(season)) season = "0";
    let mode = "all";
    let query = "";
    function items() {
      let list = season === "7"
        ? (window.MH_SEASON7 || []).slice()
        : season === "specials"
          ? (window.MH_SPECIALS || []).map((title,index) => ({season:"Special",episode:index+1,title,special:true,thumbnail:(window.MH_SPECIAL_THUMBNAILS || [])[index]}))
          : getAllEpisodes().filter(ep => season === "0" || String(ep.season) === season);
      if (mode === "new") list = list.filter(ep => ep.new === true);
      if (mode === "available") list = list.filter(ep => ep.available !== false);
      if (mode === "upcoming") list = list.filter(ep => ep.available === false);
      if (query) list = list.filter(ep => (ep.title + " " + episodeCode(ep) + " season " + ep.season).toLowerCase().includes(query));
      return list;
    }
    function render() {
      const list = items();
      if (count) count.textContent = list.length + (list.length === 1 ? " title" : " titles");
      grid.innerHTML = list.length ? list.map(ep => renderEpisodeCard(ep)).join("") :
        '<div class="mh-empty">' + (season === "7" ? "No Season 7 episodes are marked as available yet. Check the Season 7 page for release details." : "No episodes match those filters. Try another season or search.") + '</div>';
    }
    function setActive() {
      seasonTabs.forEach(button => button.classList.toggle("active", button.dataset.season === season));
      filterTabs.forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    }
    seasonTabs.forEach(button => button.addEventListener("click", () => {
      season = button.dataset.season || "0";
      setActive();
      render();
    }));
    filterTabs.forEach(button => button.addEventListener("click", () => {
      mode = button.dataset.mode || "all";
      setActive();
      render();
    }));
    search?.addEventListener("input", () => {
      query = search.value.trim().toLowerCase();
      render();
    });
    setActive();
    render();
    window.addEventListener("mh-progress-synced", render);
  }

  async function initSeason7() {
    await whenReady();
    const grid = $("#season7EpisodesV2");
    if (!grid) return;
    const episodes = window.MH_SEASON7 || [];
    const syn = $("[data-s7-synopsis]");
    if (syn) syn.textContent = window.MH_SEASON7_SYNOPSIS || "Follow the next chapter of Miraculous.";
    const confirmed = episodes.filter(ep => ep.releaseStatus === "confirmed").length;
    const reported = episodes.filter(ep => ep.releaseStatus === "reported").length;
    const stats = $("#s7StatsV2");
    if (stats) stats.textContent = episodes.length + " episodes · " + confirmed + " confirmed listings · " + reported + " reported listings";
    grid.innerHTML = episodes.map(ep => {
      const date = ep.releaseDate ? new Date(ep.releaseDate + "T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}) : "Date not announced";
      const status = ep.releaseStatus === "confirmed" ? "Confirmed listing" : ep.releaseStatus === "reported" ? "Reported listing" : "Unannounced";
      const href = ep.available ? "watch.html?season=7&episode=" + ep.episode : "episodes.html?season=7";
      return '<a class="mh-release-card" id="s7e' + ep.episode + '" href="' + href + '"><div class="mh-release-num">' + String(ep.episode).padStart(2,"0") + '</div><div class="mh-release-copy"><strong>' + esc(ep.title || "Episode " + ep.episode) + '</strong><span>' + date + '</span></div><span class="mh-release-status">' + status + '</span></a>';
    }).join("");
  }

  async function initAnimeSearch() {
    const form = $("#reanAnimeSearchFormV2");
    if (!form) return;
    const input = $("#reanAnimeSearchV2");
    const status = $("#reanAnimeStatusV2");
    const results = $("#reanAnimeResultsV2");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const query = input.value.trim();
      if (query.length < 2) { status.textContent = "Enter at least two characters."; return; }
      status.textContent = "Searching English-dub anime…";
      results.replaceChildren();
      try {
        const response = await fetch("https://api.anidub.moe/v1/anime/search?q=" + encodeURIComponent(query), {signal:AbortSignal.timeout(12000)});
        if (!response.ok) throw new Error("Search service unavailable");
        const payload = await response.json();
        const list = Array.isArray(payload) ? payload : (payload.results || payload.data || []);
        if (!list.length) { status.textContent = "No matches found. Try a different title."; return; }
        status.textContent = list.length + " results";
        list.slice(0,9).forEach(item => {
          const title = item.titleEnglish || item.titleRomaji || item.titleNative || "Untitled anime";
          const link = document.createElement("a");
          link.className = "mh-search-result";
          link.href = "https://anilist.co/anime/" + encodeURIComponent(item.anilistId || item.id || "");
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          if (item.coverImage) {
            const image = document.createElement("img");
            image.src = safeImage(item.coverImage) || item.coverImage;
            image.alt = "";
            image.loading = "lazy";
            link.append(image);
          }
          const copy = document.createElement("div");
          const strong = document.createElement("strong");
          strong.textContent = title;
          const meta = document.createElement("span");
          meta.textContent = item.dubStatus || "Open on AniList";
          copy.append(strong,meta);
          link.append(copy);
          results.append(link);
        });
      } catch {
        status.textContent = "Anime search is temporarily unavailable. The featured titles are still here below.";
      }
    });
  }

  async function initApps() {
    const available = [["phone","MiraculousHubPhone.apk"],["tv","MiraculousHubTV.apk"]];
    for (const [device,file] of available) {
      const anchor = $("#" + device + "Download");
      const caption = $("#" + device + "Version");
      if (!anchor || !caption) continue;
      anchor.removeAttribute("href");
      anchor.setAttribute("aria-disabled","true");
      try {
        const response = await fetch("/downloads/" + device + ".json?t=" + Date.now(), {cache:"no-store"});
        if (!response.ok) throw new Error("Mirror not published");
        const version = await response.json();
        const stem = file.slice(0,-4);
        const required = "https://miraculoushub.co.uk/downloads/" + stem + "-" + version.versionCode + ".apk";
        if (version.url !== required || !Number.isInteger(version.versionCode) || version.versionCode < 1 || !/^[a-f0-9]{64}$/.test(String(version.sha256 || ""))) throw new Error("Invalid update metadata");
        const path = "/downloads/" + stem + "-" + version.versionCode + ".apk";
        const check = await fetch(path,{method:"HEAD",cache:"no-store"});
        if (!check.ok) throw new Error("APK mirror unavailable");
        const bytes = Number(check.headers.get("Content-Length"));
        caption.textContent = "Latest available · Build " + version.versionCode + (bytes > 0 ? " · " + (bytes/1048576).toFixed(1) + " MB" : "");
        anchor.href = path;
        anchor.download = file;
        anchor.setAttribute("aria-disabled","false");
        anchor.textContent = "Download latest APK ↓";
      } catch {
        caption.textContent = "Direct download is being published. Please check back soon.";
        anchor.textContent = "Download temporarily unavailable";
      }
    }
  }

  initHome();
  initEpisodes();
  initSeason7();
  initAnimeSearch();
  initApps();
})();
