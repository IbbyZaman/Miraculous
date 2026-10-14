(async()=>{
 await window.MH_CATALOG_READY;
 const id=new URLSearchParams(location.search).get('id'),entry=(window.MH_TRAILERS||[]).find(t=>t.id===id);
 const $=id=>document.getElementById(id),video=$('trailerVideo'),status=$('trailerStatus'),screen=$('trailerScreen');
 const notice=text=>$('trailerNotice').textContent=text;
 if(!entry){$('trailerTitle').textContent='Trailer unavailable';status.textContent='This trailer could not be found. Return to the homepage or try again later.';['trailerShare','trailerDownload','trailerBigPlay','trailerControls','trailerComments'].forEach(id=>$(id).hidden=true);return}
 document.title=`MiraculousHub — ${entry.title}`;$('trailerTitle').textContent=entry.title;$('trailerLabel').textContent=`SEASON ${entry.season} · TRAILER`;$('trailerDescription').textContent='Miraculous · Trailer';
 video.setAttribute('aria-label',entry.title);video.poster=entry.thumbnail||'trailer-placeholder.svg';video.hidden=false;status.hidden=true;
 let timer;
 function showControls(){screen.classList.remove('controls-hidden');clearTimeout(timer);if(!video.paused)timer=setTimeout(()=>screen.classList.add('controls-hidden'),2500)}
 const toggle=async()=>{try{if(video.paused)await video.play();else video.pause()}catch{notice('Tap play to start this trailer.')}};
 $('trailerPlay').onclick=toggle;$('trailerBigPlay').onclick=toggle;video.onclick=toggle;
 for(const event of ['pointermove','pointerdown','focusin'])screen.addEventListener(event,showControls);
 const format=n=>{n=Math.max(0,Math.floor(Number(n)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};
 function update(){const duration=Number.isFinite(video.duration)?video.duration:0;$('trailerTime').textContent=`${format(video.currentTime)} / ${format(duration)}`;$('trailerSeek').value=duration?video.currentTime/duration*100:0;$('trailerSeek').disabled=!duration;$('trailerPlay').textContent=video.paused?'▶':'Ⅱ';$('trailerPlay').setAttribute('aria-label',video.paused?'Play':'Pause');$('trailerBigPlay').hidden=!video.paused;}
 for(const event of ['timeupdate','loadedmetadata','play','pause','ended'])video.addEventListener(event,()=>{update();if(event!=='timeupdate')showControls()});
 $('trailerSeek').oninput=()=>{if(Number.isFinite(video.duration))video.currentTime=video.duration*Number($('trailerSeek').value)/100};
 $('trailerBack10').onclick=()=>video.currentTime=Math.max(0,video.currentTime-10);
 $('trailerForward10').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+10)};
 $('trailerMute').onclick=()=>video.muted=!video.muted;$('trailerVolume').oninput=()=>{video.volume=Number($('trailerVolume').value);video.muted=video.volume===0};
 video.addEventListener('volumechange',()=>{$('trailerMute').textContent=video.muted||!video.volume?'Muted':'Sound';$('trailerMute').setAttribute('aria-label',video.muted?'Unmute':'Mute');$('trailerVolume').value=video.muted?0:video.volume});
 $('trailerRate').onchange=()=>video.playbackRate=Number($('trailerRate').value);
 $('trailerFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(screen.requestFullscreen)await screen.requestFullscreen();else video.webkitEnterFullscreen?.()}catch{notice('Fullscreen is unavailable in this browser.')}};
 document.addEventListener('fullscreenchange',()=>$('trailerFullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
 video.addEventListener('error',()=>{status.textContent='The trailer could not load. Try refreshing the page.';status.hidden=false});video.addEventListener('loadeddata',()=>status.hidden=true);
 video.src=entry.src;update();
 window.MH_DOWNLOADS.bind({button:$('trailerDownload'),worker:window.MH_SITE_CONFIG.videoWorker,path:'/download/trailer/'+entry.id,mediaLabel:'Trailer',onNotice:notice});
 $('trailerShare').onclick=async()=>{try{if(navigator.share)await navigator.share({title:entry.title,url:location.href});else{await navigator.clipboard.writeText(location.href);notice('Trailer link copied.')}}catch(error){if(error.name!=='AbortError')notice('Copy the page address to share this trailer.')}};
 window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
})();
