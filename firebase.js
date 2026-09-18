import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBndazB7-e9QWMkYt2vCA1h_B097k4Wgsg",
  authDomain: "miraculoushub0.firebaseapp.com",
  projectId: "miraculoushub0",
  storageBucket: "miraculoushub0.firebasestorage.app",
  messagingSenderId: "570314503995",
  appId: "1:570314503995:web:80018441d8fb3cecfe291e",
  measurementId: "G-6K9W3X96EY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Keep the same Firebase login on this browser so playback can be
// associated with the same account after a refresh.
const persistenceReady = setPersistence(auth, browserLocalPersistence)
  .catch(err => {
    console.warn("Firebase Auth persistence could not be enabled:", err);
  });

window.MH_FIREBASE = { app, auth, db, provider };

window.MH_FIREBASE_READY = persistenceReady.then(() => true);
window.MH_AUTH_READY = persistenceReady.then(() => new Promise(resolve => {
  onAuthStateChanged(auth, user => {
    window.MH_USER = user || null;
    window.dispatchEvent(
      new CustomEvent("mh-auth-changed", {
        detail: user || null
      })
    );
    resolve(user || null);
  });
});

window.MH_AUTH = {
  async signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },

  async signUp(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  },

  async google() {
    return signInWithPopup(auth, provider);
  },

  async signOut() {
    return signOut(auth);
  },

  user() {
    return auth.currentUser;
  }
};

function userDoc(type, key) {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in required");
  return doc(db, "users", u.uid, type, key);
}

window.MH_CLOUD = {
  async getPlayback(key) {
    const u = auth.currentUser;
    if (!u) return null;
    try {
      const snap = await getDoc(doc(db, "users", u.uid, "playback", key));
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error("Firestore getPlayback failed:", error);
      throw error;
    }
  },

  async savePlayback(key, data) {
    const u = auth.currentUser;
    if (!u) throw new Error("Not signed in");
    try {
      await setDoc(
        doc(db, "users", u.uid, "playback", key),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return true;
    } catch (error) {
      console.error("Firestore savePlayback failed:", error);
      throw error;
    }
  },

  async getFavourite(key) {
    const u = auth.currentUser;
    if (!u) return false;

    return (
      await getDoc(
        doc(db, "users", u.uid, "favourites", key)
      )
    ).exists();
  },

  async setFavourite(key, episode) {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");

    const ref = doc(
      db,
      "users",
      u.uid,
      "favourites",
      key
    );

    const snap = await getDoc(ref);

    if (snap.exists()) {
      await deleteDoc(ref);
      return false;
    }

    await setDoc(ref, {
      ...episode,
      addedAt: serverTimestamp()
    });

    return true;
  },

  async markWatched(key, episode) {
    const u = auth.currentUser;
    if (!u) return;

    await setDoc(
      doc(db, "users", u.uid, "watched", key),
      {
        ...episode,
        watched: true,
        watchedAt: serverTimestamp()
      },
      { merge: true }
    );
  },

  async getWatched(key) {
    const u = auth.currentUser;
    if (!u) return false;

    return (
      await getDoc(
        doc(db, "users", u.uid, "watched", key)
      )
    ).exists();
  },

  async getAllPlayback() {
    const u = auth.currentUser;
    if (!u) return [];

    const snap = await getDocs(
      collection(db, "users", u.uid, "playback")
    );

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  },

  async getAllWatched() {
    const u = auth.currentUser;
    if (!u) return [];

    const snap = await getDocs(
      collection(db, "users", u.uid, "watched")
    );

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  },

  async getAllFavourites() {
    const u = auth.currentUser;
    if (!u) return [];

    const snap = await getDocs(
      collection(db, "users", u.uid, "favourites")
    );

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  }
};
