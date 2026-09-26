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

  // Season 5
  "/video/conformation": {
    id: "1FOfhegcW_m9GpB3sBO0HNIFEfPHAtR9O",
    filename: "S05E25 - Conformation - The Final Day Part 1.mp4"
  },

  "/video/recreation": {
    id: "1kEKfCh8p30ISC0wZO-TWz2pg9pBFvJuG",
    filename: "S05E26 - Re-Creation - The Final Day Part 2.mp4"
  },


  // Season 6 - Episodes 16-19
  "/video/noe": {
    id: "1p551qmCjlGoRIGaDKcphVkgufvp89PyP",
    filename: "S06E16 - Noe.mp4"
  },

  "/video/a-fairy-good-night": {
    id: "175bpDpw9GnlFkRAo_XFd9cnZDrY4mgId",
    filename: "S06E17 - A Fairy Good Night.mp4"
  },

  "/video/the-dirtifiers": {
    id: "1gCMeje3wvoU90Ayr9s69q_L_Hfs9eroQ",
    filename: "S06E18 - The Dirtifiers.mp4"
  },

  "/video/riginarazione": {
    id: "13pDjpoVOdAxBuZubYHfrlqKBNZFj_-tL",
    filename: "S06E19 - Riginarazione.mp4"
  },

  // Season 6
  "/video/heartfixer": {
    id: "1QUGQ4fddnAaKmXMxMhEQ1EjAvq6BcAiZ",
    filename: "S06E20 - Heartfixer.mp4"
  },

  "/video/the-chained-titans": {
    id: "1Pw_0C89gSOKSf0IgAy5Dr8aHEqi9PVxx",
    filename: "S06E21 - The Chained Titans.mp4"
  },

  "/video/lady-chaos": {
    id: "1lpYet9bFybrO1dF87RnP7el3SeuDLVw-",
    filename: "S06E22 - Lady Chaos.mp4"
  },

  "/video/sadnansi": {
    id: "1VqrXeRiqS-QzYH7pkW0icRZLDgy8bvhk",
    filename: "S06E23 - Sadnansi.mp4"
  },

  "/video/queen-of-the-dreadzone": {
    id: "16kddGMxsSDEwT6-4_949oxl5A-cjNhwZ",
    filename: "S06E24 - Queen of the Dreadzone.mp4"
  },

  "/video/secret-protocol": {
    id: "1WNfkFBPZZuS4n2NpspIRQuhbBSAOQc9m",
    filename: "S06E25 - Secret Protocol.mp4"
  },

  "/video/nemesis": {
    id: "1Cxtaq0hHq7wnrl9SZMSgFyCSNTYCtx2r",
    filename: "S06E26 - Nemesis.mp4"
  },

  // Miraculous World: London
  "/video/london": {
    id: "1qRdyE5j3EHh2Z4s92CYCYIzPgXJbImCk",
    filename: "Miraculous World - London - At the Edge of Time.mp4"
  },

  // Miraculous World: Paris
  "/video/paris": {
    id: "1UpkgVrt5DWLgY07clSylRNAXJwVo9KNS",
    filename: "Miraculous World - Paris - Tales of Shadybug and Claw Noir.mp4"
  }
};


const DOWNLOADS = {
  "/download/stormy-weather":
    VIDEOS["/video"],

  "/download/bubbler":
    VIDEOS["/video/bubbler"],

  "/download/pharaoh":
    VIDEOS["/video/pharaoh"],

  // Season 5
  "/download/conformation":
    VIDEOS["/video/conformation"],

  "/download/recreation":
    VIDEOS["/video/recreation"],


  // Season 6 - Episodes 16-19
  "/download/noe":
    VIDEOS["/video/noe"],

  "/download/a-fairy-good-night":
    VIDEOS["/video/a-fairy-good-night"],

  "/download/the-dirtifiers":
    VIDEOS["/video/the-dirtifiers"],

  "/download/riginarazione":
    VIDEOS["/video/riginarazione"],

  // Season 6
  "/download/heartfixer":
    VIDEOS["/video/heartfixer"],

  "/download/the-chained-titans":
    VIDEOS["/video/the-chained-titans"],

  "/download/lady-chaos":
    VIDEOS["/video/lady-chaos"],

  "/download/sadnansi":
    VIDEOS["/video/sadnansi"],

  "/download/queen-of-the-dreadzone":
    VIDEOS["/video/queen-of-the-dreadzone"],

  "/download/secret-protocol":
    VIDEOS["/video/secret-protocol"],

  "/download/nemesis":
    VIDEOS["/video/nemesis"],

  // Miraculous World: London
  "/download/london":
    VIDEOS["/video/london"],

  // Miraculous World: Paris
  "/download/paris":
    VIDEOS["/video/paris"]
};


