/* MiraculousHub R2 uploader Worker
   Bind your R2 bucket as VIDEOS and create a secret named UPLOAD_PASSWORD. */
const ALLOWED_ORIGINS=new Set(["https://miraculoushub.co.uk","https://www.miraculoushub.co.uk"]);
function allowed(request){const o=request.headers.get("Origin"),r=request.headers.get("Referer");if(request.headers.get("Sec-Fetch-Dest")==="iframe")return false;try{if(r&&!ALLOWED_ORIGINS.has(new URL(r).origin))return false;return o?ALLOWED_ORIGINS.has(o):!!r}catch{return false}}
function cors(request){const o=request.headers.get("Origin"),h={"Access-Control-Allow-Methods":"GET, HEAD, POST, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, X-Upload-Password, Authorization, Range","Access-Control-Expose-Headers":"ETag, Content-Length, Content-Range, Accept-Ranges","Cache-Control":"no-store","Vary":"Origin"};if(o&&ALLOWED_ORIGINS.has(o))h["Access-Control-Allow-Origin"]=o;return h}
function json(request,data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors(request),"Content-Type":"application/json; charset=utf-8"}})}
const FIREBASE_PROJECT_ID="miraculoushub0",FIREBASE_WEB_API_KEY="AIzaSyBndazB7-e9QWMkYt2vCA1h_B097k4Wgsg";
function decodeBase64URL(value){
  const raw=atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"="));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function firebaseVerificationError(reason,detail=""){
  const safe=/^[A-Z][A-Z0-9_]{0,79}$/.test(String(reason))?reason:"FIREBASE_VERIFICATION_FAILED";
  console.error("MiraculousHub download verification:",safe,detail);
  return {error:"Sign-in verification unavailable ("+safe+(detail?": "+detail:"")+").",status:503};
}
async function verifyFirebaseUser(request,env){
  const authorization=request.headers.get("Authorization")||"";
  const match=/^Bearer ([A-Za-z0-9_.-]{1,8192})$/i.exec(authorization);
  const unauthenticated={error:"Sign in again to manage content.",status:401};
  if(!match)return unauthenticated;
  const idToken=match[1];
  if(idToken.split(".").length!==3)return unauthenticated;
  const project=env.FIREBASE_PROJECT_ID||FIREBASE_PROJECT_ID;
  const apiKey=env.FIREBASE_WEB_API_KEY||FIREBASE_WEB_API_KEY;
  let account;
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),10000):null;
  try{
    // Google verifies the credential. Decoding a JWT alone is not authentication.
    const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(apiKey),{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken}),
      signal:controller?.signal,redirect:"manual"
    });
    const result=await response.json();
    if(!response.ok){
      const code=String(result?.error?.message||"").split(":")[0].trim();
      if(["INVALID_ID_TOKEN","TOKEN_EXPIRED","USER_DISABLED","USER_NOT_FOUND"].includes(code))return unauthenticated;
      const detail=Array.isArray(result?.error?.details)?result.error.details.find(item=>/^[A-Z][A-Z0-9_]{0,79}$/.test(String(item?.reason))):null;
      return firebaseVerificationError(detail?.reason||(/^[A-Z][A-Z0-9_]{0,79}$/.test(code)?code:"FIREBASE_HTTP_"+response.status));
    }
    account=result?.users?.length===1?result.users[0]:null;
  }catch(error){
    const reason=controller?.signal.aborted||error?.name==="TimeoutError"||error?.name==="AbortError"?"FIREBASE_TIMEOUT":
      error?.name==="SyntaxError"?"FIREBASE_INVALID_RESPONSE":"FIREBASE_NETWORK_ERROR";
    // Report the runtime exception without returning credentials or URLs.
    const name=String(error?.name||"Error").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,40);
    const message=String(error?.message||"")
      .split(idToken).join("[redacted]")
      .split(String(apiKey)).join("[redacted]")
      .replace(/https?:\/\/\S+/g,"[endpoint]")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,"[redacted]")
      .slice(0,180);
    return firebaseVerificationError(reason,reason==="FIREBASE_NETWORK_ERROR"?name+(message?": "+message:""):"");
  }finally{
    if(timer!==null)clearTimeout(timer);
  }
  try{
    const claims=JSON.parse(new TextDecoder().decode(decodeBase64URL(idToken.split(".")[1])));
    const now=Math.floor(Date.now()/1000);
    if(!account?.localId||account.disabled||claims.firebase?.sign_in_provider==="anonymous"||claims.sub!==account.localId||
       claims.aud!==project||claims.iss!=="https://securetoken.google.com/"+project||
       !Number.isFinite(claims.exp)||claims.exp<=now||
       !Number.isFinite(claims.iat)||claims.iat>now+30||
       !Number.isFinite(claims.auth_time)||claims.auth_time>now+30||
       Number(account.validSince||0)>claims.auth_time)return unauthenticated;
    return {uid:account.localId,email:account.email,emailVerified:account.emailVerified===true};
  }catch{return unauthenticated}
}

