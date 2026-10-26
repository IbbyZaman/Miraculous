// Non-sensitive regression checks of the deployed Cloudflare custom domains.
// Referrer/Origin checks are browser hygiene, not strong APK authentication.
const VIDEO='https://video.miraculoushub.co.uk';
const UPLOADER='https://upload.miraculoushub.co.uk';
let failed=0;
async function verify(label,url,{method='OPTIONS',headers={}}={},predicate){
  try{
    const response=await fetch(url,{method,headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
    const status=response.status,allow=response.headers.get('access-control-allow-origin')||'';
    const good=predicate(status,allow,response);
    console.log((good?'PASS':'FAIL')+' '+label+' status='+status+' allowOrigin='+allow);
    if(!good)failed++;
  }catch(error){failed++;console.error('FAIL '+label+': '+error.message)}
}
(async()=>{
  const apex='https://miraculoushub.co.uk';
  const other='https://not-miraculoushub.example';
  await verify('Video browser website accepted',VIDEO+'/video/s06e26',{headers:{Origin:apex,'Access-Control-Request-Method':'GET'}},(s,a)=>s===204&&a===apex);
  await verify('Video other browser origin rejected',VIDEO+'/video/s06e26',{headers:{Origin:other,'Access-Control-Request-Method':'GET'}},(s)=>s===403);
  await verify('Video native referrer allowed',VIDEO+'/video/s99e99',{method:'HEAD',headers:{Referer:apex+'/'}},(s)=>s!==403&&s!==302);
  await verify('Video unidentified client rejected',VIDEO+'/video/s99e99',{method:'HEAD'},(s)=>s===403);
  await verify('Uploader browser website accepted',UPLOADER+'/catalog',{headers:{Origin:apex,'Access-Control-Request-Method':'GET'}},(s,a)=>s===204&&a===apex);
  await verify('Uploader other browser origin rejected',UPLOADER+'/catalog',{headers:{Origin:other,'Access-Control-Request-Method':'GET'}},(s)=>s===403);
  await verify('Native app read-only catalogue works',UPLOADER+'/catalog',{method:'GET'},(s)=>s===200);
  if(failed)process.exitCode=1;
  console.log(failed+' failed Worker API access checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
