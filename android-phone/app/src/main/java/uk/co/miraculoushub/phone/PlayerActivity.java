package uk.co.miraculoushub.phone;
import android.app.Activity;
import android.os.Bundle;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
public class PlayerActivity extends Activity {
  private ExoPlayer player;
  private PlayerView screen;
  private TextView status;
  private int dp(int n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
  private GradientDrawable fill(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(13));return d;}
  @Override public void onCreate(Bundle b){
    super.onCreate(b);setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    getWindow().setStatusBarColor(Color.BLACK);getWindow().setNavigationBarColor(Color.BLACK);
    String url=getIntent().getStringExtra("url"),title=getIntent().getStringExtra("title");
    if(url==null||!url.startsWith("https://")){finish();return;}
    android.widget.FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(0xff07080e);setContentView(frame);
    screen=new PlayerView(this);screen.setUseController(true);screen.setKeepScreenOn(true);
    screen.setControllerShowTimeoutMs(4000);screen.setControllerAutoShow(true);
    frame.addView(screen,new FrameLayout.LayoutParams(-1,-1));
    LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(18),dp(10),dp(18),dp(10));
    GradientDrawable fade=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0xee090914,0x00090914});
    top.setBackground(fade);
    FrameLayout.LayoutParams tp=new FrameLayout.LayoutParams(-1,dp(76),Gravity.TOP);frame.addView(top,tp);
    TextView back=new TextView(this);back.setText("‹");back.setTextSize(34);back.setGravity(Gravity.CENTER);back.setTextColor(-1);
    top.addView(back,new LinearLayout.LayoutParams(dp(44),-1));back.setOnClickListener(v->finish());
    TextView name=new TextView(this);name.setText(title==null?"MiraculousHub":title);name.setTextSize(18);name.setTypeface(null,Typeface.BOLD);name.setSingleLine(true);name.setEllipsize(android.text.TextUtils.TruncateAt.END);name.setTextColor(-1);top.addView(name,new LinearLayout.LayoutParams(0,-2,1));
    status=new TextView(this);status.setText("Loading video…");status.setTextSize(13);status.setTextColor(0xffffb8cf);status.setGravity(Gravity.CENTER);status.setBackground(fill(0xcc1d1724));status.setPadding(dp(16),dp(12),dp(16),dp(12));
    FrameLayout.LayoutParams sp=new FrameLayout.LayoutParams(-2,-2,Gravity.CENTER);frame.addView(status,sp);
    player=new ExoPlayer.Builder(this).build();screen.setPlayer(player);
    player.addListener(new Player.Listener(){
      @Override public void onPlaybackStateChanged(int state){if(status!=null)status.setVisibility(state==Player.STATE_READY?View.GONE:View.VISIBLE);if(state==Player.STATE_BUFFERING&&status!=null)status.setText("Buffering…");}
      @Override public void onPlayerError(PlaybackException e){if(status!=null){status.setVisibility(View.VISIBLE);status.setText("Unable to play this video. Check the upload or stream access.");}}
    });
    player.setMediaItem(MediaItem.fromUri(url));player.prepare();player.play();
  }
  @Override protected void onStop(){super.onStop();if(player!=null){player.release();player=null;}}
}