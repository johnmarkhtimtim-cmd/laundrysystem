// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBs0iONLG0DXfwrp0LdJ5ZHcsdFJ1SuKhc",
  authDomain: "laundry-system-7fa65.firebaseapp.com",
  projectId: "laundry-system-7fa65",
  storageBucket: "laundry-system-7fa65.firebasestorage.app",
  messagingSenderId: "447068076184",
  appId: "1:447068076184:web:19878c817f2ad7bef238ed",
  measurementId: "G-9EPXVF3Z1T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Fail faster instead of hanging on blocked/misconfigured Storage uploads
storage.maxOperationRetryTime = 20000;
storage.maxUploadRetryTime = 20000;