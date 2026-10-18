package uk.co.miraculoushub.tv;

import android.content.Context;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

/** Same Firebase project as the website. Authentication state is managed by the Firebase SDK. */
public final class TvFirebase {
  private static FirebaseApp app;
  private TvFirebase(){}
  public static synchronized FirebaseApp getApp(Context context){
    if(app==null){
      for(FirebaseApp known: FirebaseApp.getApps(context)){
        if("miraculoushub-tv".equals(known.getName())){app=known;break;}
      }
      if(app==null){
        FirebaseOptions options=new FirebaseOptions.Builder()
          .setApplicationId("1:570314503995:android:95a941678498dbe5fe291e")
          .setApiKey("AIzaSyBndazB7-e9QWMkYt2vCA1h_B097k4Wgsg")
          .setProjectId("miraculoushub0")
          .setGcmSenderId("570314503995")
          .build();
        app=FirebaseApp.initializeApp(context.getApplicationContext(),options,"miraculoushub-tv");
      }
    }
    return app;
  }
  public static FirebaseAuth auth(Context context){return FirebaseAuth.getInstance(getApp(context));}
  public static FirebaseFirestore database(Context context){return FirebaseFirestore.getInstance(getApp(context));}
}