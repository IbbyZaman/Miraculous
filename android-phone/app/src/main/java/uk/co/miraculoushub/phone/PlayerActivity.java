package uk.co.miraculoushub.phone;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.Source;
import com.google.firebase.firestore.FieldValue;
import com.google.firebase.firestore.SetOptions;

public class PlayerActivity extends Activity {
  private static final int PINK=0xffff2f68;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private ExoPlayer player;
  private LinearLayout top, bottom, center;
  private TextView playPause,elapsed,remaining,buffer;
  private SeekBar timeline;
  private boolean seeking=false, controlsVisible=true,controlsLocked=false;
  private TextView lockButton;
  private String nextUrl="",nextTitle="";
  private DocumentReference cloudDocument;
  private String cloudKey,cloudTitle,accountScope="guest";
  private int cloudSeason,cloudEpisode;
  private boolean cloudReady=false,userSeeked=false;
  private long lastCloudWrite=0;
  private long pendingResumeMs=-1;
  private boolean resumeLoaded=false;
  private final Runnable cloudTimer=new Runnable(){@Override public void run(){
    savePlayback(false);
    if(player!=null)handler.postDelayed(this,1000);
  }};
  private final Runnable hideControls=()->setControls(false);
  private final Runnable progress=new Runnable(){
    @Override public void run(){
      if(player!=null){
        long position=Math.max(0,player.getCurrentPosition()),duration=player.getDuration();
        if(duration>0&&!seeking&&timeline!=null)timeline.setProgress((int)Math.min(1000,1000d*position/duration));
        if(elapsed!=null)elapsed.setText(clock(position));
        if(remaining!=null)remaining.setText(duration>0?clock(duration):"--:--");
        if(playPause!=null)playPause.setText(player.isPlaying()?"Ⅱ":"▶");
        handler.postDelayed(this,450);
      }
    }
  };
  private int dp(float v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
  private GradientDrawable round(int c,int radius){GradientDrawable d=new GradientDrawable();d.setColor(c);d.setCornerRadius(dp(radius));return d;}
  private GradientDrawable fade(boolean top){
    return new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
      top?new int[]{0xdf080a11,0x00080a11}:new int[]{0x00080a11,0xf5080a11});
  }
  private TextView label(String s,int size,boolean bold){
    TextView t=new TextView(this);t.setText(s);t.setTextColor(Color.WHITE);t.setTextSize(size);
    if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
  }
  private TextView control(String s,int size,int w,int h,LinearLayout row){
    TextView t=label(s,size,true);t.setGravity(Gravity.CENTER);t.setBackground(round(0xa91b1d2b,100));
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(w),dp(h));p.setMargins(dp(10),0,dp(10),0);row.addView(t,p);return t;
  }
  private static String clock(long ms){
    long sec=Math.max(0,ms)/1000;
    return String.format(Locale.US,"%02d:%02d",sec/60,sec%60);
  }
  private void immersive(){
    getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
    getWindow().getDecorView().setSystemUiVisibility(
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  }
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    immersive();
    String url=getIntent().getStringExtra("url"),title=getIntent().getStringExtra("title");
    cloudTitle=title==null?"Episode":title;cloudSeason=getIntent().getIntExtra("season",0);
    cloudEpisode=getIntent().getIntExtra("episode",0);
    nextUrl=getIntent().getStringExtra("nextUrl");nextTitle=getIntent().getStringExtra("nextTitle");
    cloudKey=getIntent().getStringExtra("cloudKey");
    FirebaseUser signedIn=FirebaseAuth.getInstance().getCurrentUser();
    if(signedIn!=null)accountScope=signedIn.getUid();
    if(signedIn!=null&&cloudKey!=null&&cloudKey.matches("[a-z0-9-]{2,100}"))
      cloudDocument=FirebaseFirestore.getInstance().collection("users").document(signedIn.getUid())
        .collection("playback").document(cloudKey);
    if(url==null||!url.startsWith("https://")){finish();return;}
    FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);setContentView(root);
    PlayerView video=new PlayerView(this);video.setUseController(false);video.setKeepScreenOn(true);
    root.addView(video,new FrameLayout.LayoutParams(-1,-1));
    View hitArea=new View(this);root.addView(hitArea,new FrameLayout.LayoutParams(-1,-1));
    hitArea.setOnClickListener(v->{if(controlsLocked){if(lockButton!=null)lockButton.setVisibility(lockButton.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE);}else setControls(!controlsVisible);});
    top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);
    top.setPadding(dp(19),dp(8),dp(18),dp(10));top.setBackground(fade(true));
    FrameLayout.LayoutParams topP=new FrameLayout.LayoutParams(-1,dp(72),Gravity.TOP);root.addView(top,topP);
    TextView back=label("‹",36,false);back.setGravity(Gravity.CENTER);
    top.addView(back,new LinearLayout.LayoutParams(dp(52),-1));back.setOnClickListener(v->finish());
    TextView titleLabel=label(title==null?"MiraculousHub":title,18,true);
    titleLabel.setMaxLines(1);titleLabel.setEllipsize(TextUtils.TruncateAt.END);
    top.addView(titleLabel,new LinearLayout.LayoutParams(0,-2,1));
    lockButton=label("🔒 Lock",13,true);lockButton.setPadding(dp(14),dp(12),dp(14),dp(12));lockButton.setBackground(round(0xb022182c,13));
    FrameLayout.LayoutParams lockParams=new FrameLayout.LayoutParams(dp(100),dp(48),Gravity.TOP|Gravity.RIGHT);lockParams.setMargins(0,dp(11),dp(15),0);root.addView(lockButton,lockParams);lockButton.setGravity(Gravity.CENTER);lockButton.setOnClickListener(v->toggleLock());
    TextView brand=label("  ✦",18,true);brand.setTextColor(0xffff81a9);top.addView(brand);
    center=new LinearLayout(this);center.setGravity(Gravity.CENTER);
    FrameLayout.LayoutParams centerP=new FrameLayout.LayoutParams(-2,-2,Gravity.CENTER);root.addView(center,centerP);
    TextView back10=control("↶ 10",17,78,58,center);
    playPause=control("▶",34,80,80,center);
    playPause.setBackground(round(PINK,100));
    TextView forward10=control("10 ↷",17,78,58,center);
    back10.setOnClickListener(v->{userSeeked=true;skip(-10000);showTemporarily();});
    forward10.setOnClickListener(v->{userSeeked=true;skip(10000);showTemporarily();});
    playPause.setOnClickListener(v->{
      if(player==null)return;
      if(player.isPlaying())player.pause();else player.play();
      showTemporarily();
    });
    bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.VERTICAL);
    bottom.setPadding(dp(26),dp(20),dp(26),dp(14));bottom.setBackground(fade(false));
    FrameLayout.LayoutParams bottomP=new FrameLayout.LayoutParams(-1,dp(95),Gravity.BOTTOM);root.addView(bottom,bottomP);
    timeline=new SeekBar(this);timeline.setMax(1000);timeline.setProgressTintList(android.content.res.ColorStateList.valueOf(PINK));
    timeline.setThumbTintList(android.content.res.ColorStateList.valueOf(PINK));
    bottom.addView(timeline,new LinearLayout.LayoutParams(-1,dp(42)));
    timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
      public void onStartTrackingTouch(SeekBar s){seeking=true;userSeeked=true;handler.removeCallbacks(hideControls);}
      public void onProgressChanged(SeekBar s,int p,boolean fromUser){
        if(fromUser&&player!=null&&player.getDuration()>0&&elapsed!=null)
          elapsed.setText(clock((long)(player.getDuration()*p/1000.0)));
      }
      public void onStopTrackingTouch(SeekBar s){
        if(player!=null&&player.getDuration()>0)player.seekTo((long)(player.getDuration()*s.getProgress()/1000.0));
        seeking=false;showTemporarily();
      }
    });
    LinearLayout times=new LinearLayout(this);times.setGravity(Gravity.CENTER_VERTICAL);bottom.addView(times);
    elapsed=label("00:00",13,true);times.addView(elapsed);
    TextView split=label(" / ",13,false);split.setTextColor(0xffa2aab8);times.addView(split);
    remaining=label("--:--",13,false);times.addView(remaining);
    View spacer=new View(this);times.addView(spacer,new LinearLayout.LayoutParams(0,dp(1),1));
    TextView next=label(nextUrl!=null&&nextUrl.startsWith("https://")?"Next episode  ❯":"✦ MIRACULOUSHUB",13,true);next.setTextColor(0xffff90b6);next.setPadding(dp(12),dp(5),0,dp(5));times.addView(next);
    if(nextUrl!=null&&nextUrl.startsWith("https://"))next.setOnClickListener(v->{
      savePlayback(true);
      android.content.Intent intent=new android.content.Intent(this,PlayerActivity.class);
      intent.putExtra("url",nextUrl);intent.putExtra("title",nextTitle);
      intent.putExtra("season",cloudSeason);intent.putExtra("episode",cloudEpisode+1);
      intent.putExtra("cloudKey","s"+cloudSeason+"e"+(cloudEpisode+1));startActivity(intent);finish();
    });
    buffer=label("Loading video…",14,true);buffer.setGravity(Gravity.CENTER);
    buffer.setPadding(dp(19),dp(12),dp(19),dp(12));buffer.setBackground(round(0xde171d2b,15));
    FrameLayout.LayoutParams bp=new FrameLayout.LayoutParams(-2,-2,Gravity.CENTER);
    bp.topMargin=dp(102);root.addView(buffer,bp);
    player=new ExoPlayer.Builder(this).build();video.setPlayer(player);
    player.addListener(new Player.Listener(){
      @Override public void onPlaybackStateChanged(int state){
        if(buffer==null)return;
        if(state==Player.STATE_READY){
          if(pendingResumeMs>0&&!userSeeked){long d=player.getDuration();if(d<=0||pendingResumeMs<d-4000)player.seekTo(pendingResumeMs);pendingResumeMs=-1;}
          buffer.setVisibility(View.GONE);showTemporarily();}
        else if(state==Player.STATE_BUFFERING){buffer.setText("Buffering…");buffer.setVisibility(View.VISIBLE);}
        else if(state==Player.STATE_ENDED){setControls(true);buffer.setVisibility(View.GONE);}
      }
      @Override public void onIsPlayingChanged(boolean playing){
        if(playPause!=null)playPause.setText(playing?"Ⅱ":"▶");
      }
      @Override public void onPlayerError(PlaybackException e){
        buffer.setText("Can't play this video. Check its upload and stream permissions.");
        buffer.setVisibility(View.VISIBLE);setControls(true);
      }
    });
    player.setMediaItem(MediaItem.fromUri(url));
    if(cloudDocument==null&&cloudKey!=null&&!cloudKey.isEmpty()){
      pendingResumeMs=getSharedPreferences("mh-playback-cache",MODE_PRIVATE).getLong(accountScope+":"+cloudKey,0L);
    }
    player.prepare();player.play();
    if(cloudDocument!=null){
      // Always read the server resume point BEFORE uploading initial position 0:00.
      cloudDocument.get(Source.SERVER).addOnCompleteListener(this,result->{
        if(player==null)return;
        if(!result.isSuccessful()){
          // Do not overwrite a possibly newer server checkpoint while offline.
          cloudReady=false;
          android.util.Log.w("MiraculousHub","Cloud resume unavailable",result.getException());
          return;
        }
        DocumentSnapshot record=result.getResult();
        Object current=record==null?null:record.get("position");
        if(!userSeeked&&current instanceof Number){
          long position=(long)(((Number)current).doubleValue()*1000);
          long duration=player.getDuration();
          if(position>0&&(duration<=0||position<duration-4000)){
            if(player.getPlaybackState()==Player.STATE_READY)player.seekTo(position);
            else pendingResumeMs=position;
          }
        }
        cloudReady=true;resumeLoaded=true;
      });
    }
    handler.post(progress);handler.postDelayed(cloudTimer,6000);showTemporarily();
  }
  private void skip(long ms){
    if(player!=null)player.seekTo(Math.max(0,player.getCurrentPosition()+ms));
  }
  private void toggleLock(){
    controlsLocked=!controlsLocked;
    if(controlsLocked){handler.removeCallbacks(hideControls);top.setVisibility(View.GONE);bottom.setVisibility(View.GONE);center.setVisibility(View.GONE);lockButton.setText("🔓 Unlock");lockButton.setVisibility(View.VISIBLE);}
    else{lockButton.setText("🔒 Lock");showTemporarily();}
  }
  private void setControls(boolean show){
    if(controlsLocked)return;
    controlsVisible=show;
    if(top!=null)top.setVisibility(show?View.VISIBLE:View.GONE);
    if(bottom!=null)bottom.setVisibility(show?View.VISIBLE:View.GONE);
    if(center!=null)center.setVisibility(show?View.VISIBLE:View.GONE);
    if(lockButton!=null)lockButton.setVisibility(show?View.VISIBLE:View.GONE);
    immersive();
  }
  private void showTemporarily(){
    setControls(true);handler.removeCallbacks(hideControls);
    if(player!=null&&player.isPlaying())handler.postDelayed(hideControls,4200);
  }
  private void savePlayback(boolean force){
    if(player==null||cloudKey==null||cloudKey.isEmpty())return;
    long position=player.getCurrentPosition(),duration=player.getDuration();
    if(position<0||duration<=0)return;
    if(!force&&!player.isPlaying())return;
    // Keep a device checkpoint, too, for guests and interrupted connections.
    getSharedPreferences("mh-playback-cache",MODE_PRIVATE).edit()
      .putLong(accountScope+":"+cloudKey,position).apply();
    if(cloudDocument==null||!cloudReady||position<1000)return;
    if(!force&&System.currentTimeMillis()-lastCloudWrite<1000)return;
    lastCloudWrite=System.currentTimeMillis();
    Map<String,Object> values=new HashMap<>();
    values.put("type",cloudKey.startsWith("anime-")?"anime":"episode");
    values.put("season",cloudSeason);values.put("episode",cloudEpisode);
    if(cloudKey.startsWith("anime-")){
      int i=cloudKey.lastIndexOf("-e");
      if(i>6)values.put("animeSlug",cloudKey.substring(6,i));
    }
    values.put("title",cloudTitle);values.put("position",position/1000.0);
    values.put("duration",duration/1000.0);
    values.put("progress",Math.max(0,Math.min(100,position*100.0/duration)));
    values.put("updatedAt",FieldValue.serverTimestamp());
    cloudDocument.set(values,SetOptions.merge()).addOnFailureListener(e->
      android.util.Log.w("MiraculousHub","Could not sync playback",e));
  }
  @Override protected void onStop(){
    savePlayback(true);
    handler.removeCallbacks(hideControls);handler.removeCallbacks(progress);handler.removeCallbacks(cloudTimer);
    if(player!=null){player.release();player=null;}
    super.onStop();
  }
}