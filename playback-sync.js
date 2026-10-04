// Account-scoped playback synchronisation. Read before writing so a new
// player's initial 0:00 cannot overwrite an existing Firestore resume point.
(function(){
  window.MHPlayback = {
    create({video, item, key, onResume=()=>{}, onError=()=>{}, onSave=()=>{}, canResume=()=>true, now=()=>Date.now()}){
      const SAVE_INTERVAL=1000;
      function same(a,b){return !!a && !!b && Math.abs(a.position-b.position)<.05 && (a.duration||0)===(b.duration||0);}
      function stamp(data){return Number(data?.clientUpdatedAt) || (Number(data?.updatedAt?.seconds)||0)*1000 || Number(data?.updatedAt)||0;}
      let session=null, generation=0;
      function currentSession(){
        const uid=window.MH_USER?.uid || null;
        if(!session || session.uid!==uid){
          session={uid,generation:++generation,loaded:false,read:null,pending:null,
            duration:0,lastSave:-Infinity,retryAt:0,writeRetryAt:0,writing:null,queued:null,
            confirmed:null,localPayload:null,lastLocalStage:-Infinity};
        }
        return session;
      }
      function active(s){return currentSession()===s && !!s.uid;}
      function resume(s){
        if(!active(s) || s.pending===null) return;
        // A party supplies the playback position. Loading account history still
        // enables progress saves, but must not seek away from the shared room.
        if(!canResume()){s.pending=null;return;}
        if(video.readyState<1) return;
        const actual=Number(video.duration);
        const pos=Number.isFinite(actual) && actual>0
          ? Math.min(s.pending,Math.max(0,actual-.01)) : s.pending;
        try{
          video.currentTime=pos;
          s.pending=null;
          onResume(pos);
        }catch(error){
          // Retry when the media becomes seekable; never overwrite the saved
          // timestamp with the initial position while the seek is pending.
          console.warn("MiraculousHub: resume waiting for media",error);
        }
      }
      async function load(){
        try{
          if(window.MH_FIREBASE_READY) await window.MH_FIREBASE_READY;
          if(window.MH_AUTH_READY) await window.MH_AUTH_READY;
        }catch(error){onError(error);return false;}
        const s=currentSession();
        if(!s.uid || !window.MH_CLOUD) return false;
        if(s.loaded){resume(s);return s.pending===null;}
        if(s.read) return s.read;
        if(now()<s.retryAt) return false;
        s.read=(async()=>{
          try{
            let data=await window.MH_CLOUD.getPlayback(key);
            const cached=window.mhGetCachedPlayback?.(key);
            if(cached?.pendingCloud && (!data || stamp(cached)>stamp(data))) data=cached;
            // Recover an anime record written by the older shared helper,
            // only when its payload explicitly identifies this same show.
            if(!data && item.animeSlug){
              const legacy=await window.MH_CLOUD.getPlayback(`s0e${item.episode}`);
              if(legacy?.animeSlug===item.animeSlug) data=legacy;
            }
            if(!active(s)) return false;
            const duration=Number(data?.duration);
            s.duration=Number.isFinite(duration)&&duration>0 ? duration : 0;
            let pos=Number(data?.position ?? data?.currentTime ?? data?.time ?? NaN);
            if(!Number.isFinite(pos) && data && Number.isFinite(Number(data.progress)) && s.duration>0){
              pos=Number(data.progress)/100*s.duration;
            }
            s.pending=Number.isFinite(pos)&&pos>=0 ? pos : null;
            s.loaded=true;
            if(data && !data.pendingCloud && Number.isFinite(pos)) s.confirmed={position:pos,duration:s.duration};
            resume(s);
            return s.pending===null;
          }catch(error){
            if(active(s)){
              s.retryAt=now()+30000;onError(error);
              const cached=window.mhGetCachedPlayback?.(key);
              if(cached && Number.isFinite(Number(cached.position))){
                s.duration=Number.isFinite(Number(cached.duration))?Number(cached.duration):0;
                s.pending=Number(cached.position);s.loaded=true;resume(s);
                return s.pending===null;
              }
            }
            return false;
          }finally{s.read=null;}
        })();
        return s.read;
      }
      function snapshot(s){
        const position=Number(video.currentTime);
        if(video.readyState<1 || !Number.isFinite(position) || position<0) return null;
        const actual=Number(video.duration);
        const duration=Number.isFinite(actual)&&actual>0 ? actual : s.duration;
        if(duration>0) s.duration=duration;
        return {...item,position,...(duration>0 ? {
          duration,progress:Math.min(100,Math.max(0,position/duration*100))
        } : {})};
      }
      async function write(s,payload){
        if(!active(s)) return false;
        s.lastSave=now();
        let saved=false;
        try{
          await window.MH_CLOUD.savePlayback(key,payload);
          saved=true;
          if(active(s)){
            s.confirmed=payload;s.writeRetryAt=0;
            if(window.mhConfirmCloudProgress) window.mhConfirmCloudProgress(payload);
            else window.mhSaveProgress?.(payload);
            onSave(payload);
          }
        }catch(error){
          if(active(s)){
            s.writeRetryAt=now()+(error?.code==="resource-exhausted"?900000:30000);
            onError(error);
          }
        }
        return saved;
      }
      async function drain(s,payload){
        let saved=await write(s,payload);
        while(saved && active(s) && s.queued){
          const next=s.queued;s.queued=null;
          if(!next.force && now()-s.lastSave<SAVE_INTERVAL) break;
          if(!same(s.confirmed,next.payload)) saved=await write(s,next.payload);
        }
        return saved;
      }
      async function save(force=false){
        const initial=currentSession();
        // Once restored, start the write synchronously even during pagehide.
        if(!initial.uid || !initial.loaded || initial.pending!==null){
          if(!await load()) return false;
        }
        const s=currentSession();
        if(!active(s) || !s.loaded || s.pending!==null) return false;
        let payload=snapshot(s);
        if(!payload) return false;
        // Persist the latest device checkpoint before waiting on Firestore.
        // A quota-exhausted setDoc can remain pending until the quota resets.
        if(!same(s.localPayload,payload) && (force || now()-s.lastLocalStage>=1000)){
          payload=window.mhStageProgress?.(payload) || payload;
          s.localPayload=payload;s.lastLocalStage=now();
        }else if(s.localPayload && same(s.localPayload,payload)) payload=s.localPayload;
        if(s.writing){
          if(!same(s.confirmed,payload)) s.queued={payload,force:force || !!s.queued?.force};
          return force?s.writing:false;
        }
        if(same(s.confirmed,payload)){
          window.mhConfirmCloudProgress?.(payload);
          onSave(payload);
          return true;
        }
        if(now()<s.writeRetryAt) return false;
        if(!force && now()-s.lastSave<SAVE_INTERVAL) return false;
        s.queued=null;
        s.writing=drain(s,payload);
        try{return await s.writing;}finally{s.writing=null;}
      }
      return {load,save};
    }
  };
})();
