import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAuTUKlMxidK6ob3Y6G55wVMG7izTXNzTI",
  authDomain: "sahar-al-abeer-pos.firebaseapp.com",
  projectId: "sahar-al-abeer-pos",
  storageBucket: "sahar-al-abeer-pos.firebasestorage.app",
  messagingSenderId: "733241394315",
  appId: "1:733241394315:web:f1c8267b741901af4fc08e"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
