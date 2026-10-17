package uk.co.miraculoushub.tv;

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
import android.view.ViewGroup;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainActivity extends Activity {
 static final String HOST="https://video.miraculoushub.co.uk", CATALOG="https://upload.miraculoushub.co.uk/catalog";
 final ArrayList<JSONObject> episodes=new ArrayList<>(), trailers=new ArrayList<>();
 LinearLayout root, rail, area; TextView status; String section="Home"; Handler main=new Handler(Looper.getMainLooper());
 int bg=Color.rgb(12,11,24), panel=Color.rgb(30,26,49), pink=Color.rgb(250,70,143);
 @Override public void onCreate(Bundle b){ super.onCreate(b); getWindow().getDecorView().setSystemUiVisibility(5894|1024|512); loadBundled(); render(); refresh(); }
 int dp(float n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
 GradientDrawable shape(int color,int radius){ GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d; }
 TextView text(String s,int sp,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextColor(-1);t.setTextSize(sp); if(bold)t.setTypeface(null,Typeface.BOLD);return t;}
 void loadBundled(){try(InputStream in=getAssets().open("episodes.json")){ byte[] bytes=new byte[in.available()];int n=in.read(bytes);JSONArray data=new JSONArray(new String(bytes,0,n,StandardCharsets.UTF_8));for(int i=0;i<data.length();i++)episodes.add(data.getJSONObject(i));}catch(Exception ex){ android.util.Log.e("MH","Offline library failed",ex);}}
 void refresh(){new Thread(()->{try{HttpURLConnection c=(HttpURLConnection)new URL(CATALOG).openConnection(); c.setConnectTimeout(9000);c.setReadTimeout(9000);c.setRequestProperty("Accept","application/json");if(c.getResponseCode()!=200)throw new IOException("HTTP "+c.getResponseCode());ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1 && out.size()<2_000_000)out.write(b,0,n);}JSONObject json=new JSONObject(out.toString("UTF-8"));JSONArray rows=json.getJSONArray("entries"); final ArrayList<JSONObject> updated=new ArrayList<>(episodes), ts=new ArrayList<>();for(int i=0;i<rows.length();i++){JSONObject e=rows.optJSONObject(i);if(e==null)continue;String kind=e.optString("kind");if("trailer".equals(kind)){if(e.optString("id").matches("[a-z0-9][a-z0-9-]{0,79}"))ts.add(e);continue;}if(!"episode".equals(kind))continue;int season=e.optInt("season"),episode=e.optInt("episode");String name=e.optString("title");if(season<1||season>7||episode<1||episode>99||name.isEmpty())continue;String code=String.format(Locale.US,"S%02dE%02d",season,episode);for(int j=updated.size()-1;j>=0;j--)if(updated.get(j).optString("code").equals(code))updated.remove(j);if(!e.optBoolean("available",true))continue;JSONObject copy=new JSONObject(e.toString());copy.put("code",code);copy.put("videoPath","/video/"+code.toLowerCase(Locale.US));updated.add(copy);}updated.sort((a,b)->{int c=Integer.compare(a.optInt("season"),b.optInt("season"));return c!=0?c:Integer.compare(a.optInt("episode"),b.optInt("episode"));});main.post(()->{episodes.clear();episodes.addAll(updated);trailers.clear();trailers.addAll(ts); if(status!=null)status.setText("● Live catalogue synced");render();});}catch(Exception e){main.post(()->{if(status!=null)status.setText("● Offline catalogue · Retry with Refresh");});}}).start();}
 void render(){root=new LinearLayout(this);root.setOrientation(LinearLayout.HORIZONTAL);root.setBackgroundColor(bg);setContentView(root);rail=new LinearLayout(this);rail.setOrientation(LinearLayout.VERTICAL);rail.setPadding(dp(20),dp(22),dp(16),dp(12));rail.setBackgroundColor(0xff171326);root.addView(rail,new LinearLayout.LayoutParams(dp(216),-1));TextView logo=text("MIRACULOUS\nHUB  TV",24,true);logo.setTextColor(pink);rail.addView(logo);space(rail,25);for(String s:new String[]{"Home","Seasons","Latest","Trailers","Continue Watching","Refresh"}){TextView nav=text((s.equals(section)?"▸  ":"    ")+s,17,true);nav.setPadding(dp(13),dp(13),dp(8),dp(13));nav.setFocusable(true);nav.setBackground(shape(s.equals(section)?0xff48233e:0xff171326,12));nav.setOnFocusChangeListener((v,focused)->nav.setBackground(shape(focused?pink:s.equals(section)?0xff48233e:0xff171326,12)));nav.setOnClickListener(v->{if(s.equals("Refresh")){refresh();return;}section=s;render();});rail.addView(nav,new LinearLayout.LayoutParams(-1,dp(54)));}space(rail,18);status=text("● Checking for updates…",11,false);status.setTextColor(0xffbfb3cd);rail.addView(status);
 ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);root.addView(scroll,new LinearLayout.LayoutParams(0,-1,1));area=new LinearLayout(this);area.setOrientation(LinearLayout.VERTICAL);area.setPadding(dp(30),dp(25),dp(28),dp(30));scroll.addView(area);
 TextView heading=text(section.equals("Home")?"Welcome to MiraculousHub":section,30,true);area.addView(heading);space(area,7);TextView sub=text("Your shows, made for the big screen.",15,false);sub.setTextColor(0xffc1b6cf);area.addView(sub);space(area,25);
 if(section.equals("Continue Watching")){recent();return;}if(section.equals("Trailers")){drawRow("Uploaded trailers",trailers);return;}if(section.equals("Latest")){ArrayList<JSONObject> latest=new ArrayList<>(episodes);Collections.reverse(latest);drawRow("Latest episodes",new ArrayList<>(latest.subList(0,Math.min(28,latest.size()))));return;}
 if(section.equals("Home")){ArrayList<JSONObject> latest=new ArrayList<>(episodes);Collections.reverse(latest);drawRow("Recently added",new ArrayList<>(latest.subList(0,Math.min(14,latest.size()))));}
 for(int season=7;season>=1;season--){ArrayList<JSONObject> list=new ArrayList<>();for(JSONObject e:episodes)if(e.optInt("season")==season)list.add(e);if(!list.isEmpty())drawRow("Season "+season,list);}
 }
 void recent(){String code=getPreferences(0).getString("recent","");ArrayList<JSONObject> row=new ArrayList<>();for(JSONObject e:episodes)if(code.equals(e.optString("code")))row.add(e);drawRow("Pick up where you left off",row);}
 void drawRow(String title,ArrayList<JSONObject> list){TextView h=text(title,21,true);area.addView(h);space(area,12);if(list.isEmpty()){TextView empty=text("Nothing here yet",15,false);area.addView(empty);space(area,20);return;}HorizontalScrollView hs=new HorizontalScrollView(this);hs.setHorizontalScrollBarEnabled(false);LinearLayout strip=new LinearLayout(this);strip.setOrientation(LinearLayout.HORIZONTAL);strip.setPadding(dp(2),dp(3),dp(3),dp(8));hs.addView(strip);area.addView(hs);for(JSONObject e:list){String label=e.optString("title","Episode");boolean trailer="trailer".equals(e.optString("kind"));String code=trailer?"TRAILER":e.optString("code");LinearLayout card=new LinearLayout(this);card.setFocusable(true);card.setClickable(true);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(15),dp(14),dp(14),dp(13));card.setBackground(shape(panel,13));LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(dp(214),dp(122));cp.rightMargin=dp(13);strip.addView(card,cp);TextView mark=text(trailer?"▶  TRAILER":code,13,true);mark.setTextColor(pink);card.addView(mark);space(card,12);TextView ep=text(label,17,true);ep.setMaxLines(2);card.addView(ep);card.setOnFocusChangeListener((v,f)->{card.setBackground(shape(f?pink:panel,13));mark.setTextColor(f?Color.WHITE:pink);card.setScaleX(f?1.04f:1);card.setScaleY(f?1.04f:1);if(f)hs.smoothScrollTo(Math.max(0,card.getLeft()-dp(50)),0);});card.setOnClickListener(v->{String uri=trailer?"https://upload.miraculoushub.co.uk/trailer?id="+e.optString("id"):HOST+e.optString("videoPath");if(!trailer)getPreferences(0).edit().putString("recent",code).apply();Intent intent=new Intent(this,PlayerActivity.class);intent.putExtra("url",uri);intent.putExtra("title",label);startActivity(intent);});}space(area,24);}
 void space(LinearLayout parent,int h){View v=new View(this);parent.addView(v,new LinearLayout.LayoutParams(1,dp(h)));}
 @Override protected void onResume(){super.onResume();if("Continue Watching".equals(section)&&root!=null)render();}
}
