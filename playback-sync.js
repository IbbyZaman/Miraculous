// Account-scoped playback synchronisation. Read before writing so a new
// player's initial 0:00 cannot overwrite an existing Firestore resume point.
(function(){
  window.MHPlayback = {
    create({video, item, key, onResume=()=>{}, onError=()=>{}, onSave=()=>{}}){
      let session=null, generation=0;
      function currentSession(){
        const uid=window.MH_USER?.uid || null;
        if(!session || session.uid!==uid){
          session={uid,generation:++generation,loaded:false,read:null,pending:null,
            duration:0,lastSave:0,retryAt:0,writing:null,queued:null};
        }
        return session;
      }
      function active(s){return currentSession()===s && !!s.uid;}
      function resume(s){
        if(!active(s) || s.pending===null || video.readyState<1) return;
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
        if(Date.now()<s.retryAt) return false;
        s.read=(async()=>{
          try{
            let data=await window.MH_CLOUD.getPlayback(key);
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
            resume(s);
            return s.pending===null;
          }catch(error){
            if(active(s)){s.retryAt=Date.now()+3000;onError(error);}
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
        s.lastSave=Date.now();
        let saved=false;
        try{
          await window.MH_CLOUD.savePlayback(key,payload);
          saved=true;
          if(active(s)){
            window.mhSaveProgress?.(payload);
            onSave(payload);
          }
        }catch(error){
          if(active(s)){s.lastSave=0;onError(error);}
        }
        return saved;
      }
      async function drain(s,payload){
        let saved=await write(s,payload);
        while(active(s) && s.queued){
          const next=s.queued;s.queued=null;
          saved=await write(s,next);
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
        const payload=snapshot(s);
        if(!payload) return false;
        if(s.writing){
          if(force) s.queued=payload;
          return s.writing;
        }
        if(!force && Date.now()-s.lastSave<1000) return false;
        s.writing=drain(s,payload);
        try{return await s.writing;}finally{s.writing=null;}
      }
      return {load,save};
    }
  };
})();
