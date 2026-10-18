package uk.co.miraculoushub.phone;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.*;
import javax.crypto.KeyGenerator;

public class OfflineDownloadsActivity extends Activity {
  private static final String BASE="https://video.miraculoushub.co.uk";
  private static final String CATALOG="https://upload.miraculoushub.co.uk/catalog";
  private static final String KEY="MiraculousHubOfflineV1";
  private final Handler ui=new Handler(Looper.getMainLooper());
  private LinearLayout list;
  private TextView status;
  private final ArrayList<JSONObject> available=new ArrayList<>();
  private final ArrayList<String> filenames=new ArrayList<>();
  private int dp(int x){return (int)(x*getResources().getDisplayMetrics().density+.5f);}
  private TextView label(String s,int size){TextView t=new TextView(this);t.setText(s);t.setTextColor(-1);t.setTextSize(size);return t;}
  private File folder(){File f=new File(getFilesDir(),"offline-v1");if(!f.exists())f.mkdirs();return f;}
  private SecretKey key() throws Exception {
    KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
    if(store.containsAlias(KEY))return ((KeyStore.SecretKeyEntry)store.getEntry(KEY,null)).getSecretKey();
    KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(KEY,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256).build());return generator.generateKey();
  }
  @Override public void onCreate(Bundle b){super.onCreate(b);
    LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(0xff090b14);root.setPadding(dp(20),dp(22),dp(20),dp(12));setContentView(root);
    TextView title=label("✦  Offline Downloads",26);root.addView(title);
    TextView subtitle=label("Download episodes you have permission to save offline. Files are encrypted and kept inside the app.",13);
    subtitle.setTextColor(0xffb1bac9);root.addView(subtitle);
    LinearLayout buttons=new LinearLayout(this);root.addView(buttons);
    Button stored=new Button(this);stored.setText("My downloads");buttons.addView(stored,new LinearLayout.LayoutParams(0,dp(55),1));
    Button browse=new Button(this);browse.setText("Available");buttons.addView(browse,new LinearLayout.LayoutParams(0,dp(55),1));
    ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    list=new LinearLayout(this);list.setOrientation(1);scroll.addView(list);
    status=label("Open Available to browse downloadable episodes.",13);root.addView(status);
    stored.setOnClickListener(v->showSaved());browse.setOnClickListener(v->loadAvailable());showSaved();
  }
  private void message(String text){status.setText(text);}
  private Button item(String value,Runnable action){Button b=new Button(this);b.setAllCaps(false);b.setText(value);list.addView(b,new LinearLayout.LayoutParams(-1,dp(65)));b.setOnClickListener(v->action.run());return b;}
  private void showSaved(){list.removeAllViews();File[] files=folder().listFiles((d,n)->n.endsWith(".meta"));if(files==null||files.length==0){message("No offline videos yet.");return;}
    message(files.length+" saved download(s)");
    for(File meta:files){try{JSONObject data=new JSONObject(readText(meta));
      String id=data.optString("id"),name=data.optString("title","Episode");File encrypted=new File(folder(),id+".bin");
      if(!encrypted.exists())continue;
      item("▶  "+name,()->new AlertDialog.Builder(this).setTitle(name)
        .setItems(new String[]{"Play offline","Delete download"},(dialog,choice)->{if(choice==0)play(id,data);else{encrypted.delete();meta.delete();showSaved();}}).show());
    }catch(Exception ignored){}}
  }
  private static String readText(File f)throws Exception{try(InputStream in=new FileInputStream(f)){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))>=0)out.write(b,0,n);return out.toString("UTF-8");}}
  private void loadAvailable(){message("Loading episode catalogue…");list.removeAllViews();
    new Thread(()->{try{HttpURLConnection c=(HttpURLConnection)new URL(CATALOG).openConnection();c.setConnectTimeout(12000);c.setReadTimeout(12000);
      if(c.getResponseCode()!=200)throw new IOException("Catalogue unavailable");
      ByteArrayOutputStream out=new ByteArrayOutputStream();
      try(InputStream in=c.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>=0){if(out.size()+n>2000000)throw new IOException("Catalogue too large");out.write(b,0,n);}}finally{c.disconnect();}
      JSONArray rows=new JSONObject(out.toString("UTF-8")).getJSONArray("entries");ArrayList<JSONObject> permitted=new ArrayList<>();
      for(int i=0;i<rows.length();i++){JSONObject e=rows.optJSONObject(i);if(e!=null&&"episode".equals(e.optString("kind"))&&e.optBoolean("available",true))permitted.add(e);}
      ui.post(()->{list.removeAllViews();message(permitted.isEmpty()?"No downloadable episodes were found in the catalogue.":"Choose an episode to download.");
        for(JSONObject e:permitted){int season=e.optInt("season"),ep=e.optInt("episode");if(season<1||season>7||ep<1||ep>99)continue;
          String id=String.format(Locale.US,"s%02de%02d",season,ep),title=e.optString("title",id);
          item("⬇  "+title,()->download(id,title,season,ep));
        }
      });
    }catch(Exception error){ui.post(()->message("Could not load available videos: "+error.getMessage()));}}).start();
  }
  private void download(String id,String title,int season,int episode){if(!id.matches("s[0-9]{2}e[0-9]{2}"))return;
    message("Downloading securely: "+title);new Thread(()->{File tmp=new File(folder(),id+".partial");File dest=new File(folder(),id+".bin");
      try{SecretKey secret=key();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,secret);
        HttpURLConnection conn=(HttpURLConnection)new URL(BASE+"/video/"+id).openConnection();conn.setConnectTimeout(16000);conn.setReadTimeout(30000);
        if(conn.getResponseCode()!=200)throw new IOException("Video download unavailable: HTTP "+conn.getResponseCode());
        long size=conn.getContentLengthLong();if(size>800_000_000L)throw new IOException("Video too large for offline storage");
        try(InputStream in=conn.getInputStream();OutputStream raw=new FileOutputStream(tmp)){
          byte[] iv=cipher.getIV();raw.write(iv.length);raw.write(iv);
          try(CipherOutputStream encrypted=new CipherOutputStream(raw,cipher)){
            byte[] buf=new byte[32768];int n;long copied=0;
            while((n=in.read(buf))!=-1){copied+=n;if(copied>800_000_000L)throw new IOException("Offline storage limit reached");encrypted.write(buf,0,n);}
          }
        }finally{conn.disconnect();}
        if(dest.exists())dest.delete();if(!tmp.renameTo(dest))throw new IOException("Could not save encrypted download");
        JSONObject meta=new JSONObject();meta.put("id",id);meta.put("title",title);meta.put("season",season);meta.put("episode",episode);
        try(OutputStream out=new FileOutputStream(new File(folder(),id+".meta"))){out.write(meta.toString().getBytes("UTF-8"));}
        ui.post(()->{showSaved();message("Saved securely for offline viewing: "+title);});
      }catch(Exception error){tmp.delete();ui.post(()->message("Download failed: "+error.getMessage()));}
    }).start();
  }
  private void play(String id,JSONObject meta){message("Preparing offline playback…");
    new Thread(()->{File plain=new File(getCacheDir(),"offline-playback-"+id+".mp4");
      try{File encrypted=new File(folder(),id+".bin");SecretKey secret=key();
        try(InputStream raw=new FileInputStream(encrypted)){int n=raw.read();if(n<12||n>16)throw new IOException("Invalid encrypted download");byte[] iv=new byte[n];int offset=0;while(offset<n){int count=raw.read(iv,offset,n-offset);if(count<0)throw new EOFException();offset+=count;}
          Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,secret,new GCMParameterSpec(128,iv));
          try(InputStream input=new CipherInputStream(raw,cipher);OutputStream out=new FileOutputStream(plain)){
            byte[] buf=new byte[32768];int count;while((count=input.read(buf))!=-1)out.write(buf,0,count);
          }
        }
        ui.post(()->{Intent i=new Intent(this,PlayerActivity.class);i.putExtra("offlinePath",plain.getAbsolutePath());
          i.putExtra("title",meta.optString("title","Offline episode"));i.putExtra("season",meta.optInt("season"));i.putExtra("episode",meta.optInt("episode"));
          i.putExtra("cloudKey",meta.optString("id"));startActivity(i);message("Offline playback ready.");});
      }catch(Exception e){plain.delete();ui.post(()->message("Unable to play download: "+e.getMessage()));}
    }).start();
  }
}
