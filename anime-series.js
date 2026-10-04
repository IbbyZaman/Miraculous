(function(){
  const slug=document.currentScript?.dataset.anime;
  const show=(window.MH_ANIME_SHOWS||[]).find(x=>x.slug===slug);
  const root=document.getElementById('animeEpisodeGroups');
  const filter=document.getElementById('animeSeasonFilter');
  if(!show||!root) return;
  const sections=[...new Set(show.episodes.map(x=>x.section||'Episodes'))];
  for(const section of sections){
    const option=document.createElement('option');option.value=section;option.textContent=section;
    filter.append(option);
    const group=document.createElement('section');group.className='aot-group';group.dataset.section=section;
    const title=document.createElement('h2');title.textContent=section;group.append(title);
    const grid=document.createElement('div');grid.className='aot-grid';group.append(grid);
    for(const e of show.episodes.filter(x=>(x.section||'Episodes')===section)){
      const card=document.createElement('a');card.className='aot-episode';card.href=e.watchUrl;
      const art=document.createElement('div');art.className='aot-art';
      const badge=document.createElement('span');badge.textContent=show.abbreviation;
      const number=document.createElement('b');number.textContent=e.group==='main'?String(e.episode).padStart(2,'0'):e.mediaId.toUpperCase();
      const progress=document.createElement('div');progress.className='watch-progress';progress.dataset.animeProgress=e.episode;progress.style.width='0%';
      art.append(badge,number,progress);
      const info=document.createElement('div');info.className='aot-info';
      const label=document.createElement('small');label.textContent=e.label||`Episode ${e.episode}`;
      const name=document.createElement('h3');name.textContent=e.title;
      const description=document.createElement('p');description.textContent='Watch solo or start a Watch Together party.';
      info.append(label,name,description);card.append(art,info);grid.append(card);
    }
    root.append(group);
  }
  filter.onchange=()=>root.querySelectorAll('[data-section]').forEach(el=>el.hidden=!!filter.value&&filter.value!==el.dataset.section);
  function progress(){
    const saved=window.mhGetProgress?.()||[];
    root.querySelectorAll('[data-anime-progress]').forEach(bar=>{
      const item=saved.find(x=>x.animeSlug===slug&&Number(x.episode)===Number(bar.dataset.animeProgress));
      bar.style.width=`${Math.max(0,Math.min(100,Number(item?.progress)||0))}%`;
    });
  }
  ['mh-progress-synced','mh-playback-local-saved','mh-cloud-save-ok','mh-auth-changed'].forEach(type=>window.addEventListener(type,progress));
  progress();
})();
