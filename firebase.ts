// firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebaseコンソールの「プロジェクトの設定」＞「マイアプリ」からコピーした値を貼り付けます
const firebaseConfig = {
  apiKey: "AIzaSyB7TaNBPaxm7jS0LWb23XELpluVLvaNXMg",
  authDomain: "scanner-e7e1f.firebaseapp.com",
  projectId: "scanner-e7e1f",
  storageBucket: "scanner-e7e1f.firebasestorage.app",
  messagingSenderId: "877450655966",
  appId: "1:877450655966:web:82914b45a98bfb74e6ea4f",
  measurementId: "G-NHBXVDML2W"
};

// Next.jsのSSR（サーバーサイドレンダリング）対策を含めた初期化
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };