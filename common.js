
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
  };
  window.mhClearProgress=function(season,episode){
    localStorage.setItem(PROGRESS,JSON.stringify(window.mhGetProgress().filter(x=>!(x.season===season&&x.episode===episode))));
  };
})();
