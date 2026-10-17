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
  private String tab="Home", query="";
  private final int background=0xff0b0914, surface=0xff21182f, accent=0xffff477f;

  @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setStatusBarColor(background);getWindow().setNavigationBarColor(background);loadAssets();rebuild();refresh();}
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
    LinearLayout header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(20),dp(16),dp(12),dp(12));root.addView(header);
    TextView logo=text("● MIRACULOUS",22,true);logo.setTextColor(accent);header.addView(logo,new LinearLayout.LayoutParams(0,-2,1));
    TextView sync=text("⟳",28,true);sync.setGravity(Gravity.CENTER);sync.setContentDescription("Refresh episodes");sync.setOnClickListener(v->{status.setText("Refreshing…");refresh();});header.addView(sync,new LinearLayout.LayoutParams(dp(50),dp(44)));
    ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(16),dp(8),dp(16),dp(18));scroll.addView(content);
    status=text("MiraculousHub on your phone",12,false);status.setTextColor(0xffb9a9c3);content.addView(status);
    TextView heading=text("Home".equals(tab)?"Discover":"Continue".equals(tab)?"Keep watching":tab,30,true);LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(-1,-2);titleParams.topMargin=dp(16);content.addView(heading,titleParams);
    if("Search".equals(tab)){EditText search=new EditText(this);search.setSingleLine(true);search.setTextColor(-1);search.setHintTextColor(0xffa6a0b4);search.setHint("Search episode titles");search.setText(query);search.setBackground(bg(surface,12));search.setPadding(dp(14),dp(12),dp(14),dp(12));content.addView(search);search.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){query=s.toString();drawSearchResults();}public void afterTextChanged(android.text.Editable e){}});resultsHolder=new LinearLayout(this);resultsHolder.setOrientation(LinearLayout.VERTICAL);content.addView(resultsHolder);drawSearchResults();}
    else if("Continue".equals(tab)){String recent=getPreferences(0).getString("recent","");ArrayList<JSONObject> matches=new ArrayList<>();for(JSONObject e:episodes)if(recent.equals(e.optString("code")))matches.add(e);row("Continue watching",matches);}
    else if("Trailers".equals(tab)){row("Uploaded trailers",trailers);}
    else if("Seasons".equals(tab)){for(int season=7;season>=1;season--){ArrayList<JSONObject> items=new ArrayList<>();for(JSONObject e:episodes)if(e.optInt("season")==season)items.add(e);if(!items.isEmpty())row("Season "+season,items);}}
    else{
      TextView hero=text("THE MIRACULOUS COLLECTION\nWatch your favourite adventures",23,true);
      hero.setGravity(Gravity.CENTER_VERTICAL);hero.setPadding(dp(22),dp(24),dp(22),dp(24));
      android.graphics.drawable.GradientDrawable heroBg=new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,new int[]{0xff9a235c,0xff4c215c,0xff15122b});heroBg.setCornerRadius(dp(20));hero.setBackground(heroBg);
      LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(154));hp.topMargin=dp(18);content.addView(hero,hp);
      ArrayList<JSONObject> latest=new ArrayList<>(episodes);Collections.reverse(latest);
      row("Recently added",new ArrayList<>(latest.subList(0,Math.min(16,latest.size()))));
      row("Trailers & previews",trailers);
    }
    nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER);nav.setPadding(dp(4),dp(8),dp(4),dp(8));nav.setBackgroundColor(0xff171120);root.addView(nav);
    for(String name:new String[]{"Home","Seasons","Search","Trailers","Continue","Account"}){TextView button=text(("Home".equals(name)?"⌂ ":"Seasons".equals(name)?"▦ ":"Search".equals(name)?"⌕ ":"Trailers".equals(name)?"▶ ":"Continue".equals(name)?"◷ ":"♙ ")+name,10,name.equals(tab));button.setGravity(Gravity.CENTER);button.setTextColor(name.equals(tab)?accent:-1);button.setPadding(dp(2),dp(14),dp(2),dp(14));button.setOnClickListener(v->{if("Account".equals(name)){startActivity(new Intent(this,AccountActivity.class));return;}tab=name;rebuild();});nav.addView(button,new LinearLayout.LayoutParams(0,-2,1));}
  }
  private LinearLayout resultsHolder;
  private void drawSearchResults(){if(resultsHolder==null)return;resultsHolder.removeAllViews();String q=query.toLowerCase(Locale.ROOT).trim();if(q.isEmpty())return;int count=0;for(JSONObject e:episodes){if(e.optString("title").toLowerCase(Locale.ROOT).contains(q)||e.optString("code").toLowerCase(Locale.ROOT).contains(q)){card(resultsHolder,e);if(++count>=60)break;}}if(count==0)resultsHolder.addView(text("No matching episodes",15,false));}
  private void row(String heading,ArrayList<JSONObject> data){TextView title=text(heading,19,true);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(24);p.bottomMargin=dp(10);content.addView(title,p);if(data.isEmpty()){TextView empty=text("Nothing here yet",14,false);empty.setTextColor(0xffaaa1b5);content.addView(empty);return;}for(JSONObject e:data)card(content,e);}
  private void card(LinearLayout parent,JSONObject e){String code=e.optString("code"),name=e.optString("title","Episode");boolean trailer="trailer".equals(e.optString("kind"));
    LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.VERTICAL);item.setPadding(dp(17),dp(18),dp(17),dp(18));item.setBackground(bg(surface,18));item.setElevation(dp(2));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(10);parent.addView(item,lp);
    TextView eyebrow=text(trailer?"▶  EXCLUSIVE TRAILER":"●  "+code,12,true);eyebrow.setTextColor(accent);item.addView(eyebrow);TextView label=text(name,17,true);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(5);item.addView(label,p);TextView play=text("Play episode   →",12,true);play.setTextColor(0xffeec3d8);LinearLayout.LayoutParams playParams=new LinearLayout.LayoutParams(-1,-2);playParams.topMargin=dp(12);item.addView(play,playParams);
    item.setOnClickListener(v->{String url=trailer?"https://upload.miraculoushub.co.uk/trailer?id="+e.optString("id"):HOST+e.optString("videoPath");if(!trailer)getPreferences(0).edit().putString("recent",code).apply();Intent play=new Intent(this,PlayerActivity.class);play.putExtra("url",url);play.putExtra("title",name);startActivity(play);});
  }
  @Override protected void onResume(){super.onResume();if(content!=null&&"Continue".equals(tab))rebuild();}
}