const ADMIN_EMAIL="ibbyzaman4@gmail.com";
async function adminUser(request,env){
 const user=await verifyFirebaseUser(request,env);
 if(user.error)return user;
 if(!user.emailVerified||String(user.email||"").toLowerCase()!==ADMIN_EMAIL)return {error:"Only the verified owner account can manage content.",status:403};
 return user;
}
function cleanEntry(body){
 if(body?.kind==="timer"){
  const id=String(body.id||""),title=String(body.title||"").trim(),description=String(body.description||"").trim(),targetAt=body.targetAt;
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)||!title||title.length>160||description.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(title+description))throw new Error("Enter a valid timer ID, title and description (up to 1000 characters).");
  if(typeof targetAt!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(targetAt)||!Number.isFinite(Date.parse(targetAt))||new Date(targetAt).toISOString()!==targetAt)throw new Error("Choose a valid timer date and UTC time.");
  return {kind:"timer",id,title,description,targetAt,enabled:body.enabled!==false};
 }

 const season=Number(body?.season),episode=Number(body?.episode),title=String(body?.title||"").trim(),thumbnail=String(body?.thumbnail||"").trim();
 if(!Number.isInteger(season)||season<1||season>7||!title||title.length>160||/[<>\x00-\x1f]/.test(title))throw new Error("Choose a season from 1–7 and a title of 1–160 characters.");
 if(thumbnail){const u=new URL(thumbnail);if(u.protocol!=="https:"||u.username||u.password||thumbnail.length>2000||/[<>"'\x00-\x20]/.test(thumbnail))throw new Error("Thumbnail must be a valid HTTPS image URL.");}
 if(body.kind==="trailer"){
  const id=String(body.id||"");if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))throw new Error("Invalid trailer ID.");
  return {kind:"trailer",id,season,title,thumbnail,key:`trailers/${id}.mp4`};
 }
 if(body.kind!=="episode"||!Number.isInteger(episode)||episode<1||episode>99)throw new Error("Episode must be between 1 and 99.");
 const description=String(body.description||"").trim();if(description.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(description))throw new Error("Description must be at most 1000 characters.");
 const releaseDate=body.releaseDate||null,releaseAt=body.releaseAt||null;
 if(releaseDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)||!Number.isFinite(Date.parse(releaseDate))||new Date(releaseDate).toISOString().slice(0,10)!==releaseDate))throw new Error("Choose a valid release date.");
 if(releaseAt&&(!releaseDate||typeof releaseAt!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(releaseAt)||!Number.isFinite(Date.parse(releaseAt))||new Date(releaseAt).toISOString()!==releaseAt||releaseAt.slice(0,10)!==releaseDate))throw new Error("Choose a valid UTC release time on that date.");
 const releaseRegion=String(body.releaseRegion||"").trim();if(releaseRegion.length>80||/[<>\x00-\x1f]/.test(releaseRegion))throw new Error("Invalid release region.");
 const releaseStatus=releaseDate?(body.releaseStatus==="confirmed"?"confirmed":"reported"):"unknown";
 const code=`S${String(season).padStart(2,"0")}E${String(episode).padStart(2,"0")}`;
 return {kind:"episode",id:code.toLowerCase(),season,episode,title,code,thumbnail,new:body.new!==false,available:body.available!==false,description,releaseDate,releaseAt,releaseRegion,releaseStatus,videoPath:`/video/${code.toLowerCase()}`,key:`season-${season}/${code.toLowerCase()}.mp4`};
}
async function publishEntry(env,entry){
 if(entry.kind!=="timer"&&entry.available!==false&&!await env.VIDEOS.head(entry.key))throw new Error("Upload this video first, then publish its card.");
 const value={...entry,updatedAt:new Date().toISOString()};
 // One object per entry avoids losing unrelated cards when admins save concurrently.
 await env.VIDEOS.put(`catalog/${entry.kind}/${entry.id}.json`,JSON.stringify(value),{httpMetadata:{contentType:"application/json"}});
 return value;
}
async function catalog(request,env){
 const entries=[];let cursor;
 do{const page=await env.VIDEOS.list({prefix:"catalog/",limit:1000,...(cursor?{cursor}:{})});
  for(let i=0;i<page.objects.length;i+=20){const rows=await Promise.all(page.objects.slice(i,i+20).map(async o=>{const obj=await env.VIDEOS.get(o.key);return obj?obj.json():null}));entries.push(...rows.filter(Boolean));}
  cursor=page.truncated?page.cursor:null;
 }while(cursor);
 return json(request,{entries});
}
async function trailer(request,env,url){
 const id=url.searchParams.get("id");if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id||""))return json(request,{error:"Invalid trailer."},400);
 const key=`trailers/${id}.mp4`,meta=await env.VIDEOS.head(key);if(!meta)return json(request,{error:"Trailer not found."},404);
 let range;const raw=request.headers.get("Range");
 if(raw){const m=/^bytes=(\d*)-(\d*)$/.exec(raw);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...cors(request),"Content-Range":`bytes */${meta.size}`}});
  const start=m[1]?Number(m[1]):Math.max(0,meta.size-Number(m[2])),end=m[1]?(m[2]?Math.min(Number(m[2]),meta.size-1):meta.size-1):meta.size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=meta.size)return new Response(null,{status:416,headers:{...cors(request),"Content-Range":`bytes */${meta.size}`}});
  range={offset:start,length:end-start+1};
 }
 const headers={...cors(request),"Content-Type":"video/mp4","Accept-Ranges":"bytes","Content-Length":String(range?.length??meta.size),"Content-Security-Policy":"frame-ancestors 'none'","X-Content-Type-Options":"nosniff"};
 if(range)headers["Content-Range"]=`bytes ${range.offset}-${range.offset+range.length-1}/${meta.size}`;
 const obj=request.method==="HEAD"?null:await env.VIDEOS.get(key,range?{range}:undefined);
 return new Response(request.method==="HEAD"?null:obj?.body,{status:range?206:200,headers});
}

