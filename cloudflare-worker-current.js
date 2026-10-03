/* =========================================================
   MIRACULOUSHUB UNIVERSAL VIDEO WORKER

   R2 binding: R2_VIDEOS

   Episode objects:
     season-1/s01e01.mp4
     season-2/s02e01.mp4
     ...
     season-7/s07e01.mp4

   Anime objects:
     anime/death-note/e01.mp4
     ...
     anime/death-note/e37.mp4

   Special objects:
     specials/new-york.mp4
     specials/shanghai.mp4
     specials/awakening.mp4
     specials/paris.mp4
     specials/london.mp4
     specials/tokyo.mp4

   Website routes are automatic:
     /video/s01e01
     /download/s01e01
     /video/anime/death-note/e01
     /download/anime/death-note/e01
     /video/special/london
     /download/special/london

   Upload the matching R2 object and it works immediately.
   ========================================================= */

const ALLOWED_ORIGINS = new Set([
  "https://miraculoushub.co.uk",
  "https://www.miraculoushub.co.uk"
]);

/* Existing Drive files remain temporary fallbacks while you migrate. */
const DRIVE_FALLBACKS = {
  "season-1/s01e01.mp4": { id:"13kJTw_ybytXBuMlYmpwG1kGZLqu3Kd5y", filename:"S01E01 - Stormy Weather.mp4" },
  "season-1/s01e02.mp4": { id:"1mHkQXdh5JowLNUKGHRDgWM1PyOk9xcO9", filename:"S01E02 - The Bubbler.mp4" },
  "season-1/s01e03.mp4": { id:"1hq5gCYHleseBv_Qm3_8rRXCPluBIPy7C", filename:"S01E03 - The Pharaoh.mp4" },
  "season-5/s05e25.mp4": { id:"1FOfhegcW_m9GpB3sBO0HNIFEfPHAtR9O", filename:"S05E25 - Conformation - The Final Day Part 1.mp4" },
  "season-5/s05e26.mp4": { id:"1kEKfCh8p30ISC0wZO-TWz2pg9pBFvJuG", filename:"S05E26 - Re-Creation - The Final Day Part 2.mp4" },
  "season-6/s06e01.mp4": { id:"12dc8sux10BeH9vTOH3-9bVd3EKNCcG2t", filename:"S06E01 - Climatiqueen.mp4" },
  "season-6/s06e02.mp4": { id:"1vEVnExLivd6cAD3tfJdJj-VCL4w47yMH", filename:"S06E02 - The Illustrhater.mp4" },
  "season-6/s06e03.mp4": { id:"1VDVC5IsmojvZDSaKQP9itTiRqxlqxdj4", filename:"S06E03 - Sublimation.mp4" },
  "season-6/s06e04.mp4": { id:"157UEOuZLwTsKAlDt0norIxZftRUVFK_o", filename:"S06E04 - Daddycop.mp4" },
  "season-6/s06e05.mp4": { id:"1GtMepuzvZQ2TDb1SY8PSp3Xkmxj6XGrY", filename:"S06E05 - Werepapas.mp4" },
  "season-6/s06e06.mp4": { id:"1PSpm5hQvFlWRWT4d2VBiPeVE7oBpX-gP", filename:"S06E06 - Sleeping Syren.mp4" },
  "season-6/s06e07.mp4": { id:"1x_VVVkbgX8TnmSySQ-eW-kSA8L0J073O", filename:"S06E07 - El Toro De Piedra.mp4" },
  "season-6/s06e08.mp4": { id:"1VqYbm7EyoZuUR6JZ2DSWgNwVE65TUpPQ", filename:"S06E08 - Vampigami.mp4" },
  "season-6/s06e09.mp4": { id:"1iZb0XUeLb-XTuug7EhFielPN-7Lt-amB", filename:"S06E09 - Mr. Agreste.mp4" },
  "season-6/s06e10.mp4": { id:"1oOKRgPhzYkOZtaonTwuLKF408Sa5wISF", filename:"S06E10 - The Dark Castle.mp4" },
  "season-6/s06e11.mp4": { id:"1S08J2AAKVRXhybl3XrVCAHp9TPK-Rf-T", filename:"S06E11 - Revelator.mp4" },
  "season-6/s06e12.mp4": { id:"1Po_pBR67X03LadYW-rXouR4Czpm5vBuj", filename:"S06E12 - Wreckless Driver.mp4" },
  "season-6/s06e13.mp4": { id:"1yuhp5cvnw6QU_W2icE_flP2ZWk5fP2ct", filename:"S06E13 - Yaksi Gozen.mp4" },
  "season-6/s06e14.mp4": { id:"1-OMInDJ4oxWy1IG12HkNrFtpkuV1_qBY", filename:"S06E14 - Grandiaper.mp4" },
  "season-6/s06e15.mp4": { id:"1Zd_b39K0SY_is4GREX39kJED8IBT7Jvc", filename:"S06E15 - The Ruler.mp4" },
  "season-6/s06e16.mp4": { id:"1p551qmCjlGoRIGaDKcphVkgufvp89PyP", filename:"S06E16 - Noe.mp4" },
  "season-6/s06e17.mp4": { id:"175bpDpw9GnlFkRAo_XFd9cnZDrY4mgId", filename:"S06E17 - A Fairy Good Night.mp4" },
  "season-6/s06e18.mp4": { id:"1gCMeje3wvoU90Ayr9s69q_L_Hfs9eroQ", filename:"S06E18 - The Dirtifiers.mp4" },
  "season-6/s06e19.mp4": { id:"13pDjpoVOdAxBuZubYHfrlqKBNZFj_-tL", filename:"S06E19 - Riginarazione.mp4" },
  "season-6/s06e20.mp4": { id:"1QUGQ4fddnAaKmXMxMhEQ1EjAvq6BcAiZ", filename:"S06E20 - Heartfixer.mp4" },
  "season-6/s06e21.mp4": { id:"1Pw_0C89gSOKSf0IgAy5Dr8aHEqi9PVxx", filename:"S06E21 - The Chained Titans.mp4" },
  "season-6/s06e22.mp4": { id:"1lpYet9bFybrO1dF87RnP7el3SeuDLVw-", filename:"S06E22 - Lady Chaos.mp4" },
  "season-6/s06e23.mp4": { id:"1VqrXeRiqS-QzYH7pkW0icRZLDgy8bvhk", filename:"S06E23 - Sadnansi.mp4" },
  "season-6/s06e24.mp4": { id:"16kddGMxsSDEwT6-4_949oxl5A-cjNhwZ", filename:"S06E24 - Queen of the Dreadzone.mp4" },
  "season-6/s06e25.mp4": { id:"1WNfkFBPZZuS4n2NpspIRQuhbBSAOQc9m", filename:"S06E25 - Secret Protocol.mp4" },
  "season-6/s06e26.mp4": { id:"1Cxtaq0hHq7wnrl9SZMSgFyCSNTYCtx2r", filename:"S06E26 - Nemesis.mp4" },
  "specials/london.mp4": { id:"1qRdyE5j3EHh2Z4s92CYCYIzPgXJbImCk", filename:"Miraculous World - London - At the Edge of Time.mp4" },
  "specials/paris.mp4": { id:"1UpkgVrt5DWLgY07clSylRNAXJwVo9KNS", filename:"Miraculous World - Paris - Tales of Shadybug and Claw Noir.mp4" }
};

