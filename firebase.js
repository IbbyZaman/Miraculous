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
          await fsMod.setDoc(userRef("playback", key), {
            ...data,
            updatedAt: fsMod.serverTimestamp()
          }, { merge: true });
          return true;
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
          const u = auth.currentUser;
          if (!u) return [];
          const snap = await fsMod.getDocs(fsMod.collection(db, "users", u.uid, "playback"));
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        async addComment(episodeKey, text) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          const clean = String(text || "").trim().slice(0, 500);
          if (!clean) throw new Error("Comment cannot be empty");
          return fsMod.addDoc(fsMod.collection(db, "comments"), {
            episodeKey, text: clean, authorUid: u.uid,
            authorName: (u.displayName || u.email || "User").slice(0, 60),
            createdAt: fsMod.serverTimestamp()
          });
        },
        async deleteComment(commentId) {
          const u = auth.currentUser;
          if (!u) throw new Error("Sign in required");
          await fsMod.deleteDoc(fsMod.doc(db, "comments", commentId));
        },
        subscribeComments(episodeKey, callback) {
          const q = fsMod.query(fsMod.collection(db, "comments"), fsMod.where("episodeKey", "==", episodeKey));
          return fsMod.onSnapshot(q, snap => {
            const items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
            items.sort((a,b) => (a.createdAt?.toMillis?.()||0) - (b.createdAt?.toMillis?.()||0));
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
