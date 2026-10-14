(() => {
 const $=id=>document.getElementById(id),EMAIL="ibbyzaman4@gmail.com";
 const owner=()=>{const u=window.MH_AUTH?.user();return u&&!u.isAnonymous&&u.emailVerified&&u.email?.toLowerCase()===EMAIL};
 window.mhAdminToken=async()=>{
  await window.MH_FIREBASE_READY;await window.MH_AUTH_READY;
  const user=window.MH_AUTH?.user();if(!owner())throw new Error("Sign in with the verified owner account to manage content.");
  const token=await user.getIdToken();if(window.MH_AUTH.user()?.uid!==user.uid)throw new Error("Account changed. Try again.");return token;
 };
 function update(){
  const u=window.MH_AUTH?.user();$("adminAccount").textContent=owner()?`Signed in as ${u.email}`:u?"This account cannot manage trailers or episode cards.":"Sign in to manage trailers and episode cards.";
  $("episodeAdmin").hidden=!owner();$("publishUploadWrap").hidden=!owner();$("adminSignIn").textContent=u?"Change account":"Sign in";
  $("trailerAccess").textContent=owner()?"Owner access active.":"Trailer uploads require the verified owner account.";window.mhUploaderView?.refresh();
 }
 $("adminSignIn").onclick=async()=>{if(window.MH_AUTH?.user())await window.MH_AUTH.signOut();window.mhOpenAuth?.()};
 window.addEventListener("mh-auth-changed",update);window.MH_FIREBASE_READY?.then(()=>window.MH_AUTH_READY).then(update);update();
 function draft(){const releaseDate=$("cardReleaseDate").value||null,time=$("cardReleaseTime").value;return {kind:"episode",season:Number($("cardSeason").value),episode:Number($("cardEpisode").value),title:$("cardTitle").value,description:$("cardDescription").value,thumbnail:$("cardThumbnail").value,new:$("cardNew").checked,available:$("cardAvailable").checked,releaseDate,releaseAt:releaseDate&&time?new Date(releaseDate+'T'+time+':00Z').toISOString():null,releaseRegion:$("cardReleaseRegion").value,releaseStatus:$("cardReleaseStatus").value};}
 window.mhEpisodeDraft=k=>{const entry=draft();const id=`season-${entry.season}/s${String(entry.season).padStart(2,'0')}e${String(entry.episode).padStart(2,'0')}.mp4`;if(id!==k)throw new Error("Match the card season and episode to the upload selection.");if(!entry.title.trim())throw new Error("Enter an episode card title before uploading.");return entry;};
 function prepare(){const entry=window.MH_SEASON7?.find(e=>Number($("cardSeason").value)===7&&e.episode===Number($("cardEpisode").value));if(!entry){for(const id of ["cardTitle","cardDescription","cardReleaseDate","cardReleaseTime","cardReleaseRegion"])$(id).value="";$("cardAvailable").checked=false;return;}$("cardTitle").value=entry.title;$("cardDescription").value=entry.description||'';$("cardReleaseDate").value=entry.releaseDate||'';$("cardReleaseTime").value=entry.releaseAt?entry.releaseAt.slice(11,16):'';$("cardReleaseRegion").value=entry.releaseRegion||'';$("cardReleaseStatus").value=entry.releaseStatus==='confirmed'?'confirmed':'reported';$("cardAvailable").checked=entry.available===true;}
 for(const id of ["season","episode"])$(id).addEventListener("change",()=>{if($("type").value!=="episode")return;$("cardSeason").value=$("season").value;$("cardEpisode").value=$("episode").value;prepare()});
 $("cardSeason").addEventListener('change',prepare);$("cardEpisode").addEventListener('change',prepare);prepare();
 $("cardForm").onsubmit=async event=>{
  event.preventDefault();const status=$("cardStatus"),button=$("saveCard");button.disabled=true;status.textContent="Saving…";
  try{
   const token=await window.mhAdminToken();
   const response=await fetch(window.MH_SITE_CONFIG.uploaderWorker+"/catalog",{method:"POST",signal:AbortSignal.timeout(30000),headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","X-Upload-Password":$("password").value},body:JSON.stringify(draft())});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not save card.");
   status.replaceChildren(document.createTextNode("Saved. "));const link=document.createElement("a");link.href=result.entry.available===false?`episodes.html?season=${result.entry.season}`:`watch.html?season=${result.entry.season}&episode=${result.entry.episode}`;link.textContent=result.entry.available===false?"See coming-soon card ↗":"Open episode ↗";status.append(link);
  }catch(error){status.textContent=error.message}finally{button.disabled=false}
 };
})();
