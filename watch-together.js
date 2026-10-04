(function(){
  const ROOM_RE=/^[a-f0-9]{24}$/, TOKEN_RE=/^[a-f0-9]{64}$/;
  const uuid=()=>crypto.randomUUID().replace(/-/g,'');
  const storageKey=id=>'mh-watch-party:'+id;
  function readRoom(id){try{return JSON.parse(sessionStorage.getItem(storageKey(id))||'null')}catch{return null}}
  function writeRoom(record){try{sessionStorage.setItem(storageKey(record.id),JSON.stringify(record));return true}catch{return false}}
  function clearRoom(id){try{sessionStorage.removeItem(storageKey(id))}catch{}}
  function mediaFromURL(url){
    const q=url.searchParams,slug=q.get('anime'),number=Number(q.get('episode'));
    if(slug){const show=(window.MH_ANIME_SHOWS||[]).find(x=>x.slug===slug),e=show?.episodes.find(x=>x.episode===number);return e?{path:e.videoPath,title:e.title}:null}
    const special=Number(q.get('special'));
    if(special){const slugs=['new-york','shanghai','awakening','paris','london','tokyo'];return slugs[special-1]?{path:`/video/special/${slugs[special-1]}`,title:'Miraculous special'}:null}
    const season=Number(q.get('season'));
    const e=(window.MH_EPISODES||[]).find(x=>x.season===season&&x.episode===number);
    return e?{path:`/video/s${String(season).padStart(2,'0')}e${String(number).padStart(2,'0')}`,title:e.title}:null;
  }
  function parseInvite(text){
    try{
      const url=new URL(String(text).trim(),location.href),id=url.searchParams.get('room');
      const token=new URLSearchParams(url.hash.slice(1)).get('invite');
      const allowed=url.origin===location.origin||['miraculoushub.co.uk','www.miraculoushub.co.uk'].includes(url.hostname);
      if(!allowed||!url.pathname.endsWith('/watch.html')||!ROOM_RE.test(id||'')||!TOKEN_RE.test(token||''))return null;
      return {id,invite:token};
    }catch{return null}
  }
  window.MHWatchTogether={parseInvite,mediaFromURL,create({video,worker,media,onNotice=()=>{},beforeOpen=()=>{}}){
    const action=document.getElementById('watchTogether'),setting=document.getElementById('watchTogetherSettings');
    const strip=document.getElementById('partyStrip'),dialog=document.getElementById('partyDialog');
    const $=id=>document.getElementById(id);
    if(!action||!dialog) return {active:()=>false,isHost:()=>false};
    let record=null,socket=null,state=null,members=[],phase='idle',role='guest',clockOffset=0;
    let suppressUntil=0,blocked=false,attempts=0,retryTimer,openTimer,pushTimer;
    let pendingInvite=null,lastPong=Date.now(),navigating=false,busy=false,destroyed=false,needsApply=false,playPending=false;
    const initialRoom=new URL(location.href).searchParams.get('room');
    const initialToken=window.MH_PARTY_INVITE;
    if(ROOM_RE.test(initialRoom||'')){
      pendingInvite=TOKEN_RE.test(initialToken||'')?{id:initialRoom,invite:initialToken}:null;
      const saved=readRoom(initialRoom);
      if(saved&&ROOM_RE.test(saved.id)&&TOKEN_RE.test(saved.invite)&&/^[a-f0-9]{32}$/.test(saved.member||''))record=saved;
    }
    const active=()=>!!record;
    const isHost=()=>active()&&role==='host'&&phase==='connected';
    const now=()=>Date.now()+clockOffset;
    function error(text=''){$('partyError').textContent=text}
    function busyUI(on){busy=on;$('partyCreate').disabled=on;$('partyJoin').disabled=on}
    function alias(){
      const value=$('partyName').value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,24);
      if(value.length<2){error('Choose a name with at least two characters.');$('partyName').focus();return null}
      try{sessionStorage.setItem('mh-party-name',value)}catch{}
      return value;
    }
    try{$('partyName').value=sessionStorage.getItem('mh-party-name')||''}catch{}
    function snapshot(){return {position:Number.isFinite(video.currentTime)?video.currentTime:0,
      duration:Number.isFinite(video.duration)?video.duration:0,paused:video.paused||video.ended,rate:video.playbackRate||1}}
    function send(data){if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(data));return true}return false}
    function roomURL(){
      const url=new URL(state?.media?.watchPath||'watch.html',location.href);
      if(!state){const current=new URL(location.href);url.search=current.search;url.searchParams.delete('room')}
      url.searchParams.set('room',record.id);url.hash=new URLSearchParams({invite:record.invite}).toString();return url.href;
    }
    function render(){
      const connected=phase==='connected';
      strip.hidden=!active();$('partySetup').hidden=active();$('partyActive').hidden=!active();
      action.textContent=active()?`Watch Together · ${members.length||1}`:'Watch Together';
      $('partyInvite').value=active()?roomURL():'';
      const host=members.find(x=>x.host)?.name||'the host';
      $('partySummary').textContent=connected?(role==='host'?'You are hosting':'Watching with '+host):'Connecting to your party…';
      $('partyHint').textContent=connected?`${members.length} / 12 people · ${role==='host'?'Your playback controls sync everyone.':'The host controls playback. Volume and subtitles are yours.'}`:'Playback is paused while the party reconnects.';
      $('partyNow').textContent=state?.media?.title||media.title;
      $('partyRole').textContent=connected?(role==='host'?'You control play, pause, seeking, speed and episode changes.':'Play, pause, seeking, speed and episode changes follow the host.'):'Reconnecting to the party…';
      $('partyEnable').hidden=!active()||!blocked||!!state?.paused;
      $('partyReconnect').hidden=!active()||connected;
      for(const id of ['back','forward','quickBack','quickForward']){const el=$(id);if(el){el.disabled=active()&&!isHost();el.classList.toggle('party-guest-control',el.disabled)}}
      document.querySelectorAll('[data-speed]').forEach(el=>el.disabled=active()&&!isHost());
      $('progressArea')?.setAttribute('aria-disabled',String(active()&&!isHost()));
      const list=$('partyMembers');list.replaceChildren();
      for(const person of members){
        const li=document.createElement('li'),name=document.createElement('span'),badge=document.createElement('small');
        name.textContent=person.name+(person.id===record?.member?' (you)':'');badge.textContent=person.host?'HOST':'WATCHING';
        li.append(name,badge);list.append(li);
      }
      if(!members.length&&active()){const li=document.createElement('li');li.textContent='Connecting…';list.append(li)}
    }
    async function open(){
      await beforeOpen();error();render();
      if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','')}
      if(!active())$('partyName').focus();else $('partyCopy').focus();
    }
    function close(){if(dialog.close)dialog.close();else dialog.removeAttribute('open')}
    function setURL(id){const url=new URL(location.href);if(id)url.searchParams.set('room',id);else url.searchParams.delete('room');url.hash='';history.replaceState(history.state,'',url)}
    function remember(){if(record&&!writeRoom(record))onNotice('Keep this tab open to retain your party settings.')}
    function leaveLocal(message='',removeCredential=true){
      const old=record;record=null;state=null;members=[];role='guest';phase='idle';blocked=false;window.MH_PARTY_CONNECTING=false;
      clearTimeout(retryTimer);clearTimeout(openTimer);clearTimeout(pushTimer);
      const oldSocket=socket;socket=null;try{oldSocket?.close(1000,'Left party')}catch{}
      if(old&&removeCredential)clearRoom(old.id);
      pendingInvite=null;setURL(null);render();if(message)onNotice(message);
    }
    function navigate(next){
      if(navigating||!record)return;
      const url=new URL(next.watchPath,location.href);
      if(url.origin!==location.origin||!url.pathname.endsWith('/watch.html')||!mediaFromURL(url)){error('This episode is not available in this player.');return}
      navigating=true;remember();url.searchParams.set('room',record.id);
      // The guest invitation survives navigation even if sessionStorage is unavailable.
      // The host credential is never added to a URL.
      url.hash=new URLSearchParams({invite:record.invite}).toString();location.assign(url.href);
    }
    function targetPosition(){
      if(!state)return 0;
      let value=state.position+(state.paused?0:Math.max(0,(now()-state.updatedAt)/1000)*state.rate);
      const duration=Number.isFinite(video.duration)&&video.duration>0?video.duration:state.duration;
      return duration>0?Math.min(value,Math.max(0,duration-.05)):Math.max(0,value);
    }
    function apply(force=false){
      if(!active()||!state||phase!=='connected'||navigating)return;
      if(state.media.path!==media.path){navigate(state.media);return}
      if(isHost()&&!force)return;
      if(video.readyState<1){needsApply=true;return}
      needsApply=false;
      if(!state.paused&&now()-state.updatedAt>10000){
        suppressUntil=Date.now()+750;video.pause();$('partyHint').textContent='Waiting for the host’s connection…';return;
      }
      suppressUntil=Date.now()+750;
      if(video.readyState>=1){const target=targetPosition();if(Math.abs(video.currentTime-target)>(force ? .15 : 1))try{video.currentTime=target}catch{}}
      if(Math.abs(video.playbackRate-state.rate)>.001)video.playbackRate=state.rate;
      if(state.paused){if(!video.paused)video.pause()}
      else if(video.paused&&video.readyState>=1&&!blocked&&!playPending){
        const attemptedMedia=state.media.path;
        try{const playing=video.play();if(playing?.then){playPending=true;playing.then(()=>{playPending=false},()=>{playPending=false;if(active()&&state?.media.path===attemptedMedia&&!state.paused){blocked=true;render();onNotice('Tap Enable playback to watch with your friends.')}})}}catch{blocked=true;render()}
      }
      $('partyEnable').hidden=!blocked||state.paused;
    }
    function enablePlayback(){
      if(!active()||!state||phase!=='connected'){onNotice('The party is reconnecting.');return}
      if(state.paused){onNotice('The host has paused the episode.');return}
      suppressUntil=Date.now()+750;
      if(video.readyState>=1)try{video.currentTime=targetPosition()}catch{}
      try{const play=video.play();play?.then(()=>{blocked=false;render();apply(true)}).catch(()=>{blocked=true;render();onNotice('Playback could not start. Tap Enable playback again.')})}catch{blocked=true;render()}
    }
    function localEvent(reason){
      if(!active()||Date.now()<suppressUntil||navigating)return;
      if(isHost()){
        clearTimeout(pushTimer);pushTimer=setTimeout(()=>{pushTimer=null;if(isHost()&&video.readyState>=1&&!needsApply)send({type:'state',state:snapshot(),reason})},80);
      }else apply(true);
    }
    function receive(data){
      if(!record)return;
      if(data.type==='pong'){
        lastPong=Date.now();const rtt=Date.now()-Number(data.clientTime);
        if(Number.isFinite(rtt)&&rtt>=0&&rtt<10000)clockOffset=data.serverTime-(Number(data.clientTime)+Date.now())/2;
        return;
      }
      if(data.type==='ended'){leaveLocal(data.message||'The party has ended.');close();return}
      if(data.type==='error'){error(data.message||'Party update failed.');onNotice(data.message||'Party update failed.');return}
      if(!['welcome','state','roster','promoted'].includes(data.type)||!data.state)return;
      if(state&&data.state.seq<state.seq)return;
      const previousRole=role;role=data.hostId===record.member?'host':'guest';
      if(data.type==='promoted'&&TOKEN_RE.test(data.host||'')){record.host=data.host;remember();onNotice('You are now the party host. Press play when everyone is ready.')}
      if(data.type==='welcome'){
        clearTimeout(openTimer);phase='connected';attempts=0;clockOffset=data.serverTime-Date.now();lastPong=Date.now();
        send({type:'ping',clientTime:Date.now()});window.MH_PARTY_CONNECTING=false;
      }
      state=data.state;record.expiresAt=data.expiresAt;
      if(Array.isArray(data.members))members=data.members;
      if(state.media.path!==media.path){navigate(state.media);return}
      if(data.type==='welcome'||data.type==='promoted'||previousRole!==role)apply(true);
      else if(role!=='host')apply(!!data.command);
      if(data.type!=='state')render();
      if(dialog.open&&data.type==='welcome')close();
    }
    function connect(){
      if(!record||destroyed)return;
      clearTimeout(retryTimer);clearTimeout(openTimer);
      const previous=socket;socket=null;try{previous?.close(1000,'Reconnect')}catch{}
      phase='connecting';window.MH_PARTY_CONNECTING=true;suppressUntil=Date.now()+750;video.pause();render();
      const url=new URL(`/party/rooms/${record.id}/socket`,worker);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('name',record.name);
      let next;
      try{next=new WebSocket(url,['mh-party','invite.'+record.invite,'member.'+record.member,...(record.host?['host.'+record.host]:[])])}catch{error('Could not open the party connection.');phase='disconnected';render();return}
      socket=next;
      openTimer=setTimeout(()=>{if(socket===next&&phase!=='connected')next.close()},12000);
      next.onmessage=event=>{if(socket!==next)return;let data;try{data=JSON.parse(event.data)}catch{return}receive(data)};
      next.onerror=()=>{if(socket===next)error('Could not connect. Check your invite or reconnect.')};
      next.onclose=event=>{
        if(socket!==next||!record||navigating)return;
        clearTimeout(openTimer);socket=null;phase='disconnected';suppressUntil=Date.now()+750;video.pause();render();
        if(event.code===4001){error('This party is connected in another tab.');return}
        if(++attempts<=4)retryTimer=setTimeout(connect,Math.min(5000,500*2**attempts));
        else{window.MH_PARTY_CONNECTING=false;error('Could not join this party. Check the invite, or leave and create a new room.');onNotice('Party connection unavailable. Use Reconnect or leave the room.')}
      };
    }
    async function createRoom(){
      if(busy||active())return;const name=alias();if(!name)return;
      busyUI(true);error();window.MH_PARTY_CONNECTING=true;
      try{
        const response=await fetch(new URL('/party/rooms',worker),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({media,state:snapshot()}),signal:AbortSignal.timeout(15000)});
        if(response.status===404||response.status===503)throw new Error('Watch Together is not available on this server yet.');
        let result;try{result=await response.json()}catch{throw new Error('The party server could not be reached.')}
        if(!response.ok)throw new Error(result.error||'Could not create a party.');
        if(!ROOM_RE.test(result.id)||!TOKEN_RE.test(result.invite)||!TOKEN_RE.test(result.host))throw new Error('Invalid party response.');
        record={id:result.id,invite:result.invite,host:result.host,member:uuid(),name,expiresAt:result.expiresAt};
        role='host';state=null;remember();setURL(record.id);connect();
      }catch(e){window.MH_PARTY_CONNECTING=false;error(e.name==='TimeoutError'?'The party server took too long. Try again.':e.message||'Could not create a party.')}
      finally{busyUI(false)}
    }
    function joinRoom(){
      if(busy||active())return;const name=alias();if(!name)return;
      const text=$('partyJoinLink').value.trim();
      const invite=text?parseInvite(text):pendingInvite;
      if(!invite){error('Paste the complete Watch Together invite link.');return}
      const previous=readRoom(invite.id);
      record={...invite,member:previous?.member||uuid(),name,...(previous?.host?{host:previous.host}:{})};
      state=null;role='guest';remember();setURL(record.id);error();connect();
    }
    action.onclick=open;if(setting)setting.onclick=open;
    $('partyDetails').onclick=open;$('partyClose').onclick=close;
    dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()}});
    $('partyCreate').onclick=createRoom;$('partyJoin').onclick=joinRoom;
    $('partyName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();pendingInvite?joinRoom():createRoom()}});
    $('partyJoinLink').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();joinRoom()}});
    $('partyLeave').onclick=()=>{send({type:'leave'});leaveLocal('You left the party.');close()};
    $('partyLeaveQuick').onclick=()=>{send({type:'leave'});leaveLocal('You left the party.')};
    $('partyReconnect').onclick=()=>{attempts=0;error();connect()};
    $('partyEnable').onclick=enablePlayback;
    $('partyCopy').onclick=async()=>{
      if(!active())return;try{await navigator.clipboard.writeText(roomURL());$('partyCopy').textContent='Copied';setTimeout(()=>$('partyCopy').textContent='Copy',1600)}catch{$('partyInvite').focus();$('partyInvite').select();error('Select and copy the invite link above.')}
    };
    $('partyShare').onclick=async()=>{if(!active())return;try{if(navigator.share)await navigator.share({title:'Watch Together on MiraculousHub',url:roomURL()});else $('partyCopy').click()}catch{}};
    // Guard custom controls, keyboard shortcuts and native-player events.
    // Guests retain their own volume, subtitles, fullscreen and AirPlay choices.
    document.addEventListener('click',event=>{
      if(!active()||isHost())return;
      const button=event.target.closest?.('#play,#centerPlay,#quickPlay');
      if(button){event.preventDefault();event.stopImmediatePropagation();enablePlayback();return}
      const control=event.target.closest?.('#back,#forward,#quickBack,#quickForward,[data-speed]');
      if(control){event.preventDefault();event.stopImmediatePropagation();onNotice('The host controls party playback.')}
    },true);
    document.addEventListener('pointerdown',event=>{
      if(active()&&!isHost()&&event.target.closest?.('#progressArea,.mobile-speed-zone')){event.preventDefault();event.stopImmediatePropagation();onNotice('The host controls seeking and speed.')}
    },true);
    document.addEventListener('keydown',event=>{
      if(!active()||isHost()||event.target.closest?.('input,textarea,select,dialog'))return;
      if([' ','k','K','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if([' ','k','K'].includes(event.key))enablePlayback();else onNotice('The host controls seeking.')}
    },true);
    document.addEventListener('click',event=>{
      if(!active()||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey)return;
      const link=event.target.closest?.('a[href]');if(!link)return;
      const url=new URL(link.href,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('/watch.html'))return;
      const next=mediaFromURL(url);if(!next||next.path===media.path)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!isHost()){onNotice('The host chooses the next episode. Leave the party to watch solo.');return}
      send({type:'media',media:next,state:{position:0,duration:0,paused:true,rate:video.playbackRate||1},reason:'episode'});
    },true);
    ['play','pause','seeked','ratechange','ended'].forEach(type=>video.addEventListener(type,()=>localEvent(type)));
    ['loadedmetadata','canplay'].forEach(type=>video.addEventListener(type,()=>{if(active()&&(needsApply||!isHost()))apply(true)}));
    const tick=setInterval(()=>{
      if(!active()||navigating)return;
      if(record.expiresAt&&now()>=record.expiresAt){leaveLocal('This party has expired. Create a new one.');return}
      if(phase==='connected'){
        if(isHost()&&video.readyState>=1&&!needsApply&&Date.now()>=suppressUntil&&!pushTimer)send({type:'state',state:snapshot(),reason:'heartbeat'});
        else if(!isHost())apply();
        if(Date.now()-lastPong>40000){try{socket?.close()}catch{}}
      }
    },1000);
    const ping=setInterval(()=>{if(active()&&phase==='connected')send({type:'ping',clientTime:Date.now()})},15000);
    window.addEventListener('online',()=>{if(active()&&phase!=='connected'){attempts=0;connect()}});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'&&active()){
        if(phase!=='connected'){attempts=0;connect()}else{lastPong=Date.now();send({type:'ping',clientTime:Date.now()});send({type:'sync'})}
      }
    });
    window.addEventListener('pagehide',()=>{clearTimeout(retryTimer);clearTimeout(openTimer);clearTimeout(pushTimer);clearInterval(tick);clearInterval(ping);destroyed=true;try{socket?.close(1000,'Page hidden')}catch{}});
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
    render();
    if(record)connect();
    else if(pendingInvite){$('partyJoinLink').value=location.origin+location.pathname+location.search+'#invite='+pendingInvite.invite;void open()}
    else if(initialRoom){void open();error('This room needs its complete invite link. Ask the host to copy the invite.')}
    return {active,isHost,open,enablePlayback};
  }};
})();
