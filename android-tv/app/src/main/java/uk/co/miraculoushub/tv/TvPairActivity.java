package uk.co.miraculoushub.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class TvPairActivity extends Activity {
  private static final String SERVER="https://upload.miraculoushub.co.uk";
  private final Handler handler=new Handler(Looper.getMainLooper());
  private TextView codeText,status;
  private ImageView qr;
  private String pair,secret;
  private long expiresAt;
  private boolean active=true,checking=false;
  private final Runnable poll=new Runnable(){@Override public void run(){if(active)checkStatus();}};
  private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
  private GradientDrawable fill(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));return g;}
  private TextView label(String content,int size,boolean bold,int color){
    TextView t=new TextView(this);t.setText(content);t.setTextSize(size);t.setTextColor(color);
    if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
  }
  private TextView button(String caption,LinearLayout parent,Runnable action){
    TextView v=label(caption,16,true,Color.WHITE);v.setFocusable(true);v.setGravity(Gravity.CENTER);
    v.setBackground(fill(0xff323b50,14));
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(205),dp(54));p.rightMargin=dp(14);
    parent.addView(v,p);
    v.setOnFocusChangeListener((w,f)->{v.setBackground(fill(f?0xffff376f:0xff323b50,14));v.animate().scaleX(f?1.04f:1).scaleY(f?1.04f:1).setDuration(120).start();});
    v.setOnClickListener(w->action.run());return v;
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    LinearLayout whole=new LinearLayout(this);whole.setGravity(Gravity.CENTER);whole.setBackgroundColor(0xff080c15);
    whole.setPadding(dp(40),dp(30),dp(40),dp(30));setContentView(whole);
    LinearLayout left=new LinearLayout(this);left.setOrientation(LinearLayout.VERTICAL);
    whole.addView(left,new LinearLayout.LayoutParams(0,-2,1));
    TextView kicker=label("MIRACULOUSHUB  •  LINK A DEVICE",15,true,0xffff8dae);left.addView(kicker);
    TextView title=label("Sign in with your phone",35,true,Color.WHITE);
    LinearLayout.LayoutParams titleP=new LinearLayout.LayoutParams(-1,-2);titleP.topMargin=dp(16);left.addView(title,titleP);
    TextView desc=label("1. Scan the QR code with your phone camera.\n2. Sign in on miraculoushub.co.uk.\n3. Confirm that the code matches this TV.\n4. Approve. This TV signs in automatically.",18,false,0xffc4cbd9);
    desc.setLineSpacing(dp(5),1f);LinearLayout.LayoutParams descP=new LinearLayout.LayoutParams(-1,-2);descP.topMargin=dp(20);left.addView(desc,descP);
    codeText=label("··· ···",40,true,Color.WHITE);codeText.setLetterSpacing(.20f);
    LinearLayout.LayoutParams codeP=new LinearLayout.LayoutParams(-1,-2);codeP.topMargin=dp(25);left.addView(codeText,codeP);
    status=label("Creating a secure pairing code…",15,false,0xffffa6c5);
    LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,-2);sp.topMargin=dp(8);left.addView(status,sp);
    LinearLayout actions=new LinearLayout(this);LinearLayout.LayoutParams ap=new LinearLayout.LayoutParams(-1,-2);ap.topMargin=dp(35);left.addView(actions,ap);
    button("Get new code",actions,()->startPair());
    button("Use email login",actions,()->{finish();});
    LinearLayout right=new LinearLayout(this);right.setGravity(Gravity.CENTER);right.setPadding(dp(24),dp(24),dp(24),dp(24));
    right.setBackground(fill(Color.WHITE,22));
    LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(dp(345),dp(345));rp.leftMargin=dp(30);whole.addView(right,rp);
    qr=new ImageView(this);qr.setScaleType(ImageView.ScaleType.FIT_CENTER);right.addView(qr,new LinearLayout.LayoutParams(-1,-1));
    startPair();
  }
  private JSONObject api(String path,JSONObject body) throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(SERVER+path).openConnection();
    c.setRequestMethod("POST");c.setConnectTimeout(9000);c.setReadTimeout(9000);
    c.setRequestProperty("Accept","application/json");c.setRequestProperty("Content-Type","application/json");
    c.setDoOutput(true);
    byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
    try(OutputStream out=c.getOutputStream()){out.write(bytes);}
    int statusCode=c.getResponseCode();
    ByteArrayOutputStream output=new ByteArrayOutputStream();
    try(InputStream in=statusCode>=400?c.getErrorStream():c.getInputStream()){
      if(in!=null){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(output.size()+n>30000)break;output.write(b,0,n);}}
    }finally{c.disconnect();}
    JSONObject result=new JSONObject(output.toString("UTF-8"));
    if(statusCode<200||statusCode>=300)throw new IOException(result.optString("error","Server response "+statusCode));
    return result;
  }
  private Bitmap makeQR(String url) throws Exception{
    BitMatrix matrix=new MultiFormatWriter().encode(url,BarcodeFormat.QR_CODE,500,500);
    Bitmap bmp=Bitmap.createBitmap(500,500,Bitmap.Config.ARGB_8888);
    int[] pixels=new int[250000];
    for(int y=0;y<500;y++)for(int x=0;x<500;x++)pixels[y*500+x]=matrix.get(x,y)?Color.BLACK:Color.WHITE;
    bmp.setPixels(pixels,0,500,0,0,500,500);return bmp;
  }
  private void startPair(){
    active=false;checking=false;handler.removeCallbacks(poll);
    pair=null;secret=null;qr.setImageDrawable(null);
    status.setText("Creating a secure pairing code…");codeText.setText("··· ···");active=true;
    new Thread(()->{
      try{
        JSONObject data=api("/tv-pair/start",new JSONObject());
        Bitmap image=makeQR(data.getString("url"));
        handler.post(()->{if(!active)return;
          pair=data.optString("pair");secret=data.optString("deviceSecret");
          expiresAt=data.optLong("expiresAt");
          String code=data.optString("code");codeText.setText(code.substring(0,3)+" "+code.substring(3));
          qr.setImageBitmap(image);
          status.setText("Waiting for approval  •  Code expires in 5 minutes");
          handler.postDelayed(poll,2600);
        });
      }catch(Exception e){handler.post(()->{if(active)status.setText("Pairing unavailable: "+e.getMessage());});}
    }).start();
  }
  private void checkStatus(){
    if(!active||checking||pair==null)return;
    if(System.currentTimeMillis()>expiresAt){status.setText("This code has expired. Select Get new code.");return;}
    checking=true;
    final String id=pair,key=secret;
    new Thread(()->{
      try{
        JSONObject input=new JSONObject();input.put("pair",id);input.put("deviceSecret",key);
        JSONObject answer=api("/tv-pair/status",input);
        handler.post(()->{
          checking=false;if(!active||!id.equals(pair))return;
          if("approved".equals(answer.optString("status"))){
            status.setText("Approved! Signing you in…");
            TvFirebase.auth(this).signInWithCustomToken(answer.optString("customToken"))
              .addOnCompleteListener(this,result->{
                if(!active)return;
                if(result.isSuccessful()){status.setText("TV linked successfully");setResult(RESULT_OK);handler.postDelayed(this::finish,700);}
                else status.setText("Approval received but Firebase sign-in failed. Request a new code.");
              });
          }else if("pending".equals(answer.optString("status"))){handler.postDelayed(poll,2800);}
          else status.setText("Pairing expired or already used. Select Get new code.");
        });
      }catch(Exception error){handler.post(()->{
        checking=false;if(!active||!id.equals(pair))return;
        if(System.currentTimeMillis()>expiresAt)status.setText("Code expired. Get a new code.");
        else{status.setText("Waiting for server…");handler.postDelayed(poll,4800);}
      });}
    }).start();
  }
  @Override protected void onDestroy(){active=false;handler.removeCallbacks(poll);super.onDestroy();}
}
