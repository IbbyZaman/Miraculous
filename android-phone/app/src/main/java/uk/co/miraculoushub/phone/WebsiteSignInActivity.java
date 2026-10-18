package uk.co.miraculoushub.phone;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.firebase.auth.FirebaseAuth;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Authorize this Android app through the same Firebase website Google sign-in
 * as the browser, using the existing single-use, short-lived TV pairing API.
 * Google credentials and Firebase ID tokens never leave the browser.
 */
public class WebsiteSignInActivity extends Activity {
  private static final String SERVER="https://upload.miraculoushub.co.uk";
  private static final String TRUSTED_SITE="https://miraculoushub.co.uk/tv-login.html?pair=";
  private final Handler main=new Handler(Looper.getMainLooper());
  private TextView status,code,open;
  private String pair="",deviceSecret="",approvalUrl="";
  private long expiresAt=0;
  private boolean closed=false,busy=false;
  private final Runnable check=new Runnable(){@Override public void run(){poll();}};
  private int dp(int n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
  private GradientDrawable rounded(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(16));return d;}
  private TextView label(String value,int size,boolean bold){
    TextView text=new TextView(this);text.setText(value);text.setTextColor(Color.WHITE);text.setTextSize(size);
    if(bold)text.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return text;
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
    page.setPadding(dp(24),dp(50),dp(24),dp(26));page.setBackgroundColor(0xff090b13);setContentView(page);
    TextView brand=label("MIRACULOUSHUB • SECURE SIGN-IN",13,true);brand.setTextColor(0xffff79a7);page.addView(brand);
    TextView title=label("Continue with your website account",28,true);
    LinearLayout.LayoutParams titleP=new LinearLayout.LayoutParams(-1,-2);titleP.topMargin=dp(20);page.addView(title,titleP);
    TextView desc=label("Your website's Google sign-in already works. Open MiraculousHub in your browser, confirm the matching code, then come back here.",16,false);
    desc.setTextColor(0xffbec6d7);LinearLayout.LayoutParams dp=new LinearLayout.LayoutParams(-1,-2);dp.topMargin=dp(18);
    page.addView(desc,dp);
    code=label("··· ···",35,true);code.setLetterSpacing(.15f);code.setGravity(Gravity.CENTER);
    code.setBackground(rounded(0xff20283c));code.setPadding(0,dp(24),0,dp(24));
    LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,-2);cp.topMargin=dp(28);page.addView(code,cp);
    status=label("Creating a secure code…",14,false);status.setTextColor(0xffffacc6);
    LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,-2);sp.topMargin=dp(18);page.addView(status,sp);
    open=label("Open website to approve",17,true);open.setGravity(Gravity.CENTER);
    open.setBackground(rounded(0xffff3671));open.setPadding(dp(12),dp(19),dp(12),dp(19));
    LinearLayout.LayoutParams op=new LinearLayout.LayoutParams(-1,-2);op.topMargin=dp(24);page.addView(open,op);
    open.setEnabled(false);open.setAlpha(.5f);open.setOnClickListener(v->{
      if(approvalUrl.startsWith(TRUSTED_SITE)){
        try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(approvalUrl)));}
        catch(Exception e){status.setText("Couldn't open the browser: "+e.getMessage());}
      }
    });
    TextView repeat=label("Get a new code",16,true);repeat.setGravity(Gravity.CENTER);
    repeat.setPadding(0,dp(24),0,dp(20));page.addView(repeat);
    repeat.setOnClickListener(v->startPair());
    TextView foot=label("Only approve the code displayed on this phone. Codes expire after 5 minutes and cannot be used again.",12,false);
    foot.setTextColor(0xff9ca8bc);page.addView(foot);
    startPair();
  }
  private JSONObject api(String endpoint,JSONObject payload)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(SERVER+endpoint).openConnection();
    c.setRequestMethod("POST");c.setConnectTimeout(9000);c.setReadTimeout(9000);
    c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Accept","application/json");
    c.setUseCaches(false);c.setDoOutput(true);
    byte[] bytes=payload.toString().getBytes(StandardCharsets.UTF_8);
    try(OutputStream output=c.getOutputStream()){output.write(bytes);}
    int response=c.getResponseCode();
    ByteArrayOutputStream data=new ByteArrayOutputStream();
    try(InputStream stream=response>=400?c.getErrorStream():c.getInputStream()){
      if(stream!=null){byte[] buffer=new byte[4096];int n;
        while((n=stream.read(buffer))!=-1){if(data.size()+n>20000)throw new IOException("Response too large");data.write(buffer,0,n);}
      }
    }finally{c.disconnect();}
    JSONObject result=new JSONObject(data.toString("UTF-8"));
    if(response<200||response>=300)throw new IOException(result.optString("error","Server returned "+response));
    return result;
  }
  private void startPair(){
    main.removeCallbacks(check);busy=false;pair="";deviceSecret="";approvalUrl="";expiresAt=0;
    code.setText("··· ···");status.setText("Creating a secure code…");
    open.setEnabled(false);open.setAlpha(.5f);
    new Thread(()->{
      try{
        JSONObject result=api("/tv-pair/start",new JSONObject());
        String id=result.getString("pair"),secret=result.getString("deviceSecret"),digits=result.getString("code");
        String url=result.getString("url");
        if(!id.matches("[0-9a-f]{32}")||!secret.matches("[0-9a-f]{64}")||
          !digits.matches("[0-9]{6}")||!url.equals(TRUSTED_SITE+id))
          throw new SecurityException("Unexpected pairing response");
        main.post(()->{
          if(closed)return;
          pair=id;deviceSecret=secret;approvalUrl=url;expiresAt=result.optLong("expiresAt");
          code.setText(digits.substring(0,3)+" "+digits.substring(3));
          status.setText("Waiting for website approval • This code expires in five minutes");
          open.setEnabled(true);open.setAlpha(1f);main.postDelayed(check,2600);
        });
      }catch(Exception e){main.post(()->{if(!closed)status.setText("Website sign-in unavailable: "+e.getMessage());});}
    }).start();
  }
  private void poll(){
    if(closed||busy||pair.isEmpty())return;
    if(System.currentTimeMillis()>=expiresAt){status.setText("Code expired. Tap Get a new code.");return;}
    busy=true;final String id=pair,secret=deviceSecret;
    new Thread(()->{
      try{
        JSONObject request=new JSONObject();request.put("pair",id);request.put("deviceSecret",secret);
        JSONObject reply=api("/tv-pair/status",request);
        main.post(()->{
          busy=false;if(closed||!id.equals(pair))return;
          if("approved".equals(reply.optString("status"))){
            String token=reply.optString("customToken");
            if(token.isEmpty()){status.setText("Approval received but no sign-in token was returned.");return;}
            status.setText("Approved! Signing into Firebase…");
            FirebaseAuth.getInstance().signInWithCustomToken(token)
              .addOnCompleteListener(this,result->{
                if(result.isSuccessful()){setResult(RESULT_OK);finish();}
                else status.setText("Firebase couldn't finish sign-in: "+
                  (result.getException()==null?"Unknown error":result.getException().getLocalizedMessage()));
              });
          }else if("pending".equals(reply.optString("status"))){main.postDelayed(check,2800);}
          else status.setText("Pairing expired. Tap Get a new code.");
        });
      }catch(Exception e){main.post(()->{
        busy=false;if(closed||!id.equals(pair))return;
        if(System.currentTimeMillis()>=expiresAt)status.setText("Code expired. Tap Get a new code.");
        else{status.setText("Waiting for approval…");main.postDelayed(check,4500);}
      });}
    }).start();
  }
  @Override protected void onResume(){super.onResume();if(!pair.isEmpty()&&System.currentTimeMillis()<expiresAt)main.post(check);}
  @Override protected void onDestroy(){closed=true;main.removeCallbacks(check);super.onDestroy();}
}
