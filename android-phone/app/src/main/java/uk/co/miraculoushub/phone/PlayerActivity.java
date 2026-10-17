package uk.co.miraculoushub.phone;
import android.app.Activity;
import android.os.Bundle;
import android.content.pm.ActivityInfo;
import android.widget.Toast;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
public class PlayerActivity extends Activity {
  private ExoPlayer player;
  @Override public void onCreate(Bundle b){super.onCreate(b);setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);String url=getIntent().getStringExtra("url");if(url==null||!url.startsWith("https://")){finish();return;}PlayerView screen=new PlayerView(this);screen.setUseController(true);setContentView(screen);player=new ExoPlayer.Builder(this).build();screen.setPlayer(player);player.addListener(new Player.Listener(){@Override public void onPlayerError(PlaybackException e){Toast.makeText(PlayerActivity.this,"Playback failed: "+e.getErrorCodeName(),Toast.LENGTH_LONG).show();}});player.setMediaItem(MediaItem.fromUri(url));player.prepare();player.play();}
  @Override protected void onStop(){super.onStop();if(player!=null){player.release();player=null;}}
}
