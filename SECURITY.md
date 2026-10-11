# MiraculousHub Worker access

The video Worker verifies Firebase ID tokens through Google's accounts:lookup
endpoint before signing an attachment link. It also checks the project, issuer,
user, expiry, anonymous/disabled status and revocation time. Firebase ID tokens remain in
an Authorization header; signed download URLs contain no account details.

DOWNLOAD_SIGNING_KEY is a required Worker secret with at least 32 random
characters. HMAC-SHA256 tickets expire after five minutes and are bound to the
episode path, issuing website origin and Worker hostname. Every attachment
route, including legacy routes and Drive fallbacks, passes the same checks.
Range and HEAD requests require authorization too. Responses use private,
no-store. Sign-out/account changes during preparation cancel the client action.
A ticket already issued is a bearer credential until it expires.

Only https://miraculoushub.co.uk and its www hostname can request tickets,
download attachments, create party rooms or use the password-protected uploader.
Playback also accepts direct Worker navigation and the Worker's own native
player requests. Foreign browser Origin/Referer requests and no-referrer
cross-site embeds are denied; frame-ancestors blocks foreign iframes. CORS
never permits a wildcard origin. Internal subtitle ingestion retains its
separate, signed video-only access.

Public playback is intentionally accessible. A viewer can still save or record
the stream, and non-browser clients can imitate Origin/Referer/fetch headers.
These checks protect the signed attachment route and block ordinary browser
hotlinking; they are not DRM. Keep R2 public r2.dev access and public bucket
domains disabled to avoid exposing object URLs outside the Worker.

Keep UPLOAD_PASSWORD, GOOGLE_SERVICE_ACCOUNT, AUTO_SUBTITLE_SIGNING_KEY
and DOWNLOAD_SIGNING_KEY in Cloudflare secrets. The Firebase web API key is
public project configuration, not an authorization credential.

See DOWNLOADS-AND-DOMAINS.txt for deployment and domain setup.
