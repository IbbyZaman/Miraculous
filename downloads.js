/* Account downloads are streamed by the Worker; large episodes never use a JS Blob. */
(function(){
  "use strict";
  function bind({button,path,worker,onNotice=()=>{},mediaLabel="Episode"}){
    let busy=false;
    const signedIn=()=>window.MH_USER&&!window.MH_USER.isAnonymous&&typeof window.MH_USER.getIdToken==="function";
    function label(){
      button.disabled=busy;
      button.textContent=busy?"Preparing download…":signedIn()?"⬇ Download "+mediaLabel:"Sign in to download";
    }
    function signIn(){window.mhOpenAuth?.();onNotice("Sign in to download this "+mediaLabel.toLowerCase());}
    async function authReady(){await window.MH_FIREBASE_READY;await window.MH_AUTH_READY;}
    window.addEventListener("mh-auth-changed",label);
    authReady().then(label,label);
    label();
    button.onclick=async()=>{
      if(busy)return;
      busy=true;label();
      try{
        await authReady();
        if(!signedIn()){signIn();return;}
        const user=window.MH_USER;
        const base=new URL(worker);
        let response;
        for(let attempt=0;attempt<2;attempt++){
          const token=await user.getIdToken(attempt>0);
          if(window.MH_USER?.uid!==user.uid){signIn();return;}
          response=await fetch(new URL("/download-ticket",base),{
            method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
            body:JSON.stringify({path}),credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(15000)
          });
          if(response.status!==401||attempt>0)break;
        }
        const result=await response.json().catch(()=>({}));
        if(response.status===401){window.mhOpenAuth?.();throw new Error("Sign in again to download this episode.");}
        if(!response.ok)throw new Error(result.error||"Could not prepare the download. Please try again.");
        if(window.MH_USER?.uid!==user.uid){signIn();return;}
        if(typeof result.url!=="string")throw new Error("Invalid download link. Please try again.");
        const destination=new URL(result.url);
        if(destination.protocol!=="https:"||destination.origin!==base.origin||destination.pathname!==path||
           destination.username||destination.password||destination.hash||!destination.searchParams.get("ticket"))throw new Error("Invalid download link. Please try again.");
        const link=document.createElement("a");
        link.href=destination.href;link.referrerPolicy="origin";link.hidden=true;
        document.body.appendChild(link);link.click();link.remove();
        onNotice("Your download is starting");
      }catch(error){
        onNotice(error?.name==="TimeoutError"?"The download server took too long. Please try again.":error?.message||"Could not download this episode. Please try again.");
      }finally{busy=false;label();}
    };
  }
  window.MH_DOWNLOADS={bind};
})();
