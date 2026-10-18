/* Season 4 still images are resolved by episode title so different broadcast
   episode orders do not put the wrong image on a card.
   Data source: TVmaze public episode image API. Existing upload thumbnails win. */
(function(){
 const NORMALIZE=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 const aliases={"verite":"truth","mensonge":"lies","legangdessecrets":"gangofsecrets",
   "mrpigeon72":"mrpigeon72","furiousfu":"furiousfu","furieuxfu":"furiousfu",
   "psychomedian":"psycomedian","culpabysse":"guiltrip","qilin":"qilin"};
 function patch(map){
   let changed=0;
   for(const ep of window.MH_EPISODES||[]){
     if(ep.season!==4||ep.thumbnail)continue;
     const key=NORMALIZE(ep.title);
     const url=map[key]||map[aliases[key]];
     if(url&&/^https:\/\//.test(url)){ep.thumbnail=url;changed++;}
   }
   if(changed)window.dispatchEvent(new CustomEvent("mh-season4-thumbnails",{detail:{updated:changed}}));
 }
 window.MH_S4_THUMBNAILS_READY=(async()=>{
   try{
     const cached=sessionStorage.getItem("mh_s4_thumbs_v1");
     if(cached){patch(JSON.parse(cached));return;}
     const r=await fetch("https://api.tvmaze.com/shows/5557/episodes",{signal:AbortSignal.timeout(10000)});
     if(!r.ok)throw new Error("TVmaze unavailable");
     const all=await r.json(),images={};
     if(!Array.isArray(all))return;
     for(const ep of all){
       if(ep?.season!==4||typeof ep.name!=="string")continue;
       const url=ep?.image?.medium||ep?.image?.original;
       if(typeof url!=="string"||!url.startsWith("https://"))continue;
       const key=NORMALIZE(ep.name);images[key]=url;
       if(aliases[key])images[aliases[key]]=url;
     }
     sessionStorage.setItem("mh_s4_thumbs_v1",JSON.stringify(images));
     patch(images);
   }catch(e){console.info("Season 4 stills unavailable; using existing catalogue art.");}
 })();
})();