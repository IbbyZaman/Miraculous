package uk.co.miraculoushub.phone;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
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
  private static final String TYPE="phone";
  private static final String ASSET="MiraculousHubPhone.apk";
  private static final Handler main=new Handler(Looper.getMainLooper());
  private static final AtomicBoolean checking=new AtomicBoolean(false);
  private static boolean prompting=false;
  private static final String PREFS="miraculoushub-updates";
  private AppUpdater(){}

  private static class Release {
    final int version;final String url,hash;
    Release(int version,String url,String hash){this.version=version;this.url=url;this.hash=hash==null?"":hash.toLowerCase(Locale.US);}
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
      JSONObject site=new JSONObject(read(SITE+"/downloads/"+TYPE+".json",15000));
      String url=site.optString("url");
      int version=site.optInt("versionCode");
      String sha=site.optString("sha256");
      Uri parsed=Uri.parse(url);
      if(version>0&&"https".equals(parsed.getScheme())&&"miraculoushub.co.uk".equals(parsed.getHost())
        &&sha.matches("[a-fA-F0-9]{64}"))return new Release(version,url,sha);
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
  private static boolean trustedPackage(Activity activity,File file,int newer)throws Exception{
    PackageManager pm=activity.getPackageManager();
    int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
    PackageInfo incoming=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);
    PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),flags);
    if(incoming==null||!activity.getPackageName().equals(incoming.packageName))return false;
    long version=Build.VERSION.SDK_INT>=28?incoming.getLongVersionCode():incoming.versionCode;
    long old=Build.VERSION.SDK_INT>=28?installed.getLongVersionCode():installed.versionCode;
    if(version<=old||version!=newer)return false;
    Signature[] a=signers(incoming),b=signers(installed);
    if(a==null||b==null||a.length!=b.length||a.length==0)return false;
    // Current development builds are signed by one persistent signing key.
    return Arrays.equals(a,b);
  }
  private static void verifyAndPresent(Activity a,long id){
    try{
      android.content.SharedPreferences prefs=a.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
      File file=new File(prefs.getString("file",""));
      String expected=prefs.getString("sha256","");
      int version=prefs.getInt("version",0);
      if(!file.isFile()||file.length()<10000)throw new java.io.IOException("APK missing or incomplete");
      if(expected.matches("[a-f0-9]{64}")&&!MessageDigest.isEqual(
        expected.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
        sha256(file).getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
        throw new SecurityException("Download checksum did not match");
      if(!trustedPackage(a,file,version))
        throw new SecurityException("Signing certificate or package version doesn't match the installed app. Updates must use the same signing key.");
      main.post(()->{
        if(a.isFinishing()||a.isDestroyed())return;
        new AlertDialog.Builder(a)
          .setTitle("Update downloaded ✓")
          .setMessage("Build "+version+" is downloaded and verified. Install it over your current app? Android will ask for confirmation.")
          .setNegativeButton("Later",(d,w)->{
            a.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putBoolean("staged",false).apply();
          })
          .setPositiveButton("Install update",(d,w)->install(a,file))
          .show();
      });
    }catch(Exception e){
      clear(a);notify(a,"Update not installed: "+e.getMessage());
    }
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
