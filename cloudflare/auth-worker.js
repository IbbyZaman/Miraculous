const ALLOWED_ORIGINS = new Set([
  "https://miraculoushub.co.uk",
  "https://www.miraculoushub.co.uk"
]);

const COOKIE_NAME = "mh_session";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGINS.has(origin);
    const corsHeaders = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };
    if (allowedOrigin) corsHeaders["Access-Control-Allow-Origin"] = origin;

    const respond = (data, status = 200, extra = {}) => {
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      for (const [key, value] of Object.entries(extra)) headers.set(key, value);
      return new Response(JSON.stringify(data), { status, headers });
    };

    if (url.pathname === "/health" && request.method === "GET") {
      return respond({ status: "ok" });
    }
    if (!allowedOrigin) return respond({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    try {
      if (url.pathname === "/register" && request.method === "POST") {
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return respond({ error: "Enter a valid email address.", code: "invalid-email" }, 400);
        }
        if (password.length < 8 || password.length > 128) {
          return respond({ error: "Password must be between 8 and 128 characters.", code: "weak-password" }, 400);
        }
        const id = crypto.randomUUID();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passwordHash = await hashPassword(password, salt);
        try {
          await env.DB.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)")
            .bind(id, email, toBase64(salt) + ":" + passwordHash, Date.now()).run();
        } catch {
          return respond({ error: "An account with that email may already exist.", code: "email-already-in-use" }, 409);
        }
        return await createSession(id, email, env, respond);
      }

      if (url.pathname === "/login" && request.method === "POST") {
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!email || email.length > 254 || password.length > 128) {
          return respond({ error: "Email or password is incorrect.", code: "invalid-credential" }, 401);
        }
        const user = await env.DB.prepare("SELECT id,email,password_hash FROM users WHERE email=?").bind(email).first();
        if (!user || !(await verifyPassword(password, user.password_hash))) {
          return respond({ error: "Email or password is incorrect.", code: "invalid-credential" }, 401);
        }
        await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND expires_at<=?").bind(user.id, Date.now()).run();
        return await createSession(user.id, user.email, env, respond);
      }

      if (url.pathname === "/v1/comments" && request.method === "GET") {
        const episodeKey = String(url.searchParams.get("episodeKey") || "");
        if (!validKey(episodeKey)) return respond({ error: "Invalid episode key" }, 400);
        const rows = await env.DB.prepare("SELECT id,user_id,nickname,content,created_at FROM comments WHERE episode_key=? ORDER BY created_at ASC LIMIT 100").bind(episodeKey).all();
        return respond({ items: rows.results.map(row => ({ id: row.id, authorUid: row.user_id, authorNickname: row.nickname, text: row.content, createdAt: row.created_at })) });
      }

      if (url.pathname === "/me" && request.method === "GET") {
        const user = await getSessionUser(request, env);
        return respond({ user: user ? { id: user.id, uid: user.id, email: user.email } : null });
      }

      if (url.pathname === "/logout" && request.method === "POST") {
        const token = getCookie(request, COOKIE_NAME);
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
        return respond({ success: true }, 200, { "Set-Cookie": expiredCookie() });
      }

      const user = await getSessionUser(request, env);
      if (!user) return respond({ error: "Sign in required", code: "unauthenticated" }, 401);

      if (url.pathname === "/v1/playback" && request.method === "GET") {
        const rows = await env.DB.prepare("SELECT item_key,data,updated_at FROM playback WHERE user_id=? ORDER BY updated_at DESC LIMIT 300").bind(user.id).all();
        return respond({ items: rows.results.map(row => ({ id: row.item_key, ...parseJson(row.data), updatedAt: row.updated_at })) });
      }
      if (url.pathname.startsWith("/v1/playback/")) {
        const key = decodeURIComponent(url.pathname.slice("/v1/playback/".length));
        if (!validKey(key)) return respond({ error: "Invalid item key" }, 400);
        if (request.method === "GET") {
          const row = await env.DB.prepare("SELECT data,updated_at FROM playback WHERE user_id=? AND item_key=?").bind(user.id,key).first();
          return respond({ item: row ? { id:key, ...parseJson(row.data), updatedAt:row.updated_at } : null });
        }
        if (request.method === "PUT") {
          const data = await request.json();
          const now = Date.now();
          await env.DB.prepare("INSERT INTO playback(user_id,item_key,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,item_key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at")
            .bind(user.id,key,JSON.stringify(cleanObject(data, ["pendingCloud"])),now).run();
          return respond({ success:true, updatedAt:now });
        }
      }

      if (url.pathname === "/v1/favourites" && request.method === "GET") {
        const rows = await env.DB.prepare("SELECT item_key,data,added_at FROM favourites WHERE user_id=? ORDER BY added_at DESC").bind(user.id).all();
        return respond({ items:rows.results.map(row=>({id:row.item_key,...parseJson(row.data),addedAt:row.added_at})) });
      }
      if (url.pathname.startsWith("/v1/favourites/")) {
        const key=decodeURIComponent(url.pathname.slice("/v1/favourites/".length));
        if (!validKey(key)) return respond({error:"Invalid item key"},400);
        if (request.method==="GET") {
          const row=await env.DB.prepare("SELECT item_key FROM favourites WHERE user_id=? AND item_key=?").bind(user.id,key).first();
          return respond({favourite:!!row});
        }
        if (request.method==="PUT") {
          const data=await request.json();
          const exists=await env.DB.prepare("SELECT item_key FROM favourites WHERE user_id=? AND item_key=?").bind(user.id,key).first();
          if(exists){await env.DB.prepare("DELETE FROM favourites WHERE user_id=? AND item_key=?").bind(user.id,key).run();return respond({favourite:false});}
          await env.DB.prepare("INSERT INTO favourites(user_id,item_key,data,added_at) VALUES(?,?,?,?)").bind(user.id,key,JSON.stringify(data),Date.now()).run();
          return respond({favourite:true});
        }
        if (request.method==="DELETE") {
          await env.DB.prepare("DELETE FROM favourites WHERE user_id=? AND item_key=?").bind(user.id,key).run();
          return respond({success:true});
        }
      }

      if (url.pathname === "/v1/watched" && request.method === "GET") {
        const rows=await env.DB.prepare("SELECT item_key,data,watched_at FROM watched WHERE user_id=? ORDER BY watched_at DESC").bind(user.id).all();
        return respond({items:rows.results.map(row=>({id:row.item_key,...parseJson(row.data),watchedAt:row.watched_at}))});
      }
      if (url.pathname.startsWith("/v1/watched/")) {
        const key=decodeURIComponent(url.pathname.slice("/v1/watched/".length));
        if(!validKey(key)) return respond({error:"Invalid item key"},400);
        if(request.method==="GET"){
          const row=await env.DB.prepare("SELECT item_key FROM watched WHERE user_id=? AND item_key=?").bind(user.id,key).first();
          return respond({watched:!!row});
        }
        if(request.method==="PUT"){
          const data=await request.json();
          await env.DB.prepare("INSERT INTO watched(user_id,item_key,data,watched_at) VALUES(?,?,?,?) ON CONFLICT(user_id,item_key) DO UPDATE SET data=excluded.data,watched_at=excluded.watched_at")
            .bind(user.id,key,JSON.stringify({...data,watched:true}),Date.now()).run();
          return respond({success:true});
        }
      }

      if(url.pathname==="/v1/profile" && request.method==="GET"){
        const row=await env.DB.prepare("SELECT nickname FROM profiles WHERE user_id=?").bind(user.id).first();
        return respond({nickname:row?.nickname||null});
      }
      if(url.pathname==="/v1/profile" && request.method==="PUT"){
        const body=await request.json();
        const nickname=String(body.nickname||"").trim().replace(/\s+/g," ");
        if(nickname.length<2||nickname.length>24||nickname.includes("@")||! /^[\p{L}\p{N} _.'-]+$/u.test(nickname))
          return respond({error:"Nickname must be 2–24 characters and cannot contain an email address.",code:"invalid-nickname"},400);
        await env.DB.prepare("INSERT INTO profiles(user_id,nickname,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,updated_at=excluded.updated_at")
          .bind(user.id,nickname,Date.now()).run();
        return respond({nickname});
      }

      if(url.pathname==="/v1/comments" && request.method==="POST"){
        const body=await request.json();
        const episodeKey=String(body.episodeKey||"");
        const content=String(body.text||"").trim();
        if(!validKey(episodeKey)||!content||content.length>500) return respond({error:"Comment must be 1–500 characters.",code:"invalid-comment"},400);
        const profile=await env.DB.prepare("SELECT nickname FROM profiles WHERE user_id=?").bind(user.id).first();
        if(!profile?.nickname) return respond({error:"Set a nickname before commenting",code:"nickname-required"},400);
        const id=crypto.randomUUID(),now=Date.now();
        await env.DB.prepare("INSERT INTO comments(id,user_id,episode_key,nickname,content,created_at) VALUES(?,?,?,?,?,?)")
          .bind(id,user.id,episodeKey,profile.nickname,content,now).run();
        return respond({id,success:true,authorUid:user.id,authorNickname:profile.nickname,text:content,createdAt:now});
      }
      if(url.pathname.startsWith("/v1/comments/") && request.method==="DELETE"){
        const id=decodeURIComponent(url.pathname.slice("/v1/comments/".length));
        const result=await env.DB.prepare("DELETE FROM comments WHERE id=? AND user_id=?").bind(id,user.id).run();
        return respond({success:true,deleted:(result.meta?.changes||0)>0});
      }

      if(url.pathname==="/v1/reports" && request.method==="POST"){
        const body=await request.json();
        const clean={
          episodeKey:String(body.episodeKey||"").slice(0,80),
          episodeTitle:String(body.episodeTitle||"").slice(0,120),
          targetType:String(body.targetType||"episode").slice(0,20),
          targetId:String(body.targetId||"").slice(0,160),
          reason:String(body.reason||"Other").slice(0,80),
          details:String(body.details||"").trim().slice(0,500)
        };
        if(!validKey(clean.episodeKey)||!clean.reason) return respond({error:"Invalid report"},400);
        const id=crypto.randomUUID();
        await env.DB.prepare("INSERT INTO reports(id,user_id,data,created_at) VALUES(?,?,?,?)").bind(id,user.id,JSON.stringify(clean),Date.now()).run();
        return respond({success:true,id});
      }

      return respond({error:"Not found"},404);
    } catch(error) {
      console.error("MiraculousHub API error:",error);
      return respond({error:"Something went wrong. Please try again."},500);
    }
  }
};