const LEGACY_PATHS = {
  "/video":"season-1/s01e01.mp4",
  "/video/bubbler":"season-1/s01e02.mp4",
  "/video/pharaoh":"season-1/s01e03.mp4",
  "/video/conformation":"season-5/s05e25.mp4",
  "/video/recreation":"season-5/s05e26.mp4",
  "/video/climatiqueen":"season-6/s06e01.mp4",
  "/video/the-illustrhater":"season-6/s06e02.mp4",
  "/video/sublimation":"season-6/s06e03.mp4",
  "/video/daddycop":"season-6/s06e04.mp4",
  "/video/werepapas":"season-6/s06e05.mp4",
  "/video/sleeping-syren":"season-6/s06e06.mp4",
  "/video/el-toro-de-piedra":"season-6/s06e07.mp4",
  "/video/vampigami":"season-6/s06e08.mp4",
  "/video/mr-agreste":"season-6/s06e09.mp4",
  "/video/the-dark-castle":"season-6/s06e10.mp4",
  "/video/revelator":"season-6/s06e11.mp4",
  "/video/wreckless-driver":"season-6/s06e12.mp4",
  "/video/yaksi-gozen":"season-6/s06e13.mp4",
  "/video/grandiaper":"season-6/s06e14.mp4",
  "/video/the-ruler":"season-6/s06e15.mp4",
  "/video/noe":"season-6/s06e16.mp4",
  "/video/a-fairy-good-night":"season-6/s06e17.mp4",
  "/video/the-dirtifiers":"season-6/s06e18.mp4",
  "/video/riginarazione":"season-6/s06e19.mp4",
  "/video/heartfixer":"season-6/s06e20.mp4",
  "/video/the-chained-titans":"season-6/s06e21.mp4",
  "/video/lady-chaos":"season-6/s06e22.mp4",
  "/video/sadnansi":"season-6/s06e23.mp4",
  "/video/queen-of-the-dreadzone":"season-6/s06e24.mp4",
  "/video/secret-protocol":"season-6/s06e25.mp4",
  "/video/nemesis":"season-6/s06e26.mp4",
  "/video/london":"specials/london.mp4",
  "/video/paris":"specials/paris.mp4"
};

function getRequestOrigin(request) {
  const origin=request.headers.get("Origin");
  if(origin) return origin;
  const referer=request.headers.get("Referer");
  if(!referer) return null;
  try { return new URL(referer).origin; } catch { return null; }
}
function isAllowedOrigin(request) {
  const origin=getRequestOrigin(request);
  return !!origin && ALLOWED_ORIGINS.has(origin);
}
function corsHeaders(request) {
  const origin=request.headers.get("Origin");
  const h={
    "Access-Control-Allow-Headers":"Range, Content-Type, Accept",
    "Access-Control-Allow-Methods":"GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers":"Content-Length, Content-Range, Accept-Ranges, Content-Disposition, ETag",
    "Vary":"Origin"
  };
  if(origin && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"]=origin;
  return h;
}
function textResponse(request,text,status=200){
  return new Response(text,{status,headers:{...corsHeaders(request),"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
}

function parseMediaPath(pathname){
  let m=pathname.match(/^\/(video|download)\/s(\d{2})e(\d{2})\/?$/i);
  if(m){
    const season=Number(m[2]), episode=Number(m[3]);
    if(season<1||season>99||episode<1||episode>99) return null;
    const ss=String(season).padStart(2,"0"), ee=String(episode).padStart(2,"0");
    return {key:`season-${season}/s${ss}e${ee}.mp4`,filename:`S${ss}E${ee}.mp4`,download:m[1].toLowerCase()==="download"};
  }
  m=pathname.match(/^\/(video|download)\/anime\/([a-z0-9-]+)\/e(\d{2})\/?$/i);
  if(m){
    const slug=m[2].toLowerCase(), episode=Number(m[3]);
    if(episode<1||episode>99) return null;
    const ee=String(episode).padStart(2,"0");
    return {key:`anime/${slug}/e${ee}.mp4`,filename:`${slug}-e${ee}.mp4`,download:m[1].toLowerCase()==="download"};
  }
  m=pathname.match(/^\/(video|download)\/special\/([a-z0-9-]+)\/?$/i);
  if(m){
    const slug=m[2].toLowerCase();
    return {key:`specials/${slug}.mp4`,filename:`Miraculous-${slug}.mp4`,download:m[1].toLowerCase()==="download"};
  }
  let legacy=LEGACY_PATHS[pathname];
  let download=false;
  if(!legacy && pathname.startsWith("/download/")){
    const videoPath="/video/"+pathname.slice("/download/".length);
    legacy=LEGACY_PATHS[videoPath]; download=!!legacy;
  }
  if(legacy){
    const fallback=DRIVE_FALLBACKS[legacy];
    return {key:legacy,filename:fallback?.filename||legacy.split("/").pop(),download};
  }
  return null;
}

function parseRange(header,size){
  if(!header) return null;
  const m=/^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if(!m) return {invalid:true};
  const a=m[1], b=m[2];
  if(a==="" && b!==""){
    const suffix=Number(b); if(!Number.isFinite(suffix)||suffix<=0) return {invalid:true};
    const length=Math.min(suffix,size); return {offset:size-length,length};
  }
  const start=Number(a); if(!Number.isFinite(start)||start<0||start>=size) return {invalid:true};
  let end=b===""?size-1:Number(b);
  if(!Number.isFinite(end)||end<start) return {invalid:true};
  end=Math.min(end,size-1); return {offset:start,length:end-start+1};
}

async function streamR2(request,env,file){
  if(!env.R2_VIDEOS) throw new Error("R2_VIDEOS binding is missing");
  const meta=await env.R2_VIDEOS.head(file.key);
  if(!meta) return null;
  const h=new Headers(corsHeaders(request));
  meta.writeHttpMetadata(h);
  h.set("Content-Type",meta.httpMetadata?.contentType||"video/mp4");
  h.set("Accept-Ranges","bytes");
  h.set("ETag",meta.httpEtag);
  h.set("Cache-Control","public, max-age=3600");
  if(file.download) h.set("Content-Disposition",`attachment; filename="${file.filename}"`);
  if(request.method==="HEAD"){
    h.set("Content-Length",String(meta.size));
    return new Response(null,{status:200,headers:h});
  }
  const rangeHeader=request.headers.get("Range");
  if(rangeHeader){
    const range=parseRange(rangeHeader,meta.size);
    if(!range||range.invalid){ h.set("Content-Range",`bytes */${meta.size}`); return new Response(null,{status:416,headers:h}); }
    const obj=await env.R2_VIDEOS.get(file.key,{range:{offset:range.offset,length:range.length}});
    if(!obj||!("body" in obj)) return null;
    const start=range.offset,end=start+range.length-1;
    h.set("Content-Range",`bytes ${start}-${end}/${meta.size}`);
    h.set("Content-Length",String(range.length));
    return new Response(obj.body,{status:206,headers:h});
  }
  const obj=await env.R2_VIDEOS.get(file.key);
  if(!obj||!("body" in obj)) return null;
  h.set("Content-Length",String(obj.size));
  return new Response(obj.body,{status:200,headers:h});
}

function base64url(data){
  return btoa(String.fromCharCode(...new Uint8Array(data))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function getAccessToken(sa){
  const now=Math.floor(Date.now()/1000);
  const header=base64url(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const claim=base64url(new TextEncoder().encode(JSON.stringify({iss:sa.client_email,scope:"https://www.googleapis.com/auth/drive.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
  const unsigned=`${header}.${claim}`;
  const keyBytes=Uint8Array.from(atob(sa.private_key.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"")),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("pkcs8",keyBytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const jwt=`${unsigned}.${base64url(sig)}`;
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt})});
  const d=await r.json(); if(!r.ok) throw new Error("Google authentication failed"); return d.access_token;
}
async function streamDrive(request,env,file){
  const fallback=DRIVE_FALLBACKS[file.key];
  if(!fallback||!env.GOOGLE_SERVICE_ACCOUNT) return null;
  let sa; try{sa=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);}catch{return null;}
  const token=await getAccessToken(sa);
  const gh=new Headers({Authorization:`Bearer ${token}`});
  const range=request.headers.get("Range"); if(range) gh.set("Range",range);
  const r=await fetch(`https://www.googleapis.com/drive/v3/files/${fallback.id}?alt=media`,{method:"GET",headers:gh});
  if(!r.ok) return null;
  const h=new Headers(corsHeaders(request));
  h.set("Content-Type",r.headers.get("Content-Type")||"video/mp4"); h.set("Accept-Ranges","bytes");
  for(const n of ["Content-Length","Content-Range","ETag"]){const v=r.headers.get(n);if(v)h.set(n,v);}
  if(file.download) h.set("Content-Disposition",`attachment; filename="${fallback.filename}"`);
  return new Response(request.method==="HEAD"?null:r.body,{status:r.status,headers:h});
}

async function serve(request,env,file){
  try{const r2=await streamR2(request,env,file);if(r2)return r2;}catch(e){console.error("R2 error",e);}
  try{const drive=await streamDrive(request,env,file);if(drive)return drive;}catch(e){console.error("Drive fallback error",e);}
  return textResponse(request,"This episode or special has not been uploaded to R2 yet.",404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!isAllowedOrigin(request)) return textResponse(request,"Forbidden - MiraculousHub only.",403);
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(request)});
    if(request.method!=="GET"&&request.method!=="HEAD") return textResponse(request,"Method Not Allowed",405);
    const file=parseMediaPath(url.pathname);
    if(file) return serve(request,env,file);
    if(url.pathname==="/") return textResponse(request,"MiraculousHub universal R2 video server is online.\nEpisodes: /video/s01e01\nSpecials: /video/special/london\n");
    return textResponse(request,"Not Found",404);
  }
};
