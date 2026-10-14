(async()=>{
 await window.MH_CATALOG_READY;
 const selected=new URLSearchParams(location.search).get('id');
 for(const [id,filter] of [['trailerGrid',()=>true],['season7TrailerGrid',t=>t.season===7],['relatedTrailerGrid',t=>t.id!==selected]]){
  const grid=document.getElementById(id);if(!grid)continue;
  grid.replaceChildren();
  for(const entry of window.MH_TRAILERS||[]){
   if(!filter(entry))continue;
   const card=document.createElement('a');card.className='card trailer-card';card.href='trailer.html?id='+encodeURIComponent(entry.id);
   const art=document.createElement('div');art.className='art has-thumb';const img=document.createElement('img');img.className='episode-thumb';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=entry.thumbnail||'trailer-placeholder.svg';img.onerror=()=>{img.onerror=null;img.src='trailer-placeholder.svg'};
   const badge=document.createElement('span');badge.className='epno';badge.textContent=`SEASON ${entry.season} · TRAILER`;
   const info=document.createElement('div');info.className='card-info';const title=document.createElement('h3');title.textContent=entry.title;const caption=document.createElement('p');caption.textContent='Watch trailer →';
   art.append(img,badge);info.append(title,caption);card.append(art,info);grid.append(card);
  }
  if(!grid.children.length){const empty=document.createElement('p');empty.textContent='More trailers coming soon.';empty.style.color='var(--muted)';grid.append(empty)}
 }
})();
