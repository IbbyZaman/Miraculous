/* Public additions are loaded once per page. Existing episodes remain available if offline. */
(() => {
 window.mhEscapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.MH_TRAILERS=[];window.MH_TIMERS=[];
 window.MH_CATALOG_READY=(async()=>{
  try{
   const worker=window.MH_SITE_CONFIG?.uploaderWorker||"https://upload.miraculoushub.co.uk";
   const response=await fetch(worker+"/catalog",{signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error("Catalog unavailable");
   const data=await response.json();if(!Array.isArray(data.entries))throw new Error("Invalid catalog");

   for(const row of data.entries){
    if(row?.kind==="timer"){
     if(/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.id||"")&&typeof row.title==="string"&&row.title.length<=160&&typeof row.description==="string"&&row.description.length<=1000&&typeof row.targetAt==="string"&&Number.isFinite(Date.parse(row.targetAt)))window.MH_TIMERS.push({id:row.id,title:row.title,description:row.description,targetAt:row.targetAt,enabled:row.enabled!==false});
     continue;
    }
    if(!row||!Number.isInteger(row.season)||row.season<1||row.season>7||typeof row.title!=="string"||row.title.length>160)continue;
    if(row.thumbnail&&!/^https:\/\/[^\s<>"']+$/.test(row.thumbnail))continue;
    if(row.kind==="episode"&&Number.isInteger(row.episode)&&row.episode>=1&&row.episode<=99){
     const code=`S${String(row.season).padStart(2,"0")}E${String(row.episode).padStart(2,"0")}`;
     const entry={season:row.season,episode:row.episode,title:row.title,code,videoPath:"/video/"+code.toLowerCase(),thumbnail:row.thumbnail||(row.season===7?"assets/main-season7-poster.png":""),new:row.new===true,available:row.available!==false,description:typeof row.description==="string"?row.description.slice(0,1000):""};
     const list=window.MH_EPISODES||(window.MH_EPISODES=[]),index=list.findIndex(e=>e.season===entry.season&&e.episode===entry.episode);
     if(entry.available){if(index<0)list.push(entry);else list[index]=entry;}else if(index>=0)list.splice(index,1);
     if(row.season===7){const planned=window.MH_SEASON7?.find(e=>e.episode===row.episode);if(planned){const schedule={};for(const key of ['releaseDate','releaseAt','releaseRegion','releaseStatus'])if(Object.hasOwn(row,key))schedule[key]=row[key];if((Object.hasOwn(row,"releaseDate")&&row.releaseDate!==planned.releaseDate)||(Object.hasOwn(row,"releaseAt")&&row.releaseAt!==planned.releaseAt))schedule.releaseSource=null;Object.assign(planned,entry,schedule);}}
    }else if(row.kind==="trailer"&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.id)){const entry={...row,src:worker+"/trailer?id="+row.id};const i=window.MH_TRAILERS.findIndex(t=>t.id===row.id);if(i<0)window.MH_TRAILERS.push(entry);else window.MH_TRAILERS[i]=entry;}
   }
   window.MH_EPISODES?.sort((a,b)=>a.season-b.season||a.episode-b.episode);
  }catch(error){console.warn("Extra episodes and trailers are temporarily unavailable.");}
 })();
})();
