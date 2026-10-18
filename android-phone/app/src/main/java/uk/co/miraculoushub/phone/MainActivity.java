package uk.co.miraculoushub.phone;

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
import android.text.TextWatcher;
import android.text.Editable;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.*;
import com.bumptech.glide.Glide;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.Query;
import com.google.firebase.firestore.Source;
import com.google.firebase.firestore.DocumentSnapshot;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;

public class MainActivity extends Activity {
  private static final String HOST="https://video.miraculoushub.co.uk";
  private static final String CATALOG="https://upload.miraculoushub.co.uk/catalog";
  private static final String POSTER="https://miraculoushub.co.uk/main-season7-poster.png";
  private static final int BG=0xff05070c, SURFACE=0xff151a27, PINK=0xffff2f68, MUTED=0xffaeb5c9;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ArrayList<JSONObject> bundled=new ArrayList<>(),episodes=new ArrayList<>(),trailers=new ArrayList<>();
  private LinearLayout content, dock;
  private TextView status;
  private String tab="Home", query="",selectedAnime="";
  private int selectedSeason=7;
  private LinearLayout searchResults;
  private boolean updating=false;
  private long lastLibrarySync=0;
  private final Runnable periodicLibrarySync=new Runnable(){@Override public void run(){refresh();handler.postDelayed(this,120000);}};
  private long lastUpdateCheck=0L;
  private String catalogError="";

  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
    getWindow().setStatusBarColor(BG);
    getWindow().setNavigationBarColor(BG);
    loadBundled();render();refresh();
  }
  private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
  private GradientDrawable solid(int color,int radius){
    GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;
  }
  private GradientDrawable gradient(int start,int end,int radius){
    GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{start,end});
    d.setCornerRadius(dp(radius));return d;
  }
  private TextView text(String value,int size,boolean bold,int color){
    TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(color);
    if(bold)v.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return v;
  }
  private TextView text(String value,int size,boolean bold){return text(value,size,bold,Color.WHITE);}
  private LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
  private void addTop(LinearLayout parent,View child,int top){
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(top);parent.addView(child,p);
  }
  private void loadBundled(){
    try(InputStream in=getAssets().open("episodes.json")){
      ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;
      while((n=in.read(b))!=-1)out.write(b,0,n);
      JSONArray data=new JSONArray(out.toString("UTF-8"));
      for(int i=0;i<data.length();i++){JSONObject e=data.optJSONObject(i);if(e!=null)bundled.add(e);}
      episodes.addAll(bundled);
    }catch(Exception e){android.util.Log.w("MiraculousHub","Bundled catalogue unavailable",e);}
  }
  private String loadLiveText(String address,int limit) throws Exception {
    HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();
    c.setConnectTimeout(8500);c.setReadTimeout(8500);
    c.setRequestProperty("Accept","application/json, text/javascript");
    c.setRequestProperty("Cache-Control","no-cache");
    if(c.getResponseCode()!=200){int code=c.getResponseCode();c.disconnect();throw new IOException("HTTP "+code);}
    ByteArrayOutputStream out=new ByteArrayOutputStream();
    try(InputStream in=c.getInputStream()){
      byte[] b=new byte[8192];int n;
      while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Catalogue too large");out.write(b,0,n);}
    }finally{c.disconnect();}
    return out.toString("UTF-8");
  }
  private void refresh(){
    if(updating)return;updating=true;lastLibrarySync=System.currentTimeMillis();
    new Thread(()->{
      LinkedHashMap<String,JSONObject> map=new LinkedHashMap<>();
      for(JSONObject e:bundled)map.put(e.optString("code"),e);
      String failure="";
      ArrayList<JSONObject> foundTrailers=new ArrayList<>();
      try{
        String js=loadLiveText("https://miraculoushub.co.uk/data.js",1400000);
        int at=js.indexOf("window.MH_EPISODES"),start=js.indexOf('[',at),close=js.indexOf("];",start);
        if(at<0||start<0||close<0)throw new IOException("Website data not found");
        JSONArray site=new JSONArray(js.substring(start,close+1));
        LinkedHashMap<String,JSONObject> latestBase=new LinkedHashMap<>();
        for(int i=0;i<site.length();i++){
          JSONObject e=site.optJSONObject(i);if(e==null)continue;
          int season=e.optInt("season"),episode=e.optInt("episode");
          if(season<1||season>7||episode<1||episode>99)continue;
          String code=String.format(Locale.US,"S%02dE%02d",season,episode);
          if(e.optBoolean("available",true))latestBase.put(code,e);
        }
        if(!latestBase.isEmpty())map=latestBase;
      }catch(Exception ex){failure="Website: "+ex.getMessage();}
      try{
        JSONArray rows=new JSONObject(loadLiveText(CATALOG,2000000)).getJSONArray("entries");
        for(int i=0;i<rows.length();i++){
          JSONObject row=rows.optJSONObject(i);if(row==null)continue;
          if("trailer".equals(row.optString("kind"))){
            if(row.optString("id").matches("[a-z0-9][a-z0-9-]{0,79}"))foundTrailers.add(row);
            continue;
          }
          if(!"episode".equals(row.optString("kind")))continue;
          int season=row.optInt("season"),ep=row.optInt("episode");
          if(season<1||season>7||ep<1||ep>99)continue;
          String code=String.format(Locale.US,"S%02dE%02d",season,ep);
          if(!row.optBoolean("available",true)){map.remove(code);continue;}
          JSONObject copy=new JSONObject(row.toString());
          copy.put("code",code);copy.put("videoPath","/video/"+code.toLowerCase(Locale.US));
          // Never fabricate or replace a missing thumbnail. Use upload.html metadata.
          map.put(code,copy);
        }
      }catch(Exception ex){failure+=(failure.isEmpty()?"":" • ")+"Uploads: "+ex.getMessage();}
      ArrayList<JSONObject> latest=new ArrayList<>(map.values());
      latest.sort((a,b)->{int x=Integer.compare(a.optInt("season"),b.optInt("season"));return x!=0?x:Integer.compare(a.optInt("episode"),b.optInt("episode"));});
      String error=failure;
      handler.post(()->{
        catalogError=error;updating=false;episodes.clear();episodes.addAll(latest);
        trailers.clear();trailers.addAll(foundTrailers);
        render();if(status!=null)status.setText(error.isEmpty()?"WEBSITE LIBRARY UPDATED":"PARTIAL WEBSITE SYNC");
      });
    }).start();
  }
  private void image(ImageView view,String url){
    view.setBackground(gradient(0xff29253d,0xff10141d,16));
    if(url==null||url.isEmpty())return;
    String resolved=url.startsWith("https://")?url:"https://miraculoushub.co.uk/"+url.replaceFirst("^/","");
    Glide.with(this).load(resolved).centerCrop().into(view);
  }
  private void open(String newTab){
    tab=newTab;render();
  }
  private void render(){
    LinearLayout root=vertical();
    root.setBackground(gradient(0xff0c1120,BG,0));
    setContentView(root);
    header(root);
    ScrollView scroll=new ScrollView(this);scroll.setFillViewport(false);scroll.setVerticalScrollBarEnabled(false);
    root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    content=vertical();content.setPadding(dp(17),dp(12),dp(17),dp(34));scroll.addView(content);
    if("Home".equals(tab))home();
    else if("Anime".equals(tab))anime();
    else if("Trailers".equals(tab))trailers();
    else if("Search".equals(tab))search();
    else if("Seasons".equals(tab))seasons();
    else if("Continue".equals(tab))continueWatching();
    else more();
    bottom(root);
  }
  private void header(LinearLayout root){
    LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(15),dp(5),dp(9),dp(5));
    bar.setBackground(gradient(0xff1d1b32,0xff0c1423,22));
    GradientDrawable frame=gradient(0xff201d35,0xff10131e,22);frame.setStroke(dp(1),0xff34354a);bar.setBackground(frame);
    LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(61));hp.setMargins(dp(13),dp(10),dp(13),0);root.addView(bar,hp);
    TextView logo=text("Miraculous",22,true);logo.setTypeface(Typeface.create("serif",Typeface.BOLD_ITALIC));logo.setTextColor(0xfff6eeff);
    bar.addView(logo);
    TextView hub=text("Hub",22,true,PINK);hub.setTypeface(Typeface.create("serif",Typeface.BOLD_ITALIC));
    bar.addView(hub);
    View space=new View(this);bar.addView(space,new LinearLayout.LayoutParams(0,1,1));
    TextView lookup=text("⌕",31,false);lookup.setGravity(Gravity.CENTER);lookup.setContentDescription("Search the library");
    bar.addView(lookup,new LinearLayout.LayoutParams(dp(45),dp(48)));lookup.setOnClickListener(v->open("Search"));
    TextView account=text("●",22,true,0xffff90af);account.setGravity(Gravity.CENTER);account.setBackground(solid(0xff37203e,50));
    LinearLayout.LayoutParams acp=new LinearLayout.LayoutParams(dp(37),dp(37));bar.addView(account,acp);
    account.setContentDescription("Your account");account.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));
  }
  private void home(){
    hero();
    LinearLayout quick=new LinearLayout(this);quick.setGravity(Gravity.CENTER_VERTICAL);
    TextView greeting=text("EXPLORE YOUR UNIVERSE",11,true,0xfffd82a3);
    quick.addView(greeting,new LinearLayout.LayoutParams(0,-2,1));
    status=text("LATEST PICKS",10,true,MUTED);status.setGravity(Gravity.END);quick.addView(status);
    addTop(content,quick,20);
    section("Trending Now","Seasons",new ArrayList<>(latestEpisodes(15)),true);
    animeShelf();
    section("Trailers & Previews","Trailers",trailers,true);
    // A compact watch-history shortcut and settings entry at the bottom.
    TextView continueLink=text("◷   Continue Watching      →",16,true);
    continueLink.setBackground(gradient(0xff222439,0xff101523,17));
    continueLink.setPadding(dp(18),dp(18),dp(18),dp(18));
    addTop(content,continueLink,26);continueLink.setOnClickListener(v->open("Continue"));
  }
  private void hero(){
    FrameLayout hero=new FrameLayout(this);
    hero.setBackground(gradient(0xff5a2452,0xff111725,25));hero.setClipToOutline(true);
    ImageView poster=new ImageView(this);poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
    hero.addView(poster,new FrameLayout.LayoutParams(-1,-1));image(poster,POSTER);
    View dark=new View(this);dark.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x22100718,0x55100619,0xe9070a12,0xff070a12}));
    hero.addView(dark,new FrameLayout.LayoutParams(-1,-1));
    LinearLayout details=vertical();details.setPadding(dp(20),dp(18),dp(20),dp(20));
    FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM);hero.addView(details,lp);
    TextView kicker=text("✦  FEATURED  •  SEASON 7",11,true,0xffff96b8);details.addView(kicker);
    TextView title=text("Miraculous Ladybug",29,true);title.setShadowLayer(dp(6),0,dp(2),0xff000000);
    title.setPadding(0,dp(7),0,0);details.addView(title);
    TextView caption=text("The adventure continues...",15,false,0xffede2f0);details.addView(caption);
    LinearLayout actions=new LinearLayout(this);actions.setGravity(Gravity.CENTER_VERTICAL);
    LinearLayout.LayoutParams ap=new LinearLayout.LayoutParams(-1,-2);ap.topMargin=dp(18);details.addView(actions,ap);
    TextView explore=button("▶   Explore S7",PINK,Color.WHITE);
    LinearLayout.LayoutParams p1=new LinearLayout.LayoutParams(0,dp(45),1);actions.addView(explore,p1);
    explore.setOnClickListener(v->{selectedSeason=7;open("Seasons");});
    TextView more=button("More info",0xb91a1a2d,Color.WHITE);
    LinearLayout.LayoutParams p2=new LinearLayout.LayoutParams(0,dp(45),1);p2.leftMargin=dp(10);actions.addView(more,p2);
    more.setOnClickListener(v->{selectedSeason=7;open("Seasons");});
    LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(320));hp.bottomMargin=dp(5);content.addView(hero,hp);
  }
  private TextView button(String value,int background,int foreground){
    TextView v=text(value,13,true,foreground);v.setGravity(Gravity.CENTER);v.setBackground(solid(background,15));return v;
  }
  private ArrayList<JSONObject> latestEpisodes(int max){
    ArrayList<JSONObject> list=new ArrayList<>(episodes);Collections.reverse(list);
    if(list.size()>max)return new ArrayList<>(list.subList(0,max));return list;
  }
  private void heading(String label,String destination){
    LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);
    TextView title=text(label,21,true);row.addView(title,new LinearLayout.LayoutParams(0,-2,1));
    TextView more=text("See all  →",13,true,0xffff70a0);more.setGravity(Gravity.CENTER_VERTICAL);
    row.addView(more);
    if(destination!=null){more.setOnClickListener(v->open(destination));title.setOnClickListener(v->open(destination));}
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(27);p.bottomMargin=dp(13);content.addView(row,p);
  }
  private void section(String label,String destination,ArrayList<JSONObject> items,boolean horizontal){
    heading(label,destination);
    if(items.isEmpty()){
      TextView empty=text("Trailers".equals(destination)||label.toLowerCase(Locale.ROOT).contains("trailer")?(catalogError.isEmpty()?"No trailers in the catalogue yet.":"Unable to load trailers (catalogue: "+catalogError+"). Update the upload Worker to permit Android catalogue reads."):"No episodes found yet.",14,false,MUTED);
      empty.setPadding(dp(10),dp(17),dp(10),dp(17));empty.setBackground(solid(SURFACE,16));content.addView(empty);
      return;
    }
    if(horizontal){
      HorizontalScrollView scroller=new HorizontalScrollView(this);scroller.setHorizontalScrollBarEnabled(false);
      content.addView(scroller);
      LinearLayout rail=new LinearLayout(this);rail.setOrientation(LinearLayout.HORIZONTAL);scroller.addView(rail);
      for(int i=0;i<Math.min(24,items.size());i++)rail.addView(posterCard(items.get(i)));
    } else for(JSONObject item:items)addTop(content,listCard(item),10);
  }
  private View posterCard(JSONObject item){
    String name=item.optString("title","Episode"),code=item.optString("code","");
    boolean trailer="trailer".equals(item.optString("kind"));
    LinearLayout outer=vertical();outer.setBackground(gradient(0xff1b2032,0xff111320,17));outer.setClipToOutline(true);
    LinearLayout.LayoutParams mp=new LinearLayout.LayoutParams(dp(163),dp(235));mp.rightMargin=dp(12);outer.setLayoutParams(mp);
    FrameLayout art=new FrameLayout(this);outer.addView(art,new LinearLayout.LayoutParams(-1,dp(158)));
    ImageView cover=new ImageView(this);cover.setScaleType(ImageView.ScaleType.CENTER_CROP);art.addView(cover,new FrameLayout.LayoutParams(-1,-1));
    String pic=item.optString("thumbnail","");if(pic.isEmpty()&&item.optInt("season")==7)pic=POSTER;image(cover,pic);
    TextView play=text("▶",17,true);play.setGravity(Gravity.CENTER);play.setBackground(solid(0xdd0b0d17,50));
    FrameLayout.LayoutParams pp=new FrameLayout.LayoutParams(dp(39),dp(39),Gravity.END|Gravity.BOTTOM);pp.setMargins(0,0,dp(7),dp(8));art.addView(play,pp);
    LinearLayout details=vertical();details.setPadding(dp(10),dp(7),dp(8),dp(7));outer.addView(details);
    TextView title=text(name,14,true);title.setMaxLines(2);title.setEllipsize(TextUtils.TruncateAt.END);details.addView(title);
    TextView info=text(trailer?"TRAILER":(code.isEmpty()?"EPISODE":code),11,true,0xffff8cae);
    LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(-1,-2);ip.topMargin=dp(3);details.addView(info,ip);
    outer.setOnClickListener(v->play(item));return outer;
  }
  private View listCard(JSONObject item){
    LinearLayout card=new LinearLayout(this);card.setGravity(Gravity.CENTER_VERTICAL);
    card.setPadding(dp(9),dp(9),dp(11),dp(9));
    card.setBackground(gradient(0xff1b2234,0xff0e1320,15));
    ImageView art=new ImageView(this);art.setScaleType(ImageView.ScaleType.CENTER_CROP);art.setClipToOutline(true);
    art.setBackground(solid(0xff29283b,10));card.addView(art,new LinearLayout.LayoutParams(dp(110),dp(75)));
    String img=item.optString("thumbnail","");if(img.isEmpty()&&item.optInt("season")==7)img=POSTER;image(art,img);
    LinearLayout words=vertical();words.setPadding(dp(12),0,0,0);card.addView(words,new LinearLayout.LayoutParams(0,-2,1));
    TextView title=text(item.optString("title","Episode"),15,true);title.setMaxLines(2);title.setEllipsize(TextUtils.TruncateAt.END);words.addView(title);
    String code=item.optString("code");TextView codeLabel=text(code.isEmpty()?"Watch episode":code,12,false,MUTED);addTop(words,codeLabel,5);
    TextView play=text("▶",19,true,PINK);play.setPadding(dp(8),0,dp(2),0);card.addView(play);
    card.setOnClickListener(v->play(item));return card;
  }
  private String playbackKey(JSONObject item){
    int season=item.optInt("season"),episode=item.optInt("episode");
    if(season>0&&episode>0)return "s"+season+"e"+episode;
    String path=item.optString("videoPath","");
    if(path.startsWith("/video/anime/")){
      String[] parts=path.split("/");
      if(parts.length==5&&parts[4].matches("e[0-9]{1,3}")){
        try{return "anime-"+parts[3]+"-e"+Integer.parseInt(parts[4].substring(1));}catch(Exception ignored){}
      }
    }
    return "";
  }
  private void play(JSONObject item){
    boolean trailer="trailer".equals(item.optString("kind"));
    String path=trailer?"/video/trailer/"+item.optString("id"):item.optString("videoPath","");
    if(!path.startsWith("/video/"))return;
    String url=HOST+path,title=item.optString("title","Episode");
    String cloudKey=playbackKey(item);
    if(!trailer)getPreferences(0).edit().putString("recent",item.optString("code"))
      .putString("recentUrl",url).putString("recentTitle",title)
      .putString("recentKey",cloudKey).putInt("recentSeason",item.optInt("season"))
      .putInt("recentEpisode",item.optInt("episode")).apply();
    Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("url",url);intent.putExtra("title",title);
    if(!cloudKey.isEmpty())intent.putExtra("cloudKey",cloudKey);
    intent.putExtra("season",item.optInt("season"));intent.putExtra("episode",item.optInt("episode"));
    startActivity(intent);
  }
  private void animeShelf(){
    heading("Monthly Animes","Anime");
    HorizontalScrollView scroller=new HorizontalScrollView(this);scroller.setHorizontalScrollBarEnabled(false);
    content.addView(scroller);
    LinearLayout cards=new LinearLayout(this);scroller.addView(cards);
    for(String[] show:shows())cards.addView(animeCard(show));
  }
  private String animeCover(String slug){
    if("death-note".equals(slug))return "https://cdn.myanimelist.net/images/anime/1079/138100.jpg";
    if("attack-on-titan".equals(slug))return "https://cdn.myanimelist.net/images/anime/10/47347.jpg";
    return "https://cdn.myanimelist.net/images/anime/2/88336.jpg";
  }
  private String[][] shows(){return new String[][]{{"Death Note","death-note","37 EPISODES"},{"Attack on Titan","attack-on-titan","94 EPISODES"},{"Black Clover","black-clover","170 EPISODES"}};}
  private View animeCard(String[] show){
    int c1=show[1].equals("death-note")?0xff363743:show[1].equals("attack-on-titan")?0xff5d372f:0xff324939;
    int c2=show[1].equals("death-note")?0xff0b0e19:show[1].equals("attack-on-titan")?0xff121417:0xff121d1a;
    FrameLayout outer=new FrameLayout(this);outer.setBackground(gradient(c1,c2,18));outer.setClipToOutline(true);
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(176),dp(177));p.rightMargin=dp(12);outer.setLayoutParams(p);
    ImageView cover=new ImageView(this);cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
    outer.addView(cover,new FrameLayout.LayoutParams(-1,-1));image(cover,animeCover(show[1]));
    View shade=new View(this);shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
      new int[]{0x1b090b13,0x61090b13,0xf4080c16}));
    outer.addView(shade,new FrameLayout.LayoutParams(-1,-1));
    LinearLayout info=vertical();info.setPadding(dp(13),dp(12),dp(12),dp(16));
    FrameLayout.LayoutParams ilp=new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM);outer.addView(info,ilp);
    TextView marker=text("MONTHLY ANIME",10,true,0xffff8ba5);info.addView(marker);
    TextView title=text(show[0],20,true);title.setMaxLines(2);addTop(info,title,7);
    TextView count=text(show[2]+"    →",11,true,MUTED);addTop(info,count,6);
    outer.setOnClickListener(v->{selectedAnime=show[1];open("Anime");});return outer;
  }
  private void anime(){
    if(selectedAnime.isEmpty()){
      TextView eyebrow=text("MONTHLY COLLECTION",12,true,PINK);addTop(content,eyebrow,8);
      addTop(content,text("Explore Anime",31,true),6);
      TextView subtitle=text("Choose a series to explore its episodes.",15,false,MUTED);addTop(content,subtitle,7);
      for(String[] show:shows()){
        View card=animeCard(show);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(192));lp.topMargin=dp(16);
        content.addView(card,lp);
      }
      return;
    }
    String[] found=shows()[0];for(String[] show:shows())if(show[1].equals(selectedAnime))found=show;
    final String title=found[0],slug=found[1];
    TextView back=text("‹  All monthly anime",15,true,PINK);addTop(content,back,7);
    back.setOnClickListener(v->{selectedAnime="";render();});
    addTop(content,text(title,29,true),16);
    int count=slug.equals("death-note")?37:slug.equals("attack-on-titan")?94:170;
    addTop(content,text(count+" episodes  •  Select an episode",13,false,MUTED),4);
    for(int n=1;n<=count;n++){
      try{
        JSONObject e=new JSONObject();e.put("title",title+" • Episode "+n);
        e.put("code","EPISODE "+n);
        e.put("thumbnail",animeCover(slug));
        e.put("videoPath","/video/anime/"+slug+"/e"+String.format(Locale.US,slug.equals("black-clover")?"%03d":"%02d",n));
        addTop(content,listCard(e),9);
      }catch(Exception ignored){}
    }
  }
  private void trailers(){
    TextView kicker=text("FIRST LOOK",11,true,PINK);addTop(content,kicker,10);
    addTop(content,text("Trailers & Previews",29,true),8);
    addTop(content,text("The latest teasers uploaded to MiraculousHub.",14,false,MUTED),7);
    section("Latest trailers",null,new ArrayList<>(trailers),false);
  }
  private void seasons(){
    addTop(content,text("Miraculous Episodes",29,true),12);
    HorizontalScrollView scroller=new HorizontalScrollView(this);scroller.setHorizontalScrollBarEnabled(false);
    LinearLayout tabs=new LinearLayout(this);scroller.addView(tabs);addTop(content,scroller,17);
    for(int n=1;n<=7;n++){final int number=n;
      TextView chip=button("Season "+n,n==selectedSeason?PINK:0xff202437,n==selectedSeason?Color.WHITE:MUTED);
      LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(103),dp(43));cp.rightMargin=dp(9);tabs.addView(chip,cp);
      chip.setOnClickListener(v->{selectedSeason=number;render();});
    }
    ArrayList<JSONObject> items=new ArrayList<>();for(JSONObject e:episodes)if(e.optInt("season")==selectedSeason)items.add(e);
    section("Season "+selectedSeason,null,items,false);
  }
  private void search(){
    addTop(content,text("Search",30,true),12);
    EditText field=new EditText(this);field.setTextColor(Color.WHITE);field.setHintTextColor(MUTED);
    field.setSingleLine(true);field.setTextSize(16);field.setHint("Search episodes, trailers, anime…");
    field.setPadding(dp(16),dp(12),dp(16),dp(12));field.setBackground(solid(0xff20253b,18));
    addTop(content,field,16);
    TextView hint=text("SUGGESTED  •  MIRACULOUS  •  ANIME",11,true,PINK);addTop(content,hint,17);
    searchResults=vertical();addTop(content,searchResults,12);
    field.setText(query);populateSearch();
    field.addTextChangedListener(new TextWatcher(){
      public void beforeTextChanged(CharSequence s,int start,int count,int after){}
      public void onTextChanged(CharSequence s,int start,int before,int count){query=s.toString();populateSearch();}
      public void afterTextChanged(Editable e){}
    });
  }
  private void populateSearch(){
    if(searchResults==null)return;searchResults.removeAllViews();
    String q=query.toLowerCase(Locale.ROOT).trim();if(q.isEmpty()){
      for(String[] show:shows()){TextView suggestion=text("✦  "+show[0]+"    →",16,true);
        suggestion.setPadding(dp(15),dp(19),dp(15),dp(19));suggestion.setBackground(solid(0xff151c2d,15));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(10);searchResults.addView(suggestion,p);
        suggestion.setOnClickListener(v->{selectedAnime=show[1];open("Anime");});}
      return;
    }
    int count=0;ArrayList<JSONObject> matches=new ArrayList<>(episodes);matches.addAll(trailers);
    for(JSONObject item:matches){
      if(item.optString("title").toLowerCase(Locale.ROOT).contains(q)||item.optString("code").toLowerCase(Locale.ROOT).contains(q)){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(9);
        searchResults.addView(listCard(item),p);if(++count>=50)break;
      }
    }
    if(count==0)searchResults.addView(text("No matching episodes or trailers found.",14,false,MUTED));
  }
  private void continueWatching(){
    addTop(content,text("Continue Watching",29,true),12);
    FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();
    if(user!=null){
      TextView syncing=text("SYNCING WITH MIRACULOUSHUB ACCOUNT…",12,true,PINK);
      addTop(content,syncing,12);
      LinearLayout cloudList=vertical();addTop(content,cloudList,14);
      FirebaseFirestore.getInstance().collection("users").document(user.getUid())
        .collection("playback").orderBy("updatedAt",Query.Direction.DESCENDING).limit(20)
        .get(Source.SERVER).addOnCompleteListener(this,result->{
          if(!"Continue".equals(tab)||cloudList.getParent()==null)return;
          syncing.setVisibility(View.GONE);
          cloudList.removeAllViews();
          if(!result.isSuccessful()){
            addTop(cloudList,text("Can't sync right now. Your saved device episode is below.",13,false,MUTED),10);
            return;
          }
          int count=0;
          for(DocumentSnapshot doc:result.getResult().getDocuments()){
            JSONObject matched=findCloudEpisode(doc);
            if(matched==null)continue;
            View card=listCard(matched);
            LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(11);
            cloudList.addView(card,p);
            count++;
          }
          if(count==0)addTop(cloudList,text("Nothing saved to this account yet. Start an episode on the website or TV!",14,false,MUTED),12);
        });
    }else{
      TextView hint=text("Sign in to share playback with your website and TV.",14,false,MUTED);
      addTop(content,hint,12);
      TextView signIn=button("Sign in to sync",PINK,Color.WHITE);
      addTop(content,signIn,12);
      signIn.setOnClickListener(v->startActivity(new Intent(this,AccountActivity.class)));
    }
    String url=getPreferences(0).getString("recentUrl",""),title=getPreferences(0).getString("recentTitle","");
    if(!url.isEmpty()){
      addTop(content,text("On this device",17,true),22);
      TextView last=button("▶   "+title,0xff20263a,Color.WHITE);
      addTop(content,last,10);last.setPadding(dp(14),dp(16),dp(14),dp(16));
      last.setOnClickListener(v->{
        Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("url",url);intent.putExtra("title",title);
        intent.putExtra("cloudKey",getPreferences(0).getString("recentKey",""));
        intent.putExtra("season",getPreferences(0).getInt("recentSeason",0));
        intent.putExtra("episode",getPreferences(0).getInt("recentEpisode",0));startActivity(intent);
      });
    }
  }
  private JSONObject findCloudEpisode(DocumentSnapshot doc){
    String key=doc.getId();
    String title=doc.getString("title");
    try{
      if(key.matches("s[0-9]+e[0-9]+")){
        int p=key.indexOf('e');int season=Integer.parseInt(key.substring(1,p));
        int ep=Integer.parseInt(key.substring(p+1));
        for(JSONObject item:episodes)if(item.optInt("season")==season&&item.optInt("episode")==ep)return item;
        JSONObject missing=new JSONObject();missing.put("season",season);missing.put("episode",ep);
        missing.put("title",title==null?"Episode "+ep:title);
        missing.put("code",String.format(Locale.US,"S%02dE%02d",season,ep));
        missing.put("videoPath","/video/"+missing.getString("code").toLowerCase(Locale.US));
        return missing;
      }
      if(key.matches("anime-[a-z0-9-]+-e[0-9]+")){
        int p=key.lastIndexOf("-e");String slug=key.substring(6,p);
        int ep=Integer.parseInt(key.substring(p+2));
        JSONObject item=new JSONObject();item.put("title",title==null?"Anime episode "+ep:title);
        item.put("code","EPISODE "+ep);
        item.put("videoPath","/video/anime/"+slug+"/e"+String.format(Locale.US,"black-clover".equals(slug)?"%03d":"%02d",ep));
        return item;
      }
    }catch(Exception ignored){}
    return null;
  }
  private void more(){
    addTop(content,text("More",30,true),12);
    int currentBuild=0;try{currentBuild=getPackageManager().getPackageInfo(getPackageName(),0).versionCode;}catch(Exception ignored){}
    addTop(content,text("APP BUILD "+currentBuild+"  •  Updates checked automatically",12,false,MUTED),7);
    String[][] links={{"◉","My Account","Account"},{"▦","All Episodes","Seasons"},{"◷","Continue Watching","Continue"},{"⬇","Check for app updates","Updates"},{"↻","Refresh library","Refresh"},{"⌕","Search","Search"},{"↗","Open website","Website"}};
    for(String[] link:links){
      TextView entry=text(link[0]+"     "+link[1]+"       →",17,true);
      entry.setPadding(dp(17),dp(20),dp(17),dp(20));entry.setBackground(solid(0xff171d2a,17));
      addTop(content,entry,12);
      entry.setOnClickListener(v->{
        if("Account".equals(link[2]))startActivity(new Intent(this,AccountActivity.class));
        else if("Updates".equals(link[2])){android.widget.Toast.makeText(this,"Checking for a newer APK…",android.widget.Toast.LENGTH_SHORT).show();checkUpdates(true);}
        else if("Refresh".equals(link[2])){refresh();open("Home");}
        else if("Website".equals(link[2]))startActivity(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse("https://miraculoushub.co.uk")));
        else open(link[2]);
      });
    }
  }
  private void bottom(LinearLayout root){
    dock=new LinearLayout(this);dock.setGravity(Gravity.CENTER);dock.setPadding(dp(7),dp(4),dp(7),dp(4));
    GradientDrawable background=gradient(0xff21182e,0xff0d1220,32);
    background.setStroke(dp(1),0xffad2760);dock.setBackground(background);dock.setElevation(dp(14));
    LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,dp(76));params.setMargins(dp(17),dp(5),dp(17),dp(13));root.addView(dock,params);
    String[][] tabs={{"Home","⌂"},{"Anime","✦"},{"Trailers","▣"},{"More","☰"}};
    for(String[] spec:tabs){
      boolean active=spec[0].equals(tab)||("Seasons".equals(tab)&&"Home".equals(spec[0]))||("Search".equals(tab)&&"More".equals(spec[0]));
      LinearLayout entry=vertical();entry.setGravity(Gravity.CENTER);
      LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-1,1);dock.addView(entry,p);
      TextView symbol=text(spec[1],26,true,active?PINK:0xffc3c2d2);symbol.setGravity(Gravity.CENTER);
      entry.addView(symbol);
      TextView label=text(spec[0],11,active,active?PINK:0xffc3c2d2);
      label.setGravity(Gravity.CENTER);entry.addView(label);
      entry.setContentDescription(spec[0]);entry.setOnClickListener(v->{if("Anime".equals(spec[0]))selectedAnime="";open(spec[0]);});
    }
  }
  private void checkUpdates(boolean manual){
    lastUpdateCheck=System.currentTimeMillis();
    new Thread(()->{try{
      URL u=new URL("https://api.github.com/repos/IbbyZaman/Miraculous/releases?per_page=15");
      HttpURLConnection c=(HttpURLConnection)u.openConnection();
      c.setConnectTimeout(7000);c.setReadTimeout(7000);
      c.setRequestProperty("Accept","application/vnd.github+json");
      c.setRequestProperty("User-Agent","MiraculousHub-Android");
      if(c.getResponseCode()!=200){c.disconnect();if(manual)handler.post(()->android.widget.Toast.makeText(this,"Update check unavailable. Please try again.",android.widget.Toast.LENGTH_LONG).show());return;}
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
      if(manual)handler.post(()->android.widget.Toast.makeText(this,"You already have the latest MiraculousHub version.",android.widget.Toast.LENGTH_LONG).show());
    }catch(Exception ignored){if(manual)handler.post(()->android.widget.Toast.makeText(this,"Unable to check for updates. Check your connection.",android.widget.Toast.LENGTH_LONG).show());} }).start();
  }

  @Override protected void onResume(){super.onResume();if(System.currentTimeMillis()-lastUpdateCheck>15*60*1000)checkUpdates(false);handler.removeCallbacks(periodicLibrarySync);handler.postDelayed(periodicLibrarySync,120000);if(System.currentTimeMillis()-lastLibrarySync>120000)refresh();}
  @Override protected void onPause(){handler.removeCallbacks(periodicLibrarySync);super.onPause();}
}
