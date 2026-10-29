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
 private static final int BG=0xff08090d, PANEL=0xff17191f, PINK=0xffe50914, MUTED=0xffb8bac3;
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
   super.onCreate(saved);immersive();loadBundled();showStartupSplash();
 }
 private void showStartupSplash(){
   FrameLayout root=new FrameLayout(this);root.setBackgroundColor(0xff08090d);setContentView(root);
   ImageView heroes=new ImageView(this);heroes.setScaleType(ImageView.ScaleType.CENTER_CROP);
   root.addView(heroes,new FrameLayout.LayoutParams(-1,-1));
   Glide.with(this).load(POSTER).centerCrop().into(heroes);
   View shade=new View(this);shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
     new int[]{0x6608090d,0xff08090d}));root.addView(shade,new FrameLayout.LayoutParams(-1,-1));
   LinearLayout panel=vertical();panel.setGravity(Gravity.CENTER);panel.setPadding(dp(40),dp(30),dp(40),dp(30));
   root.addView(panel,new FrameLayout.LayoutParams(-1,-1));
   TextView logo=text("MIRACULOUS HUB",28,true,Color.WHITE);logo.setGravity(Gravity.CENTER);panel.addView(logo);
   space(panel,12);
   ProgressBar spinner=new ProgressBar(this);panel.addView(spinner,new LinearLayout.LayoutParams(dp(42),dp(42)));
   space(panel,12);
   TextView status=text("Connecting to MiraculousHub…",17,false,0xffe0e0e8);status.setGravity(Gravity.CENTER);panel.addView(status);
   TextView error=text("The MiraculousHub server could not be reached.",17,true,Color.WHITE);
   error.setGravity(Gravity.CENTER);error.setVisibility(View.GONE);panel.addView(error);
   TextView retry=text("↻  Restart / Try Again",16,true,Color.WHITE);retry.setGravity(Gravity.CENTER);
   retry.setPadding(dp(24),dp(14),dp(24),dp(14));retry.setBackground(bg(PINK,10));retry.setFocusable(true);retry.setVisibility(View.GONE);
   LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-2,-2);rp.topMargin=dp(18);panel.addView(retry,rp);
   retry.setOnClickListener(v->showStartupSplash());
   new Thread(()->{
     boolean online=false;String issue="Server is offline or not responding.";
     try{
       HttpURLConnection conn=(HttpURLConnection)new URL(HOST).openConnection();
       conn.setConnectTimeout(7000);conn.setReadTimeout(7000);conn.setRequestMethod("GET");
       int code=conn.getResponseCode();online=code>=200&&code<500;conn.disconnect();
       if(!online)issue="Server returned HTTP "+code+".";
     }catch(Exception ex){issue="Check your internet connection and try again.";}
     final boolean connected=online;final String message=issue;
     runOnUiThread(()->{
       if(isFinishing())return;
       if(connected){render();refresh();checkAppUpdates();}
       else{
         spinner.setVisibility(View.GONE);status.setText(message);error.setVisibility(View.VISIBLE);
         retry.setVisibility(View.VISIBLE);retry.requestFocus();
       }
     });
   }).start();
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
   top.setPadding(dp(54),dp(8),dp(54),dp(8));
   top.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{0xff08090d,0xff111218}));
   shell.addView(top,new LinearLayout.LayoutParams(-1,dp(82)));
   TextView brand=text("M",31,true,PINK);
   top.addView(brand);TextView hub=text("IRACULOUS",25,true,Color.WHITE);top.addView(hub);
   TextView hubLabel=text("HUB",11,true,0xffb7b7c0);hubLabel.setGravity(Gravity.BOTTOM);LinearLayout.LayoutParams hlp=new LinearLayout.LayoutParams(-2,dp(28));hlp.leftMargin=dp(4);top.addView(hubLabel,hlp);
   View gap=new View(this);top.addView(gap,new LinearLayout.LayoutParams(dp(35),dp(1)));
   for(String[] entry:new String[][]{{"Home","Home"},{"Series","Episodes"},{"Anime","Anime"},{"New & Upcoming","Upcoming"},{"Trailers","Trailers"},{"Live","Live"},{"My List","Continue"}}){
     final String target=entry[1];
     TextView nav=text(entry[0],16,target.equals(page),target.equals(page)?Color.WHITE:0xffc5c6ce);
     nav.setGravity(Gravity.CENTER);nav.setFocusable(true);nav.setClickable(true);
     nav.setBackground(bg(target.equals(page)?0xffe50914:0x00000000,5));
     LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-2,dp(47));np.rightMargin=dp(8);top.addView(nav,np);
     nav.setPadding(dp(15),0,dp(15),0);
     nav.setOnFocusChangeListener((v,f)->{
       nav.setBackground(bg(f?0xff34343b:target.equals(page)?0xffe50914:0x00000000,5));
       nav.setTextColor(f||target.equals(page)?Color.WHITE:MUTED);
       nav.animate().scaleX(f?1.06f:1).scaleY(f?1.06f:1).setDuration(120).start();
     });
     nav.setOnClickListener(v->{page=target;if(!"Anime".equals(page))selectedAnime="";render();});
   }
   View flex=new View(this);top.addView(flex,new LinearLayout.LayoutParams(0,dp(1),1));
   TextView account=text("●  "+(TvFirebase.auth(this).getCurrentUser()==null?"Sign in":"Account"),14,true);
   account.setGravity(Gravity.CENTER);account.setFocusable(true);account.setClickable(true);
   account.setPadding(dp(17),0,dp(17),0);account.setBackground(bg(0xff292a31,7));
   top.addView(account,new LinearLayout.LayoutParams(-2,dp(42)));
   account.setOnFocusChangeListener((v,f)->focus(account,f,PINK,0xffa72d54));
   account.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));
   mainScroll=new ScrollView(this);mainScroll.setFillViewport(true);mainScroll.setVerticalScrollBarEnabled(false);
   shell.addView(mainScroll,new LinearLayout.LayoutParams(-1,0,1));
   content=vertical();content.setPadding(0,dp(0),0,dp(58));content.setClipChildren(false);content.setClipToPadding(false);mainScroll.setClipChildren(false);mainScroll.setClipToPadding(false);mainScroll.addView(content);
   networkStatus=null;
   if("Home".equals(page))home();else if("Episodes".equals(page))allEpisodes();
   else if("Upcoming".equals(page))upcoming();
   else if("Anime".equals(page))anime();else if("Trailers".equals(page))trailers();
   else if("Continue".equals(page))continueWatching();else if("Live".equals(page))livePage();else home();
   immersive();
 }
 private void title(String heading,String subtitle){
   TextView h=text(heading,31,true);h.setPadding(dp(54),0,dp(54),0);content.addView(h);
   if(subtitle!=null){TextView s=text(subtitle,15,false,MUTED);s.setPadding(dp(54),0,dp(54),0);space(content,7);content.addView(s);}
 }
 private void home(){
   featuredHero();
   liveCard();
   homeContinueRail();
   rows("New & Upcoming • Season 7",bySeason(7));
   TextView resume=text("Your Watch History  ›",23,true);resume.setFocusable(true);
   resume.setPadding(0,dp(10),0,dp(10));resume.setPadding(dp(54),dp(10),dp(54),dp(10));content.addView(resume);
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
     TextView hint=text("Select Continue to see your synced watch history.",13,false,MUTED);hint.setPadding(dp(54),0,dp(54),0);content.addView(hint);
   }
   space(content,24);
   rows("Recently Added",latest(18));
   animeStrip();
   rows("Trailers & Previews",new ArrayList<>(trailers));
 }
 private void liveCard(){
   LinearLayout card=vertical();card.setPadding(dp(24),dp(20),dp(24),dp(20));card.setBackground(bg(0xff241525,14));card.setFocusable(true);
   TextView kicker=text("●  MIRACULOUSHUB LIVE",13,true,0xffff739d);card.addView(kicker);
   TextView title=text("Live stream & release countdowns",23,true);title.setPadding(0,dp(7),0,dp(5));card.addView(title);
   TextView subtitle=text("Open the live stream page for the current Twitch player and countdown-triggered Live now links.",15,false,MUTED);card.addView(subtitle);
   TextView action=text("▶  Open Live",17,true,Color.WHITE);action.setGravity(Gravity.CENTER);action.setPadding(dp(20),dp(13),dp(20),dp(13));action.setBackground(bg(PINK,9));action.setFocusable(true);
   LinearLayout.LayoutParams ap=new LinearLayout.LayoutParams(-2,-2);ap.topMargin=dp(15);card.addView(action,ap);
   View.OnClickListener openLive=v->startActivity(new Intent(this,LiveActivity.class));
   card.setOnClickListener(openLive);action.setOnClickListener(openLive);
   card.setOnFocusChangeListener((v,f)->focus(card,f,PINK,0xff241525));
   LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,-2);cp.setMargins(dp(54),dp(16),dp(54),dp(20));content.addView(card,cp);
 }
 private void livePage(){
   title("MiraculousHub Live","Open the shared live page and Twitch stream.");
   TextView open=text("▶  Open Live Stream",22,true,Color.WHITE);open.setGravity(Gravity.CENTER);open.setFocusable(true);open.setPadding(dp(28),dp(20),dp(28),dp(20));open.setBackground(bg(PINK,12));
   LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(dp(54),dp(20),dp(54),0);content.addView(open,p);
   open.setOnFocusChangeListener((v,f)->focus(open,f,PINK,0xff17191f));
   open.setOnClickListener(v->startActivity(new Intent(this,LiveActivity.class)));
   TextView info=text("The live page is hosted on MiraculousHub, so stream and countdown behaviour can be fixed centrally without waiting for a new app release.",15,false,MUTED);info.setPadding(dp(54),dp(14),dp(54),0);content.addView(info);
 }
 private void featuredHero(){
   FrameLayout hero=new FrameLayout(this);
   LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(500));hp.leftMargin=-dp(38);hp.rightMargin=-dp(38);hp.bottomMargin=dp(25);
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
   LinearLayout details=vertical();details.setPadding(dp(64),dp(42),dp(22),dp(42));
   FrameLayout.LayoutParams detailParams=new FrameLayout.LayoutParams(dp(720),-2,Gravity.BOTTOM|Gravity.LEFT);
   hero.addView(details,detailParams);
   TextView eyebrow=text("M I R A C U L O U S   H U B     •     FEATURED SERIES",13,true,0xffff7777);
   details.addView(eyebrow);space(details,11);
   TextView name=text("MIRACULOUS",60,true,Color.WHITE);details.addView(name);
   TextView subtitle=text("TALES OF LADYBUG & CAT NOIR",21,true,0xffeeeeee);details.addView(subtitle);
   space(details,15);
   TextView description=text("The city needs its heroes. Dive into the latest episodes, explore the collection and continue watching your favourites.",18,false,0xffe8e8ed);
   description.setMaxLines(3);description.setLineSpacing(dp(2),1.0f);details.addView(description);space(details,22);
   LinearLayout buttons=new LinearLayout(this);details.addView(buttons);
   TextView play=text("▶  Play Latest",17,true,0xff101010);
   play.setGravity(Gravity.CENTER);play.setBackground(bg(0xfff5f5f5,5));
   play.setPadding(dp(30),dp(17),dp(30),dp(17));play.setFocusable(true);
   buttons.addView(play);play.setOnFocusChangeListener((v,f)->focus(play,f,0xffcccccc,0xfff5f5f5));
   play.setOnClickListener(v->{ArrayList<JSONObject> available=latest(1);if(!available.isEmpty()){
     JSONObject e=available.get(0);launch(HOST+e.optString("videoPath"),e.optString("title","Episode"),e);
   }else{page="Episodes";render();}});
   TextView browse=text("  ⓘ  More Info  ",17,true,Color.WHITE);
   browse.setGravity(Gravity.CENTER);browse.setBackground(bg(0xff3a3a3a,5));browse.setPadding(dp(10),0,dp(10),0);browse.setFocusable(true);
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
 private void seasonSelector(){
   HorizontalScrollView scroller=new HorizontalScrollView(this);scroller.setHorizontalScrollBarEnabled(false);
   scroller.setClipChildren(false);scroller.setClipToPadding(false);content.addView(scroller);
   LinearLayout strip=new LinearLayout(this);strip.setClipChildren(false);strip.setPadding(dp(6),dp(8),dp(12),dp(8));scroller.addView(strip);
   for(int season=7;season>=1;season--){
     final int chosen=season;
     TextView chip=text("Season "+season,16,true,chosen==selectedSeason?Color.WHITE:MUTED);
     chip.setGravity(Gravity.CENTER);chip.setPadding(dp(22),dp(13),dp(22),dp(13));
     chip.setBackground(bg(chosen==selectedSeason?0xff494949:0xff242424,6));
     chip.setFocusable(true);chip.setClickable(true);
     LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-2,dp(52));cp.rightMargin=dp(12);strip.addView(chip,cp);
     chip.setOnFocusChangeListener((v,focused)->{
       chip.setBackground(bg(focused?0xffe50914:chosen==selectedSeason?0xff494949:0xff242424,6));
       chip.setTextColor(focused||chosen==selectedSeason?Color.WHITE:MUTED);
       chip.animate().scaleX(focused?1.06f:1).scaleY(focused?1.06f:1).setDuration(150).start();
       if(focused)scroller.smoothScrollTo(Math.max(0,chip.getLeft()-dp(25)),0);
     });
     chip.setOnClickListener(v->{selectedSeason=chosen;page="Episodes";render();});
   }
 }
 private void homeContinueRail(){
   FirebaseUser user=TvFirebase.auth(this).getCurrentUser();
   if(user==null)return;
   LinearLayout holder=vertical();content.addView(holder);
   String uid=user.getUid();
   TvFirebase.database(this).collection("users").document(uid).collection("playback")
     .orderBy("updatedAt",Query.Direction.DESCENDING).limit(15).get(Source.SERVER)
     .addOnCompleteListener(this,result->{
       if(!"Home".equals(page)||holder.getParent()==null||!result.isSuccessful())return;
       ArrayList<JSONObject> history=new ArrayList<>();
       for(DocumentSnapshot snap:result.getResult().getDocuments()){
         JSONObject item=findCloudEpisode(snap);
         if(item!=null)history.add(item);
       }
       if(history.isEmpty())return;
       holder.removeAllViews();
       TextView heading=text("Continue Watching  ›",24,true);holder.addView(heading);
       space(holder,14);
       HorizontalScrollView railScroll=new HorizontalScrollView(this);railScroll.setHorizontalScrollBarEnabled(false);
       railScroll.setClipChildren(false);railScroll.setClipToPadding(false);holder.addView(railScroll);
       LinearLayout rail=new LinearLayout(this);rail.setPadding(dp(6),dp(7),dp(20),dp(10));
       rail.setClipChildren(false);railScroll.addView(rail);
       for(JSONObject item:history)rail.addView(episodeCard(item,railScroll));
       space(holder,24);
     });
 }
 private void allEpisodes(){
   title("Miraculous • Episodes","Choose a season, then press OK on any episode to watch.");
   space(content,22);
   seasonSelector();
   space(content,20);
   rows("Season "+selectedSeason+" • Episodes",bySeason(selectedSeason));
   if(selectedSeason==7)rows("Recently Added",latest(14));
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
   TextView title=text(heading+"  ›",25,true);title.setPadding(dp(54),0,dp(54),0);content.addView(title);space(content,14);
   if(items.isEmpty()){
     TextView empty=text(catalogError.isEmpty()?"No uploads here yet.":"Live catalogue unavailable; retry after updating the uploader Worker.",14,false,MUTED);
     content.addView(empty);space(content,20);return;
   }
   HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);
   scroll.setClipChildren(false);scroll.setClipToPadding(false);content.addView(scroll);
   LinearLayout strip=new LinearLayout(this);strip.setPadding(dp(60),dp(9),dp(60),dp(15));strip.setClipChildren(false);strip.setClipToPadding(false);
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
   LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(370),dp(260));cp.rightMargin=dp(20);card.setLayoutParams(cp);
   FrameLayout art=new FrameLayout(this);card.addView(art,new LinearLayout.LayoutParams(-1,dp(198)));
   ImageView img=new ImageView(this);img.setScaleType(ImageView.ScaleType.CENTER_CROP);
   art.addView(img,new FrameLayout.LayoutParams(-1,-1));
   String thumb=item.optString("thumbnail","");
   if(thumb.isEmpty()&&item.optInt("season")==7)thumb=POSTER;
   if(thumb.isEmpty()&&item.optString("videoPath","").contains("/anime/")){
     String[] segments=item.optString("videoPath").split("/");
     if(segments.length>3)thumb=cover(segments[3]);
   }
   artwork(img,thumb);
   TextView play=text("▶",22,true);play.setGravity(Gravity.CENTER);play.setBackground(bg(0xcc0a0f19,30));
   FrameLayout.LayoutParams playP=new FrameLayout.LayoutParams(dp(38),dp(38),Gravity.RIGHT|Gravity.BOTTOM);
   playP.setMargins(0,0,dp(9),dp(9));art.addView(play,playP);
   LinearLayout info=vertical();info.setPadding(dp(14),dp(8),dp(11),dp(10));card.addView(info);
   TextView name=text(title,18,true);name.setMaxLines(1);name.setEllipsize(TextUtils.TruncateAt.END);info.addView(name);
   TextView meta=text(trailer?"TRAILER  •  PREVIEW":code,11,true,0xffc4c6d0);space(info,3);info.addView(meta);
   card.setOnFocusChangeListener((v,f)->{
     GradientDrawable focusedBg=bg(f?0xff24262d:PANEL,8);if(f)focusedBg.setStroke(dp(2),0xfff5f5f5);card.setBackground(focusedBg);card.animate().scaleX(f?1.075f:1).scaleY(f?1.075f:1).setDuration(160).start();
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
   TextView title=text("Popular Animes  ›",25,true);title.setPadding(dp(54),0,dp(54),0);content.addView(title);space(content,13);
   HorizontalScrollView hs=new HorizontalScrollView(this);hs.setHorizontalScrollBarEnabled(false);content.addView(hs);
   LinearLayout strip=new LinearLayout(this);strip.setClipChildren(false);strip.setPadding(dp(54),dp(6),dp(54),dp(10));hs.addView(strip);
   for(String[] show:shows())strip.addView(animeCard(show,hs));
   space(content,25);
 }
 private View animeCard(String[] show,HorizontalScrollView scroll){
   FrameLayout card=new FrameLayout(this);card.setBackground(bg(PANEL,16));card.setClipToOutline(true);
   card.setFocusable(true);card.setClickable(true);
   LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(350),dp(196));p.rightMargin=dp(21);card.setLayoutParams(p);
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
     GradientDrawable selectedBg=bg(f?0xff252831:PANEL,12);if(f)selectedBg.setStroke(dp(2),0xfff5f5f5);card.setBackground(selectedBg);card.setElevation(f?dp(14):0);card.animate().scaleX(f?1.045f:1).scaleY(f?1.045f:1).setDuration(125).start();
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