async function createSession(userId,email,env,respond){
  const token=toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const now=Date.now(),expires=now+SESSION_MS;
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(),userId,await sha256(token),expires,now).run();
  return respond({success:true,user:{id:userId,uid:userId,email}},200,{"Set-Cookie":sessionCookie(token)});
}
async function getSessionUser(request,env){
  const token=getCookie(request,COOKIE_NAME);
  if(!token)return null;
  return await env.DB.prepare("SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?")
    .bind(await sha256(token),Date.now()).first();
}
function sessionCookie(token){return COOKIE_NAME+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(SESSION_DAYS*86400);}
function expiredCookie(){return COOKIE_NAME+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";}
async function hashPassword(password,salt){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},key,256);
  return toBase64(new Uint8Array(bits));
}
async function verifyPassword(password,stored){
  try{const [saltText,expected]=stored.split(":");if(!saltText||!expected)return false;const actual=await hashPassword(password,fromBase64(saltText));if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}catch{return false;}
}
async function sha256(value){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return toBase64(new Uint8Array(digest));}
function toBase64(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function fromBase64(value){let base64=value.replace(/-/g,"+").replace(/_/g,"/");base64+="=".repeat((4-base64.length%4)%4);return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
function getCookie(request,name){const cookies=request.headers.get("Cookie")||"";const item=cookies.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));return item?item.slice(name.length+1):null;}
function validKey(value){return typeof value==="string"&&value.length>0&&value.length<=160&&!/[\u0000-\u001f]/.test(value);}
function parseJson(value){try{return JSON.parse(value||"{}");}catch{return {};}}
function cleanObject(value,omit=[]){if(!value||typeof value!=="object"||Array.isArray(value))return {};const out={};for(const [k,v] of Object.entries(value)){if(omit.includes(k)||v===undefined)continue;if(typeof v==="string"&&v.length>2000)out[k]=v.slice(0,2000);else if(typeof v==="number"||typeof v==="string"||typeof v==="boolean"||v===null)out[k]=v;}return out;}
