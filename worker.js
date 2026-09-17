const VIDEOS = {
  "/video": { id: "13kJTw_ybytXBuMlYmpwG1kGZLqu3Kd5y", filename: "S01E01 - Stormy Weather.mp4" },
  "/video/bubbler": { id: "1mHkQXdh5JowLNUKGHRDgWM1PyOk9xcO9", filename: "S01E02 - The Bubbler.mp4" },
  "/video/pharaoh": { id: "1hq5gCYHleseBv_Qm3_8rRXCPluBIPy7C", filename: "S01E03 - The Pharaoh.mp4" },
  "/video/climatiqueen": { id: "REPLACE_WITH_S06E01_DRIVE_FILE_ID", filename: "S06E01 - Climatiqueen.mp4" },
  "/video/the-illustrhater": { id: "REPLACE_WITH_S06E02_DRIVE_FILE_ID", filename: "S06E02 - The Illustrhater.mp4" },
  "/video/sublimation": { id: "REPLACE_WITH_S06E03_DRIVE_FILE_ID", filename: "S06E03 - Sublimation.mp4" },
  "/video/daddycop": { id: "REPLACE_WITH_S06E04_DRIVE_FILE_ID", filename: "S06E04 - Daddycop.mp4" },
  "/video/werepapas": { id: "REPLACE_WITH_S06E05_DRIVE_FILE_ID", filename: "S06E05 - Werepapas.mp4" },
  "/video/sleeping-syren": { id: "REPLACE_WITH_S06E06_DRIVE_FILE_ID", filename: "S06E06 - Sleeping Syren.mp4" },
  "/video/el-toro-de-piedra": { id: "REPLACE_WITH_S06E07_DRIVE_FILE_ID", filename: "S06E07 - El Toro De Piedra.mp4" },
  "/video/vampigami": { id: "REPLACE_WITH_S06E08_DRIVE_FILE_ID", filename: "S06E08 - Vampigami.mp4" },
  "/video/mr-agreste": { id: "REPLACE_WITH_S06E09_DRIVE_FILE_ID", filename: "S06E09 - Mr. Agreste.mp4" },
  "/video/the-dark-castle": { id: "REPLACE_WITH_S06E10_DRIVE_FILE_ID", filename: "S06E10 - The Dark Castle.mp4" },
  "/video/revelator": { id: "REPLACE_WITH_S06E11_DRIVE_FILE_ID", filename: "S06E11 - Revelator.mp4" },
  "/video/wreckless-driver": { id: "REPLACE_WITH_S06E12_DRIVE_FILE_ID", filename: "S06E12 - Wreckless Driver.mp4" },
  "/video/yaksi-gozen": { id: "REPLACE_WITH_S06E13_DRIVE_FILE_ID", filename: "S06E13 - Yaksi Gozen.mp4" },
  "/video/grandiaper": { id: "REPLACE_WITH_S06E14_DRIVE_FILE_ID", filename: "S06E14 - Grandiaper.mp4" },
  "/video/the-ruler": { id: "REPLACE_WITH_S06E15_DRIVE_FILE_ID", filename: "S06E15 - The Ruler.mp4" },
  "/video/noe": { id: "REPLACE_WITH_S06E16_DRIVE_FILE_ID", filename: "S06E16 - Noe.mp4" },
  "/video/a-fairy-good-night": { id: "REPLACE_WITH_S06E17_DRIVE_FILE_ID", filename: "S06E17 - A Fairy Good Night.mp4" },
  "/video/the-dirtifiers": { id: "REPLACE_WITH_S06E18_DRIVE_FILE_ID", filename: "S06E18 - The Dirtifiers.mp4" },
  "/video/riginarazione": { id: "REPLACE_WITH_S06E19_DRIVE_FILE_ID", filename: "S06E19 - Riginarazione.mp4" },
  "/video/heartfixer": { id: "REPLACE_WITH_S06E20_DRIVE_FILE_ID", filename: "S06E20 - Heartfixer.mp4" },
  "/video/the-chained-titans": { id: "REPLACE_WITH_S06E21_DRIVE_FILE_ID", filename: "S06E21 - The Chained Titans.mp4" },
  "/video/lady-chaos": { id: "REPLACE_WITH_S06E22_DRIVE_FILE_ID", filename: "S06E22 - Lady Chaos.mp4" },
  "/video/sadnansi": { id: "REPLACE_WITH_S06E23_DRIVE_FILE_ID", filename: "S06E23 - Sadnansi.mp4" },
  "/video/queen-of-the-dreadzone": { id: "16kddGMxsSDEwT6-4_949oxl5A-cjNhwZ", filename: "S06E24 - Queen Of The Dreadzone.mp4" },
  "/video/secret-protocol": { id: "1WNfkFBPZZuS4n2NpspIRQuhbBSAOQc9m", filename: "S06E25 - Secret Protocol.mp4" },
  "/video/nemesis": { id: "1Cxtaq0hHq7wnrl9SZMSgFyCSNTYCtx2r", filename: "S06E26 - Nemesis.mp4" }
};

