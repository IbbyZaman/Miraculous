const VIDEOS = {
  "/video": {
    id: "13kJTw_ybytXBuMlYmpwG1kGZLqu3Kd5y",
    filename: "S01E01 - Stormy Weather.mp4"
  },
  "/video/bubbler": {
    id: "1mHkQXdh5JowLNUKGHRDgWM1PyOk9xcO9",
    filename: "S01E02 - The Bubbler.mp4"
  },
  "/video/pharaoh": {
    id: "1hq5gCYHleseBv_Qm3_8rRXCPluBIPy7C",
    filename: "S01E03 - The Pharaoh.mp4"
  },
  "/video/secret-protocol": {
    id: "1WNfkFBPZZuS4n2NpspIRQuhbBSAOQc9m",
    filename: "S06E25 - Secret Protocol.mp4"
  }
};

const DOWNLOADS = {
  "/download/stormy-weather": VIDEOS["/video"],
  "/download/bubbler": VIDEOS["/video/bubbler"],
  "/download/pharaoh": VIDEOS["/video/pharaoh"],
  "/download/secret-protocol": VIDEOS["/video/secret-protocol"]
};

function base64url(data) {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const enc = value => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const header = enc({ alg: "RS256", typ: "JWT" });
  const claim = enc({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  });

  const unsigned = `${header}.${claim}`;
  const keyBytes = Uint8Array.from(
    atob(
      serviceAccount.private_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s/g, "")
    ),
    c => c.charCodeAt(0)
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error("Google authentication failed");
  return data.access_token;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Range, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Disposition"
  };
}

async function handleFile(request, env, file, isDownload) {
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const token = await getAccessToken(serviceAccount);

  const googleHeaders = new Headers({ Authorization: `Bearer ${token}` });
  const range = request.headers.get("Range");
  if (range) googleHeaders.set("Range", range);

  const googleResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: googleHeaders }
  );

  if (!googleResponse.ok) {
    const detail = await googleResponse.text();
    console.error("Google Drive error", googleResponse.status, detail);
    return new Response("Google Drive could not provide this file.", {
      status: googleResponse.status,
      headers: { ...corsHeaders(), "Content-Type": "text/plain" }
    });
  }

  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", googleResponse.headers.get("Content-Type") || "video/mp4");
  headers.set("Accept-Ranges", "bytes");

  for (const name of ["Content-Length", "Content-Range"]) {
    const value = googleResponse.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (isDownload) {
    headers.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    headers.set("Cache-Control", "no-store");
  }

  return new Response(
    request.method === "HEAD" ? null : googleResponse.body,
    { status: googleResponse.status, headers }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }

    if (url.pathname === "/") {
      return new Response(
`Miraculous Video Server

Video routes:
/video
/video/bubbler
/video/pharaoh
/video/secret-protocol

Download routes:
/download/stormy-weather
/download/bubbler
/download/pharaoh
/download/secret-protocol
`,
        { headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    const video = VIDEOS[url.pathname];
    if (video) {
      try {
        return await handleFile(request, env, video, false);
      } catch (error) {
        console.error(error);
        return new Response("Server error while streaming video.", {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "text/plain" }
        });
      }
    }

    const download = DOWNLOADS[url.pathname];
    if (download) {
      try {
        return await handleFile(request, env, download, true);
      } catch (error) {
        console.error(error);
        return new Response("Server error while preparing download.", {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "text/plain" }
        });
      }
    }

    return new Response("Not Found", {
      status: 404,
      headers: { ...corsHeaders(), "Content-Type": "text/plain" }
    });
  }
};
