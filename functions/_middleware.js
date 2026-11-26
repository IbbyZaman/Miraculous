const COOKIE_NAME = "__Host-mh_access";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function validSession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";
  const entry = cookie.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + "="));
  if (!entry) return false;
  const token = entry.slice(COOKIE_NAME.length + 1);
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiryText = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(expiryText, secret);
  return bytesEqual(encoder.encode(signature), encoder.encode(expected));
}

function gatePage(message = "") {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#070710"><title>Private access · MiraculousHub</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;color:#f8f7ff;background:radial-gradient(ellipse at 20% 15%,#4a1740 0,transparent 38%),radial-gradient(ellipse at 85% 80%,#241b59 0,transparent 42%),#070710;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
main{width:min(440px,100%);padding:38px;border:1px solid #ffffff24;border-radius:28px;background:#11111dcc;box-shadow:0 30px 100px #0009;backdrop-filter:blur(24px)}
.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:linear-gradient(145deg,#ff789c,#8d39e9);font-weight:950;font-size:20px;box-shadow:0 12px 32px #f34b8050}
.kicker{margin:28px 0 8px;color:#ff91b0;font-size:11px;font-weight:800;letter-spacing:.2em}
h1{margin:0;font-size:32px;letter-spacing:-.04em}p{color:#b9b5c8;line-height:1.6;font-size:14px}
label{display:block;margin:24px 0 8px;font-size:12px;color:#d8d4e4;font-weight:700}
input{width:100%;padding:15px 16px;border:1px solid #ffffff28;border-radius:13px;background:#ffffff0b;color:#fff;font:inherit;outline:none}
input:focus{border-color:#ff729c;box-shadow:0 0 0 3px #ff729c22}
button{width:100%;margin-top:14px;padding:15px;border:0;border-radius:13px;background:linear-gradient(110deg,#ff527f,#984eff);color:white;font:inherit;font-weight:850;cursor:pointer}
.error{color:#ff9db3;min-height:20px;font-size:13px}
small{display:block;margin-top:26px;color:#777387;font-size:11px}
</style></head><body><main><div class="mark">M</div><div class="kicker">MIRACULOUSHUB · PRIVATE ACCESS</div><h1>Your watch space awaits.</h1><p>Enter the shared access password to continue to MiraculousHub.</p>
<form method="post" action="/__mh_access/login"><label for="password">Access password</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><div class="error" role="alert">${message}</div><button type="submit">Enter MiraculousHub <span aria-hidden="true">→</span></button></form>
<small>Protected access · MiraculousHub</small></main></body></html>`, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const password = env.MH_SHARED_PASSWORD;
  const sessionSecret = env.MH_SESSION_SECRET;

  if (!password || !sessionSecret) {
    return new Response("MiraculousHub access protection is not configured. Set MH_SHARED_PASSWORD and MH_SESSION_SECRET as Cloudflare secrets.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  if (url.pathname === "/__mh_access/login" && request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
    const form = await request.formData();
    const submitted = String(form.get("password") || "");
    const supplied = encoder.encode(submitted);
    const expected = encoder.encode(password);
    if (!bytesEqual(supplied, expected)) return gatePage("That password wasn't recognised. Please try again.");
    const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
    const signature = await sign(expiry, sessionSecret);
    return new Response(null, {
      status: 303,
      headers: {
        "Location": "/",
        "Set-Cookie": `${COOKIE_NAME}=${expiry}.${signature}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store"
      }
    });
  }

  if (await validSession(request, sessionSecret)) return next();
  return gatePage();
}
