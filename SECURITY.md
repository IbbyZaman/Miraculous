# Cloudflare Worker hardening notes

Your Google service-account JSON should remain a Cloudflare Worker Secret, never in HTML/JS.
Cloudflare documents that Secrets are encrypted and exposed to Worker code through `env`, while plaintext vars are not encrypted.

Recommended production approach:
1. Keep GOOGLE_SERVICE_ACCOUNT as a Secret.
2. Add a second secret such as PLAYER_SHARED_SECRET.
3. Have your site obtain a short-lived signed playback token from the Worker.
4. Make `/video` reject requests without a valid token.
5. Optionally check `Origin`/`Referer` as an additional signal for your own domain.
6. Add rate limiting.
7. Consider putting the Worker behind your own domain, e.g. video.miraculoushub.co.uk.

Important:
- CORS/origin checks are not a complete anti-hotlink solution.
- Referer can be missing or altered.
- A browser that is allowed to play a video can still inspect its network request.
- The goal is to make copying/hotlinking harder and prevent unauthorised access to the backend, not to make the media cryptographically invisible.

Example of a basic origin check (not sufficient by itself):

const allowed = new Set([
  "https://miraculoushub.co.uk",
  "https://www.miraculoushub.co.uk"
]);

const origin = request.headers.get("Origin");
if (origin && !allowed.has(origin)) {
  return new Response("Forbidden", {status:403});
}

Use signed short-lived tokens for real access control.
