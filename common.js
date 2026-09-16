
(function(){
  const THEME="mh-theme", PROGRESS="miraculoushub-progress";
  function setTheme(t){document.documentElement.classList.toggle("light",t==="light");localStorage.setItem(THEME,t);const b=document.querySelector("#themeToggle");if(b)b.textContent=t==="light"?"☀":"☾";}
  setTheme(localStorage.getItem(THEME)||"dark");
  const b=document.querySelector("#themeToggle"); if(b)b.onclick=()=>setTheme(document.documentElement.classList.contains("light")?"dark":"light");

  const modal=document.querySelector("#searchModal"), open=document.querySelector("#searchOpen"), close=document.querySelector("#searchClose"), close2=document.querySelector("#searchCloseBtn"), input=document.querySelector("#searchInput"), results=document.querySelector("#searchResults");
  function doSearch(q){
    if(!results)return;
    q=q.trim().toLowerCase();
    if(q.length<2){results.innerHTML='<div class="result"><small>Type at least two characters.</small></div>';return;}
    const hits=(window.MH_EPISODES||[]).filter(e=>`${e.title} ${e.code} season ${e.season} episode ${e.episode}`.toLowerCase().includes(q)).slice(0,12);
    results.innerHTML=hits.length?hits.map(e=>`<a class="result" href="watch.html?season=${e.season}&episode=${e.episode}"><strong>S${e.season} E${e.episode} · ${e.title}</strong><small>${e.code}</small></a>`).join(""):'<div class="result"><small>No episodes found.</small></div>';
  }
  if(open)open.onclick=()=>{modal.hidden=false;input.focus()}; if(close)close.onclick=()=>modal.hidden=true;if(close2)close2.onclick=()=>modal.hidden=true;if(input)input.oninput=e=>doSearch(e.target.value);

  const lb=document.querySelector("#languageButton"), lp=document.querySelector("#languagePopover");
  if(lb)lb.onclick=()=>lp.hidden=!lp.hidden;
  document.addEventListener("click",e=>{if(lp&&!e.target.closest("#languageButton")&&!e.target.closest("#languagePopover"))lp.hidden=true});

  window.mhGetProgress=function(){try{return JSON.parse(localStorage.getItem(PROGRESS)||"[]")}catch{return[]}};
  window.mhSaveProgress=function(item){
    let all=window.mhGetProgress().filter(x=>!(x.season===item.season&&x.episode===item.episode));
    all.unshift(item); all=all.slice(0,12); localStorage.setItem(PROGRESS,JSON.stringify(all));
    if(window.MH_CLOUD && window.MH_USER){
      const key=`s${item.season}e${item.episode}`;
      window.MH_CLOUD.savePlayback(key,item).catch(()=>{});
    }
  };
  window.mhClearProgress=function(season,episode){
    localStorage.setItem(PROGRESS,JSON.stringify(window.mhGetProgress().filter(x=>!(x.season===season&&x.episode===episode))));
  };
  window.mhSyncCloudProgress=async function(){
    if(!window.MH_CLOUD||!window.MH_USER)return window.mhGetProgress();
    try{
      const cloud=await window.MH_CLOUD.getAllPlayback();
      const local=window.mhGetProgress();
      const map=new Map();
      [...cloud,...local].forEach(x=>{if(x&&x.season!=null&&x.episode!=null)map.set(`${x.season}-${x.episode}`,x)});
      const merged=[...map.values()].sort((a,b)=>{const at=String(a.updatedAt?.seconds||a.updatedAt||0),bt=String(b.updatedAt?.seconds||b.updatedAt||0);return bt.localeCompare(at)}).slice(0,12);
      localStorage.setItem(PROGRESS,JSON.stringify(merged));
      window.dispatchEvent(new Event("mh-progress-synced"));
      return merged;
    }catch{return window.mhGetProgress()}
  };
  window.mhToggleFavourite=async function(ep){
    if(!window.MH_USER) { window.mhOpenAuth?.(); return null; }
    const key=`s${ep.season}e${ep.episode}`; return window.MH_CLOUD.setFavourite(key,ep);
  };
  window.mhIsFavourite=async function(ep){if(!window.MH_CLOUD||!window.MH_USER)return false;return window.MH_CLOUD.getFavourite(`s${ep.season}e${ep.episode}`)};
  window.mhMarkCloudWatched=async function(ep){if(window.MH_CLOUD&&window.MH_USER)await window.MH_CLOUD.markWatched(`s${ep.season}e${ep.episode}`,ep)};

  const authMarkup=`<div class="auth-modal" id="authModal" hidden><div class="auth-backdrop" data-auth-close></div><div class="auth-box"><button class="auth-close" data-auth-close>×</button><div class="auth-kicker">MIRACULOUSHUB ACCOUNT</div><h2 id="authTitle">Sign in</h2><p id="authSubtitle">Save watch progress, favourites and history across devices.</p><button class="google-auth" id="googleAuth">Continue with Google</button><div class="auth-divider"><span>or</span></div><form id="authForm"><input id="authEmail" type="email" autocomplete="email" placeholder="Email" required><input id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="Password (6+ characters)" required><button class="auth-submit" id="authSubmit" type="submit">Sign in</button></form><button class="auth-switch" id="authSwitch">Create an account</button><p class="auth-error" id="authError" aria-live="polite"></p></div></div>`;
  document.body.insertAdjacentHTML("beforeend",authMarkup);
  const am=document.querySelector("#authModal"), form=document.querySelector("#authForm"), err=document.querySelector("#authError"), submit=document.querySelector("#authSubmit"), title=document.querySelector("#authTitle"), subtitle=document.querySelector("#authSubtitle"), sw=document.querySelector("#authSwitch"), google=document.querySelector("#googleAuth");
  let authMode="signin";
  window.mhOpenAuth=function(mode="signin"){authMode=mode;title.textContent=mode==="signin"?"Sign in":"Create account";subtitle.textContent="Save watch progress, favourites and history across devices.";submit.textContent=mode==="signin"?"Sign in":"Create account";sw.textContent=mode==="signin"?"Create an account":"Already have an account? Sign in";err.textContent="";am.hidden=false;document.querySelector("#authEmail")?.focus()};
  function closeAuth(){am.hidden=true}
  am.querySelectorAll("[data-auth-close]").forEach(x=>x.onclick=closeAuth);
  sw.onclick=()=>window.mhOpenAuth(authMode==="signin"?"signup":"signin");
  form.onsubmit=async e=>{e.preventDefault();err.textContent="";submit.disabled=true;try{if(authMode==="signin")await window.MH_AUTH.signIn(authEmail.value.trim(),authPassword.value);else await window.MH_AUTH.signUp(authEmail.value.trim(),authPassword.value);closeAuth()}catch(e){err.textContent=(e.code||"").includes("invalid-credential")?"Email or password is incorrect.":(e.code||"").includes("email-already-in-use")?"That email already has an account.":(e.code||"").includes("weak-password")?"Use a password with at least 6 characters.":e.message||"Sign-in failed."}finally{submit.disabled=false}};
  google.onclick=async()=>{err.textContent="";google.disabled=true;try{await window.MH_AUTH.google();closeAuth()}catch(e){if(e.code!=="auth/popup-closed-by-user")err.textContent=e.message||"Google sign-in failed."}finally{google.disabled=false}};
  function updateAuthButton(user){document.querySelectorAll(".signin").forEach(b=>{b.textContent=user?"Account":"Sign in";b.onclick=()=>user?window.mhOpenAccount():window.mhOpenAuth()})}
  window.mhOpenAccount=function(){const u=window.MH_USER;if(!u)return window.mhOpenAuth();if(confirm(`Signed in as ${u.email||"Google account"}.\n\nPress OK to sign out.`))window.MH_AUTH.signOut()};
  window.addEventListener("mh-auth-changed",async e=>{updateAuthButton(e.detail);if(e.detail)await window.mhSyncCloudProgress();});
  updateAuthButton(window.MH_USER);

})();
