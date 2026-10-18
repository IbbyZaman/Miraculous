package uk.co.miraculoushub.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import com.bumptech.glide.Glide;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;

public class MainActivity extends Activity {
 private static final String HOST="https://video.miraculoushub.co.uk";
 private static final String CATALOG="https://upload.miraculoushub.co.uk/catalog";
 private static final String POSTER="https://miraculoushub.co.uk/main-season7-poster.png";
 private static final int BG=0xff090b12, PANEL=0xff171c28, PINK=0xffff376f, MUTED=0xffb3bdcf;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final ArrayList<JSONObject> bundled=new ArrayList<>(), episodes=new ArrayList<>(), trailers=new ArrayList<>();
 private LinearLayout menu, content;
 private TextView networkStatus;
 private ScrollView mainScroll;
 private String page="Home", selectedAnime="";
 private int selectedSeason=7;
 private boolean updating=false;
 private String catalogError="";
 private long lastUpdateCheck=0;

 @Override public void onCreate(Bundle saved){
   super.onCreate(saved);immersive();loadBundled();render();refresh();checkAppUpdates();
 }
 private void immersive(){getWindow().getDecorView().setSystemUiVisibility(
   View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|
   View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
 }
 private int dp(float n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
 private GradientDrawable bg(int color,int r){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(r));return d;}
 private GradientDrawable blend(int start,int end,int r){
   GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{start,end});d.setCornerRadius(dp(r));return d;
 }
 private TextView text(String val,int size,boolean bold,int color){
   TextView v=new TextView(this);v.setText(val);v.setTextSize(size);v.setTextColor(color);
   if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return v;
 }
 private TextView text(String val,int size,boolean bold){return text(val,size,bold,-1);}
 private LinearLayout vertical(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
 private void space(LinearLayout parent,int n){View v=new View(this);parent.addView(v,new LinearLayout.LayoutParams(dp(1),dp(n)));}
 private void artwork(ImageView view,String url){
   view.setBackground(blend(0xff38263f,0xff151923,13));
   if(url!=null&&url.startsWith("https://"))Glide.with(this).load(url).centerCrop().into(view);
 }
 private void loadBundled(){
   try(InputStream in=getAssets().open("episodes.json")){
     ByteArrayOutputStream data=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
     while((n=in.read(buffer))!=-1)data.write(buffer,0,n);
     JSONArray all=new JSONArray(data.toString("UTF-8"));
     for(int i=0;i<all.length();i++){JSONObject item=all.optJSONObject(i);if(item!=null)bundled.add(item);}
     episodes.addAll(bundled);
   }catch(Exception e){android.util.Log.e("MiraculousTV","Missing bundled catalogue",e);}
 }
 private void refresh(){
   if(updating)return;updating=true;
   new Thread(()->{
     try{
       HttpURLConnection conn=(HttpURLConnection)new URL(CATALOG).openConnection();
       conn.setConnectTimeout(9000);conn.setReadTimeout(9000);conn.setRequestProperty("Accept","application/json");
       if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
       ByteArrayOutputStream out=new ByteArrayOutputStream();
       try(InputStream in=conn.getInputStream()){
         byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){
           if(out.size()+n>2000000)throw new IOException("Catalogue too large");
           out.write(b,0,n);
         }
       }finally{conn.disconnect();}
       JSONArray entries=new JSONObject(out.toString("UTF-8")).getJSONArray("entries");
       LinkedHashMap<String,JSONObject> map=new LinkedHashMap<>();
       for(JSONObject row:bundled)map.put(row.optString("code"),row);
       ArrayList<JSONObject> ts=new ArrayList<>();
       for(int i=0;i<entries.length();i++){
         JSONObject row=entries.optJSONObject(i);if(row==null)continue;
         if("trailer".equals(row.optString("kind"))){
           if(row.optString("id").matches("[a-z0-9][a-z0-9-]{0,79}"))ts.add(row);
           continue;
         }
         if(!"episode".equals(row.optString("kind")))continue;
         int season=row.optInt("season"),ep=row.optInt("episode");
         if(season<1||season>7||ep<1||ep>99)continue;
         String code=String.format(Locale.US,"S%02dE%02d",season,ep);
         if(!row.optBoolean("available",true)){map.remove(code);continue;}
         JSONObject copy=new JSONObject(row.toString());copy.put("code",code);
         copy.put("videoPath","/video/"+code.toLowerCase(Locale.US));map.put(code,copy);
       }
       ArrayList<JSONObject> updated=new ArrayList<>(map.values());
       updated.sort((a,b)->{
         int s=Integer.compare(a.optInt("season"),b.optInt("season"));
         return s!=0?s:Integer.compare(a.optInt("episode"),b.optInt("episode"));
       });
       handler.post(()->{
         catalogError="";updating=false;episodes.clear();episodes.addAll(updated);
         trailers.clear();trailers.addAll(ts);
         render();if(networkStatus!=null)networkStatus.setText("● LIBRARY UPDATED");
       });
     }catch(Exception e){
       handler.post(()->{
         updating=false;catalogError=e.getMessage()==null?"Network unavailable":e.getMessage();
         if(networkStatus!=null)networkStatus.setText("● OFFLINE  •  RETRY TO SYNC");
       });
     }
   }).start();
 }
 private void render(){
   LinearLayout shell=new LinearLayout(this);shell.setOrientation(LinearLayout.HORIZONTAL);shell.setBackgroundColor(BG);setContentView(shell);
   menu=vertical();menu.setBackground(blend(0xff191c2a,0xff0a0d16,0));menu.setPadding(dp(17),dp(25),dp(12),dp(14));
   shell.addView(menu,new LinearLayout.LayoutParams(dp(220),-1));
   TextView mark=text("M",43,true,PINK);mark.setTypeface(Typeface.SERIF,Typeface.BOLD);
   menu.addView(mark);TextView brand=text("MIRACULOUS",17,true);menu.addView(brand);
   TextView small=text("HUB  •  TV",14,true,PINK);menu.addView(small);space(menu,32);
   for(String[] entry:new String[][]{{"⌂","Home"},{"▦","Episodes"},{"✦","Anime"},{"▷","Trailers"},{"◷","Continue"},{"↻","Refresh"}}){
     TextView nav=text(entry[0]+"    "+entry[1],18,true);
     nav.setGravity(Gravity.CENTER_VERTICAL);nav.setPadding(dp(15),0,dp(8),0);
     nav.setFocusable(true);nav.setClickable(true);
     boolean selected=entry[1].equals(page)||("Episodes".equals(entry[1])&&"Seasons".equals(page));
     nav.setTextColor(selected?Color.WHITE:MUTED);
     nav.setBackground(bg(selected?0xff743046:0x00000000,12));
     LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-1,dp(53));np.bottomMargin=dp(7);menu.addView(nav,np);
     nav.setOnFocusChangeListener((v,focused)->{
       nav.setBackground(bg(focused?PINK:selected?0xff743046:0x00000000,12));
       nav.setTextColor(focused||selected?Color.WHITE:MUTED);
       nav.animate().scaleX(focused?1.04f:1).scaleY(focused?1.04f:1).setDuration(120).start();
     });
     nav.setOnClickListener(v->{
       if(entry[1].equals("Refresh")){refresh();Toast.makeText(this,"Checking for new episodes…",Toast.LENGTH_SHORT).show();}
       else {page=entry[1];if(!"Anime".equals(page))selectedAnime="";render();}
     });
   }
   space(menu,10);
   networkStatus=text(catalogError.isEmpty()?"● CONNECTED LIBRARY":"● OFFLINE LIBRARY",12,false,MUTED);menu.addView(networkStatus);
   TextView version=text("TV  •  BUILD "+BuildConfig.VERSION_CODE,11,false,0xff8592a7);space(menu,15);menu.addView(version);
   TextView check=text("CHECK FOR APP UPDATE ↗",11,true,0xffff96b5);
   check.setFocusable(true);check.setPadding(dp(5),dp(12),0,dp(12));menu.addView(check);
   check.setOnClickListener(v->checkAppUpdates(true));
   mainScroll=new ScrollView(this);mainScroll.setFillViewport(true);mainScroll.setVerticalScrollBarEnabled(false);
   shell.addView(mainScroll,new LinearLayout.LayoutParams(0,-1,1));
   content=vertical();content.setPadding(dp(36),dp(24),dp(32),dp(50));mainScroll.addView(content);
   if("Home".equals(page))home();else if("Episodes".equals(page))allEpisodes();
   else if("Anime".equals(page))anime();else if("Trailers".equals(page))trailers();
   else if("Continue".equals(page))continueWatching();
   else home();
   immersive();
 }
 private void title(String heading,String subtitle){
   TextView h=text(heading,33,true);content.addView(h);
   if(subtitle!=null){TextView s=text(subtitle,15,false,MUTED);space(content,7);content.addView(s);}
 }
 private void home(){
   FrameLayout hero=new FrameLayout(this);hero.setBackground(blend(0xff4f1c45,0xff0a0c15,22));hero.setClipToOutline(true);
   LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(310));content.addView(hero,hp);
   ImageView poster=new ImageView(this);poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
   hero.addView(poster,new FrameLayout.LayoutParams(-1,-1));artwork(poster,POSTER);
   View shade=new View(this);
   shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{0xfb070a11,0xd3070a11,0x40070a11,0x00070a11}));
   hero.addView(shade,new FrameLayout.LayoutParams(-1,-1));
   LinearLayout info=vertical();info.setPadding(dp(32),dp(28),dp(15),dp(27));
   FrameLayout.LayoutParams infoP=new FrameLayout.LayoutParams(dp(570),-1,Gravity.LEFT|Gravity.BOTTOM);hero.addView(info,infoP);
   TextView kicker=text("✦  FEATURED SERIES  •  SEASON 7",13,true,0xffff94b9);info.addView(kicker);
   space(info,20);TextView title=text("The Miraculous Universe",35,true);info.addView(title);
   space(info,8);TextView sub=text("Welcome to MiraculousHub. Explore seasons, new episodes and previews.",16,false,0xffd9d8e2);
   sub.setMaxLines(2);info.addView(sub);space(info,19);
   TextView action=text("▶  Explore Seasons",15,true);action.setGravity(Gravity.CENTER);action.setFocusable(true);
   action.setBackground(bg(PINK,12));LinearLayout.LayoutParams ap=new LinearLayout.LayoutParams(dp(216),dp(47));info.addView(action,ap);
   action.setOnFocusChangeListener((v,f)->focus(action,f,PINK,0xffa72d54));
   action.setOnClickListener(v->{page="Episodes";render();});
   space(content,25);
   rows("Recently added",new ArrayList<>(latest(16)));
   animeStrip();rows("Trailers & Previews",new ArrayList<>(trailers));
   for(int season=7;season>=4;season--)rows("Season "+season,bySeason(season));
 }
 private ArrayList<JSONObject> latest(int count){
   ArrayList<JSONObject> all=new ArrayList<>(episodes);Collections.reverse(all);
   if(all.size()>count)return new ArrayList<>(all.subList(0,count));return all;
 }
 private ArrayList<JSONObject> bySeason(int season){
   ArrayList<JSONObject> all=new ArrayList<>();
   for(JSONObject x:episodes)if(x.optInt("season")==season)all.add(x);
   return all;
 }
 private void allEpisodes(){
   title("Episode Library","Every season, in one place. Select an episode to start watching.");
   space(content,25);
   for(int season=7;season>=1;season--)rows("Season "+season,bySeason(season));
 }
 private void trailers(){
   title("Trailers & Previews","First looks and uploaded trailers on the big screen.");space(content,22);
   rows("Latest trailers",new ArrayList<>(trailers));
 }
 private void continueWatching(){
   title("Continue Watching","Pick up where you left off on this TV.");space(content,25);
   String url=getPreferences(0).getString("recentUrl",""),label=getPreferences(0).getString("recentTitle","");
   if(url.isEmpty()){content.addView(text("Watch an episode to save it to this device.",16,false,MUTED));return;}
   TextView item=text("▶   Resume  •  "+label,22,true);item.setPadding(dp(20),dp(22),dp(20),dp(22));
   item.setFocusable(true);item.setBackground(bg(PANEL,15));content.addView(item);
   item.setOnFocusChangeListener((v,f)->focus(item,f,PINK,PANEL));
   item.setOnClickListener(v->launch(url,label));
 }
 private void rows(String heading,ArrayList<JSONObject> items){
   TextView title=text(heading,22,true);content.addView(title);space(content,12);
   if(items.isEmpty()){
     TextView empty=text(catalogError.isEmpty()?"No uploads here yet.":"Live catalogue unavailable; retry after updating the uploader Worker.",14,false,MUTED);
     content.addView(empty);space(content,20);return;
   }
   HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);
   scroll.setClipChildren(false);scroll.setClipToPadding(false);content.addView(scroll);
   LinearLayout strip=new LinearLayout(this);strip.setPadding(dp(6),dp(7),dp(20),dp(10));strip.setClipChildren(false);strip.setClipToPadding(false);
   scroll.addView(strip);
   int max=Math.min(items.size(),52);
   for(int i=0;i<max;i++)strip.addView(episodeCard(items.get(i),scroll));
   space(content,24);
 }
 private View episodeCard(JSONObject item,HorizontalScrollView scroll){
   String title=item.optString("title","Episode"),code=item.optString("code","");
   boolean trailer="trailer".equals(item.optString("kind"));
   LinearLayout card=vertical();card.setBackground(bg(PANEL,14));card.setClipToOutline(true);
   card.setFocusable(true);card.setClickable(true);
   LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(242),dp(194));cp.rightMargin=dp(17);card.setLayoutParams(cp);
   FrameLayout art=new FrameLayout(this);card.addView(art,new LinearLayout.LayoutParams(-1,dp(130)));
   ImageView img=new ImageView(this);img.setScaleType(ImageView.ScaleType.CENTER_CROP);
   art.addView(img,new FrameLayout.LayoutParams(-1,-1));
   String thumb=item.optString("thumbnail","");
   if(thumb.isEmpty()&&item.optInt("season")==7)thumb=POSTER;
   artwork(img,thumb);
   TextView play=text("▶",17,true);play.setGravity(Gravity.CENTER);play.setBackground(bg(0xcc0a0f19,30));
   FrameLayout.LayoutParams playP=new FrameLayout.LayoutParams(dp(38),dp(38),Gravity.RIGHT|Gravity.BOTTOM);
   playP.setMargins(0,0,dp(9),dp(9));art.addView(play,playP);
   LinearLayout info=vertical();info.setPadding(dp(11),dp(5),dp(8),dp(8));card.addView(info);
   TextView name=text(title,15,true);name.setMaxLines(1);name.setEllipsize(TextUtils.TruncateAt.END);info.addView(name);
   TextView meta=text(trailer?"TRAILER":code,11,true,0xffff94b9);space(info,2);info.addView(meta);
   card.setOnFocusChangeListener((v,f)->{
     card.setBackground(bg(f?0xff912d55:PANEL,14));card.animate().scaleX(f?1.055f:1).scaleY(f?1.055f:1).setDuration(130).start();
     card.setElevation(f?dp(13):0);
     if(f)scroll.smoothScrollTo(Math.max(0,card.getLeft()-dp(32)),0);
   });
   card.setOnClickListener(v->{
     String url=trailer?HOST+"/video/trailer/"+item.optString("id"):HOST+item.optString("videoPath");
     if(!trailer)getPreferences(0).edit().putString("recentUrl",url).putString("recentTitle",title).apply();
     launch(url,title);
   });
   return card;
 }
 private String[][] shows(){return new String[][]{{"Death Note","death-note","37 episodes"},{"Attack on Titan","attack-on-titan","94 episodes"},{"Black Clover","black-clover","170 episodes"}};}
 private String cover(String slug){
   if("death-note".equals(slug))return "https://cdn.myanimelist.net/images/anime/1079/138100.jpg";
   if("attack-on-titan".equals(slug))return "https://cdn.myanimelist.net/images/anime/10/47347.jpg";
   return "https://cdn.myanimelist.net/images/anime/2/88336.jpg";
 }
 private void animeStrip(){
   TextView title=text("Monthly Anime",22,true);content.addView(title);space(content,13);
   HorizontalScrollView hs=new HorizontalScrollView(this);hs.setHorizontalScrollBarEnabled(false);content.addView(hs);
   LinearLayout strip=new LinearLayout(this);strip.setClipChildren(false);hs.addView(strip);
   for(String[] show:shows())strip.addView(animeCard(show,hs));
   space(content,25);
 }
 private View animeCard(String[] show,HorizontalScrollView scroll){
   FrameLayout card=new FrameLayout(this);card.setBackground(bg(PANEL,16));card.setClipToOutline(true);
   card.setFocusable(true);card.setClickable(true);
   LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(300),dp(174));p.rightMargin=dp(19);card.setLayoutParams(p);
   ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);
   card.addView(image,new FrameLayout.LayoutParams(-1,-1));artwork(image,cover(show[1]));
   View fade=new View(this);fade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x20030a12,0xf9070a10}));
   card.addView(fade,new FrameLayout.LayoutParams(-1,-1));
   LinearLayout info=vertical();info.setPadding(dp(15),0,dp(13),dp(13));
   card.addView(info,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));
   TextView tag=text("MONTHLY COLLECTION",11,true,0xffff8ab1);info.addView(tag);
   TextView title=text(show[0],22,true);info.addView(title);
   TextView count=text(show[2]+"    →",12,false,MUTED);info.addView(count);
   card.setOnFocusChangeListener((v,f)->{
     card.setElevation(f?dp(14):0);card.animate().scaleX(f?1.055f:1).scaleY(f?1.055f:1).setDuration(125).start();
     if(f)scroll.smoothScrollTo(Math.max(0,card.getLeft()-dp(32)),0);
   });
   card.setOnClickListener(v->{selectedAnime=show[1];page="Anime";render();});return card;
 }
 private void anime(){
   if(selectedAnime.isEmpty()){
     title("Monthly Anime","Explore Death Note, Attack on Titan and Black Clover.");space(content,25);animeStrip();return;
   }
   String name=selectedAnime.equals("death-note")?"Death Note":selectedAnime.equals("attack-on-titan")?"Attack on Titan":"Black Clover";
   TextView back=text("‹  All anime",16,true,0xffff8db0);back.setFocusable(true);content.addView(back);
   back.setOnClickListener(v->{selectedAnime="";render();});back.setOnFocusChangeListener((v,f)->back.setTextColor(f?Color.WHITE:0xffff8db0));
   space(content,14);title(name,"Select an episode to start playback.");space(content,22);
   int count=selectedAnime.equals("death-note")?37:selectedAnime.equals("attack-on-titan")?94:170;
   for(int start=1;start<=count;start+=24){
     ArrayList<JSONObject> batch=new ArrayList<>();
     for(int n=start;n<=Math.min(count,start+23);n++){
       try{
         JSONObject e=new JSONObject();e.put("title",name+" • Episode "+n);
         e.put("code","EP "+n);e.put("thumbnail",cover(selectedAnime));
         String no=String.format(Locale.US,selectedAnime.equals("black-clover")?"%03d":"%02d",n);
         e.put("videoPath","/video/anime/"+selectedAnime+"/e"+no);
         batch.add(e);
       }catch(Exception ignored){}
     }
     rows("Episodes "+start+"–"+Math.min(count,start+23),batch);
   }
 }
 private void focus(View item,boolean focused,int on,int off){
   item.setBackground(bg(focused?on:off,12));
   item.animate().scaleX(focused?1.045f:1).scaleY(focused?1.045f:1).setDuration(135).start();
 }
 private void launch(String url,String title){
   if(!url.startsWith("https://"))return;
   Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("url",url);intent.putExtra("title",title);
   startActivity(intent);
 }
 private void checkAppUpdates(){checkAppUpdates(false);}
 private void checkAppUpdates(boolean manual){
   lastUpdateCheck=System.currentTimeMillis();
   new Thread(()->{
     try{
       HttpURLConnection conn=(HttpURLConnection)new URL("https://api.github.com/repos/IbbyZaman/Miraculous/releases?per_page=50").openConnection();
       conn.setConnectTimeout(7000);conn.setReadTimeout(7000);conn.setRequestProperty("Accept","application/vnd.github+json");conn.setRequestProperty("User-Agent","MiraculousHub-TV");
       if(conn.getResponseCode()!=200){conn.disconnect();throw new IOException("Updates unavailable");}
       ByteArrayOutputStream out=new ByteArrayOutputStream();
       try(InputStream in=conn.getInputStream()){byte[] b=new byte[4096];int n;
         while((n=in.read(b))!=-1){if(out.size()+n>250000)break;out.write(b,0,n);}}
       conn.disconnect();
       int installed=getPackageManager().getPackageInfo(getPackageName(),0).versionCode;
       JSONArray releases=new JSONArray(out.toString("UTF-8"));
       for(int i=0;i<releases.length();i++){
         JSONObject rel=releases.optJSONObject(i);if(rel==null||rel.optBoolean("draft")||rel.optBoolean("prerelease"))continue;
         String tag=rel.optString("tag_name");if(!tag.matches("tv-build-[0-9]+"))continue;
         int version=Integer.parseInt(tag.substring(9));if(version<=installed)continue;
         JSONArray assets=rel.optJSONArray("assets");if(assets==null)continue;
         for(int j=0;j<assets.length();j++){
           JSONObject asset=assets.optJSONObject(j);if(asset==null)continue;
           String uri=asset.optString("browser_download_url");
           if(!"MiraculousHubTV.apk".equals(asset.optString("name"))||!uri.startsWith("https://github.com/"))continue;
           handler.post(()->new AlertDialog.Builder(this).setTitle("New MiraculousHub TV update")
              .setMessage("Build "+version+" is ready. Download the APK and confirm installation to update.")
              .setNegativeButton("Later",null)
              .setPositiveButton("Get update",(d,w)->startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(uri)))).show());
           return;
         }
       }
       if(manual)handler.post(()->Toast.makeText(this,"Your TV app is up to date.",Toast.LENGTH_LONG).show());
     }catch(Exception ex){
       if(manual)handler.post(()->Toast.makeText(this,"Couldn't check for app updates.",Toast.LENGTH_LONG).show());
     }
   }).start();
 }
 @Override public void onBackPressed(){
   if("Anime".equals(page)&&!selectedAnime.isEmpty()){selectedAnime="";render();}
   else if(!"Home".equals(page)){page="Home";render();}
   else super.onBackPressed();
 }
 @Override protected void onResume(){
   super.onResume();immersive();
   if(System.currentTimeMillis()-lastUpdateCheck>15*60*1000)checkAppUpdates();
   if("Continue".equals(page)&&content!=null)render();
 }
}
