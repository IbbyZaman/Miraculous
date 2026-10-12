(async()=>{
 await window.MH_CATALOG_READY;
 const id=new URLSearchParams(location.search).get('id'),entry=(window.MH_TRAILERS||[]).find(t=>t.id===id);
 const $=id=>document.getElementById(id),video=$('trailerVideo'),status=$('trailerStatus');
 if(!entry){$('trailerTitle').textContent='Trailer unavailable';status.textContent='This trailer could not be found. Return to the homepage or try again later.';$('trailerShare').hidden=true;return}
 document.title=`MiraculousHub — ${entry.title}`;$('trailerTitle').textContent=entry.title;$('trailerLabel').textContent=`SEASON ${entry.season} · TRAILER`;$('trailerDescription').textContent='Miraculous · Trailer';
 video.setAttribute('aria-label',entry.title);video.poster=entry.thumbnail||'assets/trailer-placeholder.svg';video.hidden=false;status.hidden=true;
 video.addEventListener('error',()=>{status.textContent='The trailer could not load. Try refreshing the page.';status.hidden=false});video.addEventListener('loadeddata',()=>status.hidden=true);video.src=entry.src;
 $('trailerShare').onclick=async()=>{try{if(navigator.share)await navigator.share({title:entry.title,url:location.href});else{await navigator.clipboard.writeText(location.href);$('trailerNotice').textContent='Trailer link copied.'}}catch(error){if(error.name!=='AbortError')$('trailerNotice').textContent='Copy the page address to share this trailer.'}};
})();
