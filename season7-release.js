(()=>{
 function countdown(entry,now=Date.now()){
  if(entry.available)return 'Ready to watch';
  if(entry.releaseAt){const left=Date.parse(entry.releaseAt)-now;if(left<=0)return 'Premiere time passed · awaiting upload';const seconds=Math.floor(left/1000);return `${Math.floor(seconds/86400)}d ${String(Math.floor(seconds%86400/3600)).padStart(2,'0')}h ${String(Math.floor(seconds%3600/60)).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;}
  if(entry.releaseDate){const days=Math.ceil((Date.parse(entry.releaseDate+'T23:59:59Z')-now)/86400000);return days>0?`About ${days} days · time TBA`:'Scheduled date passed · awaiting upload';}
  return 'Date to be announced';
 }
 window.MH_S7_COUNTDOWN=countdown;
 async function render(){
  document.querySelectorAll('[data-s7-synopsis]').forEach(el=>el.textContent=window.MH_SEASON7_SYNOPSIS);
  await window.MH_CATALOG_READY;
  for(const [id,limit] of [['s7HomeReleaseGrid',6],['s7OtherReleaseGrid',26],['s7ReleaseGrid',26]]){
   const grid=document.getElementById(id);if(!grid)continue;grid.replaceChildren();
   const entries=(window.MH_SEASON7||[]).slice(id==='s7OtherReleaseGrid'?6:0,limit);
   for(const entry of entries){
    const card=document.createElement('article');card.className='s7-release-card';card.id=id==='s7ReleaseGrid'?`s7e${entry.episode}`:'';
    const code=document.createElement('small');code.textContent=entry.code+' · '+(entry.releaseStatus==='confirmed'?'Confirmed':entry.releaseStatus==='reported'?'Reported':'Schedule pending');
    const title=document.createElement('h3');title.textContent=entry.title;
    const date=document.createElement('p');date.textContent=entry.releaseAt?new Date(entry.releaseAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})+' · your local time':entry.releaseDate?new Date(entry.releaseDate+'T12:00:00Z').toLocaleDateString([], {dateStyle:'medium',timeZone:'UTC'})+' · exact time TBA':'Release date not announced';
    const region=document.createElement('p');region.className='s7-region';region.textContent=entry.releaseRegion||'Date will appear when announced';
    const clock=document.createElement('strong');clock.className='s7-countdown';clock.dataset.episode=entry.episode;clock.setAttribute('aria-label','Release countdown');clock.textContent=countdown(entry);
    const compact=id!=='s7ReleaseGrid';
    const information=document.createElement('div');information.append(code);
    if(entry.description){const description=document.createElement('p');description.textContent=entry.description;description.style.whiteSpace='pre-wrap';information.append(description)}information.append(date,region);
    if(entry.available){const link=document.createElement('a');link.href=`watch.html?season=7&episode=${entry.episode}`;link.textContent='Watch episode →';information.append(link)}
    if(!compact&&entry.releaseSource){const source=document.createElement('a');source.href=entry.releaseSource;source.target='_blank';source.rel='noopener';source.textContent='Schedule source ↗';information.append(source)}
    card.append(title,clock);
    if(compact){const details=document.createElement('details'),summary=document.createElement('summary');details.className='countdown-information';summary.textContent='View more';details.addEventListener('toggle',()=>summary.textContent=details.open?'View less':'View more');details.append(summary,information);card.append(details)}else card.append(information);
    grid.append(card);
   }
  }
  tick();
 }
 function tick(){if(document.hidden)return;for(const el of document.querySelectorAll('.s7-countdown[data-episode]')){const entry=window.MH_SEASON7?.find(e=>e.episode===Number(el.dataset.episode));if(entry)el.textContent=countdown(entry)}}
 render();const timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
