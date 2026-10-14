(()=>{
 const $=id=>document.getElementById(id);let active='upload';
 const owner=()=>{const user=window.MH_AUTH?.user();return user?.emailVerified&&!user?.isAnonymous&&user?.email?.toLowerCase()==='ibbyzaman4@gmail.com'};
 const sections=[['upload','uploadTab','videoUploadPanel'],['cards','cardsTab','episodeAdmin'],['timers','timersTab','timerAdmin']];
 function refresh(){if(!owner()&&active!=='upload')active='upload';const busy=window.mhUploaderBusy?.();
  for(const [name,tabId,panelId] of sections){const tab=$(tabId);tab.hidden=name!=='upload'&&!owner();tab.disabled=!!busy;tab.setAttribute('aria-selected',String(name===active));tab.tabIndex=name===active?0:-1;$(panelId).hidden=name!==active;}
  $('publishUploadWrap').hidden=!owner()||$('type').value!=='episode';$('publishUploadHelp').hidden=!owner()||$('type').value!=='episode';$('editEpisodeDetails').hidden=!owner()||$('type').value!=='episode';
 }
 function select(name){if(window.mhUploaderBusy?.())return;if(name!=='upload'&&!owner()){window.mhOpenAuth?.();return}active=name;refresh();}
 for(const [name,tabId] of sections)$(tabId).onclick=()=>select(name);
 $('editEpisodeDetails').onclick=()=>{$('cardSeason').value=$('season').value;$('cardEpisode').value=$('episode').value;$('cardSeason').dispatchEvent(new Event('change'));select('cards')};$('type').addEventListener('change',refresh);
 document.querySelector('.upload-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const visible=sections.filter(([,id])=>!$(id).hidden&&!$(id).disabled);const i=visible.findIndex(([name])=>name===active);const next=event.key==='Home'?0:event.key==='End'?visible.length-1:(i+(event.key==='ArrowRight'?1:-1)+visible.length)%visible.length;if(!visible[next])return;event.preventDefault();select(visible[next][0]);$(visible[next][1]).focus()});
 let customTrailerId=false;$('trailerId').addEventListener('input',()=>customTrailerId=!!$('trailerId').value.trim());$('trailerTitle').addEventListener('input',()=>{if(!customTrailerId){$('trailerId').value=$('trailerTitle').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);$('trailerId').oninput?.()}});
 window.mhUploaderView={refresh,select};window.addEventListener('mh-auth-changed',refresh);refresh();
})();
