/* Read-only compatibility checks for the deployed Cloudflare Workers.
 * No private videos are streamed and no upload/password is attempted. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const SITE='https://miraculoushub.co.uk';
const VIDEO='https://video.miraculoushub.co.uk';
const UPLOAD='https://upload.miraculoushub.co.uk';
async function probe(name,url,opts,check){
  const abort=AbortSignal.timeout(18000);
  const r=await fetch(url,{redirect:'manual',signal:abort,...opts});
  const body=await r.text();
  const details={status:r.status,origin:r.headers.get('access-control-allow-origin'),contentType:r.headers.get('content-type'),preview:body.slice(0,110)};
  console.log(name,JSON.stringify(details));
  assert.ok(check(r,body),name+' unexpected response: '+JSON.stringify(details));
  return {response:r,body};
}
async function main(){
  for(const p of ['android-phone/app/src/main/java/uk/co/miraculoushub/phone/PlayerActivity.java',
                  'android-tv/app/src/main/java/uk/co/miraculoushub/tv/PlayerActivity.java',
                  'android-phone/app/src/main/java/uk/co/miraculoushub/phone/OfflineDownloadsActivity.java']){
    const code=fs.readFileSync(p,'utf8');
    assert.match(code,/Referer","https:\/\/miraculoushub\.co\.uk\//,p+' missing Worker website compatibility header');
    console.log('PASS native app header',p);
  }
  for(const p of ['cloudflare-worker-current.js','cloudflare-uploader-worker.js']){
    const code=fs.readFileSync(p,'utf8');
    assert.match(code,/"https:\/\/miraculoushub\.co\.uk"/,p+' missing canonical first-party origin');
    console.log('PASS worker source origin',p);
  }
  await probe('video from website',VIDEO+'/video/__mh_access_probe__',{method:'OPTIONS',headers:{Origin:SITE,'Access-Control-Request-Method':'GET'}},r=>r.status===204&&r.headers.get('access-control-allow-origin')===SITE);
  await probe('video APK Referer allowed',VIDEO+'/video/__mh_access_probe__',{method:'OPTIONS',headers:{Referer:SITE+'/'}},r=>r.status===204);
  await probe('video foreign Origin denied',VIDEO+'/video/__mh_access_probe__',{method:'OPTIONS',headers:{Origin:'https://example.org'}},r=>r.status===403&&!r.headers.has('access-control-allow-origin'));
  await probe('uploader website allowed',UPLOAD+'/catalog',{method:'OPTIONS',headers:{Origin:SITE,'Access-Control-Request-Method':'GET'}},r=>r.status===204&&r.headers.get('access-control-allow-origin')===SITE);
  const nativeCatalogue=await probe('uploader native catalog allowed',UPLOAD+'/catalog',{method:'GET'},(r,body)=>r.status===200&&(()=>{try{return Array.isArray(JSON.parse(body).entries)}catch{return false}})());
  // HEAD reads only metadata, never downloads video content. This confirms the
  // video Worker can retrieve at least one object published by the uploader.
  const rows=JSON.parse(nativeCatalogue.body).entries;
  const candidate=rows.find(e=>e&&e.available!==false&&e.kind==='episode'&&typeof e.videoPath==='string'&&e.videoPath.startsWith('/video/'));
  assert.ok(candidate,'No uploaded watchable episode in uploader catalogue to verify');
  await probe('native playback HEAD of uploaded '+candidate.code,VIDEO+candidate.videoPath,{method:'HEAD',headers:{Referer:SITE+'/'}},r=>r.status===200&&r.headers.get('accept-ranges')==='bytes');
  await probe('uploader foreign origin rejected',UPLOAD+'/catalog',{method:'GET',headers:{Origin:'https://example.org'}},r=>r.status===403&&!r.headers.has('access-control-allow-origin'));
  await probe('uploader mutation needs password',UPLOAD+'/catalog',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:'{}'},r=>r.status===401);
  // The app update feeds must point to the rebuilt, public first-party APKs.
  for(const type of ['phone','tv']){
    const manifest=await probe(type+' published update manifest',SITE+'/downloads/'+type+'.json',{method:'GET'},(r,body)=>{
      if(r.status!==200)return false;
      try{const v=JSON.parse(body);return Number.isInteger(v.versionCode)&&v.versionCode>0&&
        typeof v.url==='string'&&v.url.startsWith(SITE+'/downloads/')&&v.url.endsWith('.apk')&&
        /^[0-9a-f]{64}$/.test(v.sha256);}catch{return false}
    });
    const entry=JSON.parse(manifest.body);
    await probe(type+' APK download reachable',entry.url,{method:'HEAD'},r=>r.status===200&&
      Number(r.headers.get('content-length'))>1000000);
    console.log('PASS public '+type+' APK version '+entry.versionCode);
  }
  console.log('PASS all first-party website / native app Worker access and APK availability checks.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
