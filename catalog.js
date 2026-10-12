/* Public additions are loaded once per page. Existing episodes remain available if offline. */
(() => {
 window.mhEscapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.MH_CATALOG_READY=(async()=>{
  try{
   const worker=window.MH_SITE_CONFIG?.uploaderWorker||"https://upload.miraculoushub.co.uk";
   const response=await fetch(worker+"/catalog",{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error("Catalog unavailable");
   const data=await response.json();if(!Array.isArray(data.entries))throw new Error("Invalid catalog");
   window.MH_TRAILERS=[];
   for(const row of data.entries){
    if(!row||!Number.isInteger(row.season)||row.season<1||row.season>7||typeof row.title!=="string"||row.title.length>160)continue;
    if(row.thumbnail&&!/^https:\/\/[^\s<>"']+$/.test(row.thumbnail))continue;
    if(row.kind==="episode"&&Number.isInteger(row.episode)&&row.episode>=1&&row.episode<=99){
     const code=`S${String(row.season).padStart(2,"0")}E${String(row.episode).padStart(2,"0")}`;
     const entry={season:row.season,episode:row.episode,title:row.title,code,videoPath:"/video/"+code.toLowerCase(),thumbnail:row.thumbnail||"",new:row.new===true};
     const list=window.MH_EPISODES||(window.MH_EPISODES=[]),index=list.findIndex(e=>e.season===entry.season&&e.episode===entry.episode);
     if(index<0)list.push(entry);else list[index]=entry;
    }else if(row.kind==="trailer"&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.id))window.MH_TRAILERS.push({...row,src:worker+"/trailer?id="+row.id});
   }
   window.MH_EPISODES?.sort((a,b)=>a.season-b.season||a.episode-b.episode);
  }catch(error){console.warn("Extra episodes and trailers are temporarily unavailable.");}
 })();
})();
