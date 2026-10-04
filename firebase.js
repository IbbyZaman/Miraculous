(function () {
  const FIREBASE_VERSION = "11.10.0";
  const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

  const config = {
    apiKey: "AIzaSyBndazB7-e9QWMkYt2vCA1h_B097k4Wgsg",
    authDomain: "miraculoushub0.firebaseapp.com",
    projectId: "miraculoushub0",
    storageBucket: "miraculoushub0.firebasestorage.app",
    messagingSenderId: "570314503995",
    appId: "1:570314503995:web:80018441d8fb3cecfe291e",
    measurementId: "G-6K9W3X96EY"
  };

  // Classic-script loader: this avoids the race that was causing the
  // sign-in button to see an undefined Firebase API.
  window.MH_FIREBASE_READY = (async function () {
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${BASE}/firebase-app.js`),
        import(`${BASE}/firebase-auth.js`),
        import(`${BASE}/firebase-firestore.js`)
      ]);

      // Firestore retries quota-exhausted writes internally; its setDoc
      // promise can stay pending. Surface SDK errors as well as rejections.
      function playbackStatus(state,error=null){
        window.MH_PLAYBACK_CLOUD_ERROR=error;
        window.dispatchEvent(new CustomEvent("mh-cloud-playback-status",{
          detail:{state,code:error?.code || null,message:error?.message || ""}
        }));
      }
      appMod.onLog?.(entry=>{
        if(/resource-exhausted|quota exceeded/i.test(entry.message || "")){
          const error=Object.assign(new Error("Firestore quota exceeded"),{code:"resource-exhausted"});
          if(window.MH_PLAYBACK_CLOUD_ERROR?.code!==error.code) playbackStatus("quota",error);
        }
      },{level:"error"});
      const playbackLists=new Map();
      const app = appMod.initializeApp(config);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      const provider = new authMod.GoogleAuthProvider();

      try {
        await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      } catch (e) {
        console.warn("Firebase persistence unavailable:", e);
      }

      window.MH_FIREBASE = { app, auth, db, provider };

      window.MH_AUTH = {
        signIn: (email, password) =>
          authMod.signInWithEmailAndPassword(auth, email, password),
        signUp: (email, password) =>
          authMod.createUserWithEmailAndPassword(auth, email, password),
        google: () => authMod.signInWithPopup(auth, provider),
        signOut: () => authMod.signOut(auth),
        user: () => auth.currentUser
      };

      // Wait for Firebase to finish restoring the existing session.
      window.MH_AUTH_READY = new Promise(resolve => {
        let resolved = false;
        authMod.onAuthStateChanged(auth, user => {
          window.MH_USER = user || null;
          window.dispatchEvent(new CustomEvent("mh-auth-changed", {
            detail: user || null
          }));
          if (!resolved) {
            resolved = true;
            resolve(user || null);
          }
        });
      });

      function userRef(type, key) {
        const u = auth.currentUser;
        if (!u) throw new Error("Sign in required");
        return fsMod.doc(db, "users", u.uid, type, key);
      }

      function normalisePlaybackSnapshot(snap){
        return snap.docs.map(d=>{
                const data=d.data() || {};
                const normal=/^s(\d+)e(\d+)$/i.exec(d.id);
                const anime=/^anime-([a-z0-9-]+)-e(\d+)$/i.exec(d.id);
                const special=/^special-(\d+)$/i.exec(d.id);
                const animeSlug=data.animeSlug || anime?.[1] || null;
                const season=animeSlug?0:special?"Special":data.season ?? (normal?Number(normal[1]):null);
                const episode=data.episode ?? (anime?Number(anime[2]):special?Number(special[1]):normal?Number(normal[2]):null);
                const show=animeSlug?(window.MH_ANIME_SHOWS || []).find(a=>a.slug===animeSlug):null;
                const known=show?show.episodes?.find(e=>Number(e.episode)===Number(episode)):
                  (window.MH_EPISODES || []).find(e=>Number(e.season)===Number(season)&&Number(e.episode)===Number(episode));
                const rawDuration=Number(data.duration),rawPosition=Number(data.position ?? data.currentTime ?? data.time ?? NaN);
                const duration=Number.isFinite(rawDuration)&&rawDuration>0?rawDuration:0;
                const rawProgress=Number(data.progress);
                const position=Number.isFinite(rawPosition)&&rawPosition>=0?rawPosition:
                  Number.isFinite(rawProgress)&&duration>0?Math.max(0,rawProgress/100*duration):0;
                const progress=duration>0?Math.min(100,position/duration*100):
                  Number.isFinite(rawProgress)?Math.max(0,Math.min(100,rawProgress)):0;
                return {...data,id:d.id,season,episode,animeSlug,animeTitle:show?.title || data.animeTitle || null,
                  type:animeSlug?"anime":special?"special":data.type || "episode",title:data.title || known?.title || "Episode",
                  position,duration,progress,pendingCloud:!!d.metadata?.hasPendingWrites};
              });
      }

      window.MH_CLOUD = {
        async getPlayback(key) {
          const u = auth.currentUser;
          if (!u) return null;
          const snap = await fsMod.getDoc(userRef("playback", key));
          return snap.exists() ? snap.data() : null;
        },
        async savePlayback(key, data) {
          const u = auth.currentUser;
          if (!u) throw new Error("Not signed in");
          // Device-only state is never uploaded as a confirmed cloud field.
          const {pendingCloud,...playback}=data;
          const timer=setTimeout(()=>{
            if(auth.currentUser?.uid===u.uid && !window.MH_PLAYBACK_CLOUD_ERROR){
              playbackStatus("pending",Object.assign(new Error("Waiting for Firestore; check connection or browser blocking"),{code:"unavailable"}));
            }
          },10000);
          try{
            await fsMod.setDoc(userRef("playback", key), {
              ...playback,updatedAt:fsMod.serverTimestamp()
            },{merge:true});
            playbackLists.delete(u.uid);
            if(auth.currentUser?.uid===u.uid) playbackStatus("synced");
            return true;
          }catch(error){
            if(auth.currentUser?.uid===u.uid) playbackStatus(error?.code==="resource-exhausted"?"quota":"error",error);
            throw error;
          }finally{clearTimeout(timer);}
        },
        async getFavourite(key) {
          const u = auth.currentUser;
          if (!u) return false;
          return (await fsMod.getDoc(userRef("favourites", key))).exists();
        },
        async setFavourite(key, episode) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          const ref = userRef("favourites", key);
          const snap = await fsMod.getDoc(ref);
          if (snap.exists()) {
            await fsMod.deleteDoc(ref);
            return false;
          }
          await fsMod.setDoc(ref, { ...episode, addedAt: fsMod.serverTimestamp() });
          return true;
        },
        async markWatched(key, episode) {
          const u = auth.currentUser;
          if (!u) return;
          await fsMod.setDoc(userRef("watched", key), {
            ...episode,
            watched: true,
            watchedAt: fsMod.serverTimestamp()
          }, { merge: true });
        },
        async getWatched(key) {
          const u = auth.currentUser;
          if (!u) return false;
          return (await fsMod.getDoc(userRef("watched", key))).exists();
        },
        async getAllPlayback() {
          const u=auth.currentUser;
          if(!u) return [];
          const previous=playbackLists.get(u.uid);
          if(previous && Date.now()<previous.expires) return previous.promise;
          // Auth, pageshow and homepage listeners can request the same list
          // together. Reuse in-flight reads; live listeners deliver ongoing updates.
          const request={expires:Date.now()+1000,promise:null};
          request.promise=(async()=>{
            try{
              const snap=await fsMod.getDocs(fsMod.collection(db,"users",u.uid,"playback"));
              return normalisePlaybackSnapshot(snap);
            }catch(error){
              if(playbackLists.get(u.uid)===request) playbackLists.delete(u.uid);
              throw error;
            }
          })();
          playbackLists.set(u.uid,request);
          return request.promise;
        },
        subscribePlayback(callback){
          const uid=auth.currentUser?.uid;
          if(!uid) return ()=>{};
          return fsMod.onSnapshot(fsMod.collection(db,"users",uid,"playback"),snap=>{
            if(auth.currentUser?.uid!==uid) return;
            const items=normalisePlaybackSnapshot(snap);
            playbackLists.set(uid,{expires:Date.now()+1000,promise:Promise.resolve(items)});
            callback(items);
          },error=>callback(null,error));
        },
        async getAllWatched() {
          const u = auth.currentUser;
          if (!u) return [];
          const snap = await fsMod.getDocs(fsMod.collection(db, "users", u.uid, "watched"));
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },
        async getAllFavourites() {
          const u = auth.currentUser;
          if (!u) return [];
          const snap = await fsMod.getDocs(fsMod.collection(db, "users", u.uid, "favourites"));
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },
        async getNickname() {
          const u = auth.currentUser;
          if (!u) return null;
          const snap = await fsMod.getDoc(userRef("profile", "public"));
          if (!snap.exists()) return null;
          const value = String(snap.data()?.nickname || "").trim();
          return value || null;
        },
        async setNickname(value) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          const nickname = String(value || "").trim().replace(/\s+/g, " ");
          if (nickname.length < 2 || nickname.length > 24) {
            throw new Error("Nickname must be 2–24 characters");
          }
          if (nickname.includes("@")) {
            throw new Error("Please use a nickname, not an email address");
          }
          if (!/^[\p{L}\p{N} _.'-]+$/u.test(nickname)) {
            throw new Error("Nickname contains unsupported characters");
          }
          await fsMod.setDoc(userRef("profile", "public"), {
            nickname,
            updatedAt: fsMod.serverTimestamp()
          }, { merge: true });
          return nickname;
        },
        async addComment(episodeKey, text) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          const clean = String(text || "").trim().slice(0, 500);
          if (!clean) throw new Error("Comment cannot be empty");
          const authorNickname = await window.MH_CLOUD.getNickname();
          if (!authorNickname) {
            const error = new Error("Set a nickname before commenting");
            error.code = "nickname-required";
            throw error;
          }
          return fsMod.addDoc(fsMod.collection(db, "comments"), {
            episodeKey,
            text: clean,
            authorUid: u.uid,
            authorNickname,
            createdAt: fsMod.serverTimestamp()
          });
        },
        async deleteComment(commentId) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          await fsMod.deleteDoc(fsMod.doc(db, "comments", commentId));
        },
        async addReport(report) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          const clean = {
            episodeKey: String(report?.episodeKey || "").slice(0, 80),
            episodeTitle: String(report?.episodeTitle || "").slice(0, 120),
            targetType: String(report?.targetType || "episode").slice(0, 20),
            targetId: String(report?.targetId || "").slice(0, 160),
            reason: String(report?.reason || "Other").slice(0, 80),
            details: String(report?.details || "").trim().slice(0, 500)
          };
          if (!clean.episodeKey || !clean.targetType || !clean.reason) throw new Error("Invalid report");
          const reporterNickname = await window.MH_CLOUD.getNickname().catch(() => null);
          return fsMod.addDoc(fsMod.collection(db, "reports"), {
            ...clean,
            reporterUid: u.uid,
            reporterNickname: reporterNickname || "Miraculous Fan",
            status: "new",
            createdAt: fsMod.serverTimestamp()
          });
        },
        subscribeComments(episodeKey, callback) {
          const q = fsMod.query(
            fsMod.collection(db, "comments"),
            fsMod.where("episodeKey", "==", episodeKey)
          );
          return fsMod.onSnapshot(q, snap => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            items.sort((a, b) =>
              (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)
            );
            callback(items);
          }, err => callback(null, err));
        }
      };

      window.MH_FIREBASE_ERROR = null;
      window.dispatchEvent(new Event("mh-firebase-ready"));
      return true;
    } catch (error) {
      window.MH_FIREBASE_ERROR = error;
      console.error("MiraculousHub Firebase failed to initialize:", error);
      window.dispatchEvent(new CustomEvent("mh-firebase-error", { detail: error }));
      throw error;
    }
  })();
})();
