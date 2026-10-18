package uk.co.miraculoushub.tv;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

public class AccountActivity extends Activity {
  private FirebaseAuth auth;
  private LinearLayout content;
  private EditText email,password;
  private TextView message;
  private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
  private GradientDrawable panel(int color,int r){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(r));return d;}
  private TextView text(String label,int size,boolean strong){
    TextView t=new TextView(this);t.setText(label);t.setTextColor(Color.WHITE);t.setTextSize(size);
    if(strong)t.setTypeface(null,Typeface.BOLD);return t;
  }
  private void button(String label,int background,Runnable action){
    TextView item=text(label,18,true);item.setGravity(Gravity.CENTER);item.setFocusable(true);item.setClickable(true);
    item.setBackground(panel(background,12));
    LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(310),dp(54));p.bottomMargin=dp(15);content.addView(item,p);
    item.setOnClickListener(v->action.run());
    item.setOnFocusChangeListener((v,focus)->{
      item.setBackground(panel(focus?0xffff376f:background,12));
      item.animate().scaleX(focus?1.045f:1).scaleY(focus?1.045f:1).setDuration(120).start();
    });
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    auth=TvFirebase.auth(this);render();
  }
  private void render(){
    ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(0xff090b12);
    setContentView(scroll);
    content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(dp(68),dp(35),dp(45),dp(45));scroll.addView(content);
    TextView brand=text("MIRACULOUSHUB  •  TV ACCOUNT",14,true);brand.setTextColor(0xffff88ac);content.addView(brand);
    TextView heading=text("Your account",38,true);
    LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,-2);hp.topMargin=dp(20);content.addView(heading,hp);
    FirebaseUser user=auth.getCurrentUser();
    if(user!=null){
      TextView signed=text("Signed in as "+(user.getEmail()==null?"your MiraculousHub account":user.getEmail()),19,false);
      signed.setPadding(0,dp(20),0,dp(26));content.addView(signed);
      button("Sign out",0xff342338,()->{auth.signOut();render();});
      button("Back to TV",0xff22283b,()->finish());
      return;
    }
    TextView intro=text("Use the same email and password as miraculoushub.co.uk. Watching does not require an account.",16,false);
    intro.setTextColor(0xffbac4d6);intro.setPadding(0,dp(15),0,dp(23));content.addView(intro);
    email=new EditText(this);email.setHint("Email address");email.setHintTextColor(0xffa2aabb);email.setTextColor(-1);
    email.setSingleLine(true);email.setInputType(33);email.setTextSize(17);
    email.setBackground(panel(0xff222638,12));email.setPadding(dp(18),0,dp(18),0);
    LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(dp(520),dp(55));ep.bottomMargin=dp(15);content.addView(email,ep);
    password=new EditText(this);password.setHint("Password");password.setHintTextColor(0xffa2aabb);
    password.setTextColor(-1);password.setSingleLine(true);password.setInputType(129);password.setTextSize(17);
    password.setBackground(panel(0xff222638,12));password.setPadding(dp(18),0,dp(18),0);
    LinearLayout.LayoutParams pp=new LinearLayout.LayoutParams(dp(520),dp(55));pp.bottomMargin=dp(13);content.addView(password,pp);
    message=text("",14,false);message.setTextColor(0xffffa4c1);content.addView(message);
    button("Sign in",0xffae2a57,()->authenticate(false));
    button("Create account",0xff283043,()->authenticate(true));
    TextView note=text("Google-only accounts need TV pairing, which isn't enabled yet. Use an email/password account for now.",13,false);
    note.setTextColor(0xffabb2c2);note.setPadding(0,dp(10),0,dp(10));content.addView(note);
    email.requestFocus();
  }
  private void authenticate(boolean create){
    String e=email.getText().toString().trim(),p=password.getText().toString();
    if(e.isEmpty()||p.length()<6){message.setText("Enter your email and a password of at least 6 characters.");return;}
    message.setText("Connecting to Firebase…");
    if(create)auth.createUserWithEmailAndPassword(e,p).addOnCompleteListener(this,r->done(r.isSuccessful(),r.getException()));
    else auth.signInWithEmailAndPassword(e,p).addOnCompleteListener(this,r->done(r.isSuccessful(),r.getException()));
  }
  private void done(boolean successful,Exception problem){
    if(successful)render();
    else message.setText("Sign-in failed: "+(problem==null?"Please try again.":problem.getLocalizedMessage()));
  }
}