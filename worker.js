const VIDEOS = {
  "/video": {
    id: "13kJTw_ybytXBuMlYmpwG1kGZLqu3Kd5y",
    filename: "S01E01 - Stormy Weather.mp4"
  },
  "/video/bubbler": {
    id: "1mHkQXdh5JowLNUKGHRDgWM1PyOk9xcO9",
    filename: "S01E02 - The Bubbler.mp4"
  }
};

function base64url(data) {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa) {
  const now=Math.floor(Date.now()/1000);
  const enc=x=>base64url(new TextEncoder().encode(JSON.stringify(x)));
  const header=enc({alg:"RS256",typ:"JWT"});
  const claim=enc({iss:sa.client_email,scope:"https://www.googleapis.com/auth/drive.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
  const unsigned=`${header}.${claim}`;
  const key=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(sa.private_key.replace("-----BEGIN PRIVATE KEY-----","").replace("-----END PRIVATE KEY-----","").replace(/\s/g,"")),c=>c.charCodeAt(0)),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const jwt=`${unsigned}.${base64url(sig)}`;
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt})});
  const data=await r.json(); if(!r.ok)throw new Error("Google authentication failed"); return data.access_token;
}

function cors(headers=new Headers()){
  headers.set("Access-Control-Allow-Origin","*");
  headers.set("Access-Control-Allow-Headers","Range, Content-Type");
  headers.set("Access-Control-Allow-Methods","GET, HEAD, OPTIONS");
  headers.set("Access-Control-Expose-Headers","Content-Length, Content-Range, Accept-Ranges, Content-Disposition");
  return headers;
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(request.method==="OPTIONS") return new Response(null,{headers:cors()});

    let item=VIDEOS[url.pathname];
    const isDownload=url.pathname.startsWith("/download/");
    if(isDownload){
      const key=url.pathname.replace("/download/","");
      item=Object.values(VIDEOS).find(x=>key==="bubbler"&&x.id==="1mHkQXdh5JowLNUKGHRDgWM1PyOk9xcO9" || key==="stormy-weather"&&x.id==="13kJTw_ybytXBuMlYmpwG1kGZLqu3Kd5y");
    }

    if(!item) return new Response("Miraculous Video Server",{status:404,headers:cors(new Headers({"Content-Type":"text/plain"}))});

    try{
      const sa=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
      const token=await getAccessToken(sa);
      const h=new Headers({Authorization:`Bearer ${token}`});
      const range=request.headers.get("Range"); if(range)h.set("Range",range);
      const gr=await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`,{method:"GET",headers:h});
      const out=cors(new Headers());
      out.set("Content-Type",gr.headers.get("Content-Type")||"video/mp4");
      out.set("Accept-Ranges","bytes");
      for(const n of ["Content-Length","Content-Range"]){const v=gr.headers.get(n);if(v)out.set(n,v);}
      if(isDownload)out.set("Content-Disposition",`attachment; filename="${item.filename}"`);
      if(request.method==="HEAD")return new Response(null,{status:gr.status,headers:out});
      return new Response(gr.body,{status:gr.status,headers:out});
    }catch(e){
      return new Response("Server error",{status:500,headers:cors(new Headers({"Content-Type":"text/plain"}))});
    }
  }
};