function validKey(key){return !!key&&!key.includes("..")&&(/^trailers\/[a-z0-9][a-z0-9-]{0,79}\.mp4$/.test(key)||/^season-\d{1,2}\/s\d{2}e\d{2,3}\.mp4$/i.test(key)||/^specials\/[a-z0-9-]+\.mp4$/i.test(key)||/^anime\/[a-z0-9-]+\/e\d{2,3}\.mp4$/i.test(key)||/^anime\/attack-on-titan\/(sp0[12]|oad0[1-8])\.mp4$/i.test(key))}
function uploadedRoutes(key){
  let m,videoPath,watchPath;
  if(key.startsWith("trailers/"))return {videoPath:`/trailer?id=${key.slice(9,-4)}`,watchPath:`trailer.html?id=${key.slice(9,-4)}`,watchUrl:`https://miraculoushub.co.uk/trailer.html?id=${key.slice(9,-4)}`};
  if((m=/^anime\/([a-z0-9-]+)\/(e|sp|oad)(\d{2,3})\.mp4$/i.exec(key))){
    videoPath=`/video/anime/${m[1]}/${m[2]}${m[3]}`;
    watchPath=`watch.html?anime=${m[1]}&episode=${Number(m[3])+(m[2]==="sp"?94:m[2]==="oad"?100:0)}`;
  }else if((m=/^season-\d+\/s(\d{2})e(\d{2,3})\.mp4$/i.exec(key))){
    videoPath=`/video/s${m[1]}e${m[2]}`;watchPath=`watch.html?season=${Number(m[1])}&episode=${Number(m[2])}`;
  }else{
    const slug=key.slice('specials/'.length,-4);
    videoPath=`/video/special/${slug}`;
    const number=["new-york","shanghai","awakening","paris","london","tokyo"].indexOf(slug)+1;
    watchPath=number?`watch.html?special=${number}`:null;
  }
  return {videoPath,downloadPath:videoPath.replace('/video/','/download/'),watchPath,
    watchUrl:watchPath?`https://miraculoushub.co.uk/${watchPath}`:null};
}

