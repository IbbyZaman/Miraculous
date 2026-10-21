(()=>{
 const $=id=>document.getElementById(id);let rows=[];
 const toLocalInput=iso=>{if(!iso)return '';const d=new Date(iso);return Number.isFinite(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):''};
 const owner=()=>{const u=window.MH_AUTH?.user();return u?.emailVerified&&!u?.isAnonymous&&u?.email?.toLowerCase()==='ibbyzaman4@gmail.com'};
 function auth(){$('timerAdmin').hidden=!owner();window.mhUploaderView?.refresh()}
 async function load(selected=''){
  const response=await fetch(window.MH_SITE_CONFIG.uploaderWorker+'/catalog',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Could not load saved timers.');const result=await response.json();if(result.capabilities?.timers!==true){$('timerStatus').textContent='⚠ The live Cloudflare upload Worker has not confirmed countdown support. If saving asks for a season, deploy the latest cloudflare-uploader-worker.js from GitHub to upload.miraculoushub.co.uk (keep your existing bindings and secrets).';}rows=(result.entries||[]).filter(r=>r.kind==='timer');const selector=$('timerEdit');selector.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='New timer';selector.append(option);
  for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.title+(row.enabled===false?' (hidden)':'');selector.append(option)}selector.value=selected;
 }
 $('timerEdit').onchange=()=>{const row=rows.find(r=>r.id===$('timerEdit').value);$('timerTitle').value=row?.title||'';$('timerId').value=row?.id||'';$('timerId').readOnly=!!row;$('timerDescription').value=row?.description||'';$('timerTarget').value=toLocalInput(row?.targetAt);$('timerEnabled').checked=row?.enabled!==false;$('timerStatus').textContent=''};
 $('timerTitle').oninput=()=>{if(!$('timerEdit').value)$('timerId').value=$('timerTitle').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)};
 $('timerForm').onsubmit=async event=>{
  event.preventDefault();
  const button=$('timerSave'),status=$('timerStatus');
  button.disabled=true;status.textContent='Saving countdown…';
  try{
   if(!owner())throw new Error('Sign in to the verified owner account to save countdowns.');
   if(!$('password').value.trim())throw new Error('Enter your upload password in the Account & upload password section above.');
   const title=$('timerTitle').value.trim(),id=$('timerId').value.trim();
   const value=$('timerTarget').value;
   if(!title)throw new Error('Enter a countdown title.');
   if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))throw new Error('Timer ID must use lowercase letters, numbers and hyphens.');
   if(!value)throw new Error('Choose the countdown date and time.');
   // datetime-local is in the user's timezone; convert to ISO UTC for Worker storage.
   const date=new Date(value);
   if(!Number.isFinite(date.getTime()))throw new Error('Enter a valid date and time.');
   if(date.getTime()<=Date.now())throw new Error('Choose a future date and time. This countdown would already be finished.');
   const token=await window.mhAdminToken();
   const entry={kind:'timer',id,title,description:$('timerDescription').value.trim(),
     targetAt:date.toISOString(),enabled:$('timerEnabled').checked};
   let response;
   try{
    response=await fetch(window.MH_SITE_CONFIG.uploaderWorker+'/catalog',{
     method:'POST',headers:{Authorization:'Bearer '+token,
      'X-Upload-Password':$('password').value,'Content-Type':'application/json'},
     signal:AbortSignal.timeout(30000),body:JSON.stringify(entry)
    });
   }catch(error){throw new Error(error.name==='TimeoutError'?'Save timed out. Please check whether the timer appears in the list before trying again.':'Unable to reach the upload Worker: '+error.message);}
   let result={};try{result=await response.json()}catch{}
   if(!response.ok){
    const msg=result.error||('HTTP '+response.status);
    if(/Choose a season from 1[–-]7 and a title/.test(msg))throw new Error('The live upload Worker is treating this countdown as an episode. Your timer details are fine. Deploy the latest cloudflare-uploader-worker.js from GitHub to the upload.miraculoushub.co.uk Cloudflare Worker, keeping the existing R2 binding and upload password secret.');
    throw new Error('Save failed: '+msg+(response.status===404||response.status===405?' The Cloudflare uploader Worker may need redeploying with countdown support.':''));
   }
   // A save is successful as soon as the Worker confirms it; a follow-up GET is optional.
   status.textContent=entry.enabled?'✓ Countdown saved. It will appear on the homepages.':'✓ Countdown saved as hidden.';
   try{await load(entry.id);$('timerId').readOnly=true}
   catch(error){status.textContent+=' The timer list could not refresh; reload this page to check it.'}
  }catch(error){status.textContent=error.message||'Could not save countdown.'}
  finally{button.disabled=false}
 };
 window.addEventListener('mh-auth-changed',()=>{auth();if(owner())load().catch(error=>$('timerStatus').textContent=error.message)});auth();window.MH_FIREBASE_READY?.then(()=>window.MH_AUTH_READY).then(async()=>{auth();if(owner())try{await load()}catch(error){$('timerStatus').textContent=error.message}});
})();
