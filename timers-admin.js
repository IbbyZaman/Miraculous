(()=>{
 const $=id=>document.getElementById(id);let rows=[];
 const owner=()=>{const u=window.MH_AUTH?.user();return u?.emailVerified&&!u?.isAnonymous&&u?.email?.toLowerCase()==='ibbyzaman4@gmail.com'};
 function auth(){$('timerAdmin').hidden=!owner()}
 async function load(selected=''){
  const response=await fetch(window.MH_SITE_CONFIG.uploaderWorker+'/catalog',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Could not load saved timers.');const result=await response.json();rows=(result.entries||[]).filter(r=>r.kind==='timer');const selector=$('timerEdit');selector.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='New timer';selector.append(option);
  for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.title+(row.enabled===false?' (hidden)':'');selector.append(option)}selector.value=selected;
 }
 $('timerEdit').onchange=()=>{const row=rows.find(r=>r.id===$('timerEdit').value);$('timerTitle').value=row?.title||'';$('timerId').value=row?.id||'';$('timerId').readOnly=!!row;$('timerDescription').value=row?.description||'';$('timerTarget').value=row?.targetAt?.slice(0,16)||'';$('timerEnabled').checked=row?.enabled!==false;$('timerStatus').textContent=''};
 $('timerTitle').oninput=()=>{if(!$('timerEdit').value)$('timerId').value=$('timerTitle').value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)};
 $('timerForm').onsubmit=async event=>{event.preventDefault();const button=$('timerSave'),status=$('timerStatus');button.disabled=true;status.textContent='Saving…';
  try{const token=await window.mhAdminToken(),value=$('timerTarget').value;const date=new Date(value+(value.length===16?':00Z':'Z'));if(!Number.isFinite(date.getTime()))throw new Error('Choose a valid UTC date and time.');const entry={kind:'timer',id:$('timerId').value.trim(),title:$('timerTitle').value.trim(),description:$('timerDescription').value.trim(),targetAt:date.toISOString(),enabled:$('timerEnabled').checked};
   const response=await fetch(window.MH_SITE_CONFIG.uploaderWorker+'/catalog',{method:'POST',headers:{Authorization:'Bearer '+token,'X-Upload-Password':$('password').value,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify(entry)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save timer.');await load(entry.id);$('timerId').readOnly=true;status.textContent=entry.enabled?'Countdown saved. It will appear on the homepage.':'Countdown saved and hidden from the homepage.';
  }catch(error){status.textContent=error.message}finally{button.disabled=false}
 };
 window.addEventListener('mh-auth-changed',()=>{auth();if(owner())load().catch(error=>$('timerStatus').textContent=error.message)});auth();window.MH_FIREBASE_READY?.then(()=>window.MH_AUTH_READY).then(async()=>{auth();if(owner())try{await load()}catch(error){$('timerStatus').textContent=error.message}});
})();