/* TV pairing: 5-minute one-use pairing, authenticated website approval, and
   a Firebase custom token signed ONLY by a private Cloudflare Worker secret.
   Set FIREBASE_SERVICE_ACCOUNT_JSON in Cloudflare Secrets. Never commit it.
   Use VIDEOS R2 for temporary coordination; configure a 1-day R2 lifecycle
   expiration rule for tv-pair/ objects to delete abandoned requests.
*/
const TV_PAIR_TTL=5*60*1000;
const TV_PAIR_PATH="tv-pair/";
const TV_ORIGIN="https://miraculoushub.co.uk";
function randomHex(bytes){
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)),n=>n.toString(16).padStart(2,"0")).join("");
}
function b64url(bytes){
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function fingerprint(str){
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return b64url(hash);
}
function constantEqual(a,b){
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function parseSmallJSON(request){
  if(Number(request.headers.get("Content-Length")||0)>2048)throw new Error("Request too large");
  const raw=await request.text();
  if(raw.length>2048)throw new Error("Request too large");
  return JSON.parse(raw||"{}");
}
function pairingConfig(env){
  if(!env.VIDEOS||!env.FIREBASE_SERVICE_ACCOUNT_JSON)return null;
  try{
    const data=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if(data.project_id!==FIREBASE_PROJECT_ID||!data.client_email?.endsWith(".gserviceaccount.com")||
      !data.private_key?.includes("-----BEGIN PRIVATE KEY-----"))return null;
    return data;
  }catch{return null}
}
async function firebaseCustomToken(uid,service){
  const now=Math.floor(Date.now()/1000);
  const header=b64url(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const claims=b64url(new TextEncoder().encode(JSON.stringify({
    iss:service.client_email,sub:service.client_email,
    aud:"https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat:now,exp:now+3600,uid
  })));
  const unsigned=header+"."+claims;
  const raw=atob(service.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,""));
  const privateBytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("pkcs8",privateBytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  return unsigned+"."+b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned)));
}
async function pairingRead(env,id){
  const obj=await env.VIDEOS.get(TV_PAIR_PATH+id+".json");
  return obj?{value:await obj.json(),etag:obj.etag}:null;
}
async function pairingWrite(env,id,entry,etag){
  const options={httpMetadata:{contentType:"application/json"}};
  if(etag)options.onlyIf={etagMatches:etag};
  return !!await env.VIDEOS.put(TV_PAIR_PATH+id+".json",JSON.stringify(entry),options);
}
async function tvPairRoute(request,env,url){
  const path=url.pathname,device=path==="/tv-pair/start"||path==="/tv-pair/status";
  const website=path==="/tv-pair/info"||path==="/tv-pair/approve";
  const trustedBrowser=allowed(request)&&ALLOWED_ORIGINS.has(request.headers.get("Origin"));
  if(device&&(request.headers.has("Origin")||request.headers.has("Referer")))
    return json(request,{error:"Native device only"},403);
  if(website&&!trustedBrowser)return json(request,{error:"Use the MiraculousHub website"},403);
  if(!env.VIDEOS)return json(request,{error:"Storage unavailable"},503);
  // Don't initiate pairing when the server has no signing capability.
  const service=pairingConfig(env);
  if(!service)return json(request,{error:"TV pairing is not configured on this Worker yet."},503);
  if(path==="/tv-pair/start"&&request.method==="POST"){
    const id=randomHex(16),deviceSecret=randomHex(32);
    const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
    const expiresAt=Date.now()+TV_PAIR_TTL;
    await pairingWrite(env,id,{secretHash:await fingerprint(deviceSecret),code,expiresAt,state:"pending"});
    return json(request,{pair:id,deviceSecret,code,expiresAt,url:TV_ORIGIN+"/tv-login.html?pair="+id});
  }
  if(path==="/tv-pair/info"&&request.method==="GET"){
    const id=url.searchParams.get("pair")||"";
    if(!/^[0-9a-f]{32}$/.test(id))return json(request,{error:"Invalid pairing link"},400);
    const read=await pairingRead(env,id),session=read?.value;
    if(!session)return json(request,{error:"Pairing no longer available"},404);
    if(Date.now()>=session.expiresAt){
      await env.VIDEOS.delete(TV_PAIR_PATH+id+".json");
      return json(request,{error:"Pairing expired"},410);
    }
    return json(request,{code:session.code,expiresAt:session.expiresAt,status:session.state});
  }
  if(path==="/tv-pair/status"&&request.method==="POST"){
    let data;try{data=await parseSmallJSON(request)}catch{return json(request,{error:"Invalid request"},400)}
    const id=String(data.pair||""),deviceSecret=String(data.deviceSecret||"");
    if(!/^[0-9a-f]{32}$/.test(id)||!/^[0-9a-f]{64}$/.test(deviceSecret))
      return json(request,{error:"Invalid pairing"},400);
    const read=await pairingRead(env,id),session=read?.value;
    if(!session)return json(request,{status:"expired"},410);
    if(Date.now()>=session.expiresAt){await env.VIDEOS.delete(TV_PAIR_PATH+id+".json");return json(request,{status:"expired"},410)}
    if(!constantEqual(await fingerprint(deviceSecret),session.secretHash))
      return json(request,{error:"Not authorized"},403);
    if(session.state==="pending")return json(request,{status:"pending"});
    if(session.state!=="approved"||typeof session.uid!=="string")return json(request,{status:"expired"},410);
    // Atomically redeem once, even if the TV retries from two connections.
    // A second redemption fails the R2 ETag condition and never gets a token.
    const customToken=await firebaseCustomToken(session.uid,service);
    const redeemed=await pairingWrite(env,id,{...session,state:"redeemed",uid:null},read.etag);
    if(!redeemed)return json(request,{status:"expired"},410);
    return json(request,{status:"approved",customToken});
  }
  if(path==="/tv-pair/approve"&&request.method==="POST"){
    let data;try{data=await parseSmallJSON(request)}catch{return json(request,{error:"Invalid request"},400)}
    const id=String(data.pair||""),code=String(data.code||"");
    if(!/^[0-9a-f]{32}$/.test(id)||!/^\d{6}$/.test(code))
      return json(request,{error:"Invalid pairing code"},400);
    const user=await verifyFirebaseUser(request,env);
    if(user.error)return json(request,{error:user.error},user.status);
    const read=await pairingRead(env,id),session=read?.value;
    if(!session)return json(request,{error:"Pairing not found"},404);
    if(session.expiresAt<=Date.now())return json(request,{error:"Pairing expired"},410);
    if(session.state!=="pending"||!constantEqual(session.code,code))
      return json(request,{error:"Pairing was already used or confirmation code does not match"},409);
    const saved=await pairingWrite(env,id,{...session,state:"approved",uid:user.uid},read.etag);
    if(!saved)return json(request,{error:"Pairing was already approved. Try your TV again."},409);
    return json(request,{success:true,message:"TV approved. You can return to your TV."});
  }
  return json(request,{error:"Method not allowed"},405);
}

