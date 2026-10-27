package uk.co.miraculoushub.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.Dialog;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/** Downloads updates inside the app, verifies bytes and signing identity, and
 *  requests standard Android Package Installer confirmation. Never bypasses
 *  Android's installer, signature validation or Play Protect. */
public final class AppUpdater {
  private static final String SITE="https://miraculoushub.co.uk";
  private static final String RELEASES="https://api.github.com/repos/IbbyZaman/Miraculous/releases?per_page=60";
  private static final String TYPE="tv";
  private static final String ASSET="MiraculousHubTV.apk";
  private static final Handler main=new Handler(Looper.getMainLooper());
  private static final AtomicBoolean checking=new AtomicBoolean(false);
  private static boolean prompting=false;
  private static final String PREFS="miraculoushub-updates";
  private AppUpdater(){}

  private static class Release {
    final int version;final String url,hash;
    Release(int version,String url,String hash){this.version=version;this.url=url;this.hash=hash==null?"":hash.toLowerCase(Locale.US);}
  }
  /** A persistent dialog replaces easy-to-miss toast failures on TV. */
  private static void showIssue(Activity a,String title,String details){
    main.post(()->{
      if(a.isFinishing()||a.isDestroyed())return;
      new AlertDialog.Builder(a).setTitle(title).setMessage(details)
        .setPositiveButton("OK",(d,w)->{})
        .setNeutralButton("Copy details",(d,w)->{
          ClipboardManager cb=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
          if(cb!=null)cb.setPrimaryClip(ClipData.newPlainText("MiraculousHub update diagnostic",details));
        }).show();
    });
  }
  private static class CheckResult{
    final boolean permitted,installerMustVerify;
    final String message;
    CheckResult(boolean allowed,boolean finalCheck,String details){
      permitted=allowed;installerMustVerify=finalCheck;message=details;
    }
  }
  private static String certDigest(Signature signature)throws Exception{
    byte[] digest=MessageDigest.getInstance("SHA-256").digest(signature.toByteArray());
    StringBuilder hex=new StringBuilder();
    for(byte b:digest)hex.append(String.format(Locale.US,"%02X",b&0xff));
    return hex.toString();
  }
  private static String fingerprint(Signature[] signatures){
    if(signatures==null||signatures.length==0)return "Not available";
    try{
      String hash=certDigest(signatures[0]);
      return hash.substring(0,16)+"…";
    }catch(Exception e){return "Cannot read certificate";}
  }
  private static void notify(Activity context,String message){
    main.post(()->{if(!context.isFinishing()&&!context.isDestroyed())
      Toast.makeText(context,message,Toast.LENGTH_LONG).show();});
  }
  private static int installedVersion(Activity a)throws Exception {
    PackageInfo info=a.getPackageManager().getPackageInfo(a.getPackageName(),0);
    return Build.VERSION.SDK_INT>=28?(int)info.getLongVersionCode():info.versionCode;
  }
  private static String read(String endpoint,int max)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(endpoint).openConnection();
    c.setConnectTimeout(8000);c.setReadTimeout(10000);
    c.setUseCaches(false);
    c.setRequestProperty("Cache-Control","no-cache, no-store, max-age=0");
    c.setRequestProperty("Accept","application/json");
    c.setRequestProperty("User-Agent","MiraculousHub-Updater");
    if(c.getResponseCode()!=200){int status=c.getResponseCode();c.disconnect();throw new java.io.IOException("HTTP "+status);}
    ByteArrayOutputStream out=new ByteArrayOutputStream();
    try(InputStream stream=c.getInputStream()){
      byte[] buffer=new byte[8192];int n;
      while((n=stream.read(buffer))!=-1){
        if(out.size()+n>max)throw new java.io.IOException("Update metadata too large");
        out.write(buffer,0,n);
      }
    }finally{c.disconnect();}
    return out.toString("UTF-8");
  }
  private static Release latest()throws Exception{
    // First-party metadata includes the expected SHA-256 of the APK file.
    try{
      JSONObject site=new JSONObject(read(SITE+"/downloads/"+TYPE+".json?cacheBust="+System.currentTimeMillis(),15000));
      String url=site.optString("url");
      int version=site.optInt("versionCode");
      String sha=site.optString("sha256");
      String expectedUrl=SITE+"/downloads/"+ASSET.substring(0,ASSET.length()-4)+"-"+version+".apk";
      // Immutable file names prevent a newer JSON checksum from referring
      // to a cached older download of the same "latest.apk" path.
      if(version>0&&url.equals(expectedUrl)&&sha.matches("[a-fA-F0-9]{64}"))
        return new Release(version,url,sha);
    }catch(Exception ignored){/* Fallback while the website mirror is deploying. */}
    JSONArray releases=new JSONArray(read(RELEASES,250000));
    Release best=null;
    for(int i=0;i<releases.length();i++){
      JSONObject item=releases.optJSONObject(i);
      if(item==null||item.optBoolean("draft")||item.optBoolean("prerelease"))continue;
      String tag=item.optString("tag_name");
      if(!tag.matches(TYPE+"-build-[0-9]+"))continue;
      int version=Integer.parseInt(tag.substring((TYPE+"-build-").length()));
      JSONArray assets=item.optJSONArray("assets");if(assets==null)continue;
      for(int j=0;j<assets.length();j++){
        JSONObject a=assets.optJSONObject(j);if(a==null||!ASSET.equals(a.optString("name")))continue;
        String url=a.optString("browser_download_url"),digest=a.optString("digest");
        if(!url.startsWith("https://github.com/IbbyZaman/Miraculous/releases/download/"))continue;
        String hash=digest.startsWith("sha256:")?digest.substring(7):"";
        if(best==null||version>best.version)best=new Release(version,url,hash);
      }
    }
    if(best==null)throw new java.io.IOException("No APK release found");
    return best;
  }
  public static void check(Activity activity,boolean manual){
    if(!checking.compareAndSet(false,true))return;
    new Thread(()->{
      try{
        Release release=latest();int current=installedVersion(activity);
        if(release.version<=current){
          if(manual)notify(activity,"Build "+current+" is already up to date.");
          return;
        }
        main.post(()->{
          if(activity.isFinishing()||activity.isDestroyed()||prompting)return;
          prompting=true;
          new AlertDialog.Builder(activity)
            .setTitle("MiraculousHub update • Build "+release.version)
            .setMessage("Download and prepare this update inside the app? Your account and watch history stay intact if its signing certificate matches. Android will ask you to confirm installation.")
            .setNegativeButton("Later",(d,w)->prompting=false)
            .setOnCancelListener(d->prompting=false)
            .setPositiveButton("Download update",(d,w)->{prompting=false;startDownload(activity,release);})
            .show();
        });
      }catch(Exception e){if(manual)notify(activity,"Couldn't check updates: "+e.getMessage());}
      finally{checking.set(false);}
    }).start();
  }
  private static File target(Activity activity,int version){
    return new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
      "MiraculousHub-"+TYPE+"-"+version+".apk");
  }
  private static void startDownload(Activity a,Release release){
    try{
      File folder=a.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
      if(folder==null)throw new IllegalStateException("Download storage unavailable");
      File file=target(a,release.version);
      if(file.exists()&&!file.delete())throw new java.io.IOException("Couldn't replace old update file");
      DownloadManager manager=(DownloadManager)a.getSystemService(Context.DOWNLOAD_SERVICE);
      if(manager==null)throw new IllegalStateException("Android Download Manager unavailable");
      DownloadManager.Request request=new DownloadManager.Request(Uri.parse(release.url));
      request.setTitle("MiraculousHub "+TYPE+" update "+release.version);
      request.setDescription("Downloading an update ready to install");
      request.setMimeType("application/vnd.android.package-archive");
      request.addRequestHeader("Cache-Control","no-cache");
      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      request.setAllowedOverMetered(true);
      request.setDestinationInExternalFilesDir(a,Environment.DIRECTORY_DOWNLOADS,file.getName());
      long id=manager.enqueue(request);
      a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
        .putLong("id",id).putInt("version",release.version)
        .putString("sha256",release.hash).putString("file",file.getAbsolutePath())
        .putBoolean("staged",false).apply();
      notify(a,"Downloading update in the background…");
      onResume(a);
    }catch(Exception e){notify(a,"Download couldn't start: "+e.getMessage());}
  }
  private static void clear(Activity a){
    a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().clear().apply();
  }
  public static void onResume(Activity a){
    android.content.SharedPreferences p=a.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    long id=p.getLong("id",-1);
    if(id<0)return;
    if(p.getBoolean("waitingForInstallPermission",false)){
      if(Build.VERSION.SDK_INT<26||a.getPackageManager().canRequestPackageInstalls()){
        p.edit().putBoolean("waitingForInstallPermission",false).apply();
        String file=p.getString("file","");
        if(!file.isEmpty()){
          // Check it again when returning from Android settings.
          new Thread(()->verifyAndPresent(a,id)).start();
        }
      }
      return;
    }
    // The download can complete while the app is backgrounded. Re-show the
    // installer prompt when the user reopens the app instead of losing it.
    if(p.getBoolean("staged",false))
      p.edit().putBoolean("staged",false).apply();
    main.postDelayed(()->poll(a,id),900);
  }
  private static void poll(Activity a,long id){
    if(a.isFinishing()||a.isDestroyed())return;
    if(a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getLong("id",-1)!=id)return;
    DownloadManager dm=(DownloadManager)a.getSystemService(Context.DOWNLOAD_SERVICE);
    if(dm==null)return;
    DownloadManager.Query query=new DownloadManager.Query().setFilterById(id);
    try(android.database.Cursor c=dm.query(query)){
      if(c==null||!c.moveToFirst()){clear(a);return;}
      int status=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
      if(status==DownloadManager.STATUS_PENDING||status==DownloadManager.STATUS_RUNNING||
         status==DownloadManager.STATUS_PAUSED){
        main.postDelayed(()->poll(a,id),2500);return;
      }
      if(status!=DownloadManager.STATUS_SUCCESSFUL){
        clear(a);notify(a,"Update download failed. Please try again.");return;
      }
    }catch(Exception e){notify(a,"Couldn't read update status.");return;}
    if(a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean("staged",false))return;
    a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("staged",true).apply();
    new Thread(()->verifyAndPresent(a,id)).start();
  }
  private static String sha256(File file)throws Exception{
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    try(java.io.FileInputStream in=new java.io.FileInputStream(file)){
      byte[] bytes=new byte[65536];int n;
      while((n=in.read(bytes))!=-1)digest.update(bytes,0,n);
    }
    StringBuilder out=new StringBuilder();
    for(byte b:digest.digest())out.append(String.format(Locale.US,"%02x",b&0xff));
    return out.toString();
  }
  @SuppressWarnings("deprecation")
  private static Signature[] signers(PackageInfo info){
    if(info==null)return null;
    if(Build.VERSION.SDK_INT>=28&&info.signingInfo!=null)return info.signingInfo.getApkContentsSigners();
    return info.signatures;
  }
  @SuppressWarnings("deprecation")
  private static CheckResult examinePackage(Activity activity,File file,int expected)throws Exception{
    PackageManager pm=activity.getPackageManager();
    int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
    PackageInfo incoming=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);
    PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),flags);
    if(incoming==null)return new CheckResult(false,false,
      "Android couldn't read the downloaded APK metadata. Try downloading it again.\n\nFile: "+file.getName());
    if(!activity.getPackageName().equals(incoming.packageName))
      return new CheckResult(false,false,
      "Wrong app package!\nInstalled: "+activity.getPackageName()+"\nDownloaded: "+incoming.packageName);
    long newVersion=Build.VERSION.SDK_INT>=28?incoming.getLongVersionCode():incoming.versionCode;
    long oldVersion=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode;
    if(newVersion<=oldVersion||newVersion!=expected)
      return new CheckResult(false,false,"Version mismatch.\nInstalled build: "+oldVersion+
        "\nDownloaded build: "+newVersion+"\nExpected build: "+expected+
        "\nPlease try checking for updates again.");
    Signature[] archiveCert=signers(incoming),installedCert=signers(installed);
    if(archiveCert==null||archiveCert.length==0||installedCert==null||installedCert.length==0)
      // Archive signature info can be absent on some Android/TV firmware.
      // Android's own installer MUST still validate the APK certificate.
      return new CheckResult(true,true,"Android's package inspector didn't return both certificates."+
        "\nInstalled cert: "+fingerprint(installedCert)+
        "\nDownloaded cert: "+fingerprint(archiveCert)+
        "\n\nAndroid's system installer will verify the signature before installing.");
    if(!Arrays.equals(archiveCert,installedCert))
      return new CheckResult(false,false,
        "The downloaded APK is signed with a different certificate.\n\n"+
        "Installed build: "+oldVersion+"  •  Certificate: "+fingerprint(installedCert)+
        "\nDownloaded build: "+newVersion+"  •  Certificate: "+fingerprint(archiveCert)+
        "\n\nAndroid will not replace an app signed by a different key. "+
        "Do not uninstall until your account and watch progress are synced. "+
        "Send a screenshot of this message so we can investigate the installed build.");
    return new CheckResult(true,false,
      "Signing certificates match.\nInstalled build: "+oldVersion+
      "\nDownloaded build: "+newVersion+"\nCertificate: "+fingerprint(installedCert));
  }
  private static void verifyAndPresent(Activity a,long id){
    try{
      android.content.SharedPreferences prefs=a.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
      File file=new File(prefs.getString("file",""));
      String expected=prefs.getString("sha256","");
      int version=prefs.getInt("version",0);
      if(!file.isFile()||file.length()<10000)throw new java.io.IOException("APK missing or incomplete");
      if(expected.matches("[a-f0-9]{64}")){
        String actual=sha256(file);
        if(!MessageDigest.isEqual(
          expected.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
          actual.getBytes(java.nio.charset.StandardCharsets.US_ASCII))){
          clear(a);
          showIssue(a,"Update file didn't match",
            "The download failed its security check, so it was not installed.\n\n"+
            "Build: "+version+"\nExpected SHA-256: "+expected+"\nReceived SHA-256: "+actual+
            "\n\nThis can happen when an older APK is served from a cache. "+
            "Please check for updates again. Future builds use version-specific APK links.");
          return;
        }
      }
      // Android may have installed this APK while the app was in the background.
      // In that case clear the old download task instead of reporting a mismatch.
      int installedNow=installedVersion(a);
      if(installedNow>=version){
        clear(a);
        notify(a,"Already up to date • Build "+installedNow);
        return;
      }
      CheckResult check=examinePackage(a,file,version);
      if(!check.permitted){
        if(check.message.startsWith("Already up to date")){clear(a);notify(a,"Already up to date.");return;}
        showIssue(a,"Update blocked — details",check.message);
        // Don't delete the verified APK: it can help diagnose a real mismatch.
        a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("staged",true).apply();
        return;
      }
      main.post(()->{
        if(a.isFinishing()||a.isDestroyed())return;
        showUpdatePrompt(a,version,file,check);
      });
    }catch(Exception e){
      showIssue(a,"Update couldn't be prepared","Reason: "+e.getMessage()+
        "\n\nThe current app is still installed and your data hasn't been changed.");
    }
  }

  private static int dp(Activity a,int value){
    return (int)(a.getResources().getDisplayMetrics().density*value+0.5f);
  }
  private static GradientDrawable shape(int color,int radius,int strokeColor){
    GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(radius);
    if(strokeColor!=0)d.setStroke(1,strokeColor);
    return d;
  }
  private static TextView promptText(Activity a,String value,int size,int color,boolean bold){
    TextView t=new TextView(a);t.setText(value);t.setTextSize(size);t.setTextColor(color);
    if(bold)t.setTypeface(null,Typeface.BOLD);
    return t;
  }
  private static void showUpdatePrompt(Activity a,int version,File file,CheckResult check){
    Dialog dialog=new Dialog(a);
    LinearLayout card=new LinearLayout(a);card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(a,30),dp(a,28),dp(a,30),dp(a,26));
    card.setBackground(shape(0xff17181d,dp(a,22),0xff383a42));
    card.setElevation(dp(a,14));
    card.setFocusable(true);
    TextView brand=promptText(a,"MIRACULOUS HUB",13,0xfff04452,true);
    brand.setLetterSpacing(0.12f);card.addView(brand);
    TextView title=promptText(a,"A new version is ready",27,Color.WHITE,true);
    LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(-1,-2);
    titleParams.topMargin=dp(a,12);card.addView(title,titleParams);
    TextView subtitle=promptText(a,"Your TV experience is getting an upgrade.",15,0xffc4c5cc,false);
    LinearLayout.LayoutParams subParams=new LinearLayout.LayoutParams(-1,-2);
    subParams.topMargin=dp(a,7);card.addView(subtitle,subParams);
    TextView badge=promptText(a,"  BUILD "+version+"  •  VERIFIED APK  ",12,0xffffb9bf,true);
    badge.setPadding(dp(a,11),dp(a,8),dp(a,11),dp(a,8));
    badge.setBackground(shape(0xff352126,dp(a,8),0xff6d3038));
    LinearLayout.LayoutParams badgeParams=new LinearLayout.LayoutParams(-2,-2);
    badgeParams.topMargin=dp(a,18);card.addView(badge,badgeParams);
    TextView info=promptText(a,"Install over your current app. Your account and watch history stay in place.",14,0xffd5d6dc,false);
    info.setLineSpacing(dp(a,3),1f);
    LinearLayout.LayoutParams infoParams=new LinearLayout.LayoutParams(-1,-2);
    infoParams.topMargin=dp(a,16);card.addView(info,infoParams);
    if(check.installerMustVerify){
      TextView note=promptText(a,check.message,11,0xffaeb0b8,false);
      LinearLayout.LayoutParams noteParams=new LinearLayout.LayoutParams(-1,-2);
      noteParams.topMargin=dp(a,10);card.addView(note,noteParams);
    }
    LinearLayout actions=new LinearLayout(a);actions.setGravity(Gravity.CENTER_VERTICAL);
    actions.setOrientation(LinearLayout.HORIZONTAL);
    LinearLayout.LayoutParams actionsParams=new LinearLayout.LayoutParams(-1,-2);
    actionsParams.topMargin=dp(a,24);card.addView(actions,actionsParams);
    TextView later=promptText(a,"Later",15,Color.WHITE,true);
    later.setGravity(Gravity.CENTER);later.setFocusable(true);later.setClickable(true);
    later.setPadding(dp(a,22),dp(a,13),dp(a,22),dp(a,13));
    later.setBackground(shape(0xff292a31,dp(a,10),0xff4b4d55));
    actions.addView(later,new LinearLayout.LayoutParams(0,dp(a,50),1));
    TextView install=promptText(a,"Install update",15,Color.WHITE,true);
    install.setGravity(Gravity.CENTER);install.setFocusable(true);install.setClickable(true);
    install.setPadding(dp(a,22),dp(a,13),dp(a,22),dp(a,13));
    install.setBackground(shape(0xffe50914,dp(a,10),0xffe50914));
    LinearLayout.LayoutParams installParams=new LinearLayout.LayoutParams(0,dp(a,50),1);
    installParams.leftMargin=dp(a,12);actions.addView(install,installParams);
    View.OnFocusChangeListener focus=(view,focused)->{
      view.animate().scaleX(focused?1.04f:1f).scaleY(focused?1.04f:1f).setDuration(120).start();
      if(view==install)install.setBackground(shape(focused?0xffff2632:0xffe50914,dp(a,10),Color.WHITE));
      else later.setBackground(shape(focused?0xff41434b:0xff292a31,dp(a,10),focused?Color.WHITE:0xff4b4d55));
    };
    later.setOnFocusChangeListener(focus);install.setOnFocusChangeListener(focus);
    later.setOnClickListener(v->{
      a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("staged",false).apply();
      dialog.dismiss();
    });
    install.setOnClickListener(v->{dialog.dismiss();install(a,file);});
    dialog.setContentView(card);
    if(dialog.getWindow()!=null){
      dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
      dialog.getWindow().setDimAmount(0.72f);
    }
    dialog.setOnCancelListener(d->a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("staged",false).apply());
    dialog.show();
    if(dialog.getWindow()!=null){
      dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
      dialog.getWindow().setLayout(Math.min(dp(a,620),(int)(a.getResources().getDisplayMetrics().widthPixels*0.86f)),-2);
    }
    install.requestFocus();
  }

  private static void install(Activity activity,File file){
    if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){
      activity.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
        .putBoolean("waitingForInstallPermission",true).apply();
      new AlertDialog.Builder(activity)
        .setTitle("Allow app updates")
        .setMessage("Android requires permission to install an APK from MiraculousHub. Enable 'Allow from this source', then return here to install the verified update. No uninstall is necessary.")
        .setNegativeButton("Not now",null)
        .setPositiveButton("Open settings",(d,w)->{
          try{
            Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
              Uri.parse("package:"+activity.getPackageName()));
            activity.startActivity(settings);
          }catch(Exception e){notify(activity,"Open Android settings to allow APK installs for this app.");}
        }).show();
      return;
    }
    try{
      Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".fileprovider",file);
      Intent installer=new Intent(Intent.ACTION_VIEW);
      installer.setDataAndType(uri,"application/vnd.android.package-archive");
      installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
      activity.startActivity(installer);
    }catch(Exception e){notify(activity,"Couldn't open Android installer: "+e.getMessage());}
  }
}