function base64url(data) {
  return btoa(
    String.fromCharCode(
      ...new Uint8Array(data)
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


async function getAccessToken(serviceAccount) {
  const now = Math.floor(
    Date.now() / 1000
  );

  const header = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        alg: "RS256",
        typ: "JWT"
      })
    )
  );

  const claim = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope:
          "https://www.googleapis.com/auth/drive.readonly",
        aud:
          "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
      })
    )
  );

  const unsignedToken =
    `${header}.${claim}`;

  const privateKeyData =
    Uint8Array.from(
      atob(
        serviceAccount.private_key
          .replace(
            "-----BEGIN PRIVATE KEY-----",
            ""
          )
          .replace(
            "-----END PRIVATE KEY-----",
            ""
          )
          .replace(/\s/g, "")
      ),
      character =>
        character.charCodeAt(0)
    );

  const privateKey =
    await crypto.subtle.importKey(
      "pkcs8",
      privateKeyData,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(
        unsignedToken
      )
    );

  const jwt =
    `${unsignedToken}.${base64url(signature)}`;

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },

      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "Google authentication failed:",
      data
    );

    throw new Error(
      "Google authentication failed"
    );
  }

  return data.access_token;
}


function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":
      "Range, Content-Type, Accept",

    "Access-Control-Allow-Methods":
      "GET, HEAD, OPTIONS",

    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Accept-Ranges, Content-Disposition"
  };
}


async function streamFile({
  request,
  env,
  file,
  download = false
}) {

  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    return new Response(
      "GOOGLE_SERVICE_ACCOUNT secret is missing.",
      {
        status: 500,

        headers: {
          ...corsHeaders(),

          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }

  let serviceAccount;

  try {
    serviceAccount =
      JSON.parse(
        env.GOOGLE_SERVICE_ACCOUNT
      );

  } catch (error) {

    console.error(
      "Invalid GOOGLE_SERVICE_ACCOUNT JSON:",
      error
    );

    return new Response(
      "Invalid Google service account configuration.",
      {
        status: 500,

        headers: {
          ...corsHeaders(),

          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }


  const accessToken =
    await getAccessToken(
      serviceAccount
    );


  const googleHeaders =
    new Headers();


  googleHeaders.set(
    "Authorization",
    `Bearer ${accessToken}`
  );


  const range =
    request.headers.get("Range");


  if (range) {
    googleHeaders.set(
      "Range",
      range
    );
  }


  const googleResponse =
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        method: "GET",
        headers: googleHeaders
      }
    );


  if (!googleResponse.ok) {

    const errorText =
      await googleResponse.text();

    console.error(
      "Google Drive error:",
      googleResponse.status,
      errorText
    );

    return new Response(
      "Unable to retrieve video from Google Drive.",
      {
        status:
          googleResponse.status,

        headers: {
          ...corsHeaders(),

          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }


  const outputHeaders =
    new Headers(
      corsHeaders()
    );


  outputHeaders.set(
    "Content-Type",
    googleResponse.headers.get(
      "Content-Type"
    ) || "video/mp4"
  );


  outputHeaders.set(
    "Accept-Ranges",
    "bytes"
  );


  const contentLength =
    googleResponse.headers.get(
      "Content-Length"
    );


  const contentRange =
    googleResponse.headers.get(
      "Content-Range"
    );


  if (contentLength) {
    outputHeaders.set(
      "Content-Length",
      contentLength
    );
  }


  if (contentRange) {
    outputHeaders.set(
      "Content-Range",
      contentRange
    );
  }


  if (download) {
    outputHeaders.set(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`
    );
  }


  return new Response(
    request.method === "HEAD"
      ? null
      : googleResponse.body,
    {
      status:
        googleResponse.status,

      headers:
        outputHeaders
    }
  );
}


export default {
  async fetch(request, env) {

    const url =
      new URL(request.url);


    // CORS preflight

    if (
      request.method === "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,

          headers:
            corsHeaders()
        }
      );
    }


    // Only GET and HEAD

    if (
      request.method !== "GET" &&
      request.method !== "HEAD"
    ) {

      return new Response(
        "Method Not Allowed",
        {
          status: 405,

          headers:
            corsHeaders()
        }
      );
    }


    // VIDEO ROUTES

    const video =
      VIDEOS[url.pathname];


    if (video) {

      try {

        return await streamFile({
          request,
          env,
          file: video,
          download: false
        });

      } catch (error) {

        console.error(
          "Video streaming error:",
          error
        );

        return new Response(
          "Server error while streaming video.",
          {
            status: 500,

            headers: {
              ...corsHeaders(),

              "Content-Type":
                "text/plain; charset=utf-8"
            }
          }
        );
      }
    }


    // DOWNLOAD ROUTES

    const download =
      DOWNLOADS[url.pathname];


    if (download) {

      try {

        return await streamFile({
          request,
          env,
          file: download,
          download: true
        });

      } catch (error) {

        console.error(
          "Download preparation error:",
          error
        );

        return new Response(
          "Server error while preparing download.",
          {
            status: 500,

            headers: {
              ...corsHeaders(),

              "Content-Type":
                "text/plain; charset=utf-8"
            }
          }
        );
      }
    }


    // STATUS PAGE

    if (url.pathname === "/") {

      return new Response(
`Miraculous Video Server

VIDEO ROUTES

/video
/video/bubbler
/video/pharaoh

/video/conformation
/video/recreation
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

/video/london
/video/paris


DOWNLOAD ROUTES

/download/stormy-weather
/download/bubbler
/download/pharaoh

/download/conformation
/download/recreation
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

/download/london
/download/paris
`,
        {
          status: 200,

          headers: {
            ...corsHeaders(),

            "Content-Type":
              "text/plain; charset=utf-8"
          }
        }
      );
    }


    // 404

    return new Response(
      "Not Found",
      {
        status: 404,

        headers: {
          ...corsHeaders(),

          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }
};