export default{async fetch(request,env){
  if(request.method==="OPTIONS")return allowed(request)?new Response(null,{status:204,headers:cors(request)}):new Response("Forbidden",{status:403});
  // The catalogue is public information. Native Android requests usually have
  // no Origin/Referer, so allow only this read-only endpoint without them.
  // Uploads and all admin mutations retain the website and password checks.
  const requestUrl=new URL(request.url);
  const nativeCatalogueRead=request.method==="GET"&&requestUrl.pathname==="/catalog"&&
    !request.headers.get("Origin")&&!request.headers.get("Referer");
  // Allow only no-origin native pairing requests; website approval remains
  // restricted to trusted website Origin and a verified Firebase ID token.
  const tvNativeRequest=(requestUrl.pathname==="/tv-pair/start"||requestUrl.pathname==="/tv-pair/status")&&
    request.method==="POST"&&!request.headers.get("Origin")&&!request.headers.get("Referer");
  if(!allowed(request)&&!nativeCatalogueRead&&!tvNativeRequest)return new Response("Forbidden - MiraculousHub only.",{status:403,headers:cors(request)});

  if(!env.VIDEOS)return json(request,{error:"R2 binding VIDEOS is missing."},500);

  const url=new URL(request.url);
  if(url.pathname.startsWith("/tv-pair/"))return tvPairRoute(request,env,url);
  if(url.pathname==="/catalog"&&request.method==="GET"){try{return await catalog(request,env)}catch{return json(request,{error:"Catalog unavailable."},503)}}
  if(url.pathname==="/trailer"&&["GET","HEAD"].includes(request.method))return trailer(request,env,url);
  if(!env.UPLOAD_PASSWORD||request.headers.get("X-Upload-Password")!==env.UPLOAD_PASSWORD)return json(request,{error:"Wrong upload password."},401);
  if(url.pathname==="/catalog"&&request.method==="POST"){
   const user=await adminUser(request,env);if(user.error)return json(request,{error:user.error},user.status);
   let entry;try{entry=cleanEntry(await request.json())}catch(e){return json(request,{error:e.message||"Invalid card."},400)}
   try{return json(request,{success:true,entry:await publishEntry(env,entry)})}catch(e){return json(request,{error:e.message},409)}
  }
  if(url.pathname!=="/upload")return json(request,{error:"Not found."},404);
  const action=url.searchParams.get("action"),key=url.searchParams.get("key");if(!validKey(key))return json(request,{error:"Invalid R2 object key."},400);
  if(key.startsWith("trailers/")){const user=await adminUser(request,env);if(user.error)return json(request,{error:user.error},user.status)}
  try{
    if(request.method==="POST"&&action==="create"){
      const upload=await env.VIDEOS.createMultipartUpload(key,{httpMetadata:{contentType:"video/mp4"}});
      return json(request,{success:true,key:upload.key,uploadId:upload.uploadId});
    }
    if(request.method==="PUT"&&action==="part"){
      const uploadId=url.searchParams.get("uploadId"),partNumber=Number(url.searchParams.get("partNumber"));
      if(!uploadId||!Number.isInteger(partNumber)||partNumber<1||!request.body)return json(request,{error:"Invalid upload part."},400);
      const upload=env.VIDEOS.resumeMultipartUpload(key,uploadId),part=await upload.uploadPart(partNumber,request.body);
      return json(request,{success:true,partNumber:part.partNumber,etag:part.etag});
    }
    if(request.method==="POST"&&action==="complete"){
      const uploadId=url.searchParams.get("uploadId");if(!uploadId)return json(request,{error:"Missing uploadId."},400);
      let body;try{body=await request.json()}catch{return json(request,{error:"Invalid completion data."},400)}
      if(!Array.isArray(body?.parts)||!body.parts.length)return json(request,{error:"No uploaded parts supplied."},400);
      let entry;if(!key.startsWith("trailers/")&&body.entry){const user=await adminUser(request,env);if(user.error)return json(request,{error:user.error},user.status);try{entry=cleanEntry({...body.entry,kind:"episode",available:true});if(entry.key!==key)throw new Error("Episode destination does not match.")}catch(e){return json(request,{error:e.message},400)}}
      if(key.startsWith("trailers/")){try{entry=cleanEntry({...body.entry,kind:"trailer"});if(entry.key!==key)throw new Error("Trailer destination does not match.")}catch(e){return json(request,{error:e.message},400)}}
      const parts=[...body.parts].sort((a,b)=>a.partNumber-b.partNumber),upload=env.VIDEOS.resumeMultipartUpload(key,uploadId),obj=await upload.complete(parts);
      const routes=uploadedRoutes(obj.key);
      if(entry)await publishEntry(env,entry);
      else if(/^season-/.test(key)){const id=key.split('/')[1].slice(0,-4);const saved=await env.VIDEOS.get(`catalog/episode/${id}.json`);if(saved){const previous=await saved.json();await publishEntry(env,{...previous,available:true});}}
      let subtitlesQueued=false,subtitleWorkflowId=null,subtitleError=null;
      // AUTO_SUBS is an optional cross-script Cloudflare Workflow binding.
      // Uploads still succeed if auto captions are not configured yet.
      if(env.AUTO_SUBS&&entry?.kind!=="trailer"){
        try{
          const instance=await env.AUTO_SUBS.create({params:{key:obj.key,videoPath:routes.videoPath,language:"en"}});
          subtitlesQueued=true;subtitleWorkflowId=instance.id;
        }catch(e){console.error("Auto subtitle workflow could not start",e);subtitleError=e instanceof Error?e.message:String(e)}
      }
      return json(request,{success:true,message:"Upload complete!",key:obj.key,etag:obj.httpEtag,...routes,subtitlesQueued,subtitleWorkflowId,subtitleError});
    }
    if(request.method==="POST"&&action==="abort"){
      const uploadId=url.searchParams.get("uploadId");if(!uploadId)return json(request,{error:"Missing uploadId."},400);
      await env.VIDEOS.resumeMultipartUpload(key,uploadId).abort();return json(request,{success:true,message:"Upload cancelled."});
    }
    return json(request,{error:"Unknown upload action."},400);
  }catch(e){console.error(e);return json(request,{error:e instanceof Error?e.message:String(e)},500)}
}};
