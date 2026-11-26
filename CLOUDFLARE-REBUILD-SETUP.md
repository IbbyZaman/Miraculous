# Cloudflare cinematic rebuild — deployment notes

This branch is a safe staging point for the MiraculousHub Cloudflare rebuild. It does not replace the production branch.

## Shared-password gate

The Pages Function in `functions/_middleware.js` protects every page and static asset. It checks the password on the server, then issues a seven-day signed session cookie with the `__Host-` prefix, HttpOnly, Secure and SameSite=Lax. The password and signing key are Cloudflare secrets; neither belongs in HTML, JavaScript, Git, or the browser.

Before deploying this branch to a Cloudflare Pages preview:

1. Confirm the Pages project is connected to this repository and uses the `cloudflare-cinematic-rebuild` branch for a preview deployment.
2. Set these as **Secrets** for the preview environment (not ordinary public build variables):
   - `MH_SHARED_PASSWORD`: use a strong, unique shared password. Do not use a short or guessable word.
   - `MH_SESSION_SECRET`: a long random secret (at least 32 random bytes).
3. Deploy the preview and test a wrong password, a correct password, refresh, direct links to pages/assets, and expiry.
4. Only after the full preview is tested should the production Pages project be pointed at this branch and the existing `miraculoushub.co.uk` custom domain be attached.

The current Firebase project, video Worker, uploader Worker and R2 bucket are intentionally left unchanged. Do not redeploy `wrangler.toml` as part of the Pages migration; it describes the existing video Worker and includes a placeholder bucket name.

## Important

A shared password is a simple access barrier, not individual identity or a way to prevent an invited visitor sharing it. Rotate it if it is circulated. The gate does not replace Firebase account security or the access controls on any separate media/API host; those need to be reviewed separately before claiming that every video URL is private.
