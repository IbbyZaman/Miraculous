package uk.co.miraculoushub.phone;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainActivity extends Activity {
  private static final String HOST="https://video.miraculoushub.co.uk";
  private static final String CATALOG="https://upload.miraculoushub.co.uk/catalog";
  private final ArrayList<JSONObject> bundled=new ArrayList<>(), episodes=new ArrayList<>(), trailers=new ArrayList<>();
  private final Handler handler=new Handler(Looper.getMainLooper());
  private LinearLayout content, nav;
  private TextView status;
  private String tab="Home", query=""; private String selectedAnime="";
  private final int background=0xff05070c, surface=0xff151a27, accent=0xffff2f68;

  @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setStatusBarColor(background);getWindow().setNavigationBarColor(background);loadAssets();rebuild();refresh();checkUpdates();}
  private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
  private GradientDrawable bg(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
  private TextView text(String value,int size,boolean strong){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(-1);if(strong)v.setTypeface(null,Typeface.BOLD);return v;}
  private void loadAssets(){try(InputStream in=getAssets().open("episodes.json")){ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)bytes.write(b,0,n);JSONArray a=new JSONArray(bytes.toString("UTF-8"));for(int i=0;i<a.length();i++){JSONObject e=a.optJSONObject(i);if(e!=null)bundled.add(e);}episodes.addAll(bundled);}catch(Exception ignored){}}
  private void refresh(){new Thread(()->{try{
    HttpURLConnection conn=(HttpURLConnection)new URL(CATALOG).openConnection();conn.setConnectTimeout(10000);conn.setReadTimeout(10000);conn.setRequestProperty("Accept","application/json");
    if(conn.getResponseCode()!=200)throw new IOException("Catalogue HTTP "+conn.getResponseCode());
    ByteArrayOutputStream buf=new ByteArrayOutputStream();try(InputStream in=conn.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(buf.size()+n>2_000_000)throw new IOException("Catalogue too large");buf.write(b,0,n);}}finally{conn.disconnect();}
    JSONArray entries=new JSONObject(buf.toString("UTF-8")).getJSONArray("entries");
    LinkedHashMap<String,JSONObject> map=new LinkedHashMap<>();for(JSONObject e:bundled)map.put(e.optString("code"),e);
    ArrayList<JSONObject> freshTrailers=new ArrayList<>();
    for(int i=0;i<entries.length();i++){JSONObject e=entries.optJSONObject(i);if(e==null)continue;String kind=e.optString("kind");
      if("trailer".equals(kind)){if(e.optString("id").matches("[a-z0-9][a-z0-9-]{0,79}"))freshTrailers.add(e);continue;}
      if(!"episode".equals(kind))continue;int season=e.optInt("season"),episode=e.optInt("episode");if(season<1||season>7||episode<1||episode>99)continue;
      String code=String.format(Locale.US,"S%02dE%02d",season,episode);
      if(!e.optBoolean("available",true)){map.remove(code);continue;}
      JSONObject copy=new JSONObject(e.toString());copy.put("code",code);copy.put("videoPath","/video/"+code.toLowerCase(Locale.US));map.put(code,copy);
    }
    ArrayList<JSONObject> all=new ArrayList<>(map.values());all.sort((a,b)->{int s=Integer.compare(a.optInt("season"),b.optInt("season"));return s!=0?s:Integer.compare(a.optInt("episode"),b.optInt("episode"));});
    handler.post(()->{episodes.clear();episodes.addAll(all);trailers.clear();trailers.addAll(freshTrailers);rebuild();if(status!=null)status.setText("Catalogue updated");});
  }catch(Exception ex){handler.post(()->{if(status!=null)status.setText("Using saved catalogue • Tap refresh to retry");});}}).start();}
  private void rebuild(){
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(background);setContentView(root);
    LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(18),dp(14),dp(12),dp(14));header.setBackground(bg(0xff121722,22));LinearLayout.LayoutParams headParams=new LinearLayout.LayoutParams(-1,-2);headParams.setMargins(dp(12),dp(8),dp(12),dp(5));root.addView(header,headParams);
    TextView logo=text("M  MIRACULOUS HUB",17,true);logo.setTextColor(accent);header.addView(logo,new LinearLayout.LayoutParams(0,-2,1));
    TextView sync=text("⟳",28,true);sync.setGravity(Gravity.CENTER);sync.setContentDescription("Refresh episodes");sync.setOnClickListener(v->{status.setText("Refreshing…");refresh();});header.addView(sync,new LinearLayout.LayoutParams(dp(50),dp(44)));
    ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(18),dp(8),dp(18),dp(28));scroll.addView(content);
    status=text("STREAMING COLLECTION  •  YOUR WATCH SPACE",10,true);status.setTextColor(0xffb9a9c3);content.addView(status);
    TextView heading=text("Home".equals(tab)?"Welcome back":"Anime".equals(tab)?"Monthly Animes":tab,27,true);LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(-1,-2);titleParams.topMargin=dp(16);content.addView(heading,titleParams);
    if("Search".equals(tab)){TextView account=text("My account   →",16,true);account.setTextColor(accent);account.setPadding(0,dp(8),0,dp(20));content.addView(account);account.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));EditText search=new EditText(this);search.setSingleLine(true);search.setTextColor(-1);search.setHintTextColor(0xffa6a0b4);search.setHint("Search episode titles");search.setText(query);search.setBackground(bg(surface,12));search.setPadding(dp(14),dp(12),dp(14),dp(12));content.addView(search);search.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){query=s.toString();drawSearchResults();}public void afterTextChanged(android.text.Editable e){}});resultsHolder=new LinearLayout(this);resultsHolder.setOrientation(LinearLayout.VERTICAL);content.addView(resultsHolder);drawSearchResults();}
    else if("Continue".equals(tab)){String recent=getPreferences(0).getString("recent","");ArrayList<JSONObject> matches=new ArrayList<>();for(JSONObject e:episodes)if(recent.equals(e.optString("code")))matches.add(e);row("Continue watching",matches);}
    else if("Trailers".equals(tab)){row("Trailers & previews",trailers);}
    else if("Anime".equals(tab)){animePage();}
    else if("Seasons".equals(tab)){for(int season=7;season>=1;season--){ArrayList<JSONObject> items=new ArrayList<>();for(JSONObject e:episodes)if(e.optInt("season")==season)items.add(e);if(!items.isEmpty())row("Season "+season,items);}}
    else{
      FrameLayout hero=new FrameLayout(this);
      hero.setBackground(bg(0xff48233f,22));hero.setClipToOutline(true);
      ImageView poster=new ImageView(this);poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
      hero.addView(poster,new FrameLayout.LayoutParams(-1,-1));
      loadImage(poster,"https://miraculoushub.co.uk/main-season7-poster.png");
      View shade=new View(this);shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x00230c26,0xdd160c1e,0xff0b0914}));
      hero.addView(shade,new FrameLayout.LayoutParams(-1,-1));
      TextView heroTitle=text("THE MIRACULOUS UNIVERSE\n\nWelcome to\nMiraculousHub\n\nSEASON 7   •   EXPLORE →",21,true);
      heroTitle.setGravity(Gravity.BOTTOM);heroTitle.setPadding(dp(20),dp(14),dp(20),dp(22));
      hero.addView(heroTitle,new FrameLayout.LayoutParams(-1,-1));
      hero.setOnClickListener(v->{tab="Seasons";rebuild();});
      LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(250));hp.topMargin=dp(18);content.addView(hero,hp);
      ArrayList<JSONObject> latest=new ArrayList<>(episodes);Collections.reverse(latest);
      row("Latest episodes",new ArrayList<>(latest.subList(0,Math.min(14,latest.size()))));
      animeShelf();
      row("Trailers & previews",trailers);
      TextView accountLink=text("◉   My account  →",15,true);accountLink.setTextColor(0xfff8f9ff);accountLink.setPadding(dp(17),dp(20),dp(17),dp(20));accountLink.setBackground(bg(0xff1a2030,16));LinearLayout.LayoutParams ap=new LinearLayout.LayoutParams(-1,-2);ap.topMargin=dp(24);content.addView(accountLink,ap);accountLink.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));
    }
    nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER);nav.setPadding(dp(10),dp(5),dp(10),dp(7));nav.setBackgroundColor(0xff101420);root.addView(nav);
    for(String name:new String[]{"Home","Seasons","Anime","Search"}){
      String glyph="Home".equals(name)?"⌂":"Seasons".equals(name)?"▦":"Anime".equals(name)?"✦":"⌕";
      LinearLayout cell=new LinearLayout(this);cell.setOrientation(LinearLayout.VERTICAL);cell.setGravity(Gravity.CENTER);
      cell.setPadding(dp(2),dp(6),dp(2),dp(7));
      TextView symbol=text(glyph,24,true);symbol.setGravity(Gravity.CENTER);symbol.setTextColor(name.equals(tab)?accent:0xffabb2c5);cell.addView(symbol);
      TextView label=text(name,11,name.equals(tab));label.setGravity(Gravity.CENTER);label.setTextColor(name.equals(tab)?-1:0xffabb2c5);cell.addView(label);
      cell.setOnClickListener(v->{tab=name;rebuild();});nav.addView(cell,new LinearLayout.LayoutParams(0,dp(63),1));
    }
  }
  private LinearLayout resultsHolder;
  private void drawSearchResults(){if(resultsHolder==null)return;resultsHolder.removeAllViews();String q=query.toLowerCase(Locale.ROOT).trim();if(q.isEmpty())return;int count=0;for(JSONObject e:episodes){if(e.optString("title").toLowerCase(Locale.ROOT).contains(q)||e.optString("code").toLowerCase(Locale.ROOT).contains(q)){card(resultsHolder,e);if(++count>=60)break;}}if(count==0)resultsHolder.addView(text("No matching episodes",15,false));}
  private void row(String heading,ArrayList<JSONObject> data){TextView title=text(heading,19,true);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(24);p.bottomMargin=dp(10);content.addView(title,p);if(data.isEmpty()){TextView empty=text("No uploads yet • Pull down or tap refresh",14,false);empty.setTextColor(0xffaaa1b5);content.addView(empty);return;}HorizontalScrollView rail=new HorizontalScrollView(this);rail.setHorizontalScrollBarEnabled(false);content.addView(rail);LinearLayout items=new LinearLayout(this);items.setOrientation(LinearLayout.HORIZONTAL);rail.addView(items);int max=Math.min(data.size(),36);for(int i=0;i<max;i++)card(items,data.get(i));}
  private void card(LinearLayout parent,JSONObject e){String code=e.optString("code"),name=e.optString("title","Episode");boolean trailer="trailer".equals(e.optString("kind"));
    LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setPadding(dp(12),dp(12),dp(12),dp(14));item.setBackground(bg(surface,18));item.setElevation(dp(2));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(246),dp(294));lp.rightMargin=dp(12);parent.addView(item,lp);
    ImageView cover=new ImageView(this);cover.setScaleType(ImageView.ScaleType.CENTER_CROP);cover.setBackground(bg(0xff44314f,14));item.addView(cover,new LinearLayout.LayoutParams(-1,dp(168)));loadImage(cover,e.optString("thumbnail"));
    TextView eyebrow=text(trailer?"▶  EXCLUSIVE TRAILER":"●  "+code,12,true);eyebrow.setTextColor(accent);item.addView(eyebrow);TextView label=text(name,16,true);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(5);item.addView(label,p);TextView play=text(trailer?"Watch trailer   →":"Watch now   →",12,true);play.setTextColor(0xffeec3d8);LinearLayout.LayoutParams playParams=new LinearLayout.LayoutParams(-1,-2);playParams.topMargin=dp(6);item.addView(play,playParams);
    item.setOnClickListener(v->{String url=trailer?HOST+"/video/trailer/"+e.optString("id"):HOST+e.optString("videoPath");if(!trailer)getPreferences(0).edit().putString("recent",code).apply();Intent playbackIntent=new Intent(this,PlayerActivity.class);playbackIntent.putExtra("url",url);playbackIntent.putExtra("title",name);startActivity(playbackIntent);});
  }
  private void loadImage(ImageView image,String value){
    if(value==null||!value.startsWith("https://"))return;
    new Thread(()->{try{
      HttpURLConnection c=(HttpURLConnection)new URL(value).openConnection();
      c.setConnectTimeout(5000);c.setReadTimeout(5000);
      if(c.getResponseCode()!=200){c.disconnect();return;}
      ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){
        byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>600000)break;out.write(b,0,n);}
      }c.disconnect();byte[] data=out.toByteArray();
      android.graphics.Bitmap bitmap=android.graphics.BitmapFactory.decodeByteArray(data,0,data.length);
      if(bitmap!=null)handler.post(()->image.setImageBitmap(bitmap));
    }catch(Exception ignored){} }).start();
  }
  private void animeShelf(){
    TextView title=text("MONTHLY ANIMES",13,true);title.setTextColor(accent);
    LinearLayout.LayoutParams m=new LinearLayout.LayoutParams(-1,-2);m.topMargin=dp(26);content.addView(title,m);
    LinearLayout rail=new LinearLayout(this);rail.setOrientation(LinearLayout.VERTICAL);
    content.addView(rail);
    for(String[] show:new String[][]{{"Death Note","death-note"},{"Attack on Titan","attack-on-titan"},{"Black Clover","black-clover"}}){
      TextView card=text("✦    "+show[0]+"     →",18,true);card.setGravity(Gravity.CENTER);card.setBackground(bg(surface,15));
      LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(82));lp.setMargins(0,dp(10),0,0);rail.addView(card,lp);
      card.setOnClickListener(v->{selectedAnime=show[1];tab="Anime";rebuild();});
    }
  }
  private void animePage(){
    if(selectedAnime.isEmpty()){animeShelf();return;}
    String label=selectedAnime.equals("death-note")?"Death Note":selectedAnime.equals("attack-on-titan")?"Attack on Titan":"Black Clover";
    TextView switcher=text("‹  All monthly animes",16,true);switcher.setTextColor(accent);switcher.setPadding(0,dp(12),0,dp(20));
    content.addView(switcher);switcher.setOnClickListener(v->{selectedAnime="";rebuild();});
    int count=selectedAnime.equals("death-note")?37:selectedAnime.equals("attack-on-titan")?94:170;
    TextView heading=text(label+" • "+count+" episodes",19,true);content.addView(heading);
    // These are website-configured paths; unavailable R2 uploads show the player's error.
    for(int start=1;start<=count;start+=20){
      ArrayList<JSONObject> batch=new ArrayList<>();
      for(int n=start;n<=Math.min(count,start+19);n++){try{
        JSONObject e=new JSONObject();e.put("title",label+" — Episode "+n);
        e.put("code","EP "+n);e.put("videoPath","/video/anime/"+selectedAnime+"/e"+(selectedAnime.equals("black-clover")?String.format(Locale.US,"%03d",n):String.format(Locale.US,"%02d",n)));
        batch.add(e);
      }catch(Exception ignored){}}
      row("Episodes "+start+"–"+Math.min(count,start+19),batch);
    }
  }
  private void checkUpdates(){
    new Thread(()->{try{
      URL u=new URL("https://api.github.com/repos/IbbyZaman/Miraculous/releases?per_page=15");
      HttpURLConnection c=(HttpURLConnection)u.openConnection();
      c.setConnectTimeout(7000);c.setReadTimeout(7000);
      c.setRequestProperty("Accept","application/vnd.github+json");
      c.setRequestProperty("User-Agent","MiraculousHub-Android");
      if(c.getResponseCode()!=200){c.disconnect();return;}
      ByteArrayOutputStream out=new ByteArrayOutputStream();
      try(InputStream in=c.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1 && out.size()<130000)out.write(b,0,n);}
      c.disconnect();
      JSONArray releases=new JSONArray(out.toString("UTF-8"));
      int installed=getPackageManager().getPackageInfo(getPackageName(),0).versionCode;
      for(int i=0;i<releases.length();i++){
        JSONObject release=releases.optJSONObject(i);if(release==null||release.optBoolean("draft")||release.optBoolean("prerelease"))continue;
        String tag=release.optString("tag_name");
        if(!tag.matches("phone-build-[0-9]+"))continue;
        int remote=Integer.parseInt(tag.substring("phone-build-".length()));
        if(remote<=installed)break;
        JSONArray assets=release.optJSONArray("assets");if(assets==null)continue;
        for(int j=0;j<assets.length();j++){
          JSONObject asset=assets.optJSONObject(j);if(asset==null)continue;
          String url=asset.optString("browser_download_url");
          if(!asset.optString("name").equals("MiraculousHubPhone.apk")||!url.startsWith("https://github.com/"))continue;
          handler.post(()->new android.app.AlertDialog.Builder(this)
            .setTitle("MiraculousHub update available")
            .setMessage("A new phone app version is ready. Download it and confirm installation to update.")
            .setNegativeButton("Later",null)
            .setPositiveButton("Get update",(d,w)->startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(url))))
            .show());
          return;
        }
      }
    }catch(Exception ignored){} }).start();
  }
  @Override protected void onResume(){super.onResume();if(content!=null&&"Continue".equals(tab))rebuild();}
}
