package uk.co.miraculoushub.phone;
import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class AccountActivity extends Activity {
  private static final String API_KEY="AIzaSyBndazB7-e9QWMkYt2vCA1h_B097k4Wgsg";
  private EditText email, password;
  private TextView feedback, heading;
  private LinearLayout root;
  int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
  GradientDrawable shape(int col){GradientDrawable d=new GradientDrawable();d.setColor(col);d.setCornerRadius(dp(15));return d;}
  TextView text(String value,int size,boolean bold){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(-1);if(bold)t.setTypeface(null,Typeface.BOLD);return t;}
  @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(0xff120d20);render();}
  private void render(){
    ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xff120d20);setContentView(scroll);
    root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(25),dp(55),dp(25),dp(24));scroll.addView(root);
    heading=text("YOUR MIRACULOUSHUB ACCOUNT",27,true);heading.setTextColor(0xffff5285);root.addView(heading);
    TextView description=text("Sign in with the same email and password you use on the website.",15,false);description.setPadding(0,dp(12),0,dp(22));root.addView(description);
    if(getPreferences(0).contains("email")){TextView active=text("Signed in as "+getPreferences(0).getString("email",""),17,true);root.addView(active);button("Sign out",()->{getPreferences(0).edit().clear().apply();render();});return;}
    email=new EditText(this);email.setTextColor(-1);email.setHintTextColor(0xffa69eb5);email.setHint("Email address");email.setInputType(33);email.setSingleLine();email.setPadding(dp(14),dp(10),dp(14),dp(10));email.setBackground(shape(0xff2b2339));root.addView(email,new LinearLayout.LayoutParams(-1,dp(55)));
    password=new EditText(this);password.setTextColor(-1);password.setHintTextColor(0xffa69eb5);password.setHint("Password");password.setInputType(129);password.setSingleLine();password.setPadding(dp(14),dp(10),dp(14),dp(10));password.setBackground(shape(0xff2b2339));LinearLayout.LayoutParams pp=new LinearLayout.LayoutParams(-1,dp(55));pp.topMargin=dp(12);root.addView(password,pp);
    feedback=text("",13,false);feedback.setPadding(0,dp(12),0,dp(12));root.addView(feedback);
    button("Sign in",()->sign(false));button("Create account",()->sign(true));
  }
  private void button(String name,Runnable click){TextView v=text(name,17,true);v.setGravity(Gravity.CENTER);v.setBackground(shape(name.equals("Sign in")?0xffe83e78:0xff46304e));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(52));p.bottomMargin=dp(12);root.addView(v,p);v.setOnClickListener(w->click.run());}
  private void sign(boolean create){
    String mail=email.getText().toString().trim(),pass=password.getText().toString();
    if(mail.isEmpty()||pass.length()<6){feedback.setText("Enter an email and password (6+ characters).");return;}
    feedback.setText("Connecting securely…");
    new Thread(()->{try{
      String op=create?"signUp":"signInWithPassword";
      URL url=new URL("https://identitytoolkit.googleapis.com/v1/accounts:"+op+"?key="+API_KEY);
      HttpURLConnection conn=(HttpURLConnection)url.openConnection();conn.setRequestMethod("POST");conn.setDoOutput(true);conn.setConnectTimeout(12000);conn.setReadTimeout(12000);conn.setRequestProperty("Content-Type","application/json");
      byte[] body=new JSONObject().put("email",mail).put("password",pass).put("returnSecureToken",true).toString().getBytes(StandardCharsets.UTF_8);
      try(OutputStream os=conn.getOutputStream()){os.write(body);}
      InputStream stream=conn.getResponseCode()<400?conn.getInputStream():conn.getErrorStream();
      ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=stream){byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1&&out.size()<30000)out.write(buf,0,n);}
      JSONObject json=new JSONObject(out.toString("UTF-8"));if(conn.getResponseCode()>=400){String err=json.optJSONObject("error")!=null?json.getJSONObject("error").optString("message"):"Sign in failed";throw new IOException(err.replace('_',' '));}
      getPreferences(0).edit().putString("email",mail).putString("uid",json.getString("localId")).putString("refreshToken",json.getString("refreshToken")).putString("idToken",json.getString("idToken")).apply();
      runOnUiThread(this::render);
    }catch(Exception ex){runOnUiThread(()->feedback.setText("Could not sign in: "+ex.getMessage()));}}).start();
  }
}