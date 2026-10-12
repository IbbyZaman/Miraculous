(async()=>{
 await window.MH_CATALOG_READY;
 const section=document.getElementById("season7-trailer");if(!section)return;
 for(const entry of window.MH_TRAILERS||[]){
  if(entry.season!==7)continue;
  const card=document.createElement("div");card.className="s7-trailer-card";card.style.marginTop="16px";
  const frame=document.createElement("div");frame.className="s7-trailer-frame";
  const video=document.createElement("video");video.controls=true;video.playsInline=true;video.preload="metadata";video.src=entry.src;video.setAttribute("controlslist","nodownload");video.setAttribute("aria-label",entry.title);if(entry.thumbnail)video.poster=entry.thumbnail;
  const caption=document.createElement("div");caption.className="s7-trailer-caption";const title=document.createElement("p");title.textContent=entry.title;caption.append(title);frame.append(video);card.append(frame,caption);section.append(card);
 }
})();
