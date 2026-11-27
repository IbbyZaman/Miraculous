(function(){
  const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const THEME = "mh-theme";
  // Keep pending progress on this device when Firestore has no quota or
  // connection. Each account has its own cache; cloud success is explicit.
  let progressCache = [];
  let progressCacheUid = null;
  const CACHE_PREFIX = "mh-playback-pending-v3:";
  function restoreAccountCache(){
    const uid=window.MH_USER?.uid || null;
    if(uid===progressCacheUid) return;
    progressCacheUid=uid;
    progressCache=[];
    if(uid){
      try{
        const saved=JSON.parse(localStorage.getItem(CACHE_PREFIX+uid)||"[]");
        if(Array.isArray(saved)) progressCache=saved.slice(0,30);
      }catch{}
    }
  }

  function setTheme(t){
    document.documentElement.classList.toggle("light", t === "light");
    localStorage.setItem(THEME, t);
    const b = document.querySelector("#themeToggle");
    if (b) b.textContent = t === "light" ? "☀" : "☾";
  }

  setTheme(localStorage.getItem(THEME) || "dark");

  const themeButton = document.querySelector("#themeToggle");
  if (themeButton) {
    themeButton.onclick = () =>
      setTheme(
        document.documentElement.classList.contains("light")
          ? "dark"
          : "light"
      );
  }

  const modal = document.querySelector("#searchModal");
  const open = document.querySelector("#searchOpen");
  const close = document.querySelector("#searchClose");
  const close2 = document.querySelector("#searchCloseBtn");
  const input = document.querySelector("#searchInput");
  const results = document.querySelector("#searchResults");

  function doSearch(q){
    if (!results) return;
    q = q.trim().toLowerCase();

    if (q.length < 2) {
      results.innerHTML =
        '<div class="result"><small>Type at least two characters.</small></div>';
      return;
    }

    const miraculousHits = (window.MH_EPISODES || [])
      .filter(e =>
        `${e.title} ${e.code} season ${e.season} episode ${e.episode}`
          .toLowerCase()
          .includes(q)
      )
      .map(e => ({
        href:`watch.html?season=${e.season}&episode=${e.episode}`,
        label:`S${e.season} E${e.episode} · ${e.title}`,
        meta:e.code
      }));

    const animeHits = (window.MH_ANIME_SHOWS || [])
      .flatMap(show => (show.episodes || []).map(e => ({show,e})))
      .filter(({show,e}) =>
        `${show.title} ${e.title} ${e.label||""} episode ${e.episode}`.toLowerCase().includes(q)
      )
      .map(({show,e}) => ({
        href:`watch.html?anime=${show.slug}&episode=${e.episode}`,
        label:`${show.title} · ${e.label||"E"+e.episode} · ${e.title}`,
        meta:"Monthly Anime"
      }));

    const trailerHits=(window.MH_TRAILERS||[]).filter(t=>`${t.title} season ${t.season} trailer`.toLowerCase().includes(q)).map(t=>({href:`trailer.html?id=${encodeURIComponent(t.id)}`,label:t.title,meta:`Season ${t.season} · Trailer`}));
    const hits=[...miraculousHits,...animeHits,...trailerHits].slice(0,12);

    results.innerHTML = hits.length
      ? hits.map(e =>
          `<a class="result" href="${e.href}">
             <strong>${escapeHTML(e.label)}</strong>
             <small>${escapeHTML(e.meta)}</small>
           </a>`
        ).join("")
      : '<div class="result"><small>No episodes found.</small></div>';
  }

  if (open) open.onclick = () => {
    if (!modal) return;
    modal.hidden = false;
    input?.focus();
  };

  if (close) close.onclick = () => { if (modal) modal.hidden = true; };
  if (close2) close2.onclick = () => { if (modal) modal.hidden = true; };
  if (input) input.oninput = e => doSearch(e.target.value);

  const languageButton = document.querySelector("#languageButton");
  const languagePopover = document.querySelector("#languagePopover");

  if (languageButton) {
    languageButton.onclick = e => {
      e.stopPropagation();
      if (languagePopover) languagePopover.hidden = !languagePopover.hidden;
    };
  }

  document.addEventListener("click", e => {
    if (
      languagePopover &&
      !e.target.closest("#languageButton") &&
      !e.target.closest("#languagePopover")
    ) {
      languagePopover.hidden = true;
    }
  });

  function readCache(){
    restoreAccountCache();
    return progressCache.slice();
  }

  function writeCache(items){
    restoreAccountCache();
    progressCache = (Array.isArray(items) ? items : []).slice(0, 30);
    if(progressCacheUid){
      try{localStorage.setItem(CACHE_PREFIX+progressCacheUid,JSON.stringify(progressCache));}catch{}
    }
  }
  function stamp(item){
    return Number(item.clientUpdatedAt) || item.updatedAt?.toMillis?.() ||
      (Number(item.updatedAt?.seconds)||0)*1000 || Number(item.updatedAt)||0;
  }

  // One identity for playback, watched state, favourites and the page cache.
  window.mhPlaybackKey = function(item){
    if(item.animeSlug) return `anime-${item.animeSlug}-e${item.episode}`;
    if(item.type === "special" || item.specialSlug || item.season === "Special") return `special-${item.episode}`;
    return `s${item.season}e${item.episode}`;
  };

  window.mhGetProgress = function(){
    return readCache();
  };

  // Update this account's device cache. pendingCloud distinguishes a
  // device-only checkpoint from a confirmed cloud save.
  window.mhSaveProgress = function(item){
    const all = readCache().filter(
      x => window.mhPlaybackKey(x) !== window.mhPlaybackKey(item)
    );

    all.unshift({
      ...item,
      updatedAt: item.updatedAt ?? Date.now()
    });

    writeCache(all);
  };

  window.mhGetCachedPlayback = key => readCache().find(item=>window.mhPlaybackKey(item)===key) || null;
  window.mhStageProgress = function(item){
    const previous=window.mhGetCachedPlayback(window.mhPlaybackKey(item));
    const payload={...item,clientUpdatedAt:Math.max(Date.now(),Number(previous?.clientUpdatedAt||0)+1),pendingCloud:true};
    window.mhSaveProgress(payload);
    window.dispatchEvent(new Event("mh-playback-local-saved"));
    return payload;
  };
  window.mhConfirmCloudProgress = function(item){
    const newer=window.mhGetCachedPlayback(window.mhPlaybackKey(item));
    if(newer && stamp(newer)>stamp(item)) return;
    window.mhSaveProgress({...item,pendingCloud:false});
  };

  window.mhSavePosition = async function(item){
    const payload=window.mhStageProgress(item);
    if (!window.MH_CLOUD || !window.MH_USER) return false;

    await window.MH_CLOUD.savePlayback(window.mhPlaybackKey(item),payload);
    window.mhConfirmCloudProgress(payload);

    window.dispatchEvent(new CustomEvent(
      "mh-cloud-save-ok",
      { detail: { season: item.season, episode: item.episode } }
    ));
    return true;
  };

  window.mhClearProgress = function(season, episode, animeSlug=null){
    writeCache(
      readCache().filter(
        x => window.mhPlaybackKey(x) !== window.mhPlaybackKey({season,episode,animeSlug})
      )
    );
  };

  function mergeCloudProgress(cloud){
      const normalised = cloud
        .map(x => {
          const id = String(x.id || "");
          const match = /^s(\d+)e(\d+)$/i.exec(id);
          const animeMatch = /^anime-([a-z0-9-]+)-e(\d+)$/i.exec(id);
          const animeSlug = x.animeSlug || (animeMatch ? animeMatch[1] : null);
          const specialMatch = /^special-(\d+)$/i.exec(id);
          const animeShow = animeSlug ? (window.MH_ANIME_SHOWS || []).find(a => a.slug === animeSlug) : null;
          const season = animeSlug ? 0 : specialMatch ? "Special" : (x.season ?? (match ? Number(match[1]) : null));
          const episode = x.episode ?? (animeMatch ? Number(animeMatch[2]) : specialMatch ? Number(specialMatch[1]) : (match ? Number(match[2]) : null));
          const known = animeSlug
            ? animeShow?.episodes?.find(e => Number(e.episode) === Number(episode))
            : (window.MH_EPISODES || []).find(
                e => Number(e.season) === Number(season) && Number(e.episode) === Number(episode)
              );
          const position = Number(x.position ?? x.currentTime ?? x.time ?? 0) || 0;
          const duration = Number(x.duration ?? 0) || 0;
          const progress = Number.isFinite(Number(x.progress))
            ? Number(x.progress)
            : (duration > 0 ? Math.min(100, (position / duration) * 100) : 0);

          return {
            ...x,
            season,
            episode,
            animeSlug: animeSlug || x.animeSlug || null,
            animeTitle: animeShow?.title || x.animeTitle || null,
            type: animeSlug ? "anime" : specialMatch ? "special" : (x.type || "episode"),
            pendingCloud:!!x.pendingCloud,
            title: x.title || known?.title || "Episode",
            position,
            duration,
            progress
          };
        })
        .filter(x => x.season != null && x.episode != null)
        .sort((a,b) => {
          const at = a.updatedAt?.seconds
            ? a.updatedAt.seconds
            : Number(a.updatedAt || 0);
          const bt = b.updatedAt?.seconds
            ? b.updatedAt.seconds
            : Number(b.updatedAt || 0);
          return bt - at;
        });

      const combined=new Map();
      for(const item of normalised){
        const key=window.mhPlaybackKey(item);
        if(!combined.has(key)) combined.set(key,item);
      }
      for(const item of readCache()){
        const key=window.mhPlaybackKey(item),remote=combined.get(key);
        if(item.pendingCloud && (!remote || stamp(item)>stamp(remote))) combined.set(key,item);
      }
      writeCache([...combined.values()].sort((a,b)=>stamp(b)-stamp(a)));

      window.dispatchEvent(new Event("mh-progress-synced"));
      return readCache();
  }
  let playbackFeedUid=null,stopPlaybackFeed=null;
  function startPlaybackFeed(){
    const uid=window.MH_USER?.uid || null;
    if(uid===playbackFeedUid && stopPlaybackFeed) return;
    if(stopPlaybackFeed) stopPlaybackFeed();
    stopPlaybackFeed=null;playbackFeedUid=null;
    if(!uid || !window.MH_CLOUD?.subscribePlayback) return;
    playbackFeedUid=uid;
    stopPlaybackFeed=window.MH_CLOUD.subscribePlayback((items,error)=>{
      if(window.MH_USER?.uid!==uid) return;
      if(error){
        stopPlaybackFeed?.();
        stopPlaybackFeed=null;playbackFeedUid=null;
        window.dispatchEvent(new CustomEvent("mh-cloud-save-error",{detail:error}));
        return;
      }
      mergeCloudProgress(items || []);
    });
  }
  // Update other open tabs from device checkpoints too, including while the
  // project's quota prevents cloud writes. Cloud updates use one live feed.
  window.addEventListener("storage",event=>{
    if(event.key!==CACHE_PREFIX+(window.MH_USER?.uid || "")) return;
    progressCacheUid=null;restoreAccountCache();
    window.dispatchEvent(new Event("mh-progress-synced"));
  });
  window.addEventListener("mh-auth-changed",startPlaybackFeed);
  window.addEventListener("mh-firebase-ready",startPlaybackFeed);
  window.addEventListener("pageshow",startPlaybackFeed);
  window.addEventListener("online",()=>{
    stopPlaybackFeed?.();stopPlaybackFeed=null;playbackFeedUid=null;
    startPlaybackFeed();
    window.mhSyncCloudProgress?.().catch(error=>window.dispatchEvent(new CustomEvent("mh-cloud-save-error",{detail:error})));
  });

  // Merge confirmed cloud records with this device's newer pending saves.
  window.mhSyncCloudProgress = async function(){
    if (!window.MH_CLOUD || !window.MH_USER) {
      writeCache([]);
      window.dispatchEvent(new Event("mh-progress-synced"));
      return [];
    }

    try {
      const uid=window.MH_USER.uid;
      const cloud = await window.MH_CLOUD.getAllPlayback();
      if(window.MH_USER?.uid!==uid) return readCache();
      return mergeCloudProgress(cloud);
    } catch (error) {
      console.warn("Cloud progress sync failed:", error);
      window.dispatchEvent(new CustomEvent("mh-cloud-save-error",{detail:error}));
      window.dispatchEvent(new Event("mh-progress-synced"));
      return readCache();
    }
  };

  window.mhToggleFavourite = async function(ep){
    if (!window.MH_USER) {
      window.mhOpenAuth?.();
      return null;
    }

    const key = window.mhPlaybackKey(ep);
    return window.MH_CLOUD.setFavourite(key, ep);
  };

  window.mhIsFavourite = async function(ep){
    if (!window.MH_CLOUD || !window.MH_USER) return false;
    return window.MH_CLOUD.getFavourite(
      window.mhPlaybackKey(ep)
    );
  };

  window.mhMarkCloudWatched = async function(ep){
    if (!window.MH_CLOUD || !window.MH_USER) return;
    await window.MH_CLOUD.markWatched(
      window.mhPlaybackKey(ep),
      ep
    );
  };

  const authMarkup = `
    <div class="auth-modal" id="authModal" hidden>
      <div class="auth-backdrop" data-auth-close></div>
      <div class="auth-box">
        <button class="auth-close" data-auth-close>×</button>
        <div class="auth-kicker">MIRACULOUSHUB ACCOUNT</div>
        <h2 id="authTitle">Sign in</h2>
        <p id="authSubtitle">
          Save watch progress, favourites and history across devices.
        </p>
        <button class="google-auth" id="googleAuth">
          Continue with Google
        </button>
        <div class="auth-divider"><span>or</span></div>
        <form id="authForm">
          <input id="authEmail" type="email" autocomplete="email"
                 placeholder="Email" required>
          <input id="authPassword" type="password"
                 autocomplete="current-password" minlength="6"
                 placeholder="Password (6+ characters)" required>
          <button class="auth-submit" id="authSubmit" type="submit">
            Sign in
          </button>
        </form>
        <button class="auth-switch" id="authSwitch">
          Create an account
        </button>
        <p class="auth-error" id="authError" aria-live="polite"></p>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", authMarkup);

  const accountMarkup = `
    <div class="auth-modal account-modal" id="accountModal" hidden>
      <div class="auth-backdrop" data-account-close></div>
      <div class="auth-box account-box">
        <button class="auth-close" data-account-close>×</button>
        <div class="auth-kicker">MIRACULOUSHUB ACCOUNT</div>
        <h2>Your profile</h2>
        <p class="account-email" id="accountEmail"></p><a id="adminContentLink" href="upload.html" hidden>Manage trailers and episode cards ↗</a>
        <label class="account-label" for="accountNickname">Public nickname</label>
        <input id="accountNickname" type="text" maxlength="24" autocomplete="nickname" placeholder="Choose a nickname">
        <p class="account-note">Only this nickname appears beside your comments. Your email and Google account name stay private.</p>
        <button class="auth-submit" id="saveNickname" type="button">Save nickname</button>
        <p class="auth-error" id="nicknameError" aria-live="polite"></p>
        <button class="auth-switch account-signout" id="accountSignOut" type="button">Sign out</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", accountMarkup);

  const am = document.querySelector("#authModal");
  const form = document.querySelector("#authForm");
  const err = document.querySelector("#authError");
  const submit = document.querySelector("#authSubmit");
  const title = document.querySelector("#authTitle");
  const subtitle = document.querySelector("#authSubtitle");
  const sw = document.querySelector("#authSwitch");
  const google = document.querySelector("#googleAuth");

  let authMode = "signin";

  function waitForFirebaseAuth(timeout = 15000){
    if (window.MH_AUTH && typeof window.MH_AUTH.signIn === "function") {
      return Promise.resolve(window.MH_AUTH);
    }

    if (!window.MH_FIREBASE_READY) {
      return Promise.reject(new Error("Firebase did not start loading. Refresh the page and try again."));
    }

    return Promise.race([
      window.MH_FIREBASE_READY.then(() => {
        if (!window.MH_AUTH || typeof window.MH_AUTH.signIn !== "function") {
          throw new Error("Firebase loaded, but Authentication is unavailable.");
        }
        return window.MH_AUTH;
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firebase is taking too long to load. Check your internet connection and try again.")), timeout)
      )
    ]);
  }

  window.mhOpenAuth = function(mode = "signin"){
    authMode = mode;
    title.textContent =
      mode === "signin" ? "Sign in" : "Create account";
    subtitle.textContent =
      "Save watch progress, favourites and history across devices.";
    submit.textContent =
      mode === "signin" ? "Sign in" : "Create account";
    sw.textContent =
      mode === "signin"
        ? "Create an account"
        : "Already have an account? Sign in";
    err.textContent = "";
    am.hidden = false;
    document.querySelector("#authEmail")?.focus();
  };

  function closeAuth(){
    am.hidden = true;
  }

  am.querySelectorAll("[data-auth-close]")
    .forEach(x => x.onclick = closeAuth);

  sw.onclick = () =>
    window.mhOpenAuth(
      authMode === "signin" ? "signup" : "signin"
    );

  form.onsubmit = async e => {
    e.preventDefault();
    err.textContent = "";
    submit.disabled = true;

    try {
      const authApi = await waitForFirebaseAuth();

      if (authMode === "signin") {
        await authApi.signIn(
          document.querySelector("#authEmail").value.trim(),
          document.querySelector("#authPassword").value
        );
      } else {
        await authApi.signUp(
          document.querySelector("#authEmail").value.trim(),
          document.querySelector("#authPassword").value
        );
      }

      closeAuth();
    } catch (e) {
      const code = e.code || "";
      const messages = {
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/invalid-login-credentials": "Email or password is incorrect.",
        "auth/user-not-found": "No account exists with that email.",
        "auth/wrong-password": "Email or password is incorrect.",
        "auth/email-already-in-use": "That email already has an account.",
        "auth/weak-password": "Use a password with at least 6 characters.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/operation-not-allowed": "Email/password sign-in is not enabled in this Firebase project.",
        "auth/network-request-failed": "Firebase could not connect. Check your internet connection.",
        "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
        "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication.",
        "auth/api-key-not-valid": "The Firebase web API key is not valid for this project."
      };
      err.textContent = messages[code] || e.message || "Sign-in failed.";
    } finally {
      submit.disabled = false;
    }
  };

  google.onclick = async () => {
    err.textContent = "";
    google.disabled = true;

    try {
      const authApi = await waitForFirebaseAuth();
      await authApi.google();
      closeAuth();
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") {
        const code = e.code || "";
        err.textContent = code === "auth/unauthorized-domain"
          ? "This website domain is not authorized in Firebase Authentication."
          : e.message || "Google sign-in failed.";
      }
    } finally {
      google.disabled = false;
    }
  };

  function updateAuthButton(user){
    const adminLink=document.querySelector("#adminContentLink");if(adminLink)adminLink.hidden=!(user?.emailVerified&&!user?.isAnonymous&&user?.email?.toLowerCase()==="ibbyzaman4@gmail.com");
    document.querySelectorAll(".signin").forEach(b => {
      b.textContent = user ? "Account" : "Sign in";
      b.onclick = () =>
        user
          ? window.mhOpenAccount()
          : window.mhOpenAuth();
    });
  }

  const accountModal = document.querySelector("#accountModal");
  const accountEmail = document.querySelector("#accountEmail");
  const accountNickname = document.querySelector("#accountNickname");
  const nicknameError = document.querySelector("#nicknameError");
  const saveNickname = document.querySelector("#saveNickname");
  const accountSignOut = document.querySelector("#accountSignOut");

  function closeAccount(){
    if (accountModal) accountModal.hidden = true;
  }

  accountModal?.querySelectorAll("[data-account-close]")
    .forEach(x => x.onclick = closeAccount);

  window.mhOpenAccount = async function(options = {}){
    const u = window.MH_USER;

    if (!u) {
      window.mhOpenAuth();
      return;
    }

    if (accountEmail) accountEmail.textContent = u.email || "Signed-in account";
    if (nicknameError) {
      nicknameError.style.color = "";
      nicknameError.textContent = options.message || "";
    }
    if (accountNickname) accountNickname.value = "";
    if (accountModal) accountModal.hidden = false;

    try {
      if (window.MH_CLOUD?.getNickname) {
        const nickname = await window.MH_CLOUD.getNickname();
        if (accountNickname && nickname) accountNickname.value = nickname;
      }
    } catch (error) {
      console.warn("Could not load nickname:", error);
    }

    if (options.focusNickname) setTimeout(() => accountNickname?.focus(), 0);
  };

  window.mhEnsureNickname = async function(){
    if (!window.MH_USER) {
      window.mhOpenAuth();
      return null;
    }

    try {
      const nickname = await window.MH_CLOUD?.getNickname?.();
      if (nickname) return nickname;
    } catch {}

    window.mhOpenAccount({
      message: "Choose a nickname before posting. Your account name will never be shown publicly.",
      focusNickname: true
    });
    return null;
  };

  if (saveNickname) saveNickname.onclick = async () => {
    nicknameError.textContent = "";
    nicknameError.style.color = "";
    saveNickname.disabled = true;
    try {
      const nickname = await window.MH_CLOUD.setNickname(accountNickname.value);
      accountNickname.value = nickname;
      nicknameError.style.color = "#71e7b8";
      nicknameError.textContent = "Nickname saved.";
      window.dispatchEvent(new CustomEvent("mh-nickname-changed", { detail: nickname }));
    } catch (error) {
      nicknameError.textContent = error?.message || "Could not save nickname.";
    } finally {
      saveNickname.disabled = false;
    }
  };

  if (accountSignOut) accountSignOut.onclick = async () => {
    try {
      const api = await waitForFirebaseAuth();
      await api.signOut();
      closeAccount();
    } catch (error) {
      console.error(error);
    }
  };

  window.addEventListener(
    "mh-auth-changed",
    async e => {
      updateAuthButton(e.detail);

      restoreAccountCache();
      window.dispatchEvent(new Event("mh-progress-synced"));
      if (e.detail) {
        await window.mhSyncCloudProgress();
        window.dispatchEvent(
          new Event("mh-account-ready")
        );
      }
    }
  );

  updateAuthButton(window.MH_USER);

  // Firebase exposes one explicit readiness promise, so authentication UI
  // never races the Firebase module loading.
  function connectFirebaseAuth(){
    if (!window.MH_FIREBASE_READY) return;
    window.MH_FIREBASE_READY.then(() => window.MH_AUTH_READY)
      .then(async user => {
        updateAuthButton(user);
        startPlaybackFeed();
        if (user) {
          await window.mhSyncCloudProgress();
          window.dispatchEvent(new Event("mh-account-ready"));
        } else {
          writeCache([]);
          window.dispatchEvent(new Event("mh-progress-synced"));
        }
      })
      .catch(error => {
        console.error("MiraculousHub Firebase Auth initialization failed:", error);
      });
  }

  connectFirebaseAuth();
})();

  // Scheduled site maintenance: 27 November 2026, 22:00–22:30 UK time.
  (function scheduledMaintenance(){
    const start = new Date("2026-11-27T22:00:00+00:00").getTime();
    const end = new Date("2026-11-27T22:30:00+00:00").getTime();
    const style = document.createElement("style");
    style.textContent = `
      #mh-maintenance-notice{position:fixed;z-index:99990;top:12px;left:50%;transform:translateX(-50%);width:min(680px,calc(100% - 24px));padding:13px 18px;border:1px solid rgba(140,170,255,.28);border-radius:15px;background:rgba(12,18,34,.96);color:#f5f7ff;box-shadow:0 12px 40px #0008;font:500 13px/1.5 system-ui,sans-serif;text-align:center;backdrop-filter:blur(16px)}
      #mh-maintenance-notice strong{display:block;font-size:14px;letter-spacing:.04em}
      #mh-maintenance-notice span{color:#c1cbe2}
      #mh-maintenance-screen{position:fixed;inset:0;z-index:1000000;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 35%,#182b52 0%,#090e1b 55%,#05070c 100%);color:#f7f8ff;text-align:center;font-family:system-ui,sans-serif}
      #mh-maintenance-screen[hidden],#mh-maintenance-notice[hidden]{display:none}
      #mh-maintenance-screen .mh-maintenance-card{max-width:560px}
      #mh-maintenance-screen .mh-maintenance-mark{margin:0 auto 22px;width:54px;height:54px;display:grid;place-items:center;border:1px solid #7189c9;border-radius:17px;font-size:25px;font-weight:800;color:#dbe5ff}
      #mh-maintenance-screen h1{margin:0 0 12px;font-size:clamp(30px,6vw,48px);letter-spacing:-.04em}
      #mh-maintenance-screen p{color:#c0c9dc;line-height:1.7}
      #mh-maintenance-screen small{display:block;margin-top:24px;color:#91a1c2;letter-spacing:.12em;text-transform:uppercase}
    `;
    document.head.appendChild(style);
    const notice=document.createElement("div");
    notice.id="mh-maintenance-notice";
    notice.setAttribute("role","status");
    notice.innerHTML='<strong> SCHEDULED MAINTENANCE · TONIGHT </strong><span>MiraculousHub will be temporarily unavailable from 10:00 PM to 10:30 PM (UK time). <b id="mh-maintenance-countdown">Starting at 10:00 PM</b></span>';
    const screen=document.createElement("div");
    screen.id="mh-maintenance-screen";
    screen.hidden=true;
    screen.innerHTML='<div class="mh-maintenance-card"><div class="mh-maintenance-mark">M</div><h1>We’ll be right back.</h1><p>MiraculousHub is undergoing scheduled maintenance. We expect to be back at <strong>10:30 PM UK time</strong>.</p><small>Thank you for your patience · MiraculousHub</small></div>';
    document.body.append(notice,screen);
    function refresh(){
      const now=Date.now();
      if(now>=start && now<end){
        notice.hidden=true;
        screen.hidden=false;
        document.documentElement.style.overflow="hidden";
      }else if(now>=end){
        notice.hidden=true;
        screen.hidden=true;
        document.documentElement.style.overflow="";
      }else{
        notice.hidden=false;
        screen.hidden=true;
        const remaining=Math.max(0,start-now);
        const hours=Math.floor(remaining/3600000);
        const minutes=Math.floor((remaining%3600000)/60000);
        const seconds=Math.floor((remaining%60000)/1000);
        const clock=hours?hours+"h "+minutes+"m":minutes+"m "+seconds+"s";
        const label=document.getElementById("mh-maintenance-countdown");
        if(label) label.textContent="Starts in "+clock;
      }
    }
    refresh();
    window.setInterval(refresh,1000);
  })();