const DOWNLOADS = {
  "/download/stormy-weather": VIDEOS["/video"],
  "/download/bubbler": VIDEOS["/video/bubbler"],
  "/download/pharaoh": VIDEOS["/video/pharaoh"],
  "/download/climatiqueen": VIDEOS["/video/climatiqueen"],
  "/download/the-illustrhater": VIDEOS["/video/the-illustrhater"],
  "/download/sublimation": VIDEOS["/video/sublimation"],
  "/download/daddycop": VIDEOS["/video/daddycop"],
  "/download/werepapas": VIDEOS["/video/werepapas"],
  "/download/sleeping-syren": VIDEOS["/video/sleeping-syren"],
  "/download/el-toro-de-piedra": VIDEOS["/video/el-toro-de-piedra"],
  "/download/vampigami": VIDEOS["/video/vampigami"],
  "/download/mr-agreste": VIDEOS["/video/mr-agreste"],
  "/download/the-dark-castle": VIDEOS["/video/the-dark-castle"],
  "/download/revelator": VIDEOS["/video/revelator"],
  "/download/wreckless-driver": VIDEOS["/video/wreckless-driver"],
  "/download/yaksi-gozen": VIDEOS["/video/yaksi-gozen"],
  "/download/grandiaper": VIDEOS["/video/grandiaper"],
  "/download/the-ruler": VIDEOS["/video/the-ruler"],
  "/download/noe": VIDEOS["/video/noe"],
  "/download/a-fairy-good-night": VIDEOS["/video/a-fairy-good-night"],
  "/download/the-dirtifiers": VIDEOS["/video/the-dirtifiers"],
  "/download/riginarazione": VIDEOS["/video/riginarazione"],
  "/download/heartfixer": VIDEOS["/video/heartfixer"],
  "/download/the-chained-titans": VIDEOS["/video/the-chained-titans"],
  "/download/lady-chaos": VIDEOS["/video/lady-chaos"],
  "/download/sadnansi": VIDEOS["/video/sadnansi"],
  "/download/queen-of-the-dreadzone": VIDEOS["/video/queen-of-the-dreadzone"],
  "/download/secret-protocol": VIDEOS["/video/secret-protocol"],
  "/download/nemesis": VIDEOS["/video/nemesis"]
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
/video/climatiqueen
/video/the-illustrhater
/video/sublimation
/video/daddycop
/video/werepapas
/video/sleeping-syren
/video/el-toro-de-piedra
/video/vampigami
/video/mr-agreste
/video/the-dark-castle
/video/revelator
/video/wreckless-driver
/video/yaksi-gozen
/video/grandiaper
/video/the-ruler
/video/noe
/video/a-fairy-good-night
/video/the-dirtifiers
/video/riginarazione
/video/heartfixer
/video/the-chained-titans
/video/lady-chaos
/video/sadnansi
/video/queen-of-the-dreadzone
/video/secret-protocol
/video/nemesis

Download routes:
/download/stormy-weather
/download/bubbler
/download/pharaoh
/download/climatiqueen
/download/the-illustrhater
/download/sublimation
/download/daddycop
/download/werepapas
/download/sleeping-syren
/download/el-toro-de-piedra
/download/vampigami
/download/mr-agreste
/download/the-dark-castle
/download/revelator
/download/wreckless-driver
/download/yaksi-gozen
/download/grandiaper
/download/the-ruler
/download/noe
/download/a-fairy-good-night
/download/the-dirtifiers
/download/riginarazione
/download/heartfixer
/download/the-chained-titans
/download/lady-chaos
/download/sadnansi
/download/queen-of-the-dreadzone
/download/secret-protocol
/download/nemesis
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
