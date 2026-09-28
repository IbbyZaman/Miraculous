(function(){
  const THEME = "mh-theme";
  // Playback progress is intentionally NOT stored in localStorage.
  // Signed-in users use Firestore as the single source of truth.
  let progressCache = [];

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

    const hits = (window.MH_EPISODES || [])
      .filter(e =>
        `${e.title} ${e.code} season ${e.season} episode ${e.episode}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 12);

    results.innerHTML = hits.length
      ? hits.map(e =>
          `<a class="result" href="watch.html?season=${e.season}&episode=${e.episode}">
             <strong>S${e.season} E${e.episode} · ${e.title}</strong>
             <small>${e.code}</small>
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
    return progressCache.slice();
  }

  function writeCache(items){
    progressCache = (Array.isArray(items) ? items : []).slice(0, 30);
  }

  window.mhGetProgress = function(){
    return readCache();
  };

  // Update the current page's in-memory progress list. Firestore remains
  // authoritative for signed-in users; there is no persistent local fallback.
  window.mhSaveProgress = function(item){
    const all = readCache().filter(
      x => !(x.season === item.season && x.episode === item.episode)
    );

    all.unshift({
      ...item,
      updatedAt: Date.now()
    });

    writeCache(all);
  };

  window.mhSavePosition = async function(item){
    window.mhSaveProgress(item);
    if (!window.MH_CLOUD || !window.MH_USER) return false;

    await window.MH_CLOUD.savePlayback(
      `s${item.season}e${item.episode}`,
      item
    );

    window.dispatchEvent(new CustomEvent(
      "mh-cloud-save-ok",
      { detail: { season: item.season, episode: item.episode } }
    ));
    return true;
  };

  window.mhClearProgress = function(season, episode){
    writeCache(
      readCache().filter(
        x => !(x.season === season && x.episode === episode)
      )
    );
  };

  // Firestore is the only persistent playback source for signed-in accounts.
  window.mhSyncCloudProgress = async function(){
    if (!window.MH_CLOUD || !window.MH_USER) {
      writeCache([]);
      window.dispatchEvent(new Event("mh-progress-synced"));
      return [];
    }

    try {
      const cloud = await window.MH_CLOUD.getAllPlayback();
      writeCache(
        cloud
          .filter(x => x.season != null && x.episode != null)
          .sort((a,b) => {
            const at = a.updatedAt?.seconds
              ? a.updatedAt.seconds
              : Number(a.updatedAt || 0);
            const bt = b.updatedAt?.seconds
              ? b.updatedAt.seconds
              : Number(b.updatedAt || 0);
            return bt - at;
          })
      );

      window.dispatchEvent(new Event("mh-progress-synced"));
      return readCache();
    } catch (error) {
      console.warn("Cloud progress sync failed:", error);
      return readCache();
    }
  };

  window.mhToggleFavourite = async function(ep){
    if (!window.MH_USER) {
      window.mhOpenAuth?.();
      return null;
    }

    const key = `s${ep.season}e${ep.episode}`;
    return window.MH_CLOUD.setFavourite(key, ep);
  };

  window.mhIsFavourite = async function(ep){
    if (!window.MH_CLOUD || !window.MH_USER) return false;
    return window.MH_CLOUD.getFavourite(
      `s${ep.season}e${ep.episode}`
    );
  };

  window.mhMarkCloudWatched = async function(ep){
    if (!window.MH_CLOUD || !window.MH_USER) return;
    await window.MH_CLOUD.markWatched(
      `s${ep.season}e${ep.episode}`,
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
        <p class="account-email" id="accountEmail"></p>
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
      .then(user => {
        updateAuthButton(user);
        if (user) window.mhSyncCloudProgress();
      })
      .catch(error => {
        console.error("MiraculousHub Firebase Auth initialization failed:", error);
      });
  }

  connectFirebaseAuth();
})();