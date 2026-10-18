package uk.co.miraculoushub.tv;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public class PlayerActivity extends Activity {
  private final Handler handler=new Handler(Looper.getMainLooper());
  private ExoPlayer player;
  private PlayerView video;
  private TextView status,heading;
  private ProgressBar loading;
  private int dp(int n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
  private void immersive(){
    getWindow().getDecorView().setSystemUiVisibility(
      View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|
      View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  }
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);immersive();
    String uri=getIntent().getStringExtra("url"),title=getIntent().getStringExtra("title");
    if(uri==null||!uri.startsWith("https://")){finish();return;}
    FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);setContentView(root);
    video=new PlayerView(this);video.setUseController(true);video.setControllerShowTimeoutMs(5500);
    video.setControllerAutoShow(true);video.setKeepScreenOn(true);video.setFocusable(true);
    root.addView(video,new FrameLayout.LayoutParams(-1,-1));
    LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);
    top.setPadding(dp(26),dp(10),dp(26),dp(18));
    top.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0xe8080b12,0x00080b12}));
    FrameLayout.LayoutParams tp=new FrameLayout.LayoutParams(-1,dp(86),Gravity.TOP);root.addView(top,tp);
    TextView back=new TextView(this);back.setText("‹");back.setTextSize(38);back.setTextColor(-1);
    back.setGravity(Gravity.CENTER);back.setFocusable(true);top.addView(back,new LinearLayout.LayoutParams(dp(64),-1));
    back.setOnClickListener(v->finish());
    LinearLayout names=new LinearLayout(this);names.setOrientation(LinearLayout.VERTICAL);
    names.setPadding(dp(14),0,0,0);top.addView(names,new LinearLayout.LayoutParams(0,-2,1));
    TextView tag=new TextView(this);tag.setText("MIRACULOUSHUB TV  •  NOW PLAYING");
    tag.setTextColor(0xffff84aa);tag.setTextSize(11);tag.setTypeface(null,Typeface.BOLD);
    names.addView(tag);
    heading=new TextView(this);heading.setText(title==null?"Episode":title);heading.setTextColor(-1);
    heading.setTextSize(23);heading.setTypeface(null,Typeface.BOLD);heading.setSingleLine(true);
    heading.setEllipsize(TextUtils.TruncateAt.END);names.addView(heading);
    LinearLayout center=new LinearLayout(this);center.setGravity(Gravity.CENTER);
    FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(-2,-2,Gravity.CENTER);root.addView(center,cp);
    loading=new ProgressBar(this);loading.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(0xffff376f));
    center.addView(loading,new LinearLayout.LayoutParams(dp(40),dp(40)));
    status=new TextView(this);status.setTextColor(0xffffb3ce);status.setTextSize(14);
    status.setBackgroundColor(0xaa0a0e16);status.setPadding(dp(16),dp(13),dp(16),dp(13));
    FrameLayout.LayoutParams sp=new FrameLayout.LayoutParams(-2,-2,Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
    sp.bottomMargin=dp(120);root.addView(status,sp);status.setVisibility(View.GONE);
    player=new ExoPlayer.Builder(this).build();video.setPlayer(player);
    player.addListener(new Player.Listener(){
      @Override public void onPlaybackStateChanged(int state){
        loading.setVisibility(state==Player.STATE_BUFFERING||state==Player.STATE_IDLE?View.VISIBLE:View.GONE);
      }
      @Override public void onPlayerError(PlaybackException error){
        loading.setVisibility(View.GONE);status.setVisibility(View.VISIBLE);
        status.setText("This video is unavailable. Check the stream or upload.");
      }
    });
    player.setMediaItem(MediaItem.fromUri(uri));player.prepare();player.play();
    video.requestFocus();
    handler.postDelayed(()->{if(top!=null&&player!=null&&player.isPlaying())top.animate().alpha(0f).setDuration(350);},6500);
    video.setOnClickListener(v->top.animate().alpha(1f).setDuration(170));
  }
  @Override public boolean dispatchKeyEvent(KeyEvent event){
    if(event.getAction()==KeyEvent.ACTION_DOWN&&player!=null){
      if(event.getKeyCode()==KeyEvent.KEYCODE_MEDIA_FAST_FORWARD){player.seekTo(player.getCurrentPosition()+10000);return true;}
      if(event.getKeyCode()==KeyEvent.KEYCODE_MEDIA_REWIND){player.seekTo(Math.max(0,player.getCurrentPosition()-10000));return true;}
    }
    return super.dispatchKeyEvent(event);
  }
  @Override protected void onStop(){
    super.onStop();handler.removeCallbacksAndMessages(null);
    if(player!=null){player.release();player=null;}
  }
}
