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
  $("episodeAdmin").hidden=!owner();$("adminSignIn").textContent=u?"Change account":"Sign in";
  $("trailerAccess").textContent=owner()?"Owner access active.":"Trailer uploads require the verified owner account.";
 }
 $("adminSignIn").onclick=async()=>{if(window.MH_AUTH?.user())await window.MH_AUTH.signOut();window.mhOpenAuth?.()};
 window.addEventListener("mh-auth-changed",update);window.MH_FIREBASE_READY?.then(()=>window.MH_AUTH_READY).then(update);update();
 $("cardForm").onsubmit=async event=>{
  event.preventDefault();const status=$("cardStatus"),button=$("saveCard");button.disabled=true;status.textContent="Saving…";
  try{
   const token=await window.mhAdminToken();
   const response=await fetch(window.MH_SITE_CONFIG.uploaderWorker+"/catalog",{method:"POST",signal:AbortSignal.timeout(30000),headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","X-Upload-Password":$("password").value},body:JSON.stringify({kind:"episode",season:Number($("cardSeason").value),episode:Number($("cardEpisode").value),title:$("cardTitle").value,thumbnail:$("cardThumbnail").value,new:$("cardNew").checked})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not save card.");
   status.replaceChildren(document.createTextNode("Saved. "));const link=document.createElement("a");link.href=`watch.html?season=${result.entry.season}&episode=${result.entry.episode}`;link.textContent="Open episode ↗";status.append(link);
  }catch(error){status.textContent=error.message}finally{button.disabled=false}
 };
})();
