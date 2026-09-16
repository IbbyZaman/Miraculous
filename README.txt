MiraculousHub complete starter site

Files:
- index.html: homepage
- episodes.html: season/filter/search catalogue
- watch.html: connected player page
- data.js: episode catalogue
- common.js: theme/search/progress helpers
- styles.css: responsive design

The player uses your existing Cloudflare Worker /video endpoint.

SECURITY:
The browser must receive a playable media response, so a determined visitor can discover the media request. You cannot make a public browser video URL completely secret. The Worker should therefore be treated as the protected gateway, not as a hidden URL.

For production, add authentication/signed short-lived URLs, rate limiting, and origin/domain checks. Do not put your Google service-account JSON or private key in frontend files.


PLAYER UPDATE:
- Modern custom player with draggable seek bar, buffer indicator, center play, auto-hiding controls, volume, playback speed, CC/WebVTT support, picture-in-picture, theater mode, fullscreen, keyboard shortcuts, and saved progress.
- Subtitle files belong in subtitles/ as SxxExx.en.vtt.


UPDATED BUILD:
- Responsive portrait + landscape player layout.
- Season 1–6 + Specials catalogue.
- Connected media mapping for S01E01 Stormy Weather and S01E02 The Bubbler.
- Download Episode action outside the player.
- Unconnected catalogue episodes show Coming Soon instead of pretending a video exists.
- worker.js contains the Cloudflare Worker with /video, /video/bubbler, /download/stormy-weather and /download/bubbler routes.
- Keep GOOGLE_SERVICE_ACCOUNT in Cloudflare Worker Secrets; never put it in frontend files.
- The download/stream routes should only be used for content you are authorised to distribute.
