# MiraculousHub TV — Native Android TV starter

This is a **native Java Android TV project**, not a website wrapper or WebView.

## Build the APK
Open the folder in Android Studio (with Android SDK 35 and JDK 17+), allow Gradle to sync, then use **Build > Build APK(s)**. Debug APK output: `app/build/outputs/apk/debug/app-debug.apk`.

Alternatively, with Gradle 8.9 installed and the Android SDK configured: `gradle assembleDebug`.

## What works in this first version
- Android TV launcher banner; landscape layout; D-pad focusable side navigation, season rows, and Back.
- 157 bundled Miraculous episode entries from the supplied website ZIP (fallback).
- Fetches `https://upload.miraculoushub.co.uk/catalog` on every app opening or using Refresh, merging uploaded episode cards, removing unpublished entries and showing uploaded trailers.
- Uses the website's `https://video.miraculoushub.co.uk/video/sXXeXX` endpoint for playback via Android's **Media3 ExoPlayer** with HLS support.
- Simple local Continue Watching (last opened episode only).

## Important limitations / next steps
- This is **source code, not a compiled APK**. SDK/Gradle are not installed in the current environment.
- Media URLs depend on your deployed Cloudflare Workers and security settings. Workers that require browser sessions, referrer validation or special headers may reject the native TV player; adjust Worker authentication safely for native clients. Only play content you are allowed to distribute.
- Firebase login and cloud playback-position syncing, artwork loading, the separate anime catalogue and live stream are **not yet connected**. Do not call this feature-complete.
- Uploaded content updates automatically when the app is opened/refreshed; *app code/design* updates still require a new APK.
- The Worker catalogue is live, but the 157 bundled baseline episodes are baked into the APK. Editing those baseline episodes on the website won't automatically edit the APK unless changed through the live catalogue.
- Test navigation and playback on a real Android TV before distributing; Play Protect / unknown app install prompts can vary by TV.

## Easiest build: GitHub Actions (no Android Studio)
1. Create a **private** GitHub repository (or use a new public repository if you prefer).
2. Upload **all contents of this project folder to the repository root**. Make sure `.github/workflows/build-apk.yml` stays at that exact path, not inside a nested `MiraculousHubTV` folder. GitHub's web uploader may hide dot-folders in some upload dialogs; check that the workflow is present.
3. Open your GitHub repository's **Actions** tab and select **Build MiraculousHub TV APK**.
4. Click **Run workflow**, choose `main`, then click the green **Run workflow** button. The workflow also runs automatically when app files are pushed.
5. Open the completed run and find **Artifacts → MiraculousHubTV-APK**. Download and unzip it. Inside is `app-debug.apk`, which can be installed on Android TV.

You may need to enable Actions on the repository once. This is a **debug-signed APK for testing**, not a Play Store release. Do not upload secrets or credentials to the repository. If a build fails, open its red step to view the error.
