import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // For Firestore database
import { getStorage } from "firebase/storage"; // For Firebase Storage

const firebaseConfig = {
    apiKey: "AIzaSyB_hM9iRQm3ABZZhbb7oWEWxYAOXiTyxPA",
    authDomain: "g-waste-reactn.firebaseapp.com",
    projectId: "g-waste-reactn",
    storageBucket: "g-waste-reactn.appspot.com",
    messagingSenderId: "9061563077",
    appId: "1:9061563077:web:2f46f9e5d2ced94286ceac"
  };
  
  const app = initializeApp(firebaseConfig);
  export const auth = getAuth(app);
  export const db = getFirestore(app); 
  export const storage = getStorage(app, 'gs://g-waste-reactn.appspot.com'); // Pin bucket