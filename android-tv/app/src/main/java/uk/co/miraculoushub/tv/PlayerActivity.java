package uk.co.miraculoushub.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public class PlayerActivity extends Activity {
 private ExoPlayer player;
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().getDecorView().setSystemUiVisibility(5894|1024|512);PlayerView screen=new PlayerView(this);screen.setUseController(true);screen.setControllerShowTimeoutMs(4000);screen.setBackgroundColor(0xff000000);setContentView(screen);String url=getIntent().getStringExtra("url");if(url==null||!url.startsWith("https://")){finish();return;}player=new ExoPlayer.Builder(this).build();screen.setPlayer(player);player.addListener(new Player.Listener(){@Override public void onPlayerError(PlaybackException error){Toast.makeText(PlayerActivity.this,"Video unavailable: "+error.getErrorCodeName(),Toast.LENGTH_LONG).show();}});player.setMediaItem(MediaItem.fromUri(url));player.prepare();player.play();}
 @Override protected void onStop(){super.onStop();if(player!=null){player.release();player=null;}}
}
