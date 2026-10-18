package uk.co.miraculoushub.phone;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.WindowManager;
import android.view.Gravity;
import android.widget.*;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

public class AccountActivity extends Activity {
  private static final int GOOGLE_REQUEST=416;
  private static final int WEBSITE_REQUEST=417;
  private FirebaseAuth auth;
  private GoogleSignInClient google;
  private EditText email,password;
  private TextView feedback;
  private LinearLayout root;
  private int dp(int n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
  private GradientDrawable shape(int c,int r){GradientDrawable d=new GradientDrawable();d.setColor(c);d.setCornerRadius(dp(r));return d;}
  private TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(-1);if(bold)t.setTypeface(null,Typeface.BOLD);return t;}
  @Override public void onCreate(Bundle b){
    super.onCreate(b);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);getWindow().setStatusBarColor(0xff05070c);getWindow().setNavigationBarColor(0xff100e18);
    auth=FirebaseAuth.getInstance();
    GoogleSignInOptions options=new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
      .requestIdToken(getString(R.string.default_web_client_id)).requestEmail().build();
    google=GoogleSignIn.getClient(this,options);
    render();
  }
  private void button(String label,int color,Runnable action){
    TextView v=text(label,16,true);v.setGravity(Gravity.CENTER);v.setBackground(shape(color,16));if(label.equals("Continue with Google")){v.setText("G    Continue with Google");v.setTextColor(0xff182236);}
    LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(54));lp.bottomMargin=dp(12);
    root.addView(v,lp);v.setOnClickListener(w->action.run());
  }
  private void render(){
    ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xff05070c);setContentView(scroll);
    root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(dp(24),dp(32),dp(24),dp(28));scroll.addView(root);
    TextView label=text("MIRACULOUSHUB",15,true);label.setTextColor(0xffff538c);root.addView(label);
    TextView title=text("Your account",32,true);title.setPadding(0,dp(16),0,dp(10));root.addView(title);
    TextView subtitle=text("Sign in to sync your watch history and account. Watching videos never requires an account.",14,false);
    subtitle.setTextColor(0xffc5b7cf);subtitle.setPadding(0,0,0,dp(26));root.addView(subtitle);
    FirebaseUser user=auth.getCurrentUser();
    if(user!=null){
      TextView signed=text("Signed in as\\n"+(user.getEmail()!=null?user.getEmail():"Google account"),18,true);
      signed.setPadding(dp(16),dp(18),dp(16),dp(22));signed.setBackground(shape(0xff171b2b,18));root.addView(signed);
      button("Sign out",0xff603450,()->auth.signOut());
      // Re-render after sign-out; FirebaseAuth is the source of truth.
      root.getChildAt(root.getChildCount()-1).setOnClickListener(v->{
        auth.signOut();google.signOut();render();
      });
      return;
    }
    button("Continue with Google",0xfff8f9ff,()->{
      google.signOut().addOnCompleteListener(task->startActivityForResult(google.getSignInIntent(),GOOGLE_REQUEST));
    });
    button("Sign in through MiraculousHub website",0xff302541,()->{
      startActivityForResult(new Intent(this,WebsiteSignInActivity.class),WEBSITE_REQUEST);
    });
    TextView webHint=text("If Android Google sign-in fails, use the same Google account on our website to link this app securely.",12,false);
    webHint.setTextColor(0xffb6bfd0);webHint.setPadding(0,dp(2),0,dp(20));root.addView(webHint);
    TextView sep=text("or sign in with email",13,false);sep.setGravity(Gravity.CENTER);sep.setTextColor(0xffb5a3bb);
    sep.setPadding(0,dp(8),0,dp(18));root.addView(sep);
    email=new EditText(this);email.setTextColor(-1);email.setHintTextColor(0xffa9a0af);email.setSingleLine();
    email.setHint("Email address");email.setInputType(33);email.setBackground(shape(0xff171b2b,14));
    email.setPadding(dp(14),dp(10),dp(14),dp(10));root.addView(email,new LinearLayout.LayoutParams(-1,dp(56)));
    password=new EditText(this);password.setTextColor(-1);password.setHintTextColor(0xffa9a0af);password.setSingleLine();
    password.setHint("Password");password.setInputType(129);password.setBackground(shape(0xff2a2236,14));
    password.setPadding(dp(14),dp(10),dp(14),dp(10));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(56));
    p.topMargin=dp(12);root.addView(password,p);
    feedback=text("",13,false);feedback.setTextColor(0xffffb2cc);feedback.setPadding(0,dp(8),0,dp(10));root.addView(feedback);
    button("Sign in",0xffe83e78,()->emailAuth(false));
    button("Create account",0xff44314f,()->emailAuth(true));
  }
  private void emailAuth(boolean create){
    String address=email.getText().toString().trim(),secret=password.getText().toString();
    if(address.isEmpty()||secret.length()<6){feedback.setText("Enter your email and a password of at least 6 characters.");return;}
    feedback.setText("Signing in…");
    if(create)auth.createUserWithEmailAndPassword(address,secret).addOnCompleteListener(this,t->authFinished(t));
    else auth.signInWithEmailAndPassword(address,secret).addOnCompleteListener(this,t->authFinished(t));
  }
  private void authFinished(Task<?> task){
    if(task.isSuccessful())render();
    else if(feedback!=null)feedback.setText("Sign-in failed: "+(task.getException()!=null?task.getException().getLocalizedMessage():"Please try again."));
  }
  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
    super.onActivityResult(requestCode,resultCode,data);
    if(requestCode==WEBSITE_REQUEST){
      if(resultCode==RESULT_OK&&auth.getCurrentUser()!=null)render();
      return;
    }
    if(requestCode!=GOOGLE_REQUEST)return;
    try{
      GoogleSignInAccount account=GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException.class);
      if(account==null||account.getIdToken()==null)throw new Exception("Google did not return a sign-in token.");
      auth.signInWithCredential(GoogleAuthProvider.getCredential(account.getIdToken(),null))
        .addOnCompleteListener(this,t->authFinished(t));
    }catch(Exception e){if(feedback!=null){if(e instanceof ApiException&&((ApiException)e).getStatusCode()==10)feedback.setText("Android Google sign-in returned error 10 (DEVELOPER_ERROR). The SHA-1 is already registered in Firebase, so please try the website sign-in option above. App build: "+BuildConfig.VERSION_NAME+"; web OAuth configuration or Google Play services may still require checking.");else feedback.setText("Google sign-in unavailable: "+e.getMessage());}}
  }
}
