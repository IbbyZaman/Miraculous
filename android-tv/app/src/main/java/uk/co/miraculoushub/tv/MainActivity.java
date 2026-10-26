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
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.Query;
import com.google.firebase.firestore.Source;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;

public class MainActivity extends Activity {
 private static final String HOST="https://video.miraculoushub.co.uk";
 private static final String CATALOG="https://upload.miraculoushub.co.uk/catalog";
 private static final String POSTER="https://miraculoushub.co.uk/main-season7-poster.png";
 private static final int BG=0xff080808, PANEL=0xff181818, PINK=0xffe50914, MUTED=0xffb3b3b3;
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
 private long lastLibrarySync=0;
 private final Runnable liveRefresh=new Runnable(){@Override public void run(){refresh();handler.postDelayed(this,120000);}};

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
   if(url==null||url.isEmpty())return;
   String resolved=url.startsWith("https://")?url:"https://miraculoushub.co.uk/"+url.replaceFirst("^/","");
   if(resolved.startsWith("https://"))Glide.with(this).load(resolved).centerCrop().into(view);
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
 private String getText(String endpoint,int maxBytes) throws Exception {
   HttpURLConnection conn=(HttpURLConnection)new URL(endpoint).openConnection();
   conn.setConnectTimeout(8500);conn.setReadTimeout(8500);
   conn.setRequestProperty("Accept","application/json, text/javascript");
   conn.setRequestProperty("Cache-Control","no-cache");
   conn.setRequestProperty("User-Agent","MiraculousHubTV/1.0");
   if(conn.getResponseCode()!=200){int code=conn.getResponseCode();conn.disconnect();throw new IOException("HTTP "+code);}
   ByteArrayOutputStream out=new ByteArrayOutputStream();
   try(InputStream in=conn.getInputStream()){
     byte[] b=new byte[8192];int n;
     while((n=in.read(b))!=-1){
       if(out.size()+n>maxBytes)throw new IOException("Response too large");
       out.write(b,0,n);
     }
   }finally{conn.disconnect();}
   return out.toString("UTF-8");
 }
 private void refresh(){
   if(updating)return;updating=true;lastLibrarySync=System.currentTimeMillis();
   new Thread(()->{
     LinkedHashMap<String,JSONObject> map=new LinkedHashMap<>();
     for(JSONObject row:bundled)map.put(row.optString("code"),row);
     String failure="";
     ArrayList<JSONObject> ts=new ArrayList<>();
     try{
       // Fetch the site's own catalogue first: the APK's bundled fallback can get old.
       String script=getText("https://miraculoushub.co.uk/data.js",1400000);
       int marker=script.indexOf("window.MH_EPISODES"),open=script.indexOf('[',marker);
       int close=script.indexOf("];",open);
       if(marker<0||open<0||close<0)throw new IOException("Website episode data not found");
       JSONArray site=new JSONArray(script.substring(open,close+1));
       LinkedHashMap<String,JSONObject> fromWebsite=new LinkedHashMap<>();
       for(int i=0;i<site.length();i++){
         JSONObject row=site.optJSONObject(i);if(row==null)continue;
         int season=row.optInt("season"),ep=row.optInt("episode");
         if(season<1||season>7||ep<1||ep>99)continue;
         String code=String.format(Locale.US,"S%02dE%02d",season,ep);
         if(row.optBoolean("available",true))fromWebsite.put(code,row);
       }
       if(!fromWebsite.isEmpty())map=fromWebsite;
     }catch(Exception ex){failure="Website library: "+ex.getMessage();}
     try{
       // Same upload R2 catalog used by upload.html and catalog.js on the website.
       JSONArray rows=new JSONObject(getText(CATALOG,2000000)).getJSONArray("entries");
       for(int i=0;i<rows.length();i++){
         JSONObject row=rows.optJSONObject(i);if(row==null)continue;
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
         copy.put("videoPath","/video/"+code.toLowerCase(Locale.US));
         // Only the thumbnail explicitly saved in upload.html is applied.
         map.put(code,copy);
       }
     }catch(Exception ex){failure+=(failure.isEmpty()?"":" • ")+"Upload catalogue: "+ex.getMessage();}
     ArrayList<JSONObject> updated=new ArrayList<>(map.values());
     updated.sort((x,y)->{int c=Integer.compare(x.optInt("season"),y.optInt("season"));return c!=0?c:Integer.compare(x.optInt("episode"),y.optInt("episode"));});
     String problem=failure;
     handler.post(()->{
       updating=false;catalogError=problem;
       episodes.clear();episodes.addAll(updated);
       trailers.clear();trailers.addAll(ts);
       render();
       if(networkStatus!=null)networkStatus.setText(problem.isEmpty()?"● WEBSITE LIBRARY LIVE":"● WEBSITE SYNC PARTIAL");
     });
   }).start();
 }
 private void render(){
   LinearLayout shell=vertical();shell.setBackgroundColor(BG);setContentView(shell);
   LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);
   top.setPadding(dp(36),dp(9),dp(30),dp(9));top.setBackgroundColor(0xff101010);
   shell.addView(top,new LinearLayout.LayoutParams(-1,dp(70)));
   TextView brand=text("MIRACULOUS",25,true,PINK);
   top.addView(brand);TextView hub=text(" HUB",25,true,Color.WHITE);top.addView(hub);
   View gap=new View(this);top.addView(gap,new LinearLayout.LayoutParams(dp(35),dp(1)));
   for(String[] entry:new String[][]{{"Home","Home"},{"Series","Episodes"},{"Anime","Anime"},{"New & Upcoming","Upcoming"},{"Trailers","Trailers"},{"My List","Continue"}}){
     final String target=entry[1];
     TextView nav=text(entry[0],15,true,target.equals(page)?Color.WHITE:MUTED);
     nav.setGravity(Gravity.CENTER);nav.setFocusable(true);nav.setClickable(true);
     nav.setBackground(bg(target.equals(page)?0xff303030:0x00000000,10));
     LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-2,dp(45));np.rightMargin=dp(7);top.addView(nav,np);
     nav.setPadding(dp(13),0,dp(13),0);
     nav.setOnFocusChangeListener((v,f)->{
       nav.setBackground(bg(f?0xff454545:target.equals(page)?0xff303030:0x00000000,10));
       nav.setTextColor(f||target.equals(page)?Color.WHITE:MUTED);
       nav.animate().scaleX(f?1.06f:1).scaleY(f?1.06f:1).setDuration(120).start();
     });
     nav.setOnClickListener(v->{page=target;if(!"Anime".equals(page))selectedAnime="";render();});
   }
   View flex=new View(this);top.addView(flex,new LinearLayout.LayoutParams(0,dp(1),1));
   TextView account=text("●  "+(TvFirebase.auth(this).getCurrentUser()==null?"Sign in":"Account"),14,true);
   account.setGravity(Gravity.CENTER);account.setFocusable(true);account.setClickable(true);
   account.setPadding(dp(15),0,dp(15),0);account.setBackground(bg(PINK,9));
   top.addView(account,new LinearLayout.LayoutParams(-2,dp(42)));
   account.setOnFocusChangeListener((v,f)->focus(account,f,PINK,0xffa72d54));
   account.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));
   mainScroll=new ScrollView(this);mainScroll.setFillViewport(true);mainScroll.setVerticalScrollBarEnabled(false);
   shell.addView(mainScroll,new LinearLayout.LayoutParams(-1,0,1));
   content=vertical();content.setPadding(dp(38),dp(0),dp(38),dp(52));mainScroll.addView(content);
   networkStatus=null;
   if("Home".equals(page))home();else if("Episodes".equals(page))allEpisodes();
   else if("Upcoming".equals(page))upcoming();
   else if("Anime".equals(page))anime();else if("Trailers".equals(page))trailers();
   else if("Continue".equals(page))continueWatching();else home();
   immersive();
 }
 private void title(String heading,String subtitle){
   TextView h=text(heading,33,true);content.addView(h);
   if(subtitle!=null){TextView s=text(subtitle,15,false,MUTED);space(content,7);content.addView(s);}
 }
 private void home(){
   featuredHero();
   rows("New & Upcoming • Season 7",bySeason(7));
   TextView resume=text("Continue Watching  ›",23,true);resume.setFocusable(true);
   resume.setPadding(0,dp(10),0,dp(10));content.addView(resume);
   resume.setOnFocusChangeListener((v,f)->resume.setTextColor(f?PINK:Color.WHITE));
   resume.setOnClickListener(v->{page="Continue";render();});
   String recent=getPreferences(0).getString("recentTitle","");
   if(!recent.isEmpty()){
     TextView last=text("▶  Resume "+recent,16,true);
     last.setBackground(bg(PANEL,11));last.setPadding(dp(20),dp(18),dp(20),dp(18));
     last.setFocusable(true);content.addView(last);
     last.setOnFocusChangeListener((v,f)->focus(last,f,PINK,PANEL));
     last.setOnClickListener(v->{
       String url=getPreferences(0).getString("recentUrl","");
       if(url.startsWith("https://"))launch(url,recent);
     });
   }else{
     content.addView(text("Select Continue to see your synced watch history.",13,false,MUTED));
   }
   space(content,24);
   rows("Recently Added",latest(18));
   animeStrip();
   rows("Trailers & Previews",new ArrayList<>(trailers));
 }
 private void featuredHero(){
   FrameLayout hero=new FrameLayout(this);
   LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(350));hp.bottomMargin=dp(24);
   content.addView(hero,hp);
   ImageView backdrop=new ImageView(this);backdrop.setScaleType(ImageView.ScaleType.CENTER_CROP);
   hero.addView(backdrop,new FrameLayout.LayoutParams(-1,-1));artwork(backdrop,POSTER);
   View shade=new View(this);
   shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
     new int[]{0xff080808,0xf0080808,0x55080808,0x11080808}));
   hero.addView(shade,new FrameLayout.LayoutParams(-1,-1));
   View bottomShade=new View(this);
   bottomShade.setBackground(new GradientDrawable(GradientDrawable.Orientation.BOTTOM_TOP,
     new int[]{0xff080808,0x00080808}));
   hero.addView(bottomShade,new FrameLayout.LayoutParams(-1,-1));
   LinearLayout details=vertical();details.setPadding(dp(25),dp(40),dp(20),dp(25));
   FrameLayout.LayoutParams detailParams=new FrameLayout.LayoutParams(dp(540),-2,Gravity.BOTTOM|Gravity.LEFT);
   hero.addView(details,detailParams);
   TextView eyebrow=text("MIRACULOUS HUB  •  FEATURED SERIES",13,true,0xffff7777);
   details.addView(eyebrow);space(details,11);
   TextView name=text("MIRACULOUS",48,true,Color.WHITE);details.addView(name);
   TextView subtitle=text("TALES OF LADYBUG & CAT NOIR",17,true,0xffdddddd);details.addView(subtitle);
   space(details,15);
   TextView description=text("Explore every season, pick up where you left off and discover the latest adventures.",16,false,0xffe4e4e4);
   description.setMaxLines(3);details.addView(description);space(details,19);
   LinearLayout buttons=new LinearLayout(this);details.addView(buttons);
   TextView play=text("▶  Play Latest",17,true,0xff101010);
   play.setGravity(Gravity.CENTER);play.setBackground(bg(0xfff5f5f5,5));
   play.setPadding(dp(22),dp(12),dp(22),dp(12));play.setFocusable(true);
   buttons.addView(play);play.setOnFocusChangeListener((v,f)->focus(play,f,0xffcccccc,0xfff5f5f5));
   play.setOnClickListener(v->{ArrayList<JSONObject> available=latest(1);if(!available.isEmpty()){
     JSONObject e=available.get(0);launch(HOST+e.optString("videoPath"),e.optString("title","Episode"),e);
   }else{page="Episodes";render();}});
   TextView browse=text("  Browse Episodes  ",17,true,Color.WHITE);
   browse.setGravity(Gravity.CENTER);browse.setBackground(bg(0xff444444,5));browse.setFocusable(true);
   LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-2,-1);bp.leftMargin=dp(12);buttons.addView(browse,bp);
   browse.setOnFocusChangeListener((v,f)->focus(browse,f,0xff666666,0xff444444));
   browse.setOnClickListener(v->{page="Episodes";render();});
 }
 private void upcoming(){
   title("Upcoming Episodes","Season 7 episodes and the newest available releases.");
   space(content,18);
   rows("Season 7",bySeason(7));
   rows("Recently Added",latest(12));
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
   title("Continue Watching","Watch on one device. Resume on your TV, phone or website.");
   space(content,22);
   FirebaseUser account=TvFirebase.auth(this).getCurrentUser();
   if(account!=null){
     TextView syncing=text("LOADING YOUR FIREBASE WATCH HISTORY…",13,true,0xffff9dbe);
     content.addView(syncing);space(content,14);
     LinearLayout holder=vertical();content.addView(holder);
     TvFirebase.database(this).collection("users").document(account.getUid())
       .collection("playback").orderBy("updatedAt",Query.Direction.DESCENDING).limit(25)
       .get(Source.SERVER).addOnCompleteListener(this,result->{
         if(!"Continue".equals(page)||holder.getParent()==null)return;
         syncing.setVisibility(View.GONE);holder.removeAllViews();
         if(!result.isSuccessful()){
           holder.addView(text("Couldn't reach Firebase. Try again or use the device history below.",16,false,MUTED));
           return;
         }
         HorizontalScrollView scroller=new HorizontalScrollView(this);
         scroller.setHorizontalScrollBarEnabled(false);scroller.setClipChildren(false);
         LinearLayout rail=new LinearLayout(this);rail.setClipChildren(false);rail.setPadding(dp(5),dp(6),dp(10),dp(10));
         scroller.addView(rail);
         for(DocumentSnapshot snap:result.getResult().getDocuments()){
           JSONObject episode=findCloudEpisode(snap);
           if(episode!=null)rail.addView(episodeCard(episode,scroller));
         }
         if(rail.getChildCount()>0)holder.addView(scroller);
         else holder.addView(text("No account progress yet. Start a video on the website or your phone.",16,false,MUTED));
       });
   }else{
     TextView message=text("Sign in to sync your watch history across devices.",17,false,MUTED);
     content.addView(message);space(content,12);
     TextView button=text("Sign in or pair with QR code  →",18,true);
     button.setPadding(dp(19),dp(18),dp(19),dp(18));button.setFocusable(true);
     button.setBackground(bg(PANEL,14));content.addView(button);
     button.setOnFocusChangeListener((v,f)->focus(button,f,PINK,PANEL));
     button.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));
   }
   space(content,22);
   String url=getPreferences(0).getString("recentUrl",""),label=getPreferences(0).getString("recentTitle","");
   if(url.isEmpty())return;
   TextView last=text("On this device",19,true);content.addView(last);space(content,12);
   TextView item=text("▶   Resume  •  "+label,20,true);item.setPadding(dp(20),dp(22),dp(20),dp(22));
   item.setFocusable(true);item.setBackground(bg(PANEL,15));content.addView(item);
   item.setOnFocusChangeListener((v,f)->focus(item,f,PINK,PANEL));
   item.setOnClickListener(v->{
     Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("url",url);intent.putExtra("title",label);
     intent.putExtra("cloudKey",getPreferences(0).getString("recentKey",""));
     intent.putExtra("season",getPreferences(0).getInt("recentSeason",0));
     intent.putExtra("episode",getPreferences(0).getInt("recentEpisode",0));
     startActivity(intent);
   });
 }
 private JSONObject findCloudEpisode(DocumentSnapshot doc){
   String key=doc.getId(),title=doc.getString("title");
   try{
     if(key.matches("s[0-9]+e[0-9]+")){
       int delimiter=key.indexOf('e'),season=Integer.parseInt(key.substring(1,delimiter)),episode=Integer.parseInt(key.substring(delimiter+1));
       for(JSONObject e:episodes)if(e.optInt("season")==season&&e.optInt("episode")==episode)return e;
       JSONObject item=new JSONObject();
       String code=String.format(Locale.US,"S%02dE%02d",season,episode);
       item.put("season",season);item.put("episode",episode);item.put("code",code);
       item.put("title",title==null?"Episode "+episode:title);
       item.put("videoPath","/video/"+code.toLowerCase(Locale.US));return item;
     }
     if(key.matches("anime-[a-z0-9-]+-e[0-9]+")){
       int delimiter=key.lastIndexOf("-e");String slug=key.substring(6,delimiter);
       int episode=Integer.parseInt(key.substring(delimiter+2));
       JSONObject item=new JSONObject();item.put("title",title==null?"Anime episode "+episode:title);
       item.put("code","EP "+episode);item.put("thumbnail",cover(slug));
       item.put("videoPath","/video/anime/"+slug+"/e"+String.format(Locale.US,"black-clover".equals(slug)?"%03d":"%02d",episode));
       return item;
     }
   }catch(Exception ignored){}
   return null;
 }
 private void rows(String heading,ArrayList<JSONObject> items){
   TextView title=text(heading+"  ›",24,true);content.addView(title);space(content,14);
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
   LinearLayout card=vertical();card.setBackground(bg(PANEL,5));card.setClipToOutline(false);
   card.setFocusable(true);card.setClickable(true);
   LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(286),dp(215));cp.rightMargin=dp(17);card.setLayoutParams(cp);
   FrameLayout art=new FrameLayout(this);card.addView(art,new LinearLayout.LayoutParams(-1,dp(158)));
   ImageView img=new ImageView(this);img.setScaleType(ImageView.ScaleType.CENTER_CROP);
   art.addView(img,new FrameLayout.LayoutParams(-1,-1));
   String thumb=item.optString("thumbnail","");
   if(thumb.isEmpty()&&item.optInt("season")==7)thumb=POSTER;
   artwork(img,thumb);
   TextView play=text("▶",19,true);play.setGravity(Gravity.CENTER);play.setBackground(bg(0xcc0a0f19,30));
   FrameLayout.LayoutParams playP=new FrameLayout.LayoutParams(dp(38),dp(38),Gravity.RIGHT|Gravity.BOTTOM);
   playP.setMargins(0,0,dp(9),dp(9));art.addView(play,playP);
   LinearLayout info=vertical();info.setPadding(dp(11),dp(5),dp(8),dp(8));card.addView(info);
   TextView name=text(title,16,true);name.setMaxLines(1);name.setEllipsize(TextUtils.TruncateAt.END);info.addView(name);
   TextView meta=text(trailer?"TRAILER":code,11,true,MUTED);space(info,2);info.addView(meta);
   card.setOnFocusChangeListener((v,f)->{
     card.setBackground(bg(f?0xff333333:PANEL,5));card.animate().scaleX(f?1.09f:1).scaleY(f?1.09f:1).setDuration(160).start();
     card.setElevation(f?dp(13):0);
     if(f)scroll.smoothScrollTo(Math.max(0,card.getLeft()-dp(32)),0);
   });
   card.setOnClickListener(v->{
     String url=trailer?HOST+"/video/trailer/"+item.optString("id"):HOST+item.optString("videoPath");
     if(!trailer)getPreferences(0).edit().putString("recentUrl",url).putString("recentTitle",title)
       .putString("recentKey",cloudKeyForItem(item)).putInt("recentSeason",item.optInt("season"))
       .putInt("recentEpisode",item.optInt("episode")).apply();
     launch(url,title,item);
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
   TextView title=text("Popular Animes  ›",23,true);content.addView(title);space(content,13);
   HorizontalScrollView hs=new HorizontalScrollView(this);hs.setHorizontalScrollBarEnabled(false);content.addView(hs);
   LinearLayout strip=new LinearLayout(this);strip.setClipChildren(false);hs.addView(strip);
   for(String[] show:shows())strip.addView(animeCard(show,hs));
   space(content,25);
 }
 private View animeCard(String[] show,HorizontalScrollView scroll){
   FrameLayout card=new FrameLayout(this);card.setBackground(bg(PANEL,16));card.setClipToOutline(true);
   card.setFocusable(true);card.setClickable(true);
   LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(325),dp(179));p.rightMargin=dp(19);card.setLayoutParams(p);
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
 private String cloudKeyForItem(JSONObject item){
   int season=item.optInt("season"),episode=item.optInt("episode");
   if(season>0&&episode>0)return "s"+season+"e"+episode;
   String path=item.optString("videoPath","");
   if(path.startsWith("/video/anime/")){
     String[] parts=path.split("/");
     if(parts.length==5&&parts[4].matches("e[0-9]{1,3}")){
       try{return "anime-"+parts[3]+"-e"+Integer.parseInt(parts[4].substring(1));}
       catch(Exception ignored){}
     }
   }
   return "";
 }
 private void launch(String url,String title){launch(url,title,null);}
 private void launch(String url,String title,JSONObject item){
   if(!url.startsWith("https://"))return;
   Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("url",url);intent.putExtra("title",title);
   if(item!=null){
     int season=item.optInt("season"),episode=item.optInt("episode");
     String path=item.optString("videoPath");
     if(season>0&&episode>0)intent.putExtra("cloudKey","s"+season+"e"+episode);
     else if(path.startsWith("/video/anime/")){
       String[] parts=path.split("/");
       if(parts.length==5){String slug=parts[3],e=parts[4];try{
         int number=Integer.parseInt(e.substring(1));
         intent.putExtra("cloudKey","anime-"+slug+"-e"+number);
       }catch(Exception ignored){}}
     }
     intent.putExtra("season",season);intent.putExtra("episode",episode);
   }
   JSONArray library=new JSONArray();
   for(JSONObject e:episodes){int season=e.optInt("season"),episode=e.optInt("episode");String path=e.optString("videoPath","");
     if(season<=0||episode<=0||!path.startsWith("/video/"))continue;
     JSONObject row=new JSONObject();try{row.put("season",season);row.put("episode",episode);row.put("title",e.optString("title","Episode"));row.put("path",path);library.put(row);}catch(JSONException ignored){}
   }
   intent.putExtra("episodeLibrary",library.toString());
   startActivity(intent);
 }
 private void checkAppUpdates(){checkAppUpdates(false);}
 private void checkAppUpdates(boolean manual){
   lastUpdateCheck=System.currentTimeMillis();
   AppUpdater.check(this,manual);
 }
 @Override protected void onPause(){handler.removeCallbacks(liveRefresh);super.onPause();}
 @Override public void onBackPressed(){
   if("Anime".equals(page)&&!selectedAnime.isEmpty()){selectedAnime="";render();}
   else if(!"Home".equals(page)){page="Home";render();}
   else super.onBackPressed();
 }
 @Override protected void onResume(){
   super.onResume();immersive();AppUpdater.onResume(this);
   if(System.currentTimeMillis()-lastUpdateCheck>15*60*1000)checkAppUpdates();
   handler.removeCallbacks(liveRefresh);handler.postDelayed(liveRefresh,120000);
   if(System.currentTimeMillis()-lastLibrarySync>120000)refresh();
   if("Continue".equals(page)&&content!=null)render();
 }
}